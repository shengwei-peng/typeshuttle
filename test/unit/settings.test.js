import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, SPEED_PRESETS, sanitizeSettings, pacingFor } from '../../src/core/settings.js';

test('sanitizeSettings returns defaults for missing input', () => {
  assert.deepEqual(sanitizeSettings(undefined), DEFAULT_SETTINGS);
  assert.deepEqual(sanitizeSettings({}), DEFAULT_SETTINGS);
});

test('sanitizeSettings keeps valid values', () => {
  const custom = {
    speed: 'safe',
    tabWidth: 2,
    newlineKey: 'shift-enter',
    keepTrailingNewline: true,
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
