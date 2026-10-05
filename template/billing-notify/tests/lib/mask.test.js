import { test } from 'node:test';
import assert from 'node:assert/strict';
import { maskRecipient } from '../../src/lib/mask.js';

test('masks email, phone and token recipients', () => {
  assert.equal(maskRecipient('asha.k@example.com'), 'as****@example.com');
  assert.equal(maskRecipient('+919812345678'), '+91******5678');
  assert.equal(maskRecipient('kst_8f2a9c1d7e3b4a5f6c7d8e9f0a1b2c3d'), 'kst_****');
});
