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

These behaviors were observed on a live session, using Chrome on Linux with a Linux virtual desktop that had a Zhuyin (Bopomofo) IME. The HTML5 client version was not recorded, so other Citrix releases may behave differently. The IDs are referenced from the source code and from [ARCHITECTURE.md](ARCHITECTURE.md).

| ID | Behavior | How TypeShuttle handles it |
|---|---|---|
| F1 | Keyboard focus sits in a hidden contenteditable `span#CitrixClientImeBuffer`. It listens for `keydown`, `keypress`, `keyup`, `composition*`, `input`, `textInput` and `paste` | All injection targets this element. When it is missing, the hotkey is not intercepted and the panel reports that no remote desktop was found |
| F2 | Text that arrives through an `input` event is sent to the session as Unicode, independent of the remote IME. CJK text and symbols arrive intact | All text goes through the input path |
| F3 | Simulated physical keys, including key codes, pass through the remote IME. `Hi 12` arrived as Zhuyin symbols | OS-level keystroke tools are not used for text |
| F4 | `document.execCommand('insertText', false, text)` from the page inserts text | No `debugger` permission is needed |
| F5 | After any key event, the next text input is dropped. Mouse clicks do not cause this | An empty `insertText` input event is dispatched before every chunk. When nothing is being dropped, the extra event has no effect |
| F6 | Line feeds inside inserted text are removed. `insertLineBreak` and `insertParagraph` have no effect | Text is typed line by line with an Enter key event between lines |
| F7 | Enter `KeyboardEvent`s created by the page (`keydown` and `keyup`, with or without `keypress`) are forwarded to the session | Newlines are synthetic Enter presses |
| F8 | A tab character becomes a single space | Tabs become spaces (default 4). The panel can send real Tab key events for one send |
| F9 | Content scripts run in an isolated world. A `keyCode` added to an event with `Object.defineProperty` is invisible to the client's scripts | `keyCode`, `charCode` and `which` are passed to the `KeyboardEvent` constructor |

F9 is a property of Chrome extensions rather than of Citrix, but it decides whether the client accepts synthetic keys.

### Test coverage

- **Emulator:** `test/e2e/fake-citrix.html` emulates F1 and F5–F8. It only accepts Enter and Tab whose `keyCode` is visible to page scripts, so it also catches F9 regressions. The e2e tests load the test build of the extension against it.
- **Live session:** the checklist in [testing.md](testing.md#citrix-workspace-app-for-html5) has not been completed. These checks are still open:
  - typing speed for long text;
  - emoji and other characters outside the Basic Multilingual Plane;
  - Tab and Shift+Enter key events;
  - full screen and Keyboard Lock;
  - a large precise transfer;
  - panel focus handling;
  - behavior after an extension reload.

### Known issues and limitations

- **Tabs:** they arrive as spaces. Turn on 「這次送出 Tab 鍵」 (Send the Tab key this time) in the panel when the remote side needs real tabs, for example in a Makefile. Key events for Tab and Shift+Enter have been checked against the emulator only.
- **Newlines:** each newline is an Enter press. In a remote terminal, every line of a multi-line paste runs as soon as its Enter arrives. Trailing newlines are removed by default so the last command waits for you.
- **Remote editors:** editors that auto-indent, auto-close brackets or accept suggestions on Enter change the typed text. Turn those features off while typing (see the [user guide](user-guide.md)), or use precise transfer into a terminal.
- **Full screen and Keyboard Lock:** it has not been verified whether hotkey interception still works when the client runs full screen with the Keyboard Lock API.
- **Right-click menu:** the client is expected to take over the page's context menu, so TypeShuttle offers no context-menu action. This is inferred, not verified.
- **Session windows in frames:** the content script runs in the top frame only. A session embedded in an iframe of another page is not reached.
- **Focus:** the hotkey needs focus in the session. If nothing is pasted within 1.5 seconds, click the remote screen and press the hotkey again.
- **Precise transfer:** it needs a bash-compatible shell at the remote cursor, with `base64`, `gunzip` and `sha256sum`.

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
