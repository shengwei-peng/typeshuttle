import { test as base, expect, chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '../..');
const EXTENSION_PATH = path.join(root, 'dist', 'extension-test');
const FAKE_CITRIX = path.join(import.meta.dirname, 'fake-citrix.html');

export const test = base.extend({
  settings: [{}, { option: true }],

  server: [async ({}, use) => {
    const html = await readFile(FAKE_CITRIX);
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      response.end(html);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    await use(`http://127.0.0.1:${server.address().port}`);
    await new Promise((resolve) => server.close(resolve));
  }, { scope: 'worker' }],

  context: async ({}, use) => {
    const context = await chromium.launchPersistentContext('', {
      channel: 'chromium',
      args: [`--disable-extensions-except=${EXTENSION_PATH}`, `--load-extension=${EXTENSION_PATH}`],
      permissions: ['clipboard-read', 'clipboard-write'],
    });
    await use(context);
    await context.close();
  },

  serviceWorker: async ({ context }, use) => {
    const [existing] = context.serviceWorkers();
    await use(existing ?? await context.waitForEvent('serviceworker'));
  },

  extensionId: async ({ serviceWorker }, use) => {
    await use(new URL(serviceWorker.url()).host);
  },

  citrix: async ({ context, server, serviceWorker, settings }, use) => {
    await serviceWorker.evaluate((values) => chrome.storage.sync.set(values), settings);
    await expect.poll(() => serviceWorker.evaluate(
      async () => (await chrome.scripting.getRegisteredContentScripts()).length,
    )).toBeGreaterThan(0);
    const page = await context.newPage();
    await page.goto(`${server}/Citrix/StoreWeb/clients/HTML5Client/src/SessionWindow.html`);
    const tabId = await tabIdOf(serviceWorker, `${server}/*`);
    await expect.poll(() => sendToTab(serviceWorker, tabId, { type: 'typeshuttle/status' }).catch(() => null))
      .toEqual({ ready: true, busy: false });
    await use(page);
  },
});

export { expect };

export function tabIdOf(serviceWorker, urlPattern) {
  return serviceWorker.evaluate(async (pattern) => (await chrome.tabs.query({ url: pattern }))[0]?.id, urlPattern);
}

export function sendToTab(serviceWorker, tabId, message) {
  return serviceWorker.evaluate(([id, payload]) => chrome.tabs.sendMessage(id, payload), [tabId, message]);
}

export async function pasteViaHotkey(page, text) {
  await page.evaluate((value) => navigator.clipboard.writeText(value), text);
  await page.keyboard.press('Control+Shift+V');
}

export const remoteState = (page) => page.evaluate(() => structuredClone(window.__remote));
export const remoteText = async (page) => (await remoteState(page)).text;
export const overlay = (page, selector) => page.locator(`typeshuttle-overlay ${selector}`);
