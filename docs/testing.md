# Testing

TypeShuttle has three kinds of checks:

- **Unit tests** for the pure logic.
- **End-to-end tests** that load the extension into Chromium against emulator pages.
- **Manual checklists** for live remote desktop sessions.

This page explains how to run each one, what the automation cannot cover, and what to check before a release.

- [Unit tests](#unit-tests)
- [End-to-end tests](#end-to-end-tests)
- [Translation sync check](#translation-sync-check)
- [What automation cannot cover](#what-automation-cannot-cover)
- [Manual testing on live clients](#manual-testing-on-live-clients)
- [Release checklist](#release-checklist)

## Unit tests

```bash
npm ci
npm test
```

- **Runner:** `node:test`, over `test/unit/*.test.js` (Node.js 22 or newer).
- **Coverage:** measured for `src/core/**` and `scripts/lib/**`. The run fails below 80% line, function or branch coverage.
- **Scope:** everything that decides what gets typed lives in `src/core/`, and every change there needs a unit test. That covers normalization, typing plans, limits, the step runner, precise transfer commands, settings validation, hotkey matching and message validation.

To run a single file:

```bash
node --test test/unit/precise.test.js
```

## End-to-end tests

```bash
npx playwright install chromium   # once per machine
npm run test:e2e
```

`npm run test:e2e` builds the test variant into `dist/extension-test/` and then runs Playwright with one worker. For each test the harness:

- launches Playwright's bundled Chromium with `--load-extension`;
- serves `test/e2e/fake-citrix.html` from an HTTP server on `127.0.0.1`, under a path shaped like a Citrix session URL;
- relies on the test build's static host permission for `127.0.0.1`, so the content script registers at install without the permission prompt;
- opens the panel as `chrome-extension://<id>/popup.html?tabId=<tab>`, so it can target the emulator tab.

Failed tests keep a Playwright trace in `test-results/`.

### What the emulator reproduces

`fake-citrix.html` has the same hidden contenteditable `span#CitrixClientImeBuffer` as the real client. It implements the behaviors from [clients.md](clients.md#input-behaviors):

| Behavior | Emulation |
|---|---|
| F1 | The input element and its listeners |
| F5 | Any `keydown` makes the next `input` event disappear |
| F6 | Line feeds are removed from inserted text |
| F7 | An Enter `keydown` with `keyCode === 13` adds a newline |
| F8 | Tab characters in inserted text become spaces. A Tab `keydown` with `keyCode === 9` adds a real tab |
| F9 | Enter and Tab are accepted only when `keyCode` is visible to page scripts, which catches the isolated-world mistake |

The page records everything in `window.__remote`:

- `text`: what the remote session would receive;
- `keys` and `keyups`: key events that reached the client;
- `leaks`: hotkey or paste events that should never have reached it.

Tests assert on this object.

### What the e2e tests cover

- **Hotkey:** single-line paste without a dialog, with no hotkey leak; multi-line confirmation and text rules; <kbd>P</kbd> switches to precise transfer; <kbd>Esc</kbd> cancels without leaking; forged paste events are ignored; at most three toasts; Shift+Enter as the newline key.
- **Interruptions:** a key press aborts typing and leaves the remainder for the panel; the panel cannot start a second send.
- **Panel:** each mode shows only its own controls; sending waits for the tab to regain focus; real Tab keys for one send; precise transfer output decodes to the exact original bytes with a matching sha256; the limit warning for direct typing.
- **Options:** valid settings are saved; an unsafe remote directory is refused.
- **Re-injection:** injecting the content script twice still types a paste once.

## Translation sync check

English files are the source of truth. Every translation (`*.<locale>.md`, for example `README.zh-TW.md`) must start with a stamp on its first line. Recognized locales are listed in `SUPPORTED_LOCALES` in `scripts/lib/translation-sync.js`.

```html
<!-- translation-of: README.md sha256:<first 16 hex characters of the English file's hash> -->
```

```bash
npm run docs:check                            # fails if any translation is behind its English source
npm run docs:stamp -- README.zh-TW.md         # after updating the translation, record the English text it matches
```

The check reports four problems: a missing stamp, a stamp naming the wrong source, a missing source file, and a stale translation (the English file changed after the stamp). Line endings do not affect the hash.

## What automation cannot cover

- **The permission prompt:** `chrome.permissions.request` opens a browser dialog that only a person can accept. The e2e build therefore uses a static `127.0.0.1` host permission, and the 「在此網站啟用」 (Enable on this site) flow is tested manually.
- **Extension reloads:** an extension loaded with `--load-extension` cannot be brought back with `chrome.runtime.reload()` in the test browser. The e2e suite covers re-injection only. What happens in an open tab after a real reload is part of the manual checklist.
- **Branded Chrome and Edge:** Google Chrome 137 and later ignore `--load-extension`, so the automated runs use Playwright's Chromium. Chrome and Edge themselves are checked by loading the unpacked build manually.
- **Real client behavior:** the emulator only encodes behaviors we already know. New client versions, typing speed limits, full screen, Keyboard Lock and remote IMEs need live sessions.
- **Physical input:** keys that Playwright dispatches do not go through the local OS, the local IME or a physical keyboard.

## Manual testing on live clients

Run the common checklist on every supported client, then the client-specific items. Record the results in the pull request or release notes rather than in this file. Update the status in [clients.md](clients.md) to match.

### Setup

1. Build the extension with `npm run package`, unzip the archive into a new folder, and load it with **Load unpacked** at `chrome://extensions` (or `edge://extensions`). Use a fresh browser profile.
2. Write down:
   - the extension version;
   - the browser and its version;
   - the local OS and keyboard layout;
   - the client name and version;
   - the remote OS and remote IME.
3. On the remote side, open a bash terminal and a plain text editor with auto-indent turned off.
4. Prepare the test data locally:

```bash
# About 1,100 characters: ASCII, CJK and emoji, no tabs, exactly one trailing newline
yes 'TypeShuttle 測試 テスト 👍 0123456789' | head -n 36 > ts-1k.txt
# About 11,000 characters
yes 'TypeShuttle 測試 テスト 👍 0123456789' | head -n 360 > ts-10k.txt
# 100 KB of random bytes for precise transfer
head -c 102400 /dev/urandom > ts-100k.bin
wc -m ts-1k.txt ts-10k.txt && sha256sum ts-1k.txt ts-10k.txt ts-100k.bin
```

Copy a file to the clipboard with `wl-copy < ts-1k.txt` (Wayland), `xclip -selection clipboard < ts-1k.txt` (X11) or `pbcopy < ts-1k.txt` (macOS).

To capture typed text in a file on the remote side, run `cat > ~/ts-check.txt` in the terminal. Send the text, press <kbd>Enter</kbd> once (trailing newlines are trimmed before typing), then press <kbd>Ctrl</kbd>+<kbd>D</kbd>. Compare `wc -m` and `sha256sum` with the local values; the remote locale must be UTF-8. Keep each line shorter than 4,096 bytes, the terminal's line limit.

### Common checklist

| # | Steps | Expected |
|---|---|---|
| 1 | Open the client tab, open the panel, click 「在此網站啟用」 (Enable on this site) | The browser prompt names only this host. After you allow it, the panel is ready without reloading the page |
| 2 | Copy `echo hello`, focus the remote editor, press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> | The text appears once, without a dialog. No stray `V`, paste or shortcut reaches the remote side |
| 3 | Copy `繁體中文 日本語 한국어 👍🏽 é ∑` and send it into the editor. Do it once with the remote IME in native mode and once in English mode | The text is identical both times, and the remote IME mode is unchanged afterwards |
| 4 | Copy three lines and press the hotkey. Press <kbd>Esc</kbd>, then press the hotkey again and press <kbd>Enter</kbd> | The dialog previews the lines. <kbd>Esc</kbd> sends nothing. <kbd>Enter</kbd> types the three lines with no extra newline from the confirming key |
| 5 | Send `ts-1k.txt` into `cat > ~/ts-check.txt` at the 標準 (normal) and 快 (fast) speeds | `wc -m` and `sha256sum` match the local file. If characters are lost, repeat at 保守 (safe) and record the fastest speed that is lossless |
| 6 | Send `ts-10k.txt` the same way | The dialog suggests precise transfer. After you choose to send, the counts and hash still match |
| 7 | In the panel, type `all:` and a tab-indented `make build` on the next line, turn on 「這次送出 Tab 鍵」 (Send the Tab key this time), and send into `cat > ~/ts-tab.txt` | `cat -A ~/ts-tab.txt` shows `^I` before `make build` |
| 8 | Set the panel's newline key to Shift+Enter and send two lines into a remote app where Shift+Enter inserts a line break, such as a chat box | The lines are separated without submitting, and the remote IME mode is unchanged |
| 9 | Send `ts-10k.txt` into the editor and press a letter key halfway through. Repeat, aborting with a mouse click, and again by switching tabs | Typing stops and the letter is not typed remotely. The toast names the line where it stopped. The panel offers the remainder, and sending it after moving the cursor completes the text with nothing missing or duplicated |
| 10 | Send direct text from the panel | Typing starts only after the panel closes and the tab has focus. If you switch to another window within 5 seconds, nothing is typed and the text stays in the panel |
| 11 | At a bash prompt, switch the panel to 「精確傳輸」 (Precise transfer), paste text containing tabs, trailing spaces and a trailing blank line, and send | A file with the name shown in the panel appears in `~/typeshuttle-inbox/`, and the printed sha256 equals the one in the panel and the toast |
| 12 | Pick `ts-100k.bin` in precise transfer mode and send | The printed sha256 matches the local `sha256sum` |
| 13 | Copy `ts-10k.txt`, press the hotkey, then press <kbd>P</kbd> | Precise transfer runs and the sha256 matches the local file |
| 14 | Abort a precise transfer halfway | The toast asks you to press <kbd>Ctrl</kbd>+<kbd>C</kbd>. Doing so returns to the prompt. Delete the partial file |
| 15 | Repeat items 2 and 9 with the client's own full-screen control, then with browser full screen (<kbd>F11</kbd>) | Record whether the hotkey is intercepted and whether aborting works. The client's own control is where Keyboard Lock may apply |
| 16 | With the client tab still open, reload the extension at `chrome://extensions` without reloading the tab, then press the hotkey. Open the panel, then press the hotkey again | TypeShuttle types nothing on the first press; the shortcut reaches the client as an ordinary key press. After the panel re-injects the script, each press types the text exactly once |
| 17 | With a local IME active, such as a Chinese or Japanese input method, press the hotkey and use <kbd>Enter</kbd>, <kbd>Esc</kbd> and <kbd>P</kbd> in the dialog | The hotkey and the dialog keys still work |
| 18 | Remove the site on the options page, then reload the client tab | The hotkey is no longer intercepted, and `chrome://extensions` shows no access to the host |

### Citrix Workspace app for HTML5

- **Before you start:** make sure clipboard redirection is unavailable for the session, or leave it enabled but do not use it. Otherwise the checks cannot tell TypeShuttle's typing apart from the client's own paste.
- **Which host to enable:** if the session opens in a new tab or window, enable the host of that tab.
- **Checking the input element:** in DevTools on the session tab, `document.getElementById('CitrixClientImeBuffer')` must return an element while the session is connected.
- **Remote IME:** for item 3, use a remote IME that converts key codes, such as Zhuyin, Pinyin or Japanese. The behavior in F3 is what this item protects against.
- **Keyboard Lock:** for item 15, use the full-screen control in the session toolbar.

If something fails after a Citrix update, re-check the input behaviors from the DevTools console of the session tab. Focus the remote text editor first. Paste the snippet, press <kbd>Enter</kbd>, and click inside the session within 3 seconds; the click gives the page focus and does not trigger F5. The console runs in the page's own world, so F9 does not apply there.

```js
setTimeout(() => {
  const buffer = document.getElementById('CitrixClientImeBuffer');
  const enter = (type) => buffer.dispatchEvent(new KeyboardEvent(type, { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
  buffer.focus();
  document.execCommand('insertText', false, 'abc');   // F2, F4: "abc" appears remotely
  document.execCommand('insertText', false, 'a\nb');  // F6: "ab" appears (line feed removed)
  enter('keydown');
  enter('keyup');                                     // F7: a new line starts
  document.execCommand('insertText', false, 'lost');  // F5: "lost" does not appear
  buffer.dispatchEvent(new InputEvent('input', { data: '', inputType: 'insertText', bubbles: true }));
  document.execCommand('insertText', false, 'kept');  // F5 workaround: "kept" appears
}, 3000);
```

If a behavior changed, update [clients.md](clients.md), the emulator page and the adapter together.

## Release checklist

1. **Checks:** on a clean checkout of the release commit, `npm ci`, `npm test`, `npm run test:e2e` and `npm run docs:check` all pass.
2. **Version:** `package.json` has the new version and `CHANGELOG.md` has an entry for it.
3. **Package:** `npm run package` succeeds. Note the printed sha256.
4. **Archive contents:**
   - `unzip -l release/typeshuttle-<version>.zip` lists only the built extension: `manifest.json`, the bundled scripts, HTML, CSS and icons. No sources, tests or emulator pages.
   - `unzip -p release/typeshuttle-<version>.zip manifest.json` shows the name `TypeShuttle`, the right `version`, and no `host_permissions`.
5. **Install:** load the unzipped archive in Chrome and in Edge with fresh profiles.
   - The extension loads without errors in `chrome://extensions`.
   - No site access is granted until a site is enabled.
6. **Live clients:** run the [manual checklist](#manual-testing-on-live-clients) on this build for every client marked **Verified**. If a client's checklist was not run, lower its status to **Should work**.
7. **Documentation:**
   - Update the statuses in [clients.md](clients.md) with the extension version and month.
   - Translations are updated and stamped.
   - If permissions or stored data changed, update [PRIVACY.md](PRIVACY.md) and the permission tables in the README and [ARCHITECTURE.md](ARCHITECTURE.md#permissions).
8. **Publish:** attach the zip and its sha256 to the release.
