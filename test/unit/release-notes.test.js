import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatReleaseNotes, isFormatted } from '../../scripts/lib/release-notes.js';

const SHA = 'a'.repeat(64);
const GENERATED = [
  '## [0.3.0](https://github.com/owner/repo/compare/v0.2.0...v0.3.0) (2026-12-01)',
  '',
  '',
  '### Features',
  '',
  '* add a thing ([abc1234](https://github.com/owner/repo/commit/abc1234))',
  '',
  '',
  '### Bug Fixes',
  '',
  '* fix a bug ([abc1234](https://github.com/owner/repo/commit/abc1234))',
  '* fix another bug ([def5678](https://github.com/owner/repo/commit/def5678))',
  '',
  '',
  '### Performance Improvements',
  '',
  '* speed up a path ([abc1234](https://github.com/owner/repo/commit/abc1234))',
  '',
].join('\n');

const format = (body = GENERATED) => formatReleaseNotes({ tag: 'v0.3.0', body, zipName: 'typeshuttle-0.3.0.zip', sha256: SHA });

test('the notes start with the product heading and an introduction', () => {
  const lines = format().split('\n');
  assert.equal(lines[0], '## TypeShuttle v0.3.0');
  assert.match(lines[2], /^\*\*TypeShuttle\*\* `v0\.3\.0`/);
});

test('release-please sections get the release note headings and dash bullets', () => {
  const notes = format();
  assert.match(notes, /### 🚀 Highlights & Features\n\n- add a thing \(\[abc1234\]/);
  assert.match(notes, /### 🛠 Fixes\n\n- fix a bug .*\n- fix another bug /);
  assert.match(notes, /### ⚡ Performance\n\n- speed up a path /);
  assert.doesNotMatch(notes, /^\* /m);
  assert.doesNotMatch(notes, /\(2026-12-01\)/);
});

test('sections are separated by rules and no blank lines pile up', () => {
  const notes = format();
  assert.doesNotMatch(notes, /\n{3,}/);
  assert.ok(notes.split('\n---\n').length >= 5);
});

test('installation steps and the checksum table name the release asset', () => {
  const notes = format();
  assert.match(notes, /### 📦 Installation/);
  assert.match(notes, /1\. Download `typeshuttle-0\.3\.0\.zip` from the \*\*Assets\*\* below\./);
  assert.match(notes, /### 🔒 Verify Checksum\n\n\| File \| SHA-256 Checksum \|\n\| :--- \| :--- \|\n\| `typeshuttle-0\.3\.0\.zip` \| `a{64}` \|/);
});

test('the full changelog link comes from the release-please compare link', () => {
  assert.match(format(), /\*\*Full Changelog\*\*: https:\/\/github\.com\/owner\/repo\/compare\/v0\.2\.0\.\.\.v0\.3\.0\n$/);
});

test('without a compare link the full changelog points at the tag history', () => {
  const body = GENERATED.replace(/^## \[0\.3\.0\]\([^)]+\)/, '## 0.3.0');
  assert.match(format(body), /\*\*Full Changelog\*\*: https:\/\/github\.com\/shengwei-peng\/typeshuttle\/commits\/v0\.3\.0\n$/);
});

test('unknown sections keep their own heading', () => {
  const body = `${GENERATED}\n\n### Miscellaneous Chores\n\n* tidy up ([abc1234](https://github.com/owner/repo/commit/abc1234))\n`;
  assert.match(format(body), /### Miscellaneous Chores\n\n- tidy up /);
});

test('notes that are already formatted are recognized and not formatted again', () => {
  const notes = format();
  assert.equal(isFormatted(notes), true);
  assert.equal(isFormatted(GENERATED), false);
});

test('an invalid checksum or tag is rejected', () => {
  assert.throws(() => formatReleaseNotes({ tag: 'v0.3.0', body: GENERATED, zipName: 'a.zip', sha256: 'xyz' }), /sha256/);
  assert.throws(() => formatReleaseNotes({ tag: 'latest', body: GENERATED, zipName: 'a.zip', sha256: SHA }), /tag/);
});
