import { createApp } from './lib/http.js';
import { createLogger } from './lib/logger.js';
import { redis as defaultRedis } from './lib/redis.js';
import { createStore } from './lib/store.js';
import { createProviders } from './providers/index.js';
import { createDispatchService } from './services/dispatch.service.js';
import { requireApiKey } from './middleware/api-key.js';
import { rateLimit } from './middleware/rate-limit.js';
import { errorHandler } from './middleware/error-handler.js';
import { registerNotificationRoutes } from './routes/notifications.routes.js';
import { config } from '../config/index.js';

// Builds the app with its dependencies. Tests pass their own (see tests/helpers/fakes.js).
export function buildApp(deps = {}) {
  const logger = deps.logger ?? createLogger({ level: config.logLevel });
  const providers = deps.providers ?? createProviders();
  const redis = deps.redis ?? defaultRedis;
  const store = deps.store ?? createStore();
  const sleep = deps.sleep;

  const dispatchService = createDispatchService({ providers, logger, redis, store, sleep });

  const app = createApp();
  app.get('/health', (req, res) => res.json({ ok: true }));
  app.use(requireApiKey(deps.apiKeys ?? config.apiKeys));
  const dispatchLimit = rateLimit({ redis, logger, name: 'dispatch', ...(deps.limits ?? config.limits.dispatch) });
  registerNotificationRoutes(app, { dispatchService, rateLimit: dispatchLimit });
  app.use(errorHandler({ logger }));
  return app;
}
