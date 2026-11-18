import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const EXTENSION_PATH = path.join(root, 'dist', 'extension-test');
const REMOTE_PAGE = path.join(import.meta.dirname, 'demo', 'remote.html');
const ASSETS = path.join(root, 'assets');
const VIEWPORT = { width: 1000, height: 600 };
const FRAME_INTERVAL_MS = 100;
const FINAL_HOLD_MS = 3000;
const SESSION_PATH = '/Citrix/StoreWeb/clients/HTML5Client/src/SessionWindow.html';

const SCENES = {
  en: {
    locale: 'en',
    script: 'cat > deploy.sh <<\'EOF\'\n#!/usr/bin/env bash\nset -euo pipefail\nfor host in web-1 web-2; do\n    echo "Deploying to $host"\ndone\necho "Done"\nEOF\n',
    config: 'server {\n    listen 443 ssl;\n    server_name intranet.example;\n\n    location / {\n        proxy_pass http://127.0.0.1:8080;\n        proxy_set_header Host $host;\n    }\n}\n',
    captions: {
      copy: [{ text: 'Copy on your computer, then press' }, { key: 'Ctrl' }, { key: 'Shift' }, { key: 'V' }],
      confirm: [{ text: 'Check the preview, then press' }, { key: 'Enter' }],
      typing: [{ text: 'Typed line by line, indentation kept' }],
      run: [{ text: 'The last line waits for you:' }, { key: 'Enter' }],
      precise: [{ text: 'For exact files, press' }, { key: 'P' }, { text: 'for precise transfer' }],
      verified: [{ text: 'The remote sha256 matches the one shown locally' }],
    },
  },
  zh: {
    locale: 'zh_TW',
    script: 'cat > deploy.sh <<\'EOF\'\n#!/usr/bin/env bash\nset -euo pipefail\nfor host in web-1 web-2; do\n    echo "部署到 $host"\ndone\necho "部署完成 ✅"\nEOF\n',
    config: 'server {\n    listen 443 ssl;\n    server_name intranet.example;\n\n    location / {\n        proxy_pass http://127.0.0.1:8080;\n        proxy_set_header Host $host;\n    }\n}\n',
    captions: {
      copy: [{ text: '在本機複製後，按' }, { key: 'Ctrl' }, { key: 'Shift' }, { key: 'V' }],
      confirm: [{ text: '確認預覽後按' }, { key: 'Enter' }],
      typing: [{ text: '逐行打進遠端，縮排完整保留' }],
      run: [{ text: '最後一行由你決定何時執行：' }, { key: 'Enter' }],
      precise: [{ text: '要一字不差的檔案，按' }, { key: 'P' }, { text: '改用精確傳輸' }],
      verified: [{ text: '遠端算出的 sha256 與本機顯示的相同' }],
    },
  },
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function startServer() {
  const html = await readFile(REMOTE_PAGE);
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    response.end(html);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

async function openSession(origin, scene) {
  const context = await chromium.launchPersistentContext('', {
    channel: 'chromium',
    viewport: VIEWPORT,
    args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
    permissions: ['clipboard-read', 'clipboard-write'],
  });
  const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  await worker.evaluate((locale) => chrome.storage.sync.set({ uiLanguage: locale, speed: 'normal' }), scene.locale);
  await waitFor(() => worker.evaluate(async () => (await chrome.scripting.getRegisteredContentScripts()).length > 0));
  const page = await context.newPage();
  await page.goto(`${origin}${SESSION_PATH}?lang=${scene === SCENES.zh ? 'zh' : 'en'}`);
  const tabId = await worker.evaluate(async (pattern) => (await chrome.tabs.query({ url: pattern }))[0]?.id, `${origin}/*`);
  await waitFor(async () => {
    const status = await worker.evaluate(([id]) => chrome.tabs.sendMessage(id, { type: 'typeshuttle/status' }), [tabId]).catch(() => null);
    return status?.ready === true;
  });
  return { context, page };
}

async function waitFor(check, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await check()) return;
    await sleep(100);
  }
  throw new Error('Timed out waiting for the demo session');
}

function startCapture(page) {
  const frames = [];
  let running = true;
  const done = (async () => {
    while (running) {
      const startedAt = Date.now();
      frames.push({ at: startedAt, image: await page.screenshot({ type: 'png' }) });
      await sleep(Math.max(0, FRAME_INTERVAL_MS - (Date.now() - startedAt)));
    }
  })();
  return async () => {
    running = false;
    await done;
    return frames;
  };
}

const overlay = (page, selector) => page.locator(`typeshuttle-overlay ${selector}`);

async function paste(page, text) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await page.keyboard.press('Control+Shift+V');
}

