import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatBytes, formatCount, formatStats } from '../../src/core/format.js';
import { createTranslator } from '../../src/core/i18n.js';

const zh = createTranslator('zh_TW');
const en = createTranslator('en');

test('formatDuration shows seconds under a minute and minutes with seconds above', () => {
  assert.equal(formatDuration(0, zh), '不到 1 秒');
  assert.equal(formatDuration(999, zh), '不到 1 秒');
  assert.equal(formatDuration(1500, zh), '2 秒');
  assert.equal(formatDuration(59_400, zh), '59 秒');
  assert.equal(formatDuration(125_000, zh), '2 分 5 秒');
  assert.equal(formatDuration(120_000, zh), '2 分');
  assert.equal(formatDuration(500, en), 'under 1 s');
  assert.equal(formatDuration(125_000, en), '2 min 5 s');
  assert.equal(formatDuration(120_000, en), '2 min');
});

test('formatBytes uses B, KB and MB with one decimal', () => {
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(1024 * 1024), '1.0 MB');
});

test('formatCount adds thousands separators', () => {
  assert.equal(formatCount(50000), '50,000');
  assert.equal(formatCount(7), '7');
});

test('formatStats joins line and character counts, with an optional duration, in either language', () => {
  assert.equal(formatStats({ lines: 3, chars: 1200 }, zh), '3 行 · 1,200 字');
  assert.equal(formatStats({ lines: 1, chars: 1, durationMs: 2000 }, en), '1 line · 1 character · about 2 s');
  assert.equal(formatStats({ lines: 2, chars: 1000, durationMs: 0 }, en), '2 lines · 1,000 characters · under 1 s');
  assert.equal(formatStats({ lines: 2, chars: 5, durationMs: 300 }, zh), '2 行 · 5 字 · 不到 1 秒');
});
