// Shared test doubles. Tests never use real timers or the real logger output.
import { createProviders } from '../../src/providers/index.js';
import { createRedisClient } from '../../src/lib/redis.js';
import { createStore } from '../../src/lib/store.js';

// Logger that records instead of printing, so tests can assert on what was logged.
export function createTestLogger() {
  const lines = [];
  const log = level => (msg, fields = {}) => lines.push({ level, msg, ...fields });
  return { lines, debug: log('debug'), info: log('info'), warn: log('warn'), error: log('error') };
}

// Records the delays withRetry asked for, without waiting.
export function createFakeSleep() {
  const calls = [];
  const sleep = async ms => { calls.push(ms); };
  sleep.calls = calls;
  return sleep;
}

export function createTestDeps(overrides = {}) {
  return {
    providers: createProviders(),
    logger: createTestLogger(),
    redis: createRedisClient(),
    store: createStore(),
    sleep: createFakeSleep(),
    apiKeys: ['test-key'],
    ...overrides,
  };
}
