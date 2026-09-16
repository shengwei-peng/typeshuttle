import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeNewlines,
  stripInvisible,
  replaceNbsp,
  expandTabs,
  trimTrailingNewlines,
  normalizeForTyping,
} from '../../src/core/normalize.js';

test('normalizeNewlines converts CRLF and lone CR to LF', () => {
  assert.equal(normalizeNewlines('a\r\nb\rc\nd'), 'a\nb\nc\nd');
});

test('stripInvisible removes BOM, zero-width space, word joiner and control characters', () => {
  assert.equal(stripInvisible('\uFEFFa\u200Bb\u2060c\u0007d\u007Fe\u0085f'), 'abcdef');
});

test('stripInvisible keeps tab, newline and zero-width joiner used by emoji sequences', () => {
  const family = '👨\u200D👩\u200D👧';
  assert.equal(stripInvisible(`a\tb\nc${family}`), `a\tb\nc${family}`);
});

test('replaceNbsp converts no-break space variants to regular spaces', () => {
  assert.equal(replaceNbsp('a\u00A0b\u202Fc\u2007d'), 'a b c d');
});

test('expandTabs replaces each tab with the configured number of spaces', () => {
  assert.equal(expandTabs('\tx\t\ty', 2), '  x    y');
});

test('trimTrailingNewlines removes only trailing newlines', () => {
  assert.equal(trimTrailingNewlines('a\n\nb\n\n'), 'a\n\nb');
  assert.equal(trimTrailingNewlines('\n'), '');
  assert.equal(trimTrailingNewlines('a'), 'a');
});

test('normalizeForTyping applies every default rule', () => {
  const input = '\uFEFFif x:\r\n\tprint("hi\u00A0there")\r\n';
  const result = normalizeForTyping(input, { tabWidth: 4, sendTabKey: false, keepTrailingNewline: false });
  assert.equal(result, 'if x:\n    print("hi there")');
});

test('normalizeForTyping keeps tabs when sending Tab keys and keeps trailing newline on request', () => {
  const result = normalizeForTyping('a\tb\r\n', { tabWidth: 4, sendTabKey: true, keepTrailingNewline: true });
  assert.equal(result, 'a\tb\n');
});

test('normalizeForTyping preserves Chinese text and symbols unchanged', () => {
  const input = '繁體中文測試，完成。 {x: [1, 2]} <tag> "quote" ‘smart’';
  assert.equal(normalizeForTyping(input, { tabWidth: 4, sendTabKey: false, keepTrailingNewline: false }), input);
});
