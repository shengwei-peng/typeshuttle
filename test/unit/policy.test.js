import { test } from 'node:test';
import assert from 'node:assert/strict';
import { textStats, evaluateDirect, estimateDurationMs } from '../../src/core/policy.js';

const SETTINGS = { confirmCharThreshold: 500, suggestPreciseChars: 2000, maxDirectChars: 50000 };

test('textStats counts lines and characters excluding newlines, by grapheme', () => {
  assert.deepEqual(textStats('ab\n中👍'), { lines: 2, chars: 4 });
});

test('textStats reports zero for empty text', () => {
  assert.deepEqual(textStats(''), { lines: 0, chars: 0 });
});

test('evaluateDirect lets a single short line through without confirmation', () => {
  const result = evaluateDirect('echo hello', SETTINGS);
  assert.equal(result.needsConfirm, false);
  assert.equal(result.suggestPrecise, false);
  assert.equal(result.exceedsLimit, false);
  assert.equal(result.empty, false);
});

test('evaluateDirect asks for confirmation on multi-line text', () => {
  assert.equal(evaluateDirect('a\nb', SETTINGS).needsConfirm, true);
});

test('evaluateDirect asks for confirmation above the character threshold', () => {
  assert.equal(evaluateDirect('x'.repeat(500), SETTINGS).needsConfirm, false);
  assert.equal(evaluateDirect('x'.repeat(501), SETTINGS).needsConfirm, true);
});

test('evaluateDirect suggests precise mode above suggestPreciseChars', () => {
  assert.equal(evaluateDirect('x'.repeat(2000), SETTINGS).suggestPrecise, false);
  assert.equal(evaluateDirect('x'.repeat(2001), SETTINGS).suggestPrecise, true);
});

test('evaluateDirect flags text longer than maxDirectChars', () => {
  assert.equal(evaluateDirect('x'.repeat(50001), SETTINGS).exceedsLimit, true);
});

test('evaluateDirect marks empty text', () => {
  assert.equal(evaluateDirect('', SETTINGS).empty, true);
});

test('estimateDurationMs adds the delay that follows each step', () => {
  const plan = [{ type: 'text', value: 'a' }, { type: 'newline' }, { type: 'text', value: 'b' }, { type: 'tab' }];
  assert.equal(estimateDurationMs(plan, { chunkDelayMs: 40, lineDelayMs: 80 }), 40 + 80 + 40 + 40);
});
