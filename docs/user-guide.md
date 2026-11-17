# TypeShuttle user guide

TypeShuttle types text from your computer into a browser-based remote desktop, or rebuilds a small file there byte for byte. It only sends one way: from your computer to the remote session.

The interface is available in English and Traditional Chinese. It follows your browser's language; to change it, open **Settings** and choose **Interface language**. This guide uses the English labels.

## Contents

1. [Install](#1-install)
2. [Enable a remote desktop site](#2-enable-a-remote-desktop-site)
3. [Paste with the hotkey](#3-paste-with-the-hotkey)
4. [The toolbar panel](#4-the-toolbar-panel)
5. [Precise transfer for code and files](#5-precise-transfer-for-code-and-files)
6. [Typing into VS Code and other editors](#6-typing-into-vs-code-and-other-editors)
7. [Settings](#7-settings)
8. [Troubleshooting](#8-troubleshooting)
9. [Update and remove](#9-update-and-remove)

## 1. Install

1. Download `typeshuttle-<version>.zip` from [Releases](https://github.com/shengwei-peng/typeshuttle/releases).
2. Unzip it into a folder you will keep, for example `Documents/TypeShuttle`.
   - The extension stops working if the folder is moved or deleted.
   - `manifest.json` should be directly inside the folder, not inside another subfolder.
3. Open `chrome://extensions` in Chrome or `edge://extensions` in Edge.
4. Turn on **Developer mode**. It is in the top-right corner in Chrome and in the left sidebar in Edge.
5. Click **Load unpacked** and choose the folder from step 2.
6. Click the puzzle-piece icon next to the address bar and pin **TypeShuttle** to the toolbar.

If you cannot find Developer mode, or the extension shows as disabled, your browser may be managed by an organization. See [Troubleshooting](#8-troubleshooting).

## 2. Enable a remote desktop site

You do this once for each remote desktop address.

1. Sign in and open your remote desktop in the browser.
2. Click the **TypeShuttle** toolbar icon and choose **Enable on this site**.
3. When the browser asks for access to the site, click **Allow**.
4. When the panel shows a text box, you are done. You do not need to reload the page, and the remote session stays connected.

TypeShuttle gets access to that one site only. Other sites are not affected.

## 3. Paste with the hotkey

1. **Copy** text on your computer.
2. **Click where the text should go** in the remote session, so the remote cursor is there.
3. Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> on macOS).
   - **A single short line** is sent right away.
   - **Multi-line text, or more than 500 characters,** opens a confirmation dialog at the top of the page. Check the preview, then press <kbd>Enter</kbd> to send, <kbd>Esc</kbd> to cancel, or <kbd>P</kbd> to switch to [precise transfer](#5-precise-transfer-for-code-and-files). Precise transfer needs the remote cursor to be in a terminal.
4. Progress appears in the bottom-right corner while typing. **Sent** appears in the top-right corner when it finishes.

> [!IMPORTANT]
> **Do not touch the keyboard or mouse while typing.** Any key press or click stops typing immediately. This keeps your own keystrokes from mixing in and stops text from landing in the wrong place.

### If typing stops partway

The notification tells you which line it stopped at, and **the unsent text is loaded into the toolbar panel**:

1. Move the remote cursor back to where typing stopped.
2. Click the TypeShuttle toolbar icon. The panel already holds the rest of the text.
3. Click **Send to remote**.

### Be careful in terminals

When the remote cursor is in a terminal, **each line of multi-line text runs as soon as it is typed**. If the copied text ends with a newline, TypeShuttle does not press Enter for it by default, so you can check the command before running it yourself.

## 4. The toolbar panel

Click the TypeShuttle toolbar icon to open the panel. Use it when you want to review or edit text first, or to send a file.

- **Direct typing**: paste or edit the text. Check the line count, character count and estimated time, then click **Send to remote**.
  - **Send the Tab key this time (Makefiles and similar)**: by default each Tab becomes 4 spaces. Tick this only for content that needs real Tab characters.
  - **Newline key**: in chat apps such as Teams or Slack, Enter sends the message. Choose Shift+Enter to paste several lines as one message.
- **Precise transfer**: see the next section.

## 5. Precise transfer for code and files

When text is typed directly, remote programs may "help" by indenting it or closing brackets. Precise transfer compresses the content, sends it as letters and digits, and rebuilds an **identical file** on the remote side that you can check with sha256.

**Use it for:** code, YAML, JSON and scripts; content that must arrive exactly; text longer than 2,000 characters; files up to 1 MB.

**Steps:**

1. Open a **terminal** (bash) in the remote session and leave the cursor at the prompt.
2. Click the TypeShuttle icon and switch to **Precise transfer**.
3. Paste text, or click **Choose a file**.
4. The panel shows where the file will be saved, its original size, how many lines will be typed, the estimated time and the **sha256**.
5. Click **Send to remote terminal**.
6. When it finishes, the remote terminal prints a sha256. **If it matches the value in the panel, the file is exactly right.**

Files are saved in `~/typeshuttle-inbox/` on the remote machine. Each name starts with the date and time, for example `2026-09-14_153012_deploy.sh`. Only letters, digits, `.`, `_` and `-` are kept from the original file name; other characters are dropped, but the extension stays.

For reference, the typed command looks like this:

```bash
mkdir -p ~/typeshuttle-inbox && base64 -d <<'TYPESHUTTLE_EOF' | gunzip > ~/typeshuttle-inbox/2026-09-14_153012_deploy.sh
H4sIAAAAAAAAA...
TYPESHUTTLE_EOF
sha256sum ~/typeshuttle-inbox/2026-09-14_153012_deploy.sh
```

**If it stops partway:** the remote terminal is still waiting for input. Press <kbd>Ctrl</kbd>+<kbd>C</kbd> in the remote session, then send again.

## 6. Typing into VS Code and other editors

Editors react to typing: they auto-indent, close brackets and accept suggestions on Enter. Code typed straight into them can come out changed. Choose one of these:

- **Recommended:** save the content with precise transfer, then open the file in the remote editor, or copy it inside the remote session. Copy and paste *within* the remote desktop still works.
- **If you must type straight into VS Code,** temporarily change these settings and restore them afterwards:

  | Setting | Temporary value |
  |---|---|
  | `editor.autoIndent` | `none` |
  | `editor.autoClosingBrackets` | `never` |
  | `editor.acceptSuggestionOnEnter` | `off` |

## 7. Settings

Click **Settings** in the top-right corner of the panel. Changes are saved automatically.

| Setting | Default | Notes |
|---|---|---|
| **Interface language** | **Same as the browser** | Chinese browsers get Traditional Chinese, all others English. |
| **Typing speed** | **Normal** | **Normal** was checked on a live Citrix session with 200 lines into PuTTY without losing a key. **Fast** is only for short text, or for remote browsers and editors; terminals such as PuTTY can drop whole runs of keys at that speed. Switch to **Safe** if characters still go missing. Precise transfer never runs faster than **Normal**. |
| **Spaces per Tab** | 4 | |
| **Default newline key** | Enter | Choose Shift+Enter if you mostly paste into remote chat apps. |
| **Keep trailing newline** | Off | When on, Enter is pressed after the last line too. |
| **Extra Enter after lines with non-ASCII characters** | Off | Consider it only when a Chinese input method is active on a Windows remote desktop and line breaks after Chinese or other non-ASCII text disappear in PuTTY or similar terminals. The line break is not dropped every time, so blank lines can still appear, and other programs always get them. Use precise transfer for text that must be exact. |
| **Ask before sending more than this many characters** | 500 | Multi-line text always asks for confirmation. |
| **Suggest precise transfer above this many characters** | 2,000 | |
| **Direct typing limit (characters)** | 50,000 | |
| **Precise transfer limit (KB)** | 1,024 | |
| **Remote folder** | `~/typeshuttle-inbox` | Letters, digits and `. _ - /` only, and no folder name may start with `-`. May start with `~/`. |
| **Enabled sites** | | Removing a site also revokes its access. |

## 8. Troubleshooting

**Nothing happens when I press Ctrl+Shift+V**
- Click the TypeShuttle icon. If the panel offers **Enable on this site**, this address is not enabled yet. A different address, such as a new server, needs enabling again.
- Click once inside the remote session, then press the hotkey again.
- **Nothing to send** means there was nothing to type. Copying an image does not work.

**Characters go missing**
Use **Normal** or **Safe** for **Typing speed**. **Fast** can drop keys in remote terminals.

**Chinese or Japanese text comes out in the wrong order, or a line break after it disappears**
TypeShuttle sends the text itself rather than key codes, so the remote input method's Chinese or English mode does not turn letters into Zhuyin. On Windows remote desktops, though, the remote input method still handles non-ASCII characters and some programs mishandle them:

- In Chrome on the remote side, Han characters that directly follow full-width punctuation or kana can be moved later, so `你好，世界。` can arrive as `你好，。世界`.
- In PuTTY and similar terminals, while a Chinese input method is active on the remote side, the Enter after a line that contains non-ASCII characters is often used up, so the next line is joined to it. It does not happen every time. **Extra Enter after lines with non-ASCII characters** joins fewer lines but can leave blank lines. With only an English keyboard on the remote side, no line breaks were lost in testing.

Check the result after sending. For text that must be exact in a terminal, use [precise transfer](#5-precise-transfer-for-code-and-files), which types only ASCII. See [clients](clients.md#citrix-workspace-app-for-html5) for details.

**Every line of my text ran as a command**
The remote cursor was in a terminal. To create a file from a terminal, use [precise transfer](#5-precise-transfer-for-code-and-files).

**Developer mode is missing, or the extension was disabled**
The browser may be managed by an organization. Open `chrome://management` (or `edge://management`). If it says the browser is managed, ask your administrator whether extensions can be installed.

**The browser asks me to disable developer mode extensions**
Extensions installed with Load unpacked can trigger this prompt. Choose to keep the extension.

**The panel says Remote desktop not found**
The remote session is not connected yet, or the connection dropped. When the remote screen appears, click **Check again**.

## 9. Update and remove

**Update:**
1. Unzip the new version and **replace** the files in your existing folder.
2. Open `chrome://extensions` and click the reload button (↻) on the TypeShuttle card.
3. Reload the remote desktop page, or close and reopen the panel.

**Remove:** click **Remove** on the TypeShuttle card in `chrome://extensions`, then delete the folder.
