import { test } from 'node:test';
import assert from 'node:assert/strict';
import sms from '../../src/channels/sms.channel.js';
import { createTestDeps } from '../helpers/fakes.js';

const message = (to, body = 'We could not collect ₹749.') => ({ to, subject: 'Your payment did not go through', body });
const OK = '+919812345678';

// Wraps the provider so tests can see what it was called with.
function spy(deps, impl = deps.providers.sms.send) {
  const calls = [];
  deps.providers.sms.send = async args => { calls.push(args); return impl(args); };
  return calls;
}
const failing = statusCode => async () => { throw Object.assign(new Error('boom'), { statusCode }); };

test('validate() accepts well-formed E.164 numbers', () => {
  for (const to of ['+919812345678', '+12345678', '+123456789012345']) {
    assert.doesNotThrow(() => sms.validate(message(to)), to);
  }
});

test('validate() rejects malformed numbers', () => {
  for (const to of ['nope', '919812345678', '+1234567', '+1234567890123456', '+91 98123 45678', '', undefined]) {
    assert.throws(() => sms.validate(message(to)), { code: 'INVALID_RECIPIENT', status: 400 }, String(to));
  }
});

test('validate() accepts a 480-character body and rejects 481', () => {
  assert.doesNotThrow(() => sms.validate(message(OK, 'x'.repeat(480))));
  assert.throws(() => sms.validate(message(OK, 'x'.repeat(481))), { code: 'VALIDATION_FAILED', status: 400 });
});

test('send() passes the body as text and ignores the subject', async () => {
  const deps = createTestDeps();
  const calls = spy(deps);
  const result = await sms.send(message(OK), deps);
  assert.deepEqual(calls, [{ to: OK, text: 'We could not collect ₹749.' }]);
  assert.match(result.providerRef, /^sm_/);
});

test('send() returns the segment count', async () => {
  const deps = createTestDeps();
  assert.equal((await sms.send(message(OK, 'x'.repeat(160)), deps)).segments, 1);
  assert.equal((await sms.send(message(OK, 'x'.repeat(161)), deps)).segments, 2);
  assert.equal((await sms.send(message(OK, 'x'.repeat(480)), deps)).segments, 3);
});

test('send() delivers on attempt 3 after two 503s, backing off from 500 ms', async () => {
  const deps = createTestDeps();
  const calls = spy(deps);
  const result = await sms.send(message('+919800007777'), deps);
  assert.match(result.providerRef, /^sm_/);
  assert.equal(calls.length, 3);
  assert.deepEqual(deps.sleep.calls, [500, 1000]);
});

test('send() does not retry a permanent failure', async () => {
  const deps = createTestDeps();
  const calls = spy(deps);
  await assert.rejects(sms.send(message('+919800000000'), deps), { code: 'PROVIDER_REJECTED' });
  assert.equal(calls.length, 1);
  assert.deepEqual(deps.sleep.calls, []);
});

test('send() maps a provider 404 or 410 to RECIPIENT_GONE without retrying', async () => {
  for (const status of [404, 410]) {
    const deps = createTestDeps();
    const calls = spy(deps, failing(status));
    await assert.rejects(sms.send(message(OK), deps), { code: 'RECIPIENT_GONE', status: 410 });
    assert.equal(calls.length, 1, `status ${status}`);
    assert.deepEqual(deps.sleep.calls, []);
  }
});

test('send() gives up after 4 attempts on a persistent 5xx', async () => {
  const deps = createTestDeps();
  const calls = spy(deps, failing(503));
  await assert.rejects(sms.send(message(OK), deps), { code: 'PROVIDER_UNAVAILABLE', retryable: true });
  assert.equal(calls.length, 4);
  assert.deepEqual(deps.sleep.calls, [500, 1000, 2000]);
});

test('send() never logs the raw phone number', async () => {
  const deps = createTestDeps();
  await sms.send(message('+919800007777'), deps);
  assert.ok(deps.logger.lines.length > 0);
  assert.ok(!JSON.stringify(deps.logger.lines).includes('+919800007777'));
});
