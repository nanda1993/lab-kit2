import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../../src/middleware/rate-limit.js';
import { createRedisClient } from '../../src/lib/redis.js';
import { createTestLogger } from '../helpers/fakes.js';

function setup({ maxRequests = 3, windowSeconds = 60, redis } = {}) {
  const clock = { ms: 0 };
  const client = redis ?? createRedisClient({ now: () => clock.ms });
  const logger = createTestLogger();
  const limiter = rateLimit({ redis: client, logger, name: 'dispatch', maxRequests, windowSeconds });
  const call = async apiKey => {
    let passed = false;
    await limiter({ apiKey, path: '/notifications/dispatch' }, {}, () => { passed = true; });
    return passed;
  };
  return { clock, client, logger, call };
}

test('allows requests up to the max', async () => {
  const { call } = setup();
  for (let i = 0; i < 3; i++) assert.equal(await call('key-a'), true);
});

test('blocks request max+1 with RATE_LIMITED and the remaining window as retryAfterSeconds', async () => {
  const { call, clock } = setup();
  for (let i = 0; i < 3; i++) await call('key-a');
  clock.ms = 20_000;
  await assert.rejects(() => call('key-a'), err => {
    assert.equal(err.code, 'RATE_LIMITED');
    assert.equal(err.status, 429);
    assert.equal(err.details.retryAfterSeconds, 40);
    return true;
  });
});

test('the window resets after it expires', async () => {
  const { call, clock } = setup();
  for (let i = 0; i < 3; i++) await call('key-a');
  await assert.rejects(() => call('key-a'));
  clock.ms = 61_000;
  assert.equal(await call('key-a'), true);
});

test('each API key has its own counter', async () => {
  const { call } = setup({ maxRequests: 1 });
  assert.equal(await call('key-a'), true);
  assert.equal(await call('key-b'), true);
  await assert.rejects(() => call('key-a'));
});

test('sets an expiry on a counter that has none', async () => {
  const { call, client } = setup();
  await client.incr('ratelimit:dispatch:key-a'); // as if we crashed before expire
  assert.equal(await call('key-a'), true);
  assert.equal(await client.ttl('ratelimit:dispatch:key-a'), 60);
});

test('lets the request through and logs a warning when Redis fails', async () => {
  const broken = { incr: async () => { throw new Error('connection refused'); } };
  const { call, logger } = setup({ redis: broken });
  assert.equal(await call('key-a'), true);
  assert.equal(logger.lines.at(-1).level, 'warn');
});

test('does not log the raw API key', async () => {
  const { call, logger } = setup({ maxRequests: 1 });
  await call('secret-key');
  await assert.rejects(() => call('secret-key'));
  assert.ok(!JSON.stringify(logger.lines).includes('secret-key'));
});
