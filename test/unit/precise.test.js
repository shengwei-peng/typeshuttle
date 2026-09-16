import { test } from 'node:test';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import {
  HEREDOC_DELIMITER,
  toBase64,
  fromBase64,
  wrapLines,
  gzip,
  sha256Hex,
  sanitizeFilename,
  buildFilename,
  buildPreciseCommand,
  preparePrecise,
} from '../../src/core/precise.js';

const DATE = new Date(2026, 8, 14, 15, 30, 12);

test('toBase64 matches Buffer encoding for large arbitrary bytes', () => {
  const bytes = Uint8Array.from({ length: 100_003 }, (_, i) => (i * 31 + 7) % 256);
  assert.equal(toBase64(bytes), Buffer.from(bytes).toString('base64'));
});

test('fromBase64 reverses toBase64 and rejects malformed input', () => {
  const bytes = Uint8Array.from({ length: 4099 }, (_, i) => (i * 17) % 256);
  assert.deepEqual(fromBase64(toBase64(bytes)), bytes);
  assert.throws(() => fromBase64('not base64!'), /base64/);
});

test('wrapLines splits a string into fixed-width lines', () => {
  assert.deepEqual(wrapLines('abcdefg', 3), ['abc', 'def', 'g']);
  assert.deepEqual(wrapLines('', 3), []);
});

test('gzip output round-trips through zlib', async () => {
  const bytes = new TextEncoder().encode('繁體中文 '.repeat(200));
  const compressed = await gzip(bytes);
  assert.deepEqual(new Uint8Array(gunzipSync(compressed)), bytes);
  assert.ok(compressed.length < bytes.length);
});

test('sha256Hex matches node crypto', async () => {
  const bytes = new TextEncoder().encode('TypeShuttle');
  assert.equal(await sha256Hex(bytes), createHash('sha256').update(bytes).digest('hex'));
});

test('sanitizeFilename keeps safe characters and replaces unsafe runs', () => {
  assert.equal(sanitizeFilename('my report (v2).txt'), 'my_report_v2_.txt');
  assert.equal(sanitizeFilename('a;rm -rf ~;.sh'), 'a_rm_-rf_.sh');
  assert.equal(sanitizeFilename('../../etc/passwd'), 'passwd');
  assert.equal(sanitizeFilename('C:\\Users\\me\\notes.md'), 'notes.md');
  assert.equal(sanitizeFilename('x..y'), 'x.y');
  assert.equal(sanitizeFilename('a'.repeat(200)).length, 80);
});

test('buildFilename uses a local timestamp and keeps a sanitized original name', () => {
  assert.equal(buildFilename(DATE), '2026-09-14_153012.txt');
  assert.equal(buildFilename(DATE, 'my report.txt'), '2026-09-14_153012_my_report.txt');
  assert.equal(buildFilename(DATE, '報告.pdf'), '2026-09-14_153012.pdf');
  assert.equal(buildFilename(DATE, '報告'), '2026-09-14_153012.bin');
});

test('buildPreciseCommand produces mkdir, heredoc decode and checksum lines', () => {
  const command = buildPreciseCommand({ dir: '~/typeshuttle-inbox', filename: 'f.txt', base64Lines: ['QUJD', 'REVG'] });
  assert.equal(
    command,
    `mkdir -p ~/typeshuttle-inbox && base64 -d <<'${HEREDOC_DELIMITER}' | gunzip > ~/typeshuttle-inbox/f.txt\n` +
      `QUJD\nREVG\n${HEREDOC_DELIMITER}\nsha256sum ~/typeshuttle-inbox/f.txt\n`,
  );
});

test('buildPreciseCommand rejects unsafe directory or filename', () => {
  assert.throws(() => buildPreciseCommand({ dir: '~/x; rm -rf /', filename: 'f', base64Lines: [] }), /directory/);
  assert.throws(() => buildPreciseCommand({ dir: '~/x', filename: 'a b', base64Lines: [] }), /filename/);
  assert.throws(() => buildPreciseCommand({ dir: '~/../x', filename: 'f', base64Lines: [] }), /directory/);
});

test('preparePrecise payload decodes back to the original bytes with matching checksum', async () => {
  const bytes = new TextEncoder().encode('中文\r\n\tTab 👍\n最後一行沒有換行');
  const result = await preparePrecise({ bytes, date: DATE, dir: '~/typeshuttle-inbox' });
  const lines = result.commandText.split('\n');
  const end = lines.indexOf(HEREDOC_DELIMITER);
  const payload = lines.slice(1, end);

  assert.deepEqual(new Uint8Array(gunzipSync(Buffer.from(payload.join(''), 'base64'))), bytes);
  assert.equal(result.sha256, createHash('sha256').update(bytes).digest('hex'));
  assert.ok(payload.every((line) => line.length <= 76));
  assert.equal(result.filename, '2026-09-14_153012.txt');
  assert.equal(result.byteLength, bytes.length);
  assert.equal(result.payloadLines, payload.length);
});

test('preparePrecise keeps the sanitized original file name', async () => {
  const result = await preparePrecise({ bytes: new Uint8Array([0, 255]), date: DATE, dir: '/tmp/typeshuttle', originalName: 'data.bin' });
  assert.equal(result.filename, '2026-09-14_153012_data.bin');
  assert.match(result.commandText, /> \/tmp\/typeshuttle\/2026-09-14_153012_data\.bin\n/);
});
