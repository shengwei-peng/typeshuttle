import { test, expect, pasteViaHotkey, remoteState, remoteText, overlay, tabIdOf, sendToTab } from './fixtures.js';

const BOM = String.fromCodePoint(0xfeff);
const NBSP = String.fromCodePoint(0x00a0);
const ZERO_WIDTH_SPACE = String.fromCodePoint(0x200b);

test.describe('Ctrl+Shift+V on the remote desktop page', () => {
  test.use({ settings: { speed: 'fast' } });

  test('types a single line immediately and never lets Citrix see the hotkey', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'echo 你好 && ls -la {a,b} <tag>');

    await expect.poll(() => remoteText(citrix)).toBe('echo 你好 && ls -la {a,b} <tag>');
    const state = await remoteState(citrix);
    expect(state.leaks).toEqual([]);
    await expect(overlay(citrix, '.dialog')).toHaveCount(0);
    await expect(overlay(citrix, '.toast.ok')).toContainText('已送出');
  });

  test('asks before typing multi-line text and applies the text rules', async ({ citrix }) => {
    const raw = [`${BOM}第一行 Hello${NBSP}World${ZERO_WIDTH_SPACE}`, '\tindented {x: [1, 2]}', '', 'emoji 👍 done'].join('\r\n') + '\r\n';
    await pasteViaHotkey(citrix, raw);

    await expect(overlay(citrix, '.dialog')).toContainText('4 行');
    await expect(overlay(citrix, '.dialog .preview')).toContainText('indented');
    await citrix.keyboard.press('Enter');

    await expect.poll(() => remoteText(citrix)).toBe('第一行 Hello World\n    indented {x: [1, 2]}\n\nemoji 👍 done');
    const state = await remoteState(citrix);
    expect(state.leaks).toEqual([]);
    expect(state.keys.filter((key) => key.key === 'Enter' && key.trusted)).toEqual([]);
    expect(state.keyups.filter((key) => key.key === 'Enter' && key.trusted)).toEqual([]);
  });

  test('P in the confirmation dialog switches to precise transfer', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'line 1\nline 2');
    await expect(overlay(citrix, '.dialog')).toBeVisible();

    await citrix.keyboard.press('p');

    await expect.poll(() => remoteText(citrix)).toMatch(/^mkdir -p ~\/typeshuttle-inbox && base64 -d <<'TYPESHUTTLE_EOF'/);
    await expect(overlay(citrix, '.toast.ok code')).toHaveText(/^[0-9a-f]{64}$/);
    expect((await remoteState(citrix)).keys.some((key) => key.key === 'p')).toBe(false);
  });

  test('a paste event forged by the page is ignored even right after the hotkey', async ({ citrix }) => {
    await citrix.evaluate(() => navigator.clipboard.writeText(''));
    await citrix.evaluate(() => {
      window.addEventListener('keydown', () => {
        const data = new DataTransfer();
        data.setData('text/plain', 'rm -rf ~');
        window.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
      }, { capture: true, once: true });
    });
    await citrix.keyboard.press('Control+Shift+V');

    await expect(overlay(citrix, '.toast.warn')).toContainText('沒有可送出的文字');
    expect(await remoteText(citrix)).toBe('');
  });

  test('Escape in the confirmation dialog cancels without reaching the remote desktop', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'line 1\nline 2');
    await expect(overlay(citrix, '.dialog')).toBeVisible();

    await citrix.keyboard.press('Escape');

    await expect(overlay(citrix, '.dialog')).toHaveCount(0);
    const state = await remoteState(citrix);
    expect(state.text).toBe('');
    expect(state.keys.some((key) => key.key === 'Escape')).toBe(false);
  });
});

test.describe('notifications', () => {
  test.use({ settings: { speed: 'fast' } });

  test('keeps at most three notifications on screen', async ({ citrix }) => {
    for (const text of ['one', 'two', 'three', 'four']) {
      await pasteViaHotkey(citrix, text);
      await expect(overlay(citrix, '.toast.ok').last()).toContainText('已送出');
      await expect.poll(async () => (await remoteText(citrix)).endsWith(text)).toBe(true);
    }
    await expect(overlay(citrix, '.toast')).toHaveCount(3);
  });
});

test.describe('interrupting a paste', () => {
  test.use({ settings: { speed: 'safe' } });

  test('a key press stops typing and the remainder is kept for the panel', async ({ citrix, serviceWorker, server }) => {
    const text = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
    const tabId = await tabIdOf(serviceWorker, `${server}/*`);
    const readRemaining = () => serviceWorker.evaluate(
      async (key) => (await chrome.storage.session.get(key))[key] ?? null,
      `remaining:${tabId}`,
    );
    await pasteViaHotkey(citrix, text);
    await citrix.keyboard.press('Enter');
    await expect.poll(async () => (await remoteText(citrix)).length).toBeGreaterThan(20);

    await citrix.keyboard.press('q');

    await expect(overlay(citrix, '.toast.warn')).toContainText('已中止：停在第');
    await expect.poll(readRemaining).not.toBeNull();
    const typed = await remoteText(citrix);
    expect(typed + await readRemaining()).toBe(text);
    expect(typed).not.toContain('q');
    expect((await remoteState(citrix)).keyups.some((key) => key.key === 'q')).toBe(false);
  });

  test('the panel cannot start a second send while one is typing', async ({ citrix, serviceWorker, server }) => {
    const tabId = await tabIdOf(serviceWorker, `${server}/*`);
    await pasteViaHotkey(citrix, Array.from({ length: 20 }, (_, index) => `row ${index}`).join('\n'));
    await citrix.keyboard.press('Enter');
    await expect.poll(async () => (await remoteText(citrix)).length).toBeGreaterThan(0);

    const response = await sendToTab(serviceWorker, tabId, {
      type: 'typeshuttle/send-direct', text: 'SECOND', sendTabKey: false, newlineKey: 'enter',
    });

    expect(response).toEqual({ accepted: false, reason: 'busy' });
  });
});

test.describe('newline key setting', () => {
  test.use({ settings: { speed: 'fast', newlineKey: 'shift-enter' } });

  test('presses Shift+Enter between lines', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'a\nb');
    await citrix.keyboard.press('Enter');

    await expect.poll(() => remoteText(citrix)).toBe('a\nb');
    const syntheticEnters = (await remoteState(citrix)).keys.filter((key) => key.key === 'Enter' && !key.trusted);
    expect(syntheticEnters).toEqual([{ key: 'Enter', shift: true, ctrl: false, trusted: false }]);
  });
});
