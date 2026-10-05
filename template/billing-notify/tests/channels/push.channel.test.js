import { test } from 'node:test';
import assert from 'node:assert/strict';
import push from '../../src/channels/push.channel.js';
import { createTestDeps } from '../helpers/fakes.js';

const token = prefix => prefix + 'a'.repeat(36 - prefix.length); // "kst_" + 32 chars
const message = to => ({ to, subject: 'Your bill is ready', body: 'Your bill of ₹749 is ready.' });

test('validate() accepts a device token', () => {
  assert.doesNotThrow(() => push.validate(message(token('kst_'))));
});

test('validate() rejects malformed device tokens', () => {
  const bad = ['not-a-token', 'kst_short', `kst_${'a'.repeat(33)}`, `kst_${'a'.repeat(31)}!`, `xyz_${'a'.repeat(32)}`, '', undefined];
  for (const to of bad) {
    assert.throws(() => push.validate(message(to)), { code: 'INVALID_RECIPIENT', status: 400 }, String(to));
  }
});

test('send() delivers through the push provider with subject as title and body as body', async () => {
  const deps = createTestDeps();
  const sent = [];
  const send = deps.providers.push.send;
  deps.providers.push.send = async args => { sent.push(args); return send(args); };
  const result = await push.send(message(token('kst_')), deps);
  assert.match(result.providerRef, /^pu_/);
  assert.deepEqual(sent, [{ token: token('kst_'), title: 'Your bill is ready', body: 'Your bill of ₹749 is ready.' }]);
});

test('send() retries a transient gateway failure', async () => {
  const deps = createTestDeps();
  const result = await push.send(message(token('kst_flaky')), deps);
  assert.match(result.providerRef, /^pu_/);
  assert.deepEqual(deps.sleep.calls, [200]);
});

test('send() throws RECIPIENT_GONE for an uninstalled app and does not retry', async () => {
  const deps = createTestDeps();
  await assert.rejects(push.send(message(token('kst_expired')), deps), { code: 'RECIPIENT_GONE', status: 410 });
  assert.deepEqual(deps.sleep.calls, []);
});

test('send() gives up with PROVIDER_UNAVAILABLE when the gateway keeps failing', async () => {
  const deps = createTestDeps();
  deps.providers.push.send = async () => { throw Object.assign(new Error('down'), { statusCode: 503 }); };
  await assert.rejects(push.send(message(token('kst_')), deps), { code: 'PROVIDER_UNAVAILABLE', status: 502 });
  assert.deepEqual(deps.sleep.calls, [200, 400]);
});

test('send() does not retry a 4xx rejection', async () => {
  const deps = createTestDeps();
  deps.providers.push.send = async () => { throw Object.assign(new Error('bad payload'), { statusCode: 400 }); };
  await assert.rejects(push.send(message(token('kst_')), deps), { code: 'PROVIDER_REJECTED', status: 502 });
  assert.deepEqual(deps.sleep.calls, []);
});

test('send() logs only the masked token', async () => {
  const deps = createTestDeps();
  await push.send(message(token('kst_')), deps);
  assert.ok(!JSON.stringify(deps.logger.lines).includes(token('kst_')));
});
