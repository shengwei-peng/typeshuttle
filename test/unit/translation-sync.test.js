import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyStamp,
  checkTranslation,
  findTranslations,
  hashSource,
  isTranslationPath,
  parseStamp,
  sourcePathFor,
  toRepoPath,
} from '../../scripts/lib/translation-sync.js';

const SOURCE = '# Title\n\nHello.\n';

test('sourcePathFor strips the locale segment from translation paths', () => {
  assert.equal(sourcePathFor('README.zh-TW.md'), 'README.md');
  assert.equal(sourcePathFor('docs/user-guide.zh-TW.md'), 'docs/user-guide.md');
  assert.equal(sourcePathFor('docs/notes.ja.md'), 'docs/notes.md');
});

test('isTranslationPath recognizes locale-suffixed Markdown files only', () => {
  assert.equal(isTranslationPath('README.zh-TW.md'), true);
  assert.equal(isTranslationPath('docs/notes.ja.md'), true);
  assert.equal(isTranslationPath('README.md'), false);
  assert.equal(isTranslationPath('CHANGELOG.md'), false);
  assert.equal(isTranslationPath('docs/clients.md'), false);
  assert.equal(isTranslationPath('src/zh-TW.json'), false);
});

test('hashSource is a 16-character hex digest that ignores line ending style', () => {
  const hash = hashSource(SOURCE);
  assert.match(hash, /^[0-9a-f]{16}$/);
  assert.equal(hashSource(SOURCE.replaceAll('\n', '\r\n')), hash);
  assert.notEqual(hashSource(`${SOURCE}More.\n`), hash);
});

test('parseStamp reads the source path and hash from the first line', () => {
  const text = '<!-- translation-of: README.md sha256:0123456789abcdef -->\n# 標題\n';
  assert.deepEqual(parseStamp(text), { source: 'README.md', hash: '0123456789abcdef' });
});

test('parseStamp returns null when the first line is not a stamp', () => {
  assert.equal(parseStamp('# 標題\n<!-- translation-of: README.md sha256:0123456789abcdef -->\n'), null);
  assert.equal(parseStamp('<!-- translation-of: README.md sha256:xyz -->\n'), null);
  assert.equal(parseStamp(''), null);
});

test('applyStamp inserts a stamp when the translation has none', () => {
  const result = applyStamp('# 標題\n', 'README.md', SOURCE);
  assert.equal(result, `<!-- translation-of: README.md sha256:${hashSource(SOURCE)} -->\n# 標題\n`);
});

test('applyStamp replaces an existing stamp instead of adding another', () => {
  const stale = '<!-- translation-of: README.md sha256:0123456789abcdef -->\n# 標題\n';
  const result = applyStamp(stale, 'README.md', SOURCE);
  assert.equal(result, `<!-- translation-of: README.md sha256:${hashSource(SOURCE)} -->\n# 標題\n`);
  assert.equal(stale.startsWith('<!-- translation-of: README.md sha256:0123456789abcdef'), true);
});

test('checkTranslation reports ok when the stamp matches the current source', () => {
  const translation = applyStamp('# 標題\n', 'README.md', SOURCE);
  assert.deepEqual(
    checkTranslation({ path: 'README.zh-TW.md', text: translation, readSource: () => SOURCE }),
    { path: 'README.zh-TW.md', source: 'README.md', status: 'ok' },
  );
});

test('checkTranslation reports stale when the source changed after the stamp', () => {
  const translation = applyStamp('# 標題\n', 'README.md', SOURCE);
  const result = checkTranslation({ path: 'README.zh-TW.md', text: translation, readSource: () => `${SOURCE}New.\n` });
  assert.equal(result.status, 'stale');
  assert.equal(result.source, 'README.md');
});

test('checkTranslation reports a missing stamp', () => {
  const result = checkTranslation({ path: 'README.zh-TW.md', text: '# 標題\n', readSource: () => SOURCE });
  assert.equal(result.status, 'missing-stamp');
});

test('checkTranslation rejects a stamp that points at a different source file', () => {
  const translation = applyStamp('# 標題\n', 'CONTRIBUTING.md', SOURCE);
  const result = checkTranslation({ path: 'README.zh-TW.md', text: translation, readSource: () => SOURCE });
  assert.equal(result.status, 'wrong-source');
});

test('checkTranslation reports a missing source file', () => {
  const translation = applyStamp('# 標題\n', 'README.md', SOURCE);
  const result = checkTranslation({ path: 'README.zh-TW.md', text: translation, readSource: () => null });
  assert.equal(result.status, 'missing-source');
});

test('parseStamp accepts a stamp line saved with CRLF line endings', () => {
  const text = '<!-- translation-of: README.md sha256:0123456789abcdef -->\r\n# 標題\r\n';
  assert.deepEqual(parseStamp(text), { source: 'README.md', hash: '0123456789abcdef' });
});

test('checkTranslation reports ok for an up-to-date CRLF translation', () => {
  const translation = applyStamp('# 標題\n', 'README.md', SOURCE).replaceAll('\n', '\r\n');
  assert.equal(checkTranslation({ path: 'README.zh-TW.md', text: translation, readSource: () => SOURCE }).status, 'ok');
});

test('applyStamp replaces the stamp of a file that holds only a stamp line', () => {
  const result = applyStamp('<!-- translation-of: README.md sha256:0123456789abcdef -->', 'README.md', SOURCE);
  assert.equal(result, `<!-- translation-of: README.md sha256:${hashSource(SOURCE)} -->\n`);
});

test('isTranslationPath ignores two-letter suffixes that are not supported locales', () => {
  for (const path of ['docs/roadmap.io.md', 'notes.on.md', 'guide.up.md', 'README.xx-YY.md']) {
    assert.equal(isTranslationPath(path), false, path);
  }
  for (const path of ['README.zh-CN.md', 'README.ja.md', 'README.ko.md']) {
    assert.equal(isTranslationPath(path), true, path);
  }
});

test('findTranslations walks directories, skips build folders and returns POSIX paths', () => {
  const tree = {
    '': [dir('docs'), dir('node_modules'), dir('dist'), file('README.md'), file('README.zh-TW.md')],
    docs: [file('user-guide.md'), file('user-guide.zh-TW.md'), dir('nested')],
    'docs/nested': [file('deep.ja.md')],
    node_modules: [file('pkg.zh-TW.md')],
    dist: [file('copy.zh-TW.md')],
  };
  assert.deepEqual(findTranslations((relative) => tree[relative]), [
    'docs/user-guide.zh-TW.md',
    'docs/nested/deep.ja.md',
    'README.zh-TW.md',
  ]);
});

test('toRepoPath returns a POSIX path inside the root and null outside it', () => {
  assert.equal(toRepoPath('/repo', '/repo/docs/user-guide.zh-TW.md'), 'docs/user-guide.zh-TW.md');
  assert.equal(toRepoPath('/repo', '/other/README.zh-TW.md'), null);
  assert.equal(toRepoPath('/repo', '/repo'), null);
});

function dir(name) {
  return { name, isDirectory: () => true };
}

function file(name) {
  return { name, isDirectory: () => false };
}
