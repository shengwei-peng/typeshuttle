# Remote desktop clients

This page records how each browser-based remote desktop client handles input, what TypeShuttle does about it, and known limitations.

| Status | Meaning |
|---|---|
| **Verified** | The client's live-session checklist in [testing.md](testing.md#manual-testing-on-live-clients) passed with the listed extension version |
| **Should work** | The input behaviors were confirmed on a live session and the extension passes automated tests against an emulator, but the full live-session checklist has not been run |
| **Not supported** | There is no adapter for the client, or it is known not to work |

| Client | Status | Adapter |
|---|---|---|
| [Citrix Workspace app for HTML5](#citrix-workspace-app-for-html5) | Should work | `src/content/citrix-adapter.js` |
| [Other clients](#other-clients) | Not supported | — |

## Citrix Workspace app for HTML5

The client runs a Citrix session inside a browser tab. TypeShuttle is useful when clipboard redirection is unavailable or disabled for the session, but keyboard input is allowed.

### Input behaviors

These behaviors were observed on a live session, using Chrome on Linux with a Linux virtual desktop that had a Zhuyin (Bopomofo) IME. The HTML5 client version was not recorded, so other Citrix releases may behave differently. The IDs are referenced from [ARCHITECTURE.md](ARCHITECTURE.md), the emulator and the tests.

| ID | Behavior | How TypeShuttle handles it |
|---|---|---|
| F1 | Keyboard focus sits in a hidden contenteditable `span#CitrixClientImeBuffer`. It listens for `keydown`, `keypress`, `keyup`, `composition*`, `input`, `textInput` and `paste` | All injection targets this element. When it is missing, the hotkey is not intercepted and the panel reports that no remote desktop was found |
| F2 | Text that arrives through an `input` event is sent to the session as Unicode, independent of the remote IME. CJK text and symbols arrive intact | All text goes through the input path |
| F3 | Simulated physical keys, including key codes, pass through the remote IME. `Hi 12` arrived as Zhuyin symbols | OS-level keystroke tools are not used for text |
| F4 | `document.execCommand('insertText', false, text)` from the page inserts text | No `debugger` permission is needed |
| F5 | After any key event, the next text input is dropped. Mouse clicks do not cause this | An empty `insertText` input event is dispatched before every chunk. When nothing is being dropped, the extra event has no effect |
| F6 | Line feeds inside inserted text are removed. `insertLineBreak` and `insertParagraph` have no effect | Text is typed line by line with an Enter key event between lines |
| F7 | Enter `KeyboardEvent`s created by the page (`keydown` and `keyup`) are forwarded to the session | Newlines are synthetic Enter presses (`keydown` and `keyup` only, see F10) |
| F8 | A tab character becomes a single space | Tabs become spaces (default 4). The panel can send real Tab key events for one send |
| F9 | Content scripts run in an isolated world. A `keyCode` added to an event with `Object.defineProperty` is invisible to the client's scripts | `keyCode` and `which` are passed to the `KeyboardEvent` constructor |
| F10 | After the page dispatched synthetic `keypress` events with a non-ASCII char code, the client started forwarding keypress char codes as characters: every later synthetic Enter `keypress` arrived in the session as a stray symbol instead of a line break, and switching windows did not reset it. Enter sent as `keydown` and `keyup` kept working | No synthetic `keypress` is ever dispatched |
| F11 | The client reads the text of the buffer element, not `InputEvent.data`. With the client's `white-space: nowrap`, Chrome stores leading, trailing and repeated spaces as NO-BREAK SPACE (U+00A0), which then reaches the session; one space was also lost | The buffer gets `white-space: pre` before text is inserted, so spaces stay U+0020 |
| F12 | Windows sessions only. Characters outside ASCII arrive as an uncommitted composition of the remote IME. PuTTY on the remote side kept `你好，世界。` in order. In Chrome on the remote side, a run of Han characters that directly follows a non-ASCII character (full-width punctuation, kana) is committed after the characters typed later, so `你好，世界。` became `你好，。世界`. Sending the runs separately, waiting up to 1.5 s between them, synthetic composition events and an extra Ctrl press did not change the result | Cannot be fixed from the page. The dialog and the panel warn when the text contains non-ASCII characters |
| F13 | Windows sessions with the remote Zhuyin IME loaded. In PuTTY on the remote side, the Enter after a line that contains any non-ASCII character is often used up, so the next line is joined to it. It is not consistent: in one session 186 of 225 such Enters were used up, and the result changed from run to run. In a later session whose remote windows had only an English keyboard, no Enter was used up in more than 360 such lines, and the extra Enter produced a blank line after every one. Lines with ASCII only are not affected, and Chrome on the remote side does not use up the Enter | Cannot be fixed reliably from the page. The **Extra Enter after lines with non-ASCII characters** (「含中文等非英數字的行，行尾多按一次 Enter」) setting (off by default) adds a second Enter, which joins fewer lines but leaves blank lines whenever the first Enter was not used up. Precise transfer is the reliable way. The dialog and the panel warn when the text contains non-ASCII characters |

F9 is a property of Chrome extensions rather than of Citrix, but it decides whether the client accepts synthetic keys.

### Test coverage

- **Emulator:** `test/e2e/fake-citrix.html` emulates F1, F5–F8, F10 (records synthetic `keypress`) and F11 (reads the buffer's DOM text with `white-space: nowrap`). It only accepts Enter and Tab whose `keyCode` is visible to page scripts, so it also catches F9 regressions. The e2e tests load the test build of the extension against it.
- **Live session (Windows session with published Chrome and PuTTY, remote Zhuyin IME):** each result was compared by hash with what the extension meant to type. Passed with the current code: every printable ASCII character, multi-line indented code, newline and invisible-character cleanup, emoji (ZWJ sequences, flags, skin tones), combining marks, Arabic and Hebrew, a 2,573-character line, 300 lines of mixed text, aborting midway, cancelling with Escape, an empty clipboard, and precise transfer of 300 lines with Chinese (remote sha256 matched). F10–F13 were found in that session. A later session without the remote Zhuyin IME passed the same terminal checks with the default settings, including 300 lines of mixed Chinese and English typed into a heredoc in PuTTY (sha256 matched), Chinese, Japanese and Korean with full-width punctuation, emoji and RTL text, switching to precise transfer from the dialog, and aborting midway. Before 0.2.0 the full set was run again in a session with the remote Zhuyin IME loaded. Everything passed except the known F12 and F13 cases: F13 used up 186 of 225 Enters again, and the extra Enter setting joined no lines but left 39 blank lines. The run also covered the English interface, all three speeds (300 lines at 保守 (safe) took 168 s against an estimate of 2 min 46 s), keys still held, a lost tab focus, the Tab key in PuTTY, Shift+Enter in Chrome, and precise transfer of a 4,236-byte file containing every byte value (remote sha256 matched). Full screen and Keyboard Lock are still untested.

### Typing speed

On the live session, keys were lost in whole runs when PuTTY received long input too fast; Chrome on the remote side kept up. Results for 203 lines of 76 characters into `cat` in PuTTY:

| Chunk size | Delay after chunk / after newline | Result |
|---|---|---|
| 76 | 40 / 80 ms | 15 runs of keys lost |
| 76 | 40 / 250 ms | corrupted |
| 40 | 40 / 80 ms | 102 lines wrong |
| 40 | 80 / 150 ms | all lines intact |

Both a small chunk and enough delay are needed. 標準 (normal) uses the last row; precise transfer never runs faster than that.

### Known issues and limitations

- **Tabs:** they arrive as spaces. Turn on 「這次送出 Tab 鍵」 (Send the Tab key this time) in the panel when the remote side needs real tabs, for example in a Makefile. Key events for Tab and Shift+Enter have been checked against the emulator only.
- **Newlines:** each newline is an Enter press. In a remote terminal, every line of a multi-line paste runs as soon as its Enter arrives. Trailing newlines are removed by default so the last command waits for you.
- **Remote editors:** editors that auto-indent, auto-close brackets or accept suggestions on Enter change the typed text. Turn those features off while typing (see the [user guide](user-guide.md)), or use precise transfer into a terminal.
- **Full screen and Keyboard Lock:** it has not been verified whether hotkey interception still works when the client runs full screen with the Keyboard Lock API.
- **Right-click menu:** the client is expected to take over the page's context menu, so TypeShuttle offers no context-menu action. This is inferred, not verified.
- **Session windows in frames:** the content script runs in the top frame only. A session embedded in an iframe of another page is not reached.
- **Focus:** the hotkey needs focus in the session. If nothing is pasted within 1.5 seconds, click the remote screen and press the hotkey again.
- **Precise transfer:** it needs a bash-compatible shell at the remote cursor, with `base64`, `gunzip` and `sha256sum`.
- **Non-ASCII text on Windows sessions:** see F12 and F13. Precise transfer types only ASCII and is not affected.
- **Typing speed:** 快 (fast) can drop keys in remote terminals; see [Typing speed](#typing-speed).

## Other clients

Other browser-based clients are not supported yet. Without a matching adapter, the hotkey is not intercepted and the panel reports that no remote desktop was found.

If you use another client, please open a client compatibility report on the [issue tracker](https://github.com/shengwei-peng/typeshuttle/issues/new/choose). Include the client name and version, the browser, and what happens.

## Adding a client

Support for a new client needs:

- an adapter that implements the [adapter contract](ARCHITECTURE.md#adapter-contract);
- an emulator page with e2e tests for the behaviors you found;
- a section on this page;
- a manual checklist in [testing.md](testing.md).

See [CONTRIBUTING.md](../.github/CONTRIBUTING.md#adding-support-for-a-remote-desktop-client) for the process.
