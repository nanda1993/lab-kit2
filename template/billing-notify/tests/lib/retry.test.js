import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from '../../src/lib/retry.js';
import { AppError } from '../../src/lib/app-error.js';
import { createFakeSleep, createTestLogger } from '../helpers/fakes.js';

test('retries a retryable error with exponential backoff, then succeeds', async () => {
  const sleep = createFakeSleep();
  let calls = 0;
  const result = await withRetry(async () => {
    calls += 1;
    if (calls < 3) throw new AppError('PROVIDER_UNAVAILABLE', 'down', { retryable: true });
    return 'ok';
  }, { attempts: 3, baseDelayMs: 100 }, { sleep, logger: createTestLogger() });
  assert.equal(result, 'ok');
  assert.deepEqual(sleep.calls, [100, 200]);
});

test('does not retry a permanent error', async () => {
  const sleep = createFakeSleep();
  let calls = 0;
  await assert.rejects(withRetry(async () => {
    calls += 1;
    throw new AppError('PROVIDER_REJECTED', 'no');
  }, { attempts: 3, baseDelayMs: 100 }, { sleep }), { code: 'PROVIDER_REJECTED' });
  assert.equal(calls, 1);
  assert.deepEqual(sleep.calls, []);
});

test('gives up after the configured number of attempts', async () => {
  const sleep = createFakeSleep();
  let calls = 0;
  await assert.rejects(withRetry(async () => {
    calls += 1;
    throw new AppError('PROVIDER_UNAVAILABLE', 'down', { retryable: true });
  }, { attempts: 2, baseDelayMs: 50 }, { sleep }), { code: 'PROVIDER_UNAVAILABLE' });
  assert.equal(calls, 2);
});
