// Keeps translated docs in sync with their English source. English is the single source of truth:
// each translation starts with a stamp holding the hash of the English text it was reviewed against,
// and the check fails once the English file changes until someone updates the translation and re-stamps it.
import { createHash } from 'node:crypto';
import path from 'node:path';

const HASH_LENGTH = 16;
const SUPPORTED_LOCALES = ['zh-TW', 'zh-CN', 'ja', 'ko'];
const LOCALE_SUFFIX = new RegExp(`\\.(?:${SUPPORTED_LOCALES.join('|')})\\.md$`);
const STAMP_PATTERN = /^<!-- translation-of: (\S+) sha256:([0-9a-f]{16}) -->$/;
const SKIP_DIRS = new Set(['.git', 'node_modules', 'dist', 'release', 'test-results', 'playwright-report']);

export const isTranslationPath = (file) => LOCALE_SUFFIX.test(file);

export const sourcePathFor = (file) => file.replace(LOCALE_SUFFIX, '.md');

export const hashSource = (text) =>
  createHash('sha256').update(text.replace(/\r\n?/g, '\n')).digest('hex').slice(0, HASH_LENGTH);

const stampLine = (source, sourceText) => `<!-- translation-of: ${source} sha256:${hashSource(sourceText)} -->`;

export function parseStamp(text) {
  const [firstLine] = text.split('\n');
  const match = STAMP_PATTERN.exec(firstLine.replace(/\r$/, ''));
  return match ? { source: match[1], hash: match[2] } : null;
}

export function applyStamp(text, source, sourceText) {
  const newlineIndex = text.indexOf('\n');
  const body = parseStamp(text) ? (newlineIndex === -1 ? '' : text.slice(newlineIndex + 1)) : text;
  return `${stampLine(source, sourceText)}\n${body}`;
}

export function checkTranslation({ path: file, text, readSource }) {
  const source = sourcePathFor(file);
  const result = (status) => ({ path: file, source, status });
  const stamp = parseStamp(text);
  if (!stamp) return result('missing-stamp');
  if (stamp.source !== source) return result('wrong-source');
  const sourceText = readSource(source);
  if (sourceText === null) return result('missing-source');
  return result(stamp.hash === hashSource(sourceText) ? 'ok' : 'stale');
}

// readDir(relativeDir) returns directory entries shaped like fs.Dirent ({ name, isDirectory() }).
export function findTranslations(readDir, dir = '') {
  return readDir(dir).flatMap((entry) => {
    const relative = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) return SKIP_DIRS.has(entry.name) ? [] : findTranslations(readDir, relative);
    return isTranslationPath(relative) ? [relative] : [];
  });
}

// Converts an absolute path to a POSIX path relative to root, or null when it is not inside root.
export function toRepoPath(root, absolute) {
  const relative = path.relative(root, absolute);
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return relative.split(path.sep).join('/');
}
