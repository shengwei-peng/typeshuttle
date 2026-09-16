import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { test, expect, remoteText, tabIdOf, overlay } from './fixtures.js';

async function openPanel({ context, extensionId, serviceWorker, server }) {
  const tabId = await tabIdOf(serviceWorker, `${server}/*`);
  const panel = await context.newPage();
  await panel.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
  await expect(panel.locator('#ready')).toBeVisible();
  return panel;
}

test.use({ settings: { speed: 'fast' } });

test('panel shows only the controls of the selected mode', async ({ context, citrix, extensionId, serviceWorker, server }) => {
  const panel = await openPanel({ context, extensionId, serviceWorker, server });

  await expect(panel.locator('#direct-options')).toBeVisible();
  await expect(panel.locator('#file-row')).toBeHidden();
  await expect(panel.locator('#precise-details')).toBeHidden();
  await expect(panel.locator('#precise-note')).toBeHidden();
  await expect(panel.locator('#remaining-banner')).toBeHidden();

  await panel.locator('#mode-precise').click();

  await expect(panel.locator('#direct-options')).toBeHidden();
  await expect(panel.locator('#file-row')).toBeVisible();
  await expect(panel.locator('#precise-note')).toBeVisible();
  await expect(panel.locator('#precise-details')).toBeHidden();
  expect(await remoteText(citrix)).toBe('');
});

test('panel sends text once the remote desktop tab has focus again', async ({ context, citrix, extensionId, serviceWorker, server }) => {
  const panel = await openPanel({ context, extensionId, serviceWorker, server });
  await panel.locator('#text').fill('從面板送出\n\t第二行');
  await expect(panel.locator('#stats')).toContainText('2 行');

  await panel.locator('#send').click();
  await citrix.bringToFront();

  await expect.poll(() => remoteText(citrix)).toBe('從面板送出\n    第二行');
  await expect(overlay(citrix, '.toast.ok')).toContainText('已送出');
});

test('panel can send real Tab keys for this send only', async ({ context, citrix, extensionId, serviceWorker, server }) => {
  const panel = await openPanel({ context, extensionId, serviceWorker, server });
  await panel.locator('#text').fill('all:\n\tmake build');
  await panel.locator('#send-tab').check();

  await panel.locator('#send').click();
  await citrix.bringToFront();

  await expect.poll(() => remoteText(citrix)).toBe('all:\n\tmake build');
});

test('precise transfer types a command whose payload restores the exact file bytes', async ({ context, citrix, extensionId, serviceWorker, server }) => {
  const bytes = Buffer.concat([
    Buffer.from('#!/bin/bash\r\n\techo "中文 👍"\n', 'utf8'),
    Buffer.from(Array.from({ length: 2048 }, (_, index) => (index * 37) % 256)),
  ]);
  const panel = await openPanel({ context, extensionId, serviceWorker, server });
  await panel.locator('#mode-precise').click();
  await panel.locator('#file').setInputFiles({ name: '部署 script.sh', mimeType: 'application/octet-stream', buffer: bytes });
  await expect(panel.locator('#precise-details')).toBeVisible();
  const expectedSha = createHash('sha256').update(bytes).digest('hex');
  await expect(panel.locator('#detail-sha')).toHaveText(expectedSha);
  const targetPath = await panel.locator('#detail-path').textContent();
  expect(targetPath).toMatch(/^~\/typeshuttle-inbox\/\d{4}-\d{2}-\d{2}_\d{6}_script\.sh$/);

  await panel.locator('#send').click();
  await citrix.bringToFront();

  await expect.poll(() => remoteText(citrix), { timeout: 30_000 }).toContain(`sha256sum ${targetPath}\n`);
  const lines = (await remoteText(citrix)).split('\n');
  expect(lines[0]).toBe(`mkdir -p ~/typeshuttle-inbox && base64 -d <<'TYPESHUTTLE_EOF' | gunzip > ${targetPath}`);
  const payload = lines.slice(1, lines.indexOf('TYPESHUTTLE_EOF')).join('');
  expect(gunzipSync(Buffer.from(payload, 'base64')).equals(bytes)).toBe(true);
  await expect(overlay(citrix, '.toast.ok code')).toHaveText(expectedSha);
});

test('panel warns when direct text exceeds the limit', async ({ context, citrix, extensionId, serviceWorker, server }) => {
  await serviceWorker.evaluate(() => chrome.storage.sync.set({ maxDirectChars: 10 }));
  const panel = await openPanel({ context, extensionId, serviceWorker, server });
  await panel.locator('#text').fill('this text is too long');

  await expect(panel.locator('#warning')).toContainText('超過直接打字上限');
  await expect(panel.locator('#send')).toBeDisabled();
  expect(await remoteText(citrix)).toBe('');
});
