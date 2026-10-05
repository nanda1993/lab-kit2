import { test } from 'node:test';
import assert from 'node:assert/strict';
import inapp from '../../src/channels/inapp.channel.js';

test('inapp stores the notice in the customer inbox', async () => {
  await inapp.send({ to: 'CUST-104233', subject: 'Bill ready', body: 'Your bill is ready.' }, {});
  assert.equal(inapp.inbox('CUST-104233')[0].title, 'Bill ready');
});

test('inapp rejects a malformed customer id', () => {
  assert.throws(() => inapp.validate({ to: '104233' }));
});
