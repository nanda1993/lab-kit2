import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRedisClient } from '../../src/lib/redis.js';

test('SET NX only sets a key once until it expires', async () => {
  let clock = 0;
  const redis = createRedisClient({ now: () => clock });
  assert.equal(await redis.set('k', '1', 'EX', 10, 'NX'), 'OK');
  assert.equal(await redis.set('k', '1', 'EX', 10, 'NX'), null);
  clock = 11_000;
  assert.equal(await redis.set('k', '1', 'EX', 10, 'NX'), 'OK');
});

test('INCR with EXPIRE and TTL behave like Redis', async () => {
  let clock = 0;
  const redis = createRedisClient({ now: () => clock });
  assert.equal(await redis.incr('c'), 1);
  assert.equal(await redis.incr('c'), 2);
  assert.equal(await redis.ttl('c'), -1);
  await redis.expire('c', 60);
  clock = 15_000;
  assert.equal(await redis.ttl('c'), 45);
  clock = 61_000;
  assert.equal(await redis.get('c'), null);
});
