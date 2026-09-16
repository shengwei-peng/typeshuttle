import { test, expect, pasteViaHotkey, remoteText, tabIdOf } from './fixtures.js';

test.use({ settings: { speed: 'fast' } });

// Extensions loaded with --load-extension cannot call runtime.reload(), so the orphaned-instance case after a reload is covered by the manual checklist in docs/testing.md.
test('injecting the content script again does not type a paste twice', async ({ citrix, server, serviceWorker }) => {
  const tabId = await tabIdOf(serviceWorker, `${server}/*`);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    await serviceWorker.evaluate((id) => chrome.scripting.executeScript({ target: { tabId: id }, files: ['content.js'] }), tabId);
  }

  await pasteViaHotkey(citrix, 'once');

  await expect.poll(() => remoteText(citrix)).toBe('once');
  await citrix.waitForTimeout(1000);
  expect(await remoteText(citrix)).toBe('once');
});
