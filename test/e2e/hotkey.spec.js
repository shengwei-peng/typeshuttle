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

  test('the dialog preview shows eight lines and the remaining line count without scrolling', async ({ citrix }) => {
    await pasteViaHotkey(citrix, Array.from({ length: 30 }, (_, index) => `row ${index}`).join('\n'));

    const preview = overlay(citrix, '.dialog .preview');
    await expect(preview).toContainText('… 還有 22 行');
    expect(await preview.evaluate((element) => element.scrollHeight - element.clientHeight)).toBeLessThanOrEqual(1);
    await citrix.keyboard.press('Escape');
  });

  test('keeps leading, trailing and repeated spaces as plain spaces (F11)', async ({ citrix }) => {
    const text = ' lead\n    indented  twice   three \n        x';
    await pasteViaHotkey(citrix, text);
    await expect(overlay(citrix, '.dialog')).toBeVisible();
    await citrix.keyboard.press('Enter');

    await expect.poll(() => remoteText(citrix)).toBe(text);
    expect(await remoteText(citrix)).not.toContain(NBSP);
  });

  test('leaves a buffer that already preserves whitespace untouched (F11)', async ({ citrix }) => {
    await citrix.evaluate(() => { document.getElementById('CitrixClientImeBuffer').style.whiteSpace = 'pre-wrap'; });
    await pasteViaHotkey(citrix, '  a  b');

    await expect.poll(() => remoteText(citrix)).toBe('  a  b');
    expect(await citrix.evaluate(() => getComputedStyle(document.getElementById('CitrixClientImeBuffer')).whiteSpace)).toBe('pre-wrap');
  });

  test('sends Enter as keydown and keyup only, never a synthetic keypress (F10)', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'a\nb\nc');
    await expect(overlay(citrix, '.dialog')).toBeVisible();
    await citrix.keyboard.press('Enter');

    await expect.poll(() => remoteText(citrix)).toBe('a\nb\nc');
    const state = await remoteState(citrix);
    expect(state.keypresses.filter((key) => !key.trusted)).toEqual([]);
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
      async (key) => (await chrome.storage.session.get(key))[key]?.text ?? null,
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

  test('pressing the hotkey while typing stops the paste at its first key', async ({ citrix, serviceWorker, server }) => {
    const text = Array.from({ length: 40 }, (_, index) => `line ${index + 1}`).join('\n');
    const tabId = await tabIdOf(serviceWorker, `${server}/*`);
    const readRemaining = () => serviceWorker.evaluate(
      async (key) => (await chrome.storage.session.get(key))[key]?.text ?? null,
      `remaining:${tabId}`,
    );
    await pasteViaHotkey(citrix, text);
    await citrix.keyboard.press('Enter');
    await expect.poll(async () => (await remoteText(citrix)).length).toBeGreaterThan(20);

    await citrix.keyboard.press('Control+Shift+V');

    await expect(overlay(citrix, '.toast.warn')).toContainText('已中止：停在第');
    await expect(overlay(citrix, '.toast')).not.toContainText(['正在送出中']);
    await expect.poll(readRemaining).not.toBeNull();
    expect(await remoteText(citrix) + await readRemaining()).toBe(text);
    expect((await remoteState(citrix)).leaks).toEqual([]);
  });

  test('a panel send that cannot start because a key is held keeps the text for the panel', async ({ citrix, serviceWorker, server }) => {
    const tabId = await tabIdOf(serviceWorker, `${server}/*`);
    const readRemaining = () => serviceWorker.evaluate(
      async (key) => (await chrome.storage.session.get(key))[key]?.text ?? null,
      `remaining:${tabId}`,
    );
    await citrix.keyboard.down('Shift');

    const response = await sendToTab(serviceWorker, tabId, {
      type: 'typeshuttle/send-direct', text: 'echo keep me', sendTabKey: false, newlineKey: 'enter',
    });

    expect(response).toEqual({ accepted: true });
    await expect(overlay(citrix, '.toast.warn')).toContainText('內容已保留在面板', { timeout: 8000 });
    await citrix.keyboard.up('Shift');
    await expect.poll(readRemaining).toBe('echo keep me');
    expect(await remoteText(citrix)).toBe('');
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

test.describe('non-ASCII text on Windows sessions (F12, F13)', () => {
  test.use({ settings: { speed: 'fast' } });

  test('the confirmation dialog warns about non-ASCII text', async ({ citrix }) => {
    await pasteViaHotkey(citrix, '第一行\nsecond');
    await expect(overlay(citrix, '.dialog')).toContainText('內容含中文等非英數字');
    await citrix.keyboard.press('Escape');
  });

  test('ASCII-only text gets no non-ASCII warning', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'first\nsecond');
    await expect(overlay(citrix, '.dialog')).toBeVisible();
    await expect(overlay(citrix, '.dialog')).not.toContainText('非英數字');
    await citrix.keyboard.press('Escape');
  });

  test('without the setting, an app that commits the IME on Enter joins the lines', async ({ citrix }) => {
    await citrix.evaluate(() => { window.__emulateF13 = true; });
    await pasteViaHotkey(citrix, '中文\nnext');
    await citrix.keyboard.press('Enter');

    await expect.poll(() => remoteText(citrix)).toBe('中文next');
  });
});