async function play(page, scene) {
  const caption = (parts) => page.evaluate((value) => window.demo.caption(value), parts);
  await sleep(600);
  await page.evaluate((text) => window.demo.showCard(text), scene.script);
  await caption(scene.captions.copy);
  await sleep(1800);
  await page.evaluate(() => window.demo.hideCard());
  await paste(page, scene.script);
  await overlay(page, '.dialog').waitFor();
  await caption(scene.captions.confirm);
  await sleep(2200);
  const dialog = await overlay(page, '.dialog').screenshot();
  await page.keyboard.press('Enter');
  await caption(scene.captions.typing);
  await overlay(page, '.toast.ok').waitFor({ timeout: 30_000 });
  await sleep(900);
  await caption(scene.captions.run);
  await sleep(1300);
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.evaluate(() => [...document.querySelectorAll('typeshuttle-overlay')].forEach((host) => host.shadowRoot?.querySelectorAll('.toast').forEach((toast) => toast.remove())));
  await page.evaluate((text) => window.demo.showCard(text), scene.config);
  await caption(scene.captions.precise);
  await sleep(1800);
  await page.evaluate(() => window.demo.hideCard());
  await paste(page, scene.config);
  await overlay(page, '.dialog').waitFor();
  await sleep(1600);
  await page.keyboard.press('KeyP');
  await overlay(page, '.toast.ok').waitFor({ timeout: 30_000 });
  await page.locator('#terminal .hash').waitFor();
  await caption(scene.captions.verified);
  await sleep(FINAL_HOLD_MS);
  return dialog;
}

async function writeGif(frames, output) {
  const unique = frames.reduce((list, frame) => {
    const last = list.at(-1);
    return last && last.image.equals(frame.image) ? list : [...list, frame];
  }, []);
  const directory = await mkdtemp(path.join(os.tmpdir(), 'typeshuttle-demo-'));
  try {
    const args = [];
    for (const [index, frame] of unique.entries()) {
      const file = path.join(directory, `${String(index).padStart(4, '0')}.png`);
      await writeFile(file, frame.image);
      const next = unique[index + 1]?.at ?? frame.at + FINAL_HOLD_MS;
      args.push('-delay', String(Math.max(2, Math.round((next - frame.at) / 10))), file);
    }
    execFileSync('magick', [...args, '-loop', '0', '-dither', 'None', '-colors', '192', '-layers', 'Optimize', output]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
  return unique.length;
}

async function writeSocialPreview(dialogImage, output) {
  const logo = await readFile(path.join(ASSETS, 'logo.svg'), 'utf8');
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    body { margin: 0; width: 1280px; height: 640px; display: flex; align-items: center; gap: 56px; padding: 0 72px; box-sizing: border-box;
      background: linear-gradient(150deg, #1d2b3a, #0f1720); color: #e8eef6; font-family: "Noto Sans", system-ui, sans-serif; }
    .text { flex: 1; }
    .logo { width: 96px; height: 96px; }
    h1 { margin: 20px 0 12px; font-size: 64px; letter-spacing: -0.01em; }
    p { margin: 0 0 28px; font-size: 28px; line-height: 1.35; color: #c4cfdc; }
    ul { margin: 0; padding: 0; list-style: none; display: flex; flex-wrap: wrap; gap: 10px; }
    li { padding: 6px 14px; border-radius: 999px; background: rgb(43 179 192 / 18%); color: #8fe3ea; font-size: 18px; }
    img.shot { width: 460px; border-radius: 12px; box-shadow: 0 24px 60px rgb(0 0 0 / 50%); }
  </style></head><body>
    <div class="text">
      <img class="logo" src="data:image/svg+xml;base64,${Buffer.from(logo).toString('base64')}" alt="">
      <h1>TypeShuttle</h1>
      <p>Paste into Citrix Workspace in the browser when the clipboard is disabled.</p>
      <ul><li>Chrome &amp; Edge</li><li>CJK and emoji</li><li>Byte-exact files with sha256</li><li>No network access</li></ul>
    </div>
    <img class="shot" src="data:image/png;base64,${dialogImage.toString('base64')}" alt="">
  </body></html>`;
  const browser = await chromium.launch({ channel: 'chromium' });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 640 } });
    await page.setContent(html);
    await page.screenshot({ path: output, type: 'png' });
  } finally {
    await browser.close();
  }
}

async function main() {
  const { server, origin } = await startServer();
  try {
    let englishDialog = null;
    for (const [name, scene] of Object.entries(SCENES)) {
      const { context, page } = await openSession(origin, scene);
      try {
        const stop = startCapture(page);
        const dialog = await play(page, scene);
        const frames = await stop();
        const output = path.join(ASSETS, `demo-${name === 'zh' ? 'zh-TW' : 'en'}.gif`);
        const count = await writeGif(frames, output);
        console.log(`Wrote ${path.relative(root, output)} (${count} frames)`);
        if (name === 'en') englishDialog = dialog;
      } finally {
        await context.close();
      }
    }
    const preview = path.join(ASSETS, 'social-preview.png');
    await writeSocialPreview(englishDialog, preview);
    console.log(`Wrote ${path.relative(root, preview)}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

await main();
