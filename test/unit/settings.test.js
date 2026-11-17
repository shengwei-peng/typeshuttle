import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SPEED_PRESETS, sanitizeSettings, pacingFor, precisePacingFor } from '../../src/core/settings.js';

test('sanitizeSettings returns defaults for missing input', () => {
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test('sanitizeSettings keeps valid values', () => {
  const custom = {
    uiLanguage: 'en',
    speed: 'safe',
    tabWidth: 2,
    newlineKey: 'shift-enter',
    keepTrailingNewline: true,
    imeCommitEnter: true,
    confirmCharThreshold: 100,
    suggestPreciseChars: 1000,
    maxDirectChars: 20000,
    maxPreciseBytes: 2048,
    preciseDir: '/tmp/type-bridge',
  };
  assert.deepEqual(sanitizeSettings(custom), custom);
});

test('sanitizeSettings falls back to defaults for invalid values', () => {
  const result = sanitizeSettings({
    speed: 'ludicrous',
    tabWidth: 99,
    newlineKey: 'ctrl-enter',
    keepTrailingNewline: 'yes',
    confirmCharThreshold: -5,
    maxPreciseBytes: 'big',
  });
  assert.equal(result.speed, DEFAULT_SETTINGS.speed);
  assert.equal(result.tabWidth, DEFAULT_SETTINGS.tabWidth);
  assert.equal(result.newlineKey, DEFAULT_SETTINGS.newlineKey);
  assert.equal(result.keepTrailingNewline, DEFAULT_SETTINGS.keepTrailingNewline);
  assert.equal(result.confirmCharThreshold, DEFAULT_SETTINGS.confirmCharThreshold);
  assert.equal(result.maxPreciseBytes, DEFAULT_SETTINGS.maxPreciseBytes);
});

test('sanitizeSettings rejects directories that are unsafe inside a shell command', () => {
  for (const preciseDir of ['~/a b', '../x', '~/x;rm', '~/$(id)', '~/x/../y', '']) {
    assert.equal(sanitizeSettings({ preciseDir }).preciseDir, DEFAULT_SETTINGS.preciseDir, preciseDir);
  }
  assert.equal(sanitizeSettings({ preciseDir: '~/inbox_2' }).preciseDir, '~/inbox_2');
});

test('sanitizeSettings does not mutate its input', () => {
  const input = Object.freeze({ speed: 'fast', tabWidth: 99 });
  const result = sanitizeSettings(input);
  assert.equal(input.tabWidth, 99);
  assert.notEqual(result, input);
});

test('pacingFor returns the preset for a speed name and defaults to normal', () => {
  assert.deepEqual(pacingFor('fast'), SPEED_PRESETS.fast);
  assert.deepEqual(pacingFor('unknown'), SPEED_PRESETS.normal);
});

test('speed presets get strictly slower from fast to safe, and normal keeps chunks at the live-verified size', () => {
  const { fast, normal, safe } = SPEED_PRESETS;
  assert.ok(fast.chunkSize > normal.chunkSize && normal.chunkSize > safe.chunkSize);
  assert.ok(fast.chunkDelayMs < normal.chunkDelayMs && normal.chunkDelayMs < safe.chunkDelayMs);
  assert.ok(fast.lineDelayMs < normal.lineDelayMs && normal.lineDelayMs < safe.lineDelayMs);
  assert.deepEqual(normal, { chunkSize: 40, chunkDelayMs: 80, lineDelayMs: 150 });
});

test('precise transfer never runs faster than normal', () => {
  assert.deepEqual(precisePacingFor('fast'), SPEED_PRESETS.normal);
  assert.deepEqual(precisePacingFor('normal'), SPEED_PRESETS.normal);
  assert.deepEqual(precisePacingFor('safe'), SPEED_PRESETS.safe);
  assert.deepEqual(precisePacingFor('unknown'), SPEED_PRESETS.normal);
});

test('a non-boolean imeCommitEnter falls back to false', () => {
  assert.equal(sanitizeSettings({ imeCommitEnter: 'true' }).imeCommitEnter, false);
  assert.equal(sanitizeSettings({ imeCommitEnter: 1 }).imeCommitEnter, false);
  assert.equal(sanitizeSettings({}).imeCommitEnter, false);
});

test('uiLanguage accepts auto, en and zh_TW only', () => {
  assert.equal(sanitizeSettings({ uiLanguage: 'zh_TW' }).uiLanguage, 'zh_TW');
  assert.equal(sanitizeSettings({ uiLanguage: 'fr' }).uiLanguage, 'auto');
  assert.equal(sanitizeSettings({}).uiLanguage, 'auto');
});
