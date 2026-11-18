const REPOSITORY_URL = 'https://github.com/shengwei-peng/typeshuttle';
const TAG_PATTERN = /^v\d+\.\d+\.\d+$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_HEADER = /^## \[?[^\]\n]+\]?(?:\(([^)]+)\))?.*$/m;
const SECTION_HEADER = /^### (.+)$/;
const SECTION_TITLES = {
  Features: '🚀 Highlights & Features',
  'Bug Fixes': '🛠 Fixes',
  'Performance Improvements': '⚡ Performance',
  Reverts: '↩️ Reverts',
  Documentation: '📝 Documentation',
};
const PRODUCT_HEADER = (tag) => `## TypeShuttle ${tag}`;
const RULE = '---';

export const isFormatted = (body) => body.trimStart().startsWith('## TypeShuttle ');

function parseSections(body) {
  const sections = body.split('\n').reduce((list, line) => {
    const header = SECTION_HEADER.exec(line);
    if (header) return [...list, { title: header[1].trim(), items: [] }];
    if (list.length === 0 || line.trim() === '') return list;
    const last = list[list.length - 1];
    return [...list.slice(0, -1), { ...last, items: [...last.items, line.replace(/^\* /, '- ')] }];
  }, []);
  return sections.filter((section) => section.items.length > 0);
}

function installation(zipName) {
  return [
    '### 📦 Installation',
    '',
    'TypeShuttle is not yet published on the Chrome Web Store. You can install it manually in Chrome or Edge:',
    '',
    `1. Download \`${zipName}\` from the **Assets** below.`,
    '2. Unzip the file into a permanent directory (e.g., `Documents/TypeShuttle`).',
    '3. Open `chrome://extensions` (or `edge://extensions`) in your browser.',
    '4. Enable **Developer mode** (toggle in the upper right corner of Chrome or left sidebar of Edge).',
    '5. Click **Load unpacked** and select the unzipped directory containing `manifest.json`.',
    '',
    'To upgrade without losing settings or enabled sites, unzip the new version over the same directory, then press **Reload** on the extension card.',
  ].join('\n');
}

function checksum(zipName, sha256) {
  return [
    '### 🔒 Verify Checksum',
    '',
    '| File | SHA-256 Checksum |',
    '| :--- | :--- |',
    `| \`${zipName}\` | \`${sha256}\` |`,
  ].join('\n');
}

export function formatReleaseNotes({ tag, body, zipName, sha256 }) {
  if (!TAG_PATTERN.test(tag)) throw new Error(`Unexpected release tag: ${tag}`);
  if (!SHA256_PATTERN.test(sha256)) throw new Error(`Unexpected sha256 checksum: ${sha256}`);
  const compareUrl = VERSION_HEADER.exec(body)?.[1] ?? `${REPOSITORY_URL}/commits/${tag}`;
  const sections = parseSections(body).map(({ title, items }) =>
    [`### ${SECTION_TITLES[title] ?? title}`, '', ...items].join('\n'));
  const blocks = [
    `${PRODUCT_HEADER(tag)}\n\n**TypeShuttle** \`${tag}\` is available. The changes in this release are listed below, and the extension package is attached under **Assets**.`,
    ...sections,
    installation(zipName),
    checksum(zipName, sha256),
    `**Full Changelog**: ${compareUrl}`,
  ];
  return `${blocks.join(`\n\n${RULE}\n\n`)}\n`;
}
