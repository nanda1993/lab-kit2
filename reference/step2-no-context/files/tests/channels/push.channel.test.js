import { test } from 'node:test';
import assert from 'node:assert/strict';
import push from '../../src/channels/push.channel.js';
import { createTestDeps } from '../helpers/fakes.js';

const token = (prefix = 'kst_') => prefix + 'a'.repeat(36 - prefix.length);
const message = to => ({ to, subject: 'Your bill is ready', body: 'Your bill of ₹749 is ready.' });

test('validate() accepts a well-formed device token', () => {
  assert.doesNotThrow(() => push.validate(message(token())));
});

test('validate() rejects malformed device tokens', () => {
  for (const bad of ['not-a-token', 'kst_short', 'kst_' + 'a'.repeat(33), 'kst_' + 'a'.repeat(31) + '!', 'xyz_' + 'a'.repeat(32), undefined]) {
    assert.throws(() => push.validate(message(bad)), { code: 'INVALID_RECIPIENT', status: 400 });
  }
});

test('send() delivers through the push provider', async () => {
  const deps = createTestDeps();
  const result = await push.send(message(token()), deps);
  assert.match(result.providerRef, /^pu_/);
});

test('send() retries a transient gateway failure', async () => {
  const deps = createTestDeps();
  const result = await push.send(message(token('kst_flaky')), deps);
  assert.match(result.providerRef, /^pu_/);
  assert.deepEqual(deps.sleep.calls, [200]);
});

test('send() does not retry a 410 (app uninstalled)', async () => {
  const deps = createTestDeps();
  await assert.rejects(push.send(message(token('kst_expired')), deps), { code: 'PROVIDER_REJECTED' });
  assert.deepEqual(deps.sleep.calls, []);
});

test('send() logs the device token masked', async () => {
  const deps = createTestDeps();
  await push.send(message(token()), deps);
  const line = deps.logger.lines.find(l => l.msg === 'push sent');
  assert.equal(line.to, 'kst_****');
});
