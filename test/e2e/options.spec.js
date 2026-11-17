import { test, expect } from './fixtures.js';

test('options page saves valid settings and refuses an unsafe remote directory', async ({ context, extensionId, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.sync.set({ uiLanguage: 'zh_TW' }));
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await page.getByLabel('保守').check();
  await expect(page.locator('#save-status')).toHaveText('已儲存');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('speed')).speed)).toBe('safe');

  await page.locator('#imeCommitEnter').check();
  await expect(page.locator('#save-status')).toHaveText('已儲存');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('imeCommitEnter')).imeCommitEnter)).toBe(true);

  await page.locator('#preciseDir').fill('~/inbox; rm -rf ~');
  await page.locator('#preciseDir').blur();
  await expect(page.locator('#save-status')).toContainText('沒有儲存');
  await expect(page.locator('#preciseDir')).toHaveAttribute('aria-invalid', 'true');
  const storedDir = await serviceWorker.evaluate(async () => (await chrome.storage.sync.get('preciseDir')).preciseDir);
  expect(storedDir).not.toBe('~/inbox; rm -rf ~');

  await expect(page.locator('#site-list')).toContainText('http://127.0.0.1');
});

const CJK = /[\u3400-\u9fff\uff00-\uffef\u3000-\u303f]/;

test('options page follows the browser language and switches language as soon as it is changed', async ({ context, extensionId, serviceWorker }) => {
  await serviceWorker.evaluate(() => chrome.storage.sync.clear());
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/options.html`);

  await expect(page.locator('h1')).toHaveText('Settings');
  await expect(page).toHaveTitle('TypeShuttle settings');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('en');
  const englishText = (await page.locator('body').innerText()).replace('繁體中文', '');
  expect(englishText).not.toMatch(CJK);

  await expect(page.locator('#site-list button')).toHaveText('Remove');
  await page.locator('#uiLanguage').selectOption('zh_TW');
  await expect(page.locator('h1')).toHaveText('設定');
  await expect(page.locator('#site-list button')).toHaveText('移除');
  await expect(page.locator('#save-status')).toHaveText('已儲存');
  expect(await page.evaluate(() => document.documentElement.lang)).toBe('zh-Hant');
  await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('uiLanguage')).uiLanguage)).toBe('zh_TW');

  await page.locator('#uiLanguage').selectOption('en');
  await expect(page.locator('h1')).toHaveText('Settings');
  await expect(page.locator('#save-status')).toHaveText('Saved');
});
