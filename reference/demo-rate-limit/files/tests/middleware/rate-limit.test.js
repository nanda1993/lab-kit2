import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rateLimit } from '../../src/middleware/rate-limit.js';
import { createRedisClient } from '../../src/lib/redis.js';
import { createTestLogger } from '../helpers/fakes.js';

function setup({ maxRequests = 3, windowSeconds = 60, redis } = {}) {
  let clock = 0;
  const deps = {
    redis: redis ?? createRedisClient({ now: () => clock }),
    logger: createTestLogger(),
  };
  const limiter = rateLimit({ ...deps, name: 'dispatch', maxRequests, windowSeconds });
  const call = async apiKey => {
    let passed = false;
    await limiter({ apiKey, path: '/notifications/dispatch' }, {}, () => { passed = true; });
    return passed;
  };
  return { ...deps, call, advance: ms => { clock += ms; } };
}

test('allows requests up to the maximum', async () => {
  const { call } = setup();
  for (let i = 0; i < 3; i++) assert.equal(await call('k1'), true);
});

test('blocks the request over the maximum with RATE_LIMITED and retryAfterSeconds', async () => {
  const { call, advance } = setup();
  for (let i = 0; i < 3; i++) await call('k1');
  advance(15_000);
  await assert.rejects(call('k1'), err => {
    assert.equal(err.code, 'RATE_LIMITED');
    assert.equal(err.status, 429);
    assert.equal(err.details.retryAfterSeconds, 45);
    return true;
  });
});

test('starts a new window once the old one expires', async () => {
  const { call, advance } = setup();
  for (let i = 0; i < 3; i++) await call('k1');
  await assert.rejects(call('k1'));
  advance(61_000);
  assert.equal(await call('k1'), true);
});

test('counts each API key separately', async () => {
  const { call } = setup({ maxRequests: 1 });
  assert.equal(await call('k1'), true);
  assert.equal(await call('k2'), true);
  await assert.rejects(call('k1'));
});

test('repairs a counter that has no expiry', async () => {
  const { call, redis } = setup({ maxRequests: 1 });
  await redis.incr('ratelimit:dispatch:k1'); // crash between incr and expire
  await assert.rejects(call('k1'), err => err.code === 'RATE_LIMITED');
  assert.equal(await redis.ttl('ratelimit:dispatch:k1'), 60);
});

test('lets the request through and warns when Redis fails', async () => {
  const broken = { incr: async () => { throw new Error('connection refused'); } };
  const { call, logger } = setup({ redis: broken });
  assert.equal(await call('k1'), true);
  assert.equal(logger.lines[0].level, 'warn');
});
