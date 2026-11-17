import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readRemaining, remainingKey } from '../../src/shared/remaining.js';

test('remainingKey is per tab', () => {
  assert.equal(remainingKey(7), 'remaining:7');
});

test('readRemaining accepts the current object form', () => {
  assert.deepEqual(readRemaining({ text: '\nb', pendingImeCommit: true }), { text: '\nb', pendingImeCommit: true });
  assert.deepEqual(readRemaining({ text: 'x', pendingImeCommit: 'yes' }), { text: 'x', pendingImeCommit: false });
});

test('readRemaining accepts the string form stored by older versions', () => {
  assert.deepEqual(readRemaining('left over'), { text: 'left over', pendingImeCommit: false });
});

test('readRemaining ignores missing or malformed values', () => {
  assert.equal(readRemaining(undefined), null);
  assert.equal(readRemaining({ pendingImeCommit: true }), null);
  assert.equal(readRemaining(42), null);
});
