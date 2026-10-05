import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError, isAppError } from '../../src/lib/app-error.js';

test('AppError takes its HTTP status from the error code', () => {
  const err = new AppError('INVALID_RECIPIENT', 'bad address');
  assert.equal(err.status, 400);
  assert.equal(err.retryable, false);
  assert.ok(isAppError(err));
});

test('AppError refuses codes that are not registered', () => {
  assert.throws(() => new AppError('MADE_UP_CODE', 'x'), /Add it to src\/lib\/error-codes.js/);
});

test('toResponse() produces the standard error body', () => {
  const err = new AppError('UNKNOWN_CHANNEL', 'Unknown channel "fax"');
  assert.deepEqual(err.toResponse(), { error: { code: 'UNKNOWN_CHANNEL', message: 'Unknown channel "fax"' } });
});
