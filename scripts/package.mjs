// Zips dist/extension into release/typeshuttle-<version>.zip and prints its sha256.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const releaseDir = path.join(root, 'release');
const zipPath = path.join(releaseDir, `typeshuttle-${version}.zip`);

await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: path.join(root, 'dist', 'extension') });

const sha256 = createHash('sha256').update(await readFile(zipPath)).digest('hex');
console.log(`Packaged ${path.relative(root, zipPath)}\nsha256 ${sha256}`);
