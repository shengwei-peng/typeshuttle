import { readFileSync } from 'node:fs';
import { test, expect, tabIdOf, overlay, pasteViaHotkey, remoteText, sendToTab } from './fixtures.js';

const readLocale = (locale) => JSON.parse(readFileSync(new URL(`../../src/_locales/${locale}/messages.json`, import.meta.url), 'utf8'));
const MESSAGES = { en: readLocale('en'), zh_TW: readLocale('zh_TW') };
const CJK = /[㐀-鿿＀-￯　-〿]/g;
const LANGUAGE_NAMES = ['繁體中文', 'English'];
const PRODUCT_NAME = 'TypeShuttle';
const ENGLISH_FRAGMENTS = Object.values(MESSAGES.en).flatMap(({ message }) => message
  .split(/\{\w+\}/)
  .map((part) => part.trim())
  .filter((part) => part.length >= 8 && /[a-z]{3}/i.test(part) && part !== PRODUCT_NAME));
const LOCALES = [
  { locale: 'en', lang: 'en', title: 'TypeShuttle settings' },
  { locale: 'zh_TW', lang: 'zh-Hant', title: 'TypeShuttle 設定' },
];

function leaks(text, locale) {
  const rest = LANGUAGE_NAMES.reduce((value, name) => value.split(name).join(''), text);
  if (locale === 'en') return [...new Set(rest.match(CJK) ?? [])];
  return ENGLISH_FRAGMENTS.filter((fragment) => rest.includes(fragment));
}

const pageText = (page) => page.evaluate(() => {
  const attributes = [...document.querySelectorAll('[placeholder],[aria-label],[title]')]
    .flatMap((element) => ['placeholder', 'aria-label', 'title'].map((name) => element.getAttribute(name) ?? ''));
  return [document.title, document.body.textContent, ...attributes].join('\n');
});

const overlayText = (page) => page.evaluate(() => [...document.querySelectorAll('typeshuttle-overlay')]
  .map((host) => [...(host.shadowRoot?.querySelectorAll('*') ?? [])]
    .flatMap((element) => [element.childNodes.length && [...element.childNodes].filter((node) => node.nodeType === 3).map((node) => node.data).join(''), element.getAttribute('aria-label') ?? ''])
    .join('\n'))
  .join('\n'));

const overflowing = (page) => page.evaluate(() => {
  const root = document.documentElement;
  const wide = root.scrollWidth > root.clientWidth + 1 ? ['page'] : [];
  const clipped = [...document.querySelectorAll('button, label, h1, h2, .notice, kbd, option')]
    .filter((element) => element.offsetParent !== null && element.scrollWidth > element.clientWidth + 1)
    .map((element) => element.id || element.textContent.trim().slice(0, 40));
  return [...wide, ...clipped];
});

async function openPanel({ context, extensionId, tabId }) {
  const panel = await context.newPage();
  await panel.setViewportSize({ width: 380, height: 700 });
  await panel.goto(`chrome-extension://${extensionId}/popup.html?tabId=${tabId}`);
  return panel;
}