test.describe('extra Enter after non-ASCII lines (imeCommitEnter)', () => {
  test.use({ settings: { speed: 'fast', imeCommitEnter: true } });

  test('keeps line breaks in an app that commits the IME on Enter', async ({ citrix }) => {
    await citrix.evaluate(() => { window.__emulateF13 = true; });
    await pasteViaHotkey(citrix, '中文\nascii\n標點。\nend');
    await citrix.keyboard.press('Enter');

    await expect.poll(() => remoteText(citrix)).toBe('中文\nascii\n標點。\nend');
    const enters = (await remoteState(citrix)).keys.filter((key) => key.key === 'Enter' && !key.trusted);
    expect(enters).toHaveLength(5);
  });
});

test.describe('precise transfer speed', () => {
  test.use({ settings: { speed: 'fast' } });

  test('is capped at normal even when the typing speed is fast', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'line 1\nline 2');
    await expect(overlay(citrix, '.dialog')).toBeVisible();
    await citrix.keyboard.press('p');

    await expect(overlay(citrix, '.toast.ok code')).toHaveText(/^[0-9a-f]{64}$/);
    const { inputLengths } = await remoteState(citrix);
    expect(Math.max(...inputLengths)).toBe(40);
  });
});

test.describe('English interface on the remote desktop page', () => {
  test.use({ settings: { speed: 'fast', uiLanguage: 'en' } });

  test('dialog, progress and notifications are in English', async ({ citrix }) => {
    await pasteViaHotkey(citrix, 'first\nsecond\n中文');
    await expect(overlay(citrix, '.dialog')).toContainText('Send to the remote desktop?');
    await expect(overlay(citrix, '.dialog')).toContainText('3 lines');
    await expect(overlay(citrix, '.dialog')).toContainText('Chinese or other non-ASCII characters');
    await expect(overlay(citrix, '.dialog button.primary')).toContainText('Send');
    await citrix.keyboard.press('Enter');

    await expect(overlay(citrix, '.toast.ok')).toContainText('Sent');
    await expect(overlay(citrix, '.toast.ok')).toContainText('3 lines');
    await expect.poll(() => remoteText(citrix)).toBe('first\nsecond\n中文');
  });

  test('an empty clipboard is reported in English', async ({ citrix }) => {
    await citrix.evaluate(() => navigator.clipboard.writeText(''));
    await citrix.keyboard.press('Control+Shift+V');
    await expect(overlay(citrix, '.toast.warn')).toContainText('Nothing to send');
  });
});

test.describe('test build hook', () => {
  const callHook = (page, payload) => page.evaluate((data) => new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const onReply = (event) => {
      if (event.data?.source !== 'typeshuttle-test-reply' || event.data.id !== id) return;
      window.removeEventListener('message', onReply);
      resolve(event.data.result);
    };
    window.addEventListener('message', onReply);
    window.postMessage({ source: 'typeshuttle-test', id, ...data }, '*');
  }), payload);

  test('changes settings and sends like the panel', async ({ citrix, serviceWorker }) => {
    expect(await callHook(citrix, { action: 'settings', values: { speed: 'fast', uiLanguage: 'en' } })).toEqual({ ok: true });
    await expect.poll(() => serviceWorker.evaluate(async () => (await chrome.storage.sync.get('uiLanguage')).uiLanguage)).toBe('en');

    const response = await callHook(citrix, {
      action: 'send',
      message: { type: 'typeshuttle/send-direct', text: 'a\tb\nc', sendTabKey: true, newlineKey: 'shift-enter' },
    });
    expect(response).toEqual({ accepted: true });
    await expect.poll(() => remoteText(citrix)).toBe('a\tb\nc');
    await expect(overlay(citrix, '.toast.ok')).toContainText('Sent');
  });
});
