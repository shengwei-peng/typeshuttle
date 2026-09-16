// Builds the extension into dist/extension (with --test: dist/extension-test, which also grants 127.0.0.1 for e2e tests).
import { build } from 'esbuild';
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const isTest = process.argv.includes('--test');
const outdir = path.join(root, 'dist', isTest ? 'extension-test' : 'extension');
const TEST_HOST_PERMISSIONS = ['http://127.0.0.1/*'];

const STATIC_FILES = [
  ['src/ui/tokens.css', 'tokens.css'],
  ['src/popup/popup.html', 'popup.html'],
  ['src/popup/popup.css', 'popup.css'],
  ['src/options/options.html', 'options.html'],
  ['src/options/options.css', 'options.css'],
  ['assets/icons', 'icons'],
];

const shared = {
  bundle: true,
  target: 'chrome120',
  legalComments: 'none',
  logLevel: 'warning',
  charset: 'utf8',
  define: { __TYPESHUTTLE_TEST__: String(isTest) },
};

async function bundle() {
  await build({ ...shared, entryPoints: { content: 'src/content/index.js' }, format: 'iife', outdir, absWorkingDir: root });
  await build({
    ...shared,
    entryPoints: { background: 'src/background.js', popup: 'src/popup/popup.js', options: 'src/options/options.js' },
    format: 'esm',
    outdir,
    absWorkingDir: root,
  });
}

async function writeManifest() {
  const pkg = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(root, 'src/manifest.json'), 'utf8'));
  const output = {
    ...manifest,
    version: pkg.version,
    ...(isTest ? { name: `${manifest.name} (test)`, host_permissions: TEST_HOST_PERMISSIONS } : {}),
  };
  await writeFile(path.join(outdir, 'manifest.json'), `${JSON.stringify(output, null, 2)}\n`);
}

await rm(outdir, { recursive: true, force: true });
await mkdir(outdir, { recursive: true });
await bundle();
await Promise.all(STATIC_FILES.map(([from, to]) => cp(path.join(root, from), path.join(outdir, to), { recursive: true })));
await writeManifest();
console.log(`Built ${path.relative(root, outdir)}`);
