// Text normalization for direct typing (docs/ARCHITECTURE.md#text-pipeline). Every function returns a new string.

// [start, end] code point ranges. Invisible characters are never written literally so editors and review tools cannot strip them.
// BOM, zero-width space, word joiner, and C0 / DEL / C1 control characters except \t (0x09) and \n (0x0A).
// U+200C / U+200D are kept on purpose: emoji sequences and some scripts need them.
const INVISIBLE_RANGES = [[0xfeff, 0xfeff], [0x200b, 0x200b], [0x2060, 0x2060], [0x00, 0x08], [0x0b, 0x1f], [0x7f, 0x9f]];
// NO-BREAK SPACE, FIGURE SPACE, NARROW NO-BREAK SPACE.
const NBSP_RANGES = [[0x00a0, 0x00a0], [0x2007, 0x2007], [0x202f, 0x202f]];

function characterClass(ranges) {
  const body = ranges.map(([from, to]) => `${String.fromCodePoint(from)}-${String.fromCodePoint(to)}`).join('');
  return new RegExp(`[${body}]`, 'g');
}

const INVISIBLE_PATTERN = characterClass(INVISIBLE_RANGES);
const NBSP_PATTERN = characterClass(NBSP_RANGES);

export function normalizeNewlines(text) {
  return text.replace(/\r\n?/g, '\n');
}

export function stripInvisible(text) {
  return text.replace(INVISIBLE_PATTERN, '');
}

export function replaceNbsp(text) {
  return text.replace(NBSP_PATTERN, ' ');
}

export function expandTabs(text, tabWidth) {
  return text.replaceAll('\t', ' '.repeat(tabWidth));
}

export function trimTrailingNewlines(text) {
  return text.replace(/\n+$/, '');
}

export function normalizeForTyping(text, { tabWidth, sendTabKey, keepTrailingNewline }) {
  const cleaned = replaceNbsp(stripInvisible(normalizeNewlines(text)));
  const tabbed = sendTabKey ? cleaned : expandTabs(cleaned, tabWidth);
  return keepTrailingNewline ? tabbed : trimTrailingNewlines(tabbed);
}
