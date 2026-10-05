import { test } from 'node:test';
import assert from 'node:assert/strict';
import email from '../../src/channels/email.channel.js';
import { createTestDeps } from '../helpers/fakes.js';

const message = to => ({ to, subject: 'Your bill is ready', body: 'Your bill of ₹749 is ready.' });

test('validate() rejects a recipient that is not an email address', () => {
  assert.throws(() => email.validate(message('not-an-email')), { code: 'INVALID_RECIPIENT' });
});

test('send() delivers through the email provider', async () => {
  const deps = createTestDeps();
  const result = await email.send(message('asha.k@example.com'), deps);
  assert.match(result.providerRef, /^em_/);
});

test('send() retries a transient provider failure', async () => {
  const deps = createTestDeps();
  const result = await email.send(message('flaky.user@example.com'), deps);
  assert.match(result.providerRef, /^em_/);
  assert.deepEqual(deps.sleep.calls, [200]);
});

test('send() does not retry a permanent provider rejection', async () => {
  const deps = createTestDeps();
  await assert.rejects(email.send(message('bounce@example.com'), deps), { statusCode: 502 });
  assert.deepEqual(deps.sleep.calls, []);
});
