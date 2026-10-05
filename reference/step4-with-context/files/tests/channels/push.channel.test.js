import { test } from 'node:test';
import assert from 'node:assert/strict';
import push from '../../src/channels/push.channel.js';
import { createTestDeps } from '../helpers/fakes.js';

const token = suffix => `kst_${suffix}`.padEnd(36, 'a');
const message = to => ({ to, subject: 'Your Kestrel Mobile bill is ready', body: 'Your bill is ready.' });

test('push sends the template subject as title and body as body', async () => {
  const deps = createTestDeps();
  const sent = [];
  const real = deps.providers.push.send;
  deps.providers.push.send = async arg => { sent.push(arg); return real(arg); };
  const result = await push.send(message(token('ok')), deps);
  assert.match(result.providerRef, /^pu_/);
  assert.deepEqual(sent[0], { token: token('ok'), title: 'Your Kestrel Mobile bill is ready', body: 'Your bill is ready.' });
});

test('push validate accepts a well-formed device token', () => {
  assert.doesNotThrow(() => push.validate(message(token('ok'))));
});

test('push validate rejects malformed tokens with INVALID_RECIPIENT', () => {
  for (const to of ['nope', 'kst_short', `kst_${'a'.repeat(33)}`, `xyz_${'a'.repeat(32)}`, `kst_${'a'.repeat(31)}!`, undefined]) {
    assert.throws(() => push.validate({ to }), { code: 'INVALID_RECIPIENT', status: 400 });
  }
});

test('push retries a 5xx from the gateway and then succeeds', async () => {
  const deps = createTestDeps();
  const result = await push.send(message(token('flaky')), deps);
  assert.match(result.providerRef, /^pu_/);
  assert.deepEqual(deps.sleep.calls, [200]);
});

test('push throws RECIPIENT_GONE on a 410 without retrying', async () => {
  const deps = createTestDeps();
  await assert.rejects(push.send(message(token('expired')), deps), { code: 'RECIPIENT_GONE', status: 410, retryable: false });
  assert.deepEqual(deps.sleep.calls, []);
});

test('push throws RECIPIENT_GONE on a 404 without retrying', async () => {
  const deps = createTestDeps();
  deps.providers.push.send = async () => { throw Object.assign(new Error('not found'), { statusCode: 404 }); };
  await assert.rejects(push.send(message(token('ok')), deps), { code: 'RECIPIENT_GONE' });
  assert.deepEqual(deps.sleep.calls, []);
});

test('push gives up after 3 attempts on a persistent 5xx', async () => {
  const deps = createTestDeps();
  let calls = 0;
  deps.providers.push.send = async () => { calls += 1; throw Object.assign(new Error('down'), { statusCode: 503 }); };
  await assert.rejects(push.send(message(token('ok')), deps), { code: 'PROVIDER_UNAVAILABLE', status: 502 });
  assert.equal(calls, 3);
  assert.deepEqual(deps.sleep.calls, [200, 400]);
});

test('push does not retry other 4xx gateway errors', async () => {
  const deps = createTestDeps();
  let calls = 0;
  deps.providers.push.send = async () => { calls += 1; throw Object.assign(new Error('bad payload'), { statusCode: 400 }); };
  await assert.rejects(push.send(message(token('ok')), deps), { code: 'PROVIDER_REJECTED' });
  assert.equal(calls, 1);
});

test('push never logs the raw device token', async () => {
  const deps = createTestDeps();
  await push.send(message(token('flaky')), deps);
  assert.ok(deps.logger.lines.length > 0);
  assert.ok(!JSON.stringify(deps.logger.lines).includes(token('flaky')));
});
