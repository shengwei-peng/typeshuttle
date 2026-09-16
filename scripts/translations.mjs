// Translation sync CLI.
//   node scripts/translations.mjs check          fail if any translation is behind its English source
//   node scripts/translations.mjs stamp <file>…  mark translations as reviewed against the current English text
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  applyStamp,
  checkTranslation,
  findTranslations,
  isTranslationPath,
  sourcePathFor,
  toRepoPath,
} from './lib/translation-sync.js';

const root = path.resolve(import.meta.dirname, '..');

const MESSAGES = {
  stale: 'the English source changed; update the translation, then run `npm run docs:stamp --`',
  'missing-stamp': 'no translation stamp on the first line; run `npm run docs:stamp --` after reviewing it',
  'wrong-source': 'the stamp names a different source file',
  'missing-source': 'the English source file does not exist',
};

const read = (relative) => {
  const absolute = path.join(root, relative);
  return existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
};

const readDir = (relative) => readdirSync(path.join(root, relative), { withFileTypes: true });

function check() {
  const results = findTranslations(readDir).map((file) => checkTranslation({ path: file, text: read(file), readSource: read }));
  const failures = results.filter((result) => result.status !== 'ok');
  for (const { path: file, source, status } of failures) {
    process.stderr.write(`${file}: ${MESSAGES[status]} (${source})\n`);
  }
  process.stdout.write(`Checked ${results.length} translation(s), ${failures.length} out of sync.\n`);
  return failures.length === 0 ? 0 : 1;
}

function stamp(names) {
  if (names.length === 0) {
    process.stderr.write('Usage: npm run docs:stamp -- <translation.md>…\n');
    return 1;
  }
  for (const name of names) {
    const file = toRepoPath(root, path.resolve(name));
    const text = file && isTranslationPath(file) ? read(file) : null;
    const sourceText = text === null ? null : read(sourcePathFor(file));
    if (sourceText === null) {
      process.stderr.write(`${name}: not a translation inside the repository with an existing English source\n`);
      return 1;
    }
    writeFileSync(path.join(root, file), applyStamp(text, sourcePathFor(file), sourceText));
    process.stdout.write(`Stamped ${file} against ${sourcePathFor(file)}\n`);
  }
  return 0;
}

const [command, ...args] = process.argv.slice(2);
const commands = { check: () => check(), stamp: () => stamp(args) };
if (!commands[command]) {
  process.stderr.write('Usage: node scripts/translations.mjs <check|stamp> [files…]\n');
  process.exit(1);
}
process.exit(commands[command]());
