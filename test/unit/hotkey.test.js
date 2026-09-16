import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isPasteHotkey, nextHeldKeys, isMacPlatform } from '../../src/core/hotkey.js';

const key = (overrides) => ({
  code: 'KeyV', key: 'V', ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...overrides,
});

test('isPasteHotkey matches Ctrl+Shift+V on Windows and Linux', () => {
  assert.equal(isPasteHotkey(key({ ctrlKey: true, shiftKey: true }), { isMac: false }), true);
});

test('isPasteHotkey matches Cmd+Shift+V on Mac but not Ctrl+Shift+V', () => {
  assert.equal(isPasteHotkey(key({ metaKey: true, shiftKey: true }), { isMac: true }), true);
  assert.equal(isPasteHotkey(key({ ctrlKey: true, shiftKey: true }), { isMac: true }), false);
});

test('isPasteHotkey rejects plain paste, Alt combinations and other keys', () => {
  assert.equal(isPasteHotkey(key({ ctrlKey: true }), { isMac: false }), false);
  assert.equal(isPasteHotkey(key({ ctrlKey: true, shiftKey: true, altKey: true }), { isMac: false }), false);
  assert.equal(isPasteHotkey(key({ code: 'KeyC', ctrlKey: true, shiftKey: true }), { isMac: false }), false);
});

test('isPasteHotkey uses the physical key so non-US layouts and IME still match', () => {
  assert.equal(isPasteHotkey(key({ key: 'ㄒ', ctrlKey: true, shiftKey: true }), { isMac: false }), true);
});

test('nextHeldKeys tracks held physical keys without mutating the previous state', () => {
  const initial = new Set();
  const ctrl = nextHeldKeys(initial, { type: 'keydown', code: 'ControlLeft' });
  const both = nextHeldKeys(ctrl, { type: 'keydown', code: 'KeyV' });
  const released = nextHeldKeys(both, { type: 'keyup', code: 'ControlLeft' });

  assert.deepEqual([...initial], []);
  assert.deepEqual([...both].sort(), ['ControlLeft', 'KeyV']);
  assert.deepEqual([...released], ['KeyV']);
});

test('nextHeldKeys ignores events without a physical key code and clears on blur', () => {
  const state = new Set(['ShiftLeft']);
  assert.equal(nextHeldKeys(state, { type: 'keydown', code: '' }), state);
  assert.deepEqual([...nextHeldKeys(state, { type: 'blur' })], []);
});

test('isMacPlatform detects Mac platforms', () => {
  assert.equal(isMacPlatform('MacIntel'), true);
  assert.equal(isMacPlatform('macOS'), true);
  assert.equal(isMacPlatform('Linux x86_64'), false);
  assert.equal(isMacPlatform(undefined), false);
});
