// Precise transfer (docs/ARCHITECTURE.md#precise-transfer): gzip -> base64 -> a bash heredoc that decodes, saves and prints the sha256.
// The directory and file name end up in a shell command, so both are validated against an allowlist.

export const HEREDOC_DELIMITER = 'TYPESHUTTLE_EOF';
const BASE64_LINE_WIDTH = 76;

const SAFE_DIR_PATTERN = /^(~\/|\/)?[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/;
const SAFE_FILENAME_PATTERN = /^[A-Za-z0-9._-]+$/;
const MAX_FILENAME_LENGTH = 80;
const BASE64_BATCH_BYTES = 0x8000;

export function isSafeDir(dir) {
  return typeof dir === 'string' && SAFE_DIR_PATTERN.test(dir) && !dir.split('/').includes('..');
}

export function toBase64(bytes) {
  const batches = Array.from({ length: Math.ceil(bytes.length / BASE64_BATCH_BYTES) }, (_, index) =>
    String.fromCharCode(...bytes.subarray(index * BASE64_BATCH_BYTES, (index + 1) * BASE64_BATCH_BYTES)),
  );
  return btoa(batches.join(''));
}

export function fromBase64(text) {
  try {
    return Uint8Array.from(atob(text), (char) => char.charCodeAt(0));
  } catch {
    throw new Error('Invalid base64 payload');
  }
}

export function wrapLines(text, width) {
  return Array.from({ length: Math.ceil(text.length / width) }, (_, index) =>
    text.slice(index * width, (index + 1) * width),
  );
}

export async function gzip(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export async function sha256Hex(bytes) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function sanitizeFilename(name) {
  const baseName = name.split(/[\\/]/).pop();
  return baseName
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/\.{2,}/g, '.')
    .replace(/^_+/, '')
    .slice(0, MAX_FILENAME_LENGTH);
}

const pad = (value) => String(value).padStart(2, '0');

function timestamp(date) {
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${day}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

export function buildFilename(date, originalName) {
  const stamp = timestamp(date);
  if (originalName === undefined) return `${stamp}.txt`;
  const safeName = sanitizeFilename(originalName);
  if (safeName === '' || safeName === '.') return `${stamp}.bin`;
  return safeName.startsWith('.') ? `${stamp}${safeName}` : `${stamp}_${safeName}`;
}

export function buildPreciseCommand({ dir, filename, base64Lines }) {
  if (!isSafeDir(dir)) throw new Error(`Unsafe directory for precise transfer: ${dir}`);
  if (!SAFE_FILENAME_PATTERN.test(filename)) throw new Error(`Unsafe filename for precise transfer: ${filename}`);
  const target = `${dir}/${filename}`;
  return [
    `mkdir -p ${dir} && base64 -d <<'${HEREDOC_DELIMITER}' | gunzip > ${target}`,
    ...base64Lines,
    HEREDOC_DELIMITER,
    `sha256sum ${target}`,
    '',
  ].join('\n');
}

export async function preparePrecise({ bytes, date, dir, originalName, lineWidth = BASE64_LINE_WIDTH }) {
  const [compressed, sha256] = await Promise.all([gzip(bytes), sha256Hex(bytes)]);
  const base64Lines = wrapLines(toBase64(compressed), lineWidth);
  const filename = buildFilename(date, originalName);
  return {
    commandText: buildPreciseCommand({ dir, filename, base64Lines }),
    sha256,
    filename,
    targetPath: `${dir}/${filename}`,
    byteLength: bytes.length,
    compressedLength: compressed.length,
    payloadLines: base64Lines.length,
  };
}
