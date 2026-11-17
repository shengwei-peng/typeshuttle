import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { access, mkdir, readFile, rm } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
const releaseDir = path.join(root, 'release');
const zipPath = path.join(releaseDir, `typeshuttle-${version}.zip`);
const distDir = path.join(root, 'dist', 'extension');
const builtManifest = JSON.parse(await readFile(path.join(distDir, 'manifest.json'), 'utf8'));
if (builtManifest.version !== version) throw new Error(`dist/extension is version ${builtManifest.version}, expected ${version}; run npm run build first`);
await Promise.all(['en', 'zh_TW'].map((locale) => access(path.join(distDir, '_locales', locale, 'messages.json'))));

await mkdir(releaseDir, { recursive: true });
await rm(zipPath, { force: true });
execFileSync('zip', ['-r', '-X', '-q', zipPath, '.'], { cwd: distDir });

const sha256 = createHash('sha256').update(await readFile(zipPath)).digest('hex');
console.log(`Packaged ${path.relative(root, zipPath)}\nsha256 ${sha256}`);
