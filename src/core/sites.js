export const SCRIPT_ID_PREFIX = 'typeshuttle-site-';

const SITE_PATTERN = /^https?:\/\/[^/*]+\/\*$/;
const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export function originPatternFromUrl(url) {
  try {
    const { protocol, hostname } = new URL(url);
    return protocol === 'https:' || protocol === 'http:' ? `${protocol}//${hostname}/*` : null;
  } catch {
    return null;
  }
}

export function isSitePattern(pattern) {
  return typeof pattern === 'string' && SITE_PATTERN.test(pattern);
}

export function scriptIdForPattern(pattern) {
  const hash = Array.from(pattern).reduce(
    (acc, char) => Math.imul(acc ^ char.codePointAt(0), FNV_PRIME) >>> 0,
    FNV_OFFSET,
  );
  return `${SCRIPT_ID_PREFIX}${hash.toString(16).padStart(8, '0')}`;
}
