import { createServer } from 'node:http';
import { buildApp } from './app.js';
import { createLogger } from './lib/logger.js';
import { config } from '../config/index.js';

const logger = createLogger({ level: config.logLevel });
const app = buildApp({ logger });

createServer((req, res) => app.handle(req, res)).listen(config.port, () => {
  logger.info('billing-notify listening', { port: config.port });
});
