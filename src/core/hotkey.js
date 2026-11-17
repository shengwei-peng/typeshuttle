export function isMacPlatform(platform) {
  return typeof platform === 'string' && /^mac/i.test(platform);
}

export function isPasteHotkey(event, { isMac }) {
  const primary = isMac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return event.code === 'KeyV' && event.shiftKey && primary && !event.altKey;
}

const MODIFIER_CODE = /^(Shift|Control|Alt|Meta)(Left|Right)$/;
const META_CODE = /^Meta(Left|Right)$/;

export function nextHeldKeys(state, event) {
  if (event.type === 'blur') return new Set();
  if (!event.code) return state;
  if (event.type === 'keydown') return new Set([...state, event.code]);
  const remaining = [...state].filter((code) => code !== event.code);
  return new Set(META_CODE.test(event.code) ? remaining.filter((code) => MODIFIER_CODE.test(code)) : remaining);
}
