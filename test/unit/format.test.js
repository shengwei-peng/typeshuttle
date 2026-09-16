import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatDuration, formatBytes, formatCount } from '../../src/core/format.js';

test('formatDuration shows seconds under a minute and minutes with seconds above', () => {
  assert.equal(formatDuration(0), '不到 1 秒');
  assert.equal(formatDuration(999), '不到 1 秒');
  assert.equal(formatDuration(1500), '2 秒');
  assert.equal(formatDuration(59_400), '59 秒');
  assert.equal(formatDuration(125_000), '2 分 5 秒');
  assert.equal(formatDuration(120_000), '2 分');
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
