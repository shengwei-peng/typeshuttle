<p align="center">
  <img src="assets/logo.svg" width="96" height="96" alt="">
</p>

<h1 align="center">TypeShuttle</h1>

<p align="center">
  <strong>Paste into browser-based remote desktops that have clipboard sync turned off.</strong><br>
  A Chrome and Edge extension that types your text, or transfers a small file byte for byte, into the remote session.
</p>

<p align="center">
  English · <a href="README.zh-TW.md">繁體中文</a>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-Apache--2.0-blue.svg" alt="License: Apache-2.0"></a>
  <a href="https://github.com/shengwei-peng/typeshuttle/releases"><img src="https://img.shields.io/github/v/release/shengwei-peng/typeshuttle?label=release" alt="Latest release"></a>
  <a href="https://github.com/shengwei-peng/typeshuttle/actions"><img src="https://img.shields.io/github/actions/workflow/status/shengwei-peng/typeshuttle/ci.yml?label=CI" alt="CI status"></a>
</p>

---

## Why TypeShuttle

Many browser-based remote desktops and web consoles have no clipboard sync, or have it switched off. Tools that fake typing usually send key codes, and the remote side reinterprets those through its own keyboard layout and input method. With a Chinese input method active on the remote side, `Hi 12` can arrive as Bopomofo.

TypeShuttle inserts text through the client's own text input path instead, then adds newlines as real key presses.

| | TypeShuttle | OS keystroke tools<br><sub>xdotool, AutoHotkey, AutoKey</sub> | Generic "paste as keystrokes" extensions |
|---|---|---|---|
| CJK, emoji and symbols arrive intact, whatever the remote input method or layout | ✅ | ❌ | Depends on the site |
| Handles each client's input quirks (swallowed input, stripped newlines) | ✅ | ❌ | Rarely |
| Byte-exact file transfer with a sha256 check | ✅ | ❌ | ❌ |
| Stops as soon as you press a key or click | ✅ | ❌ | Some |
| Reads the clipboard only when you press the hotkey, on sites you enable | ✅ | — | Some |
| Nothing to install outside the browser | ✅ | ❌ | ✅ |

## Features

- **One hotkey.** On a remote desktop tab you have enabled, <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> on macOS) types your clipboard into the remote session.
- **Text, not key codes.** Chinese, Japanese, emoji and symbols arrive exactly as copied, whether the remote input method is on or off.
- **Precise transfer.** For code, config files or anything up to 1 MB, TypeShuttle types a short bash command that rebuilds the exact bytes in a remote file and prints its sha256, so you can compare it with the value shown locally.
- **Safe by default.**
  - Typing waits until you release every key, and stops the moment you press a key or click.
  - Multi-line or long text asks for confirmation first.
  - A trailing newline is not sent, so a copied command does not run on its own.
- **Resume where it stopped.** If typing is interrupted, the unsent text is kept in the toolbar panel so you can place the cursor and send the rest.
- **Toolbar panel.** Review or edit text before sending. You can press Shift+Enter between lines for chat apps, and send real Tab keys for Makefiles.
- **Minimal permissions.** Access is granted one site at a time. No `clipboardRead`, no `debugger`, no network requests.

## Install

Store listings are not available yet. Install from a release:

1. Download `typeshuttle-<version>.zip` from [Releases](https://github.com/shengwei-peng/typeshuttle/releases).
2. Unzip it into a folder you will keep. The extension stops working if the folder is moved or deleted.
3. Open `chrome://extensions` (Chrome) or `edge://extensions` (Edge) and turn on **Developer mode**.
4. Click **Load unpacked** and select the folder that contains `manifest.json`.

To build from source instead, run `npm ci && npm run build` and load `dist/extension`.

> [!NOTE]
> The extension's interface is currently in Traditional Chinese only. The [user guide](docs/user-guide.md) gives an English gloss for every label.

## Quick start

1. Open your remote desktop in the browser. Click the TypeShuttle toolbar icon, choose **在此網站啟用** (Enable on this site), and allow access when the browser asks. Do this once per site.
2. Copy some text on your computer, click where it should go in the remote session, and press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>.
3. For multi-line or long text, a preview appears. Press <kbd>Enter</kbd> to send, <kbd>Esc</kbd> to cancel, or <kbd>P</kbd> to use precise transfer.
4. Keep your hands off the keyboard and mouse until typing finishes.

> [!WARNING]
> If the remote cursor is in a terminal, every line of multi-line text runs as soon as it is typed. Use precise transfer to create files from a terminal.

The [user guide](docs/user-guide.md) covers the panel, precise transfer, settings, editor tips and troubleshooting.

## Privacy and permissions

TypeShuttle makes no network requests and keeps no history. What you send is typed into the remote session and nowhere else.

| Permission | Why |
|---|---|
| `storage` | Saves your settings. Text left over after an interrupted send is held in session memory and cleared when the tab or browser closes. |
| `scripting` | Runs TypeShuttle on the sites you enabled. |
| `activeTab` | Reads the current tab's address when you open the panel, to offer enabling the site. |
| Site access (optional) | Requested one site at a time when you choose to enable it. You can revoke it on the options page. |

See [PRIVACY.md](docs/PRIVACY.md) for details.

## FAQ

**Does it read my clipboard in the background?**
No. The browser hands the clipboard text to TypeShuttle only when you press the hotkey on an enabled site.

**Can I copy from the remote session back to my computer?**
No. TypeShuttle only sends from your computer to the remote session.

**Why not use xdotool or AutoHotkey?**
They send key codes, which the remote input method and keyboard layout can change. They also cannot handle client-specific issues such as text being swallowed after a key press.

**Is it allowed where I work?**
TypeShuttle types what you could type by hand and does not change any remote desktop settings. Follow your organization's policies on what you bring into remote sessions. If your browser is managed, extension installs may need approval from your administrator.

## Documentation

- [User guide](docs/user-guide.md) ([繁體中文](docs/user-guide.zh-TW.md)): panel, precise transfer, settings, troubleshooting
- [Clients](docs/clients.md): per-client behavior and known issues
- [Architecture](docs/ARCHITECTURE.md): how it works and why
- [Testing](docs/testing.md): automated tests and manual checklists

## Contributing

Bug reports, client compatibility reports and pull requests are welcome. Read [CONTRIBUTING.md](.github/CONTRIBUTING.md) first. Report security issues privately as described in [SECURITY.md](.github/SECURITY.md).

## License

[Apache License 2.0](LICENSE)

All product names and trademarks belong to their respective owners. TypeShuttle is an independent project and is not affiliated with, endorsed by or sponsored by any remote desktop vendor. Product names are used only to describe compatibility.
