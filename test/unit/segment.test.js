import { test } from 'node:test';
import assert from 'node:assert/strict';
import { splitGraphemes, chunkLine, buildTypingPlan, planToText } from '../../src/core/segment.js';

const family = ['👨', '👩', '👧'].join(String.fromCodePoint(0x200d));
const eAcute = `e${String.fromCodePoint(0x301)}`;

test('splitGraphemes keeps emoji sequences and combining marks intact', () => {
  assert.deepEqual(splitGraphemes(`a${family}é中`), ['a', family, 'é', '中']);
});

test('chunkLine splits a line by grapheme count', () => {
  assert.deepEqual(chunkLine('abcdefg', 3), ['abc', 'def', 'g']);
});

test('chunkLine never splits a grapheme across chunks', () => {
  assert.deepEqual(chunkLine(`ab${family}c`, 3), [`ab${family}`, 'c']);
});

test('chunkLine returns no chunks for an empty line', () => {
  assert.deepEqual(chunkLine('', 3), []);
});

test('buildTypingPlan emits text and newline steps line by line, including blank lines', () => {
  assert.deepEqual(buildTypingPlan('ab\n\ncd', { chunkSize: 10, sendTabKey: false }), [
    { type: 'text', value: 'ab' },
    { type: 'newline' },
    { type: 'newline' },
    { type: 'text', value: 'cd' },
  ]);
});

test('buildTypingPlan emits a final newline step when text ends with a newline', () => {
  assert.deepEqual(buildTypingPlan('a\n', { chunkSize: 10, sendTabKey: false }), [
    { type: 'text', value: 'a' },
    { type: 'newline' },
  ]);
});

test('buildTypingPlan chunks long lines', () => {
  assert.deepEqual(buildTypingPlan('abcde', { chunkSize: 2, sendTabKey: false }), [
    { type: 'text', value: 'ab' },
    { type: 'text', value: 'cd' },
    { type: 'text', value: 'e' },
  ]);
});

test('buildTypingPlan emits tab steps when sending Tab keys', () => {
  assert.deepEqual(buildTypingPlan('\ta\t\tb', { chunkSize: 10, sendTabKey: true }), [
    { type: 'tab' },
    { type: 'text', value: 'a' },
    { type: 'tab' },
    { type: 'tab' },
    { type: 'text', value: 'b' },
  ]);
});

test('buildTypingPlan keeps tab characters inside text when not sending Tab keys', () => {
  assert.deepEqual(buildTypingPlan('a\tb', { chunkSize: 10, sendTabKey: false }), [
    { type: 'text', value: 'a\tb' },
  ]);
});

test('buildTypingPlan returns an empty plan for empty text', () => {
  assert.deepEqual(buildTypingPlan('', { chunkSize: 10, sendTabKey: false }), []);
});

test('planToText reconstructs the text a plan types', () => {
  const text = '第一行\tA\n\n  第三行 👍\n';
  for (const sendTabKey of [true, false]) {
    assert.equal(planToText(buildTypingPlan(text, { chunkSize: 2, sendTabKey })), text);
  }
});
