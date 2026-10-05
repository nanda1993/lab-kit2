// Config is the only place in the service that reads process.env. Everything else imports `config`.
import { channels } from './channels.js';
import { limits } from './limits.js';

const env = process.env;

export const config = Object.freeze({
  port: Number(env.PORT ?? 3000),
  logLevel: env.LOG_LEVEL ?? 'info',
  apiKeys: (env.API_KEYS ?? 'dev-key-billing,dev-key-collections').split(',').map(k => k.trim()),
  dedupeTtlSeconds: 600,
  channels,
  limits,
});
