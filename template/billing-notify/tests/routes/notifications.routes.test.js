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
  const res = await dispatch({ channel: 'fax', to: 'asha.k@example.com', ...billReady });
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

test('POST /notifications/dispatch returns 429 with Retry-After once the key is over its limit', async () => {
  const app = buildApp(createTestDeps({ limits: { maxRequests: 2, windowSeconds: 60 } }));
  const limitedServer = createServer((req, res) => app.handle(req, res));
  await new Promise(resolve => limitedServer.listen(0, resolve));
  const url = `http://127.0.0.1:${limitedServer.address().port}`;
  const post = key => fetch(`${url}/notifications/dispatch`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(key ? { 'x-api-key': key } : {}) },
    body: JSON.stringify({ channel: 'email', to: 'asha.k@example.com', ...billReady }),
  });
  try {
    assert.equal((await post('test-key')).status, 202);
    assert.equal((await post('test-key')).status, 202);
    assert.equal((await post('bad-key')).status, 401); // not counted
    const limited = await post('test-key');
    assert.equal(limited.status, 429);
    assert.equal(Number(limited.headers.get('retry-after')) > 0, true);
    assert.equal((await limited.json()).error.code, 'RATE_LIMITED');
    // GET is not limited
    assert.equal((await fetch(`${url}/notifications/ntf_missing`, { headers: { 'x-api-key': 'test-key' } })).status, 404);
  } finally {
    limitedServer.close();
  }
});

const getRecord = id => fetch(`${base}/notifications/${id}`, { headers: { 'x-api-key': 'test-key' } });
const paymentFailed = { template: 'payment-failed', data: { amount: '₹749', dueDate: '12 Oct' } };

test('POST /notifications/dispatch sends an SMS and records segments', async () => {
  const res = await dispatch({ channel: 'sms', to: '+919812345678', ...paymentFailed });
  assert.equal(res.status, 202);
  const body = await res.json();
  assert.equal(body.status, 'sent');
  assert.match(body.providerRef, /^sm_/);
  assert.equal(body.segments, 1);
  assert.equal((await (await getRecord(body.id)).json()).segments, 1);
});

test('POST /notifications/dispatch delivers an SMS that fails twice and then succeeds', async () => {
  const res = await dispatch({ channel: 'sms', to: '+919800007777', ...paymentFailed });
  assert.equal(res.status, 202);
  assert.equal((await res.json()).status, 'sent');
});

test('POST /notifications/dispatch does not retry a permanent SMS failure', async () => {
  const res = await dispatch({ channel: 'sms', to: '+919800000000', ...paymentFailed });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).error.code, 'PROVIDER_REJECTED');
});

test('POST /notifications/dispatch rejects an SMS over 480 characters with 400', async () => {
  const res = await dispatch({
    channel: 'sms', to: '+919812345678', template: 'payment-failed',
    data: { amount: '₹'.padEnd(500, '9'), dueDate: '12 Oct' },
  });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'VALIDATION_FAILED');
});

test('POST /notifications/dispatch rejects a malformed SMS number with 400', async () => {
  const res = await dispatch({ channel: 'sms', to: '9812345678', ...paymentFailed });
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_RECIPIENT');
});

test('POST /notifications/dispatch leaves segments off non-SMS responses', async () => {
  const res = await dispatch({ channel: 'email', to: 'asha.k@example.com', ...billReady });
  assert.equal('segments' in (await res.json()), false);
});
