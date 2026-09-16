import { test, expect } from './fixtures.js';

test('options page saves valid settings and refuses an unsafe remote directory', async ({ context, extensionId, serviceWorker }) => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByLabel('保守').check();
  await expect(page.locator('#save-status')).toHaveText('已儲存');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('speed')).speed)).toBe('safe');

  await page.locator('#preciseDir').fill('~/inbox; rm -rf ~');
  await page.locator('#preciseDir').blur();
  await expect(page.locator('#save-status')).toContainText('沒有儲存');
  await expect(page.locator('#preciseDir')).toHaveAttribute('aria-invalid', 'true');
  const storedDir = await serviceWorker.evaluate(async () => (await chrome.storage.sync.get('preciseDir')).preciseDir);
  expect(storedDir).not.toBe('~/inbox; rm -rf ~');

  await expect(page.locator('#site-list')).toContainText('http://127.0.0.1');
});