for (const { locale, lang, title } of LOCALES) {
  test.describe(`${locale} interface`, () => {
    test.use({ settings: { speed: 'fast', uiLanguage: locale } });

    test('the options page uses only this language, including validation messages', async ({ context, extensionId, serviceWorker }) => {
      await serviceWorker.evaluate((value) => chrome.storage.sync.set({ uiLanguage: value }), locale);
      const page = await context.newPage();
      await page.goto(`chrome-extension://${extensionId}/options.html`);

      await expect(page).toHaveTitle(title);
      expect(await page.evaluate(() => document.documentElement.lang)).toBe(lang);
      expect(leaks(await pageText(page), locale)).toEqual([]);
      expect(await overflowing(page)).toEqual([]);

      await page.locator('#preciseDir').fill('~/-inbox');
      await page.locator('#preciseDir').dispatchEvent('change');
      await expect(page.locator('#save-status')).toHaveText(MESSAGES[locale].statusInvalid.message);
      await page.locator('#preciseDir').fill('~/typeshuttle-inbox');
      await page.locator('#preciseDir').dispatchEvent('change');
      await expect(page.locator('#save-status')).toHaveText(MESSAGES[locale].statusSaved.message);
      expect(leaks(await pageText(page), locale)).toEqual([]);
    });

    test('every panel state uses only this language', async ({ context, citrix, extensionId, serviceWorker, server }) => {
      await serviceWorker.evaluate(() => chrome.storage.sync.set({ suggestPreciseChars: 20, maxDirectChars: 60 }));
      const tabId = await tabIdOf(serviceWorker, `${server}/*`);
      await serviceWorker.evaluate((key) => chrome.storage.session.set({ [key]: { text: 'left over', pendingImeCommit: false } }), `remaining:${tabId}`);
      const panel = await openPanel({ context, extensionId, tabId });
      await expect(panel.locator('#ready')).toBeVisible();
      await expect(panel.locator('#remaining-banner')).toBeVisible();
      expect(await panel.evaluate(() => document.documentElement.lang)).toBe(lang);
      const texts = [await pageText(panel)];

      await panel.locator('#text').fill('first line\nsecond café line here');
      await expect(panel.locator('#warning')).toBeVisible();
      texts.push(await pageText(panel));
      expect(await overflowing(panel)).toEqual([]);
      await panel.locator('#text').fill('x'.repeat(80));
      await expect(panel.locator('#warning')).toContainText(MESSAGES[locale].panelOverLimit.message.split('{limit}')[0].trim());
      texts.push(await pageText(panel));

      await panel.locator('#mode-precise').click();
      await expect(panel.locator('#precise-details')).toBeVisible();
      texts.push(await pageText(panel));
      expect(await overflowing(panel)).toEqual([]);
      expect(leaks(texts.join('\n'), locale)).toEqual([]);
      expect(await remoteText(citrix)).toBe('');
    });

    test('panel messages for unusable tabs use only this language', async ({ context, citrix, extensionId, serviceWorker, server }) => {
      const texts = [];
      const blank = await context.newPage();
      await blank.goto('about:blank');
      const blankId = await tabIdOf(serviceWorker, 'about:blank');
      const unsupported = await openPanel({ context, extensionId, tabId: blankId });
      await expect(unsupported.locator('#state-title')).toHaveText(MESSAGES[locale].unsupportedTabTitle.message);
      texts.push(await pageText(unsupported));

      const tabId = await tabIdOf(serviceWorker, `${server}/*`);
      await citrix.bringToFront();
      await pasteViaHotkey(citrix, Array.from({ length: 60 }, (_, index) => `row ${index}`).join('\n'));
      await citrix.keyboard.press('Enter');
      await expect.poll(async () => (await remoteText(citrix)).length).toBeGreaterThan(0);
      const busy = await openPanel({ context, extensionId, tabId });
      await expect(busy.locator('#state-title')).toHaveText(MESSAGES[locale].busyTitle.message);
      texts.push(await pageText(busy));
      await busy.close();
      await citrix.bringToFront();
      await citrix.keyboard.press('q');
      await expect(overlay(citrix, '.toast.warn')).toBeVisible();

      await citrix.evaluate(() => document.getElementById('CitrixClientImeBuffer').remove());
      const missing = await openPanel({ context, extensionId, tabId });
      await expect(missing.locator('#state-title')).toHaveText(MESSAGES[locale].remoteMissingTitle.message);
      await expect(missing.locator('#state-action')).toHaveText(MESSAGES[locale].checkAgain.message);
      texts.push(await pageText(missing));
      expect(await overflowing(missing)).toEqual([]);

      expect(leaks(texts.join('\n'), locale)).toEqual([]);
    });

    test('dialog, progress and every notification on the remote desktop page use only this language', async ({ citrix, serviceWorker, server }) => {
      await serviceWorker.evaluate(() => chrome.storage.sync.set({ suggestPreciseChars: 20, maxDirectChars: 400, speed: 'safe' }));
      const texts = [];
      const collect = async () => texts.push(await overlayText(citrix));

      await pasteViaHotkey(citrix, Array.from({ length: 30 }, (_, index) => `row ${index} café`).join('\n'));
      await expect(overlay(citrix, '.dialog')).toBeVisible();
      await collect();
      await citrix.keyboard.press('Enter');
      await expect(overlay(citrix, '.progress')).toBeVisible();
      await collect();
      await citrix.keyboard.press('q');
      await expect(overlay(citrix, '.toast.warn')).toBeVisible();
      await collect();

      await citrix.evaluate(() => navigator.clipboard.writeText(''));
      await citrix.keyboard.press('Control+Shift+V');
      await expect(overlay(citrix, '.toast.warn')).toHaveCount(2);
      await collect();

      await pasteViaHotkey(citrix, 'y'.repeat(500));
      await expect(overlay(citrix, '.dialog')).toContainText(MESSAGES[locale].confirmExceedsLimit.message.split('{limit}')[1].slice(0, 10));
      await collect();
      await citrix.keyboard.press('Escape');
      await expect(overlay(citrix, '.dialog')).toHaveCount(0);

      const tabId = await tabIdOf(serviceWorker, `${server}/*`);
      await sendToTab(serviceWorker, tabId, { type: 'typeshuttle/send-direct', text: 'z'.repeat(500), sendTabKey: false, newlineKey: 'enter' });
      await expect(overlay(citrix, '.toast.error')).toBeVisible();
      await collect();

      await serviceWorker.evaluate(() => chrome.storage.sync.set({ speed: 'fast' }));
      await pasteViaHotkey(citrix, 'echo one\necho two');
      await expect(overlay(citrix, '.dialog')).toBeVisible();
      await citrix.keyboard.press('KeyP');
      await expect(overlay(citrix, '.toast.ok')).toBeVisible({ timeout: 30_000 });
      await collect();

      await pasteViaHotkey(citrix, 'single');
      await expect(overlay(citrix, '.toast.ok')).toHaveCount(2);
      await collect();

      await citrix.keyboard.down('Shift');
      await sendToTab(serviceWorker, tabId, { type: 'typeshuttle/send-direct', text: 'echo held', sendTabKey: false, newlineKey: 'enter' });
      await expect.poll(() => overlayText(citrix), { timeout: 8000 }).toContain(MESSAGES[locale].notStartedKeysHeldKept.message.slice(0, 12));
      await citrix.keyboard.up('Shift');
      await collect();

      const all = texts.join('\n');
      for (const key of ['confirmTitle', 'nonAsciiNotice', 'confirmSuggestPrecise', 'progressHint', 'emptyTitle', 'confirmExceedsLimit', 'overLimitTitle', 'doneTitle', 'preciseDoneBody', 'notStartedTitle']) {
        for (const part of MESSAGES[locale][key].message.split(/\{\w+\}/).map((value) => value.trim()).filter(Boolean)) expect(all, key).toContain(part);
      }
      expect(leaks(all.replace(/row \d+ café/g, ''), locale)).toEqual([]);
    });
  });
}
