import { test } from 'node:test';
import assert from 'node:assert/strict';
import sms from '../../src/channels/sms.channel.js';
import { createTestDeps } from '../helpers/fakes.js';

const message = (to, body = 'We could not collect your payment.') => ({ to, subject: 'ignored by sms', body });
const failWith = (statusCode, counter) => async () => {
  counter.calls += 1;
  throw Object.assign(new Error('boom'), { statusCode });
};

test('sms validate accepts well-formed E.164 numbers', () => {
  for (const to of ['+919812345678', '+12345678', '+123456789012345']) {
    assert.doesNotThrow(() => sms.validate(message(to)));
  }
});

test('sms validate rejects malformed numbers with INVALID_RECIPIENT', () => {
  for (const to of ['nope', '919812345678', '+1234567', '+1234567890123456', '+91 98123 45678', undefined]) {
    assert.throws(() => sms.validate({ to, body: 'hi' }), { code: 'INVALID_RECIPIENT', status: 400 });
  }
});

test('sms validate accepts a 480-character body and rejects 481 with a 400', () => {
  assert.doesNotThrow(() => sms.validate(message('+919812345678', 'a'.repeat(480))));
  assert.throws(() => sms.validate(message('+919812345678', 'a'.repeat(481))), { code: 'VALIDATION_FAILED', status: 400 });
});

test('sms sends the body only, with no subject', async () => {
  const deps = createTestDeps();
  const sent = [];
  const real = deps.providers.sms.send;
  deps.providers.sms.send = async arg => { sent.push(arg); return real(arg); };
  const result = await sms.send(message('+919812345678', 'Pay by 12 Oct.'), deps);
  assert.match(result.providerRef, /^sm_/);
  assert.deepEqual(sent[0], { to: '+919812345678', text: 'Pay by 12 Oct.' });
});

test('sms delivers on attempt 3 after two 5xx failures', async () => {
  const deps = createTestDeps();
  const result = await sms.send(message('+919812347777'), deps);
  assert.match(result.providerRef, /^sm_/);
  assert.deepEqual(deps.sleep.calls, [500, 1000]);
});

test('sms does not retry a permanent failure', async () => {
  const deps = createTestDeps();
  const counter = { calls: 0 };
  const real = deps.providers.sms.send;
  deps.providers.sms.send = async arg => { counter.calls += 1; return real(arg); };
  await assert.rejects(sms.send(message('+919812340000'), deps), { code: 'PROVIDER_REJECTED', status: 502 });
  assert.equal(counter.calls, 1);
  assert.deepEqual(deps.sleep.calls, []);
});

test('sms throws RECIPIENT_GONE on a 404 or 410 without retrying', async () => {
  for (const statusCode of [404, 410]) {
    const deps = createTestDeps();
    const counter = { calls: 0 };
    deps.providers.sms.send = failWith(statusCode, counter);
    await assert.rejects(sms.send(message('+919812345678'), deps), { code: 'RECIPIENT_GONE', status: 410 });
    assert.equal(counter.calls, 1);
    assert.deepEqual(deps.sleep.calls, []);
  }
});

test('sms gives up after 4 attempts on a persistent 5xx', async () => {
  const deps = createTestDeps();
  const counter = { calls: 0 };
  deps.providers.sms.send = failWith(503, counter);
  await assert.rejects(sms.send(message('+919812345678'), deps), { code: 'PROVIDER_UNAVAILABLE', status: 502 });
  assert.equal(counter.calls, 4);
  assert.deepEqual(deps.sleep.calls, [500, 1000, 2000]);
});

test('sms returns the segment count from the provider', async () => {
  const deps = createTestDeps();
  assert.equal((await sms.send(message('+919812345678', 'a'.repeat(160)), deps)).segments, 1);
  assert.equal((await sms.send(message('+919812345678', 'a'.repeat(161)), deps)).segments, 2);
  assert.equal((await sms.send(message('+919812345678', 'a'.repeat(480)), deps)).segments, 3);
});

test('sms never logs the raw phone number', async () => {
  const deps = createTestDeps();
  await sms.send(message('+919812347777'), deps);
  assert.ok(deps.logger.lines.length > 0);
  assert.ok(!JSON.stringify(deps.logger.lines).includes('+919812347777'));
});
