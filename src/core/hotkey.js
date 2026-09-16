// Hotkey matching (docs/ARCHITECTURE.md#triggers) uses physical key codes so it works with IMEs and non-US layouts.

export function isMacPlatform(platform) {
  return typeof platform === 'string' && /^mac/i.test(platform);
}

export function isPasteHotkey(event, { isMac }) {
  const primary = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return event.code === 'KeyV' && event.shiftKey && primary && !event.altKey;
}

// Tracks held physical keys. Everything must be released before typing starts (docs/ARCHITECTURE.md#safety);
// otherwise a held Ctrl turns typed text into remote shortcuts and a held Enter auto-repeats into an abort.
export function nextHeldKeys(state, event) {
  if (event.type === 'blur') return new Set();
  if (!event.code) return state;
  if (event.type === 'keydown') return new Set([...state, event.code]);
  return new Set([...state].filter((code) => code !== event.code));
}
