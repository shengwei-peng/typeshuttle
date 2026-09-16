import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateMessage } from '../../src/core/messages.js';

test('validateMessage accepts a status request', () => {
  assert.deepEqual(validateMessage({ type: 'typeshuttle/status' }), { type: 'typeshuttle/status' });
});

test('validateMessage keeps only known fields of a direct send', () => {
  const message = { type: 'typeshuttle/send-direct', text: '中文', sendTabKey: false, newlineKey: 'shift-enter', extra: 1 };
  assert.deepEqual(validateMessage(message), {
    type: 'typeshuttle/send-direct', text: '中文', sendTabKey: false, newlineKey: 'shift-enter',
  });
});

test('validateMessage rejects malformed direct sends', () => {
  const base = { type: 'typeshuttle/send-direct', text: 'a', sendTabKey: false, newlineKey: 'enter' };
  assert.equal(validateMessage({ ...base, text: 42 }), null);
  assert.equal(validateMessage({ ...base, sendTabKey: 'no' }), null);
  assert.equal(validateMessage({ ...base, newlineKey: 'ctrl-enter' }), null);
});

test('validateMessage accepts precise sends with or without a file name', () => {
  const base = { type: 'typeshuttle/send-precise', dataBase64: 'QUJD', createdAt: 1789400000000 };
  assert.deepEqual(validateMessage({ ...base, fileName: null }), { ...base, fileName: null });
  assert.deepEqual(validateMessage({ ...base, fileName: 'a.txt' }), { ...base, fileName: 'a.txt' });
});

test('validateMessage rejects malformed precise sends and unknown types', () => {
  const base = { type: 'typeshuttle/send-precise', dataBase64: 'QUJD', createdAt: 1, fileName: null };
  assert.equal(validateMessage({ ...base, createdAt: 'now' }), null);
  assert.equal(validateMessage({ ...base, fileName: 7 }), null);
  assert.equal(validateMessage({ ...base, dataBase64: undefined }), null);
  assert.equal(validateMessage({ type: 'typeshuttle/delete-everything' }), null);
  assert.equal(validateMessage(null), null);
});
