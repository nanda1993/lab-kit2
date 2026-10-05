import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { buildApp } from '../../src/app.js';
import { createTestDeps } from '../helpers/fakes.js';

let server;
let base;

before(async () => {
  const app = buildApp(createTestDeps());
  server = createServer((req, res) => app.handle(req, res));
  await new Promise(resolve => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

const dispatch = (body, key = 'test-key') => fetch(`${base}/notifications/dispatch`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
  body: JSON.stringify(body),
});

const billReady = { template: 'bill-ready', data: { amount: '₹749', dueDate: '12 Oct' } };

test('POST /notifications/dispatch sends an email and returns 202', async () => {
  const res = await dispatch({ channel: 'email', to: 'asha.k@example.com', ...billReady });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.status, 'sent');
  assert.match(body.id, /^ntf_/);
});

test('POST /notifications/dispatch rejects a missing API key with 401', async () => {
  const res = await dispatch({ channel: 'email', to: 'asha.k@example.com', ...billReady }, null);
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: { code: 'UNAUTHORIZED', message: 'Missing or invalid x-api-key header' } });
});

test('POST /notifications/dispatch rejects a channel we do not support', async () => {
  const res = await dispatch({ channel: 'sms', to: 'asha.k@example.com', ...billReady });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'UNKNOWN_CHANNEL');
});

test('POST /notifications/dispatch rejects an invalid recipient with 400', async () => {
  const res = await dispatch({ channel: 'email', to: 'nope', ...billReady });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_RECIPIENT');
});

test('POST /notifications/dispatch blocks a duplicate dedupeKey with 409', async () => {
  const body = { channel: 'email', to: 'asha.k@example.com', dedupeKey: 'bill-2026-10-AC1', ...billReady };
  assert.equal((await dispatch(body)).status, 202);
  const second = await dispatch(body);
  assert.equal(second.status, 409);
  assert.equal((await second.json()).error.code, 'DUPLICATE_DISPATCH');
});

test('GET /notifications/:id returns the stored notification', async () => {
  const sent = await (await dispatch({ channel: 'email', to: 'ravi@example.com', ...billReady })).json();
  const res = await fetch(`${base}/notifications/${sent.id}`, { headers: { 'x-api-key': 'test-key' } });
  assert.equal(res.status, 200);
  assert.equal((await res.json()).status, 'sent');
});

test('POST /notifications/dispatch sends a push notification and returns 202', async () => {
  const res = await dispatch({ channel: 'push', to: `kst_${'a1'.repeat(16)}`, ...billReady });
  assert.equal(res.status, 202);
  assert.equal((await res.json()).status, 'sent');
});

test('POST /notifications/dispatch rejects a malformed push token with 400', async () => {
  const res = await dispatch({ channel: 'push', to: 'kst_short', ...billReady });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_RECIPIENT');
});

test('POST /notifications/dispatch returns 410 for an uninstalled app', async () => {
  const res = await dispatch({ channel: 'push', to: `kst_expired${'a'.repeat(25)}`, ...billReady });
  assert.equal(res.status, 410);
  assert.equal((await res.json()).error.code, 'RECIPIENT_GONE');
});
