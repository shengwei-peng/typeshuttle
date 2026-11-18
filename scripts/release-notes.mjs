import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { formatReleaseNotes, isFormatted } from './lib/release-notes.js';

const { values } = parseArgs({ options: { tag: { type: 'string' }, zip: { type: 'string' } } });
if (!values.tag || !values.zip) throw new Error('Usage: node scripts/release-notes.mjs --tag vX.Y.Z --zip release/typeshuttle-X.Y.Z.zip < notes.md');

const chunks = [];
for await (const chunk of process.stdin) chunks.push(chunk);
const body = Buffer.concat(chunks).toString('utf8');

if (!isFormatted(body)) {
  const sha256 = createHash('sha256').update(await readFile(values.zip)).digest('hex');
  process.stdout.write(formatReleaseNotes({ tag: values.tag, body, zipName: path.basename(values.zip), sha256 }));
}
