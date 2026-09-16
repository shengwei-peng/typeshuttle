# TypeShuttle user guide

TypeShuttle types text from your computer into a browser-based remote desktop, or rebuilds a small file there byte for byte. It only sends one way: from your computer to the remote session.

The extension's interface is currently in Traditional Chinese. Labels in this guide are shown as they appear, followed by an English gloss.

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
2. Click the **TypeShuttle** toolbar icon and choose **在此網站啟用** (Enable on this site).
3. When the browser asks for access to the site, click **Allow**.
4. When the panel shows a text box, you are done. You do not need to reload the page, and the remote session stays connected.

TypeShuttle gets access to that one site only. Other sites are not affected.

## 3. Paste with the hotkey

1. **Copy** text on your computer.
2. **Click where the text should go** in the remote session, so the remote cursor is there.
3. Press <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> (<kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd> on macOS).
   - **A single short line** is sent right away.
   - **Multi-line text, or more than 500 characters,** opens a confirmation dialog at the top of the page. Check the preview, then press <kbd>Enter</kbd> to send, <kbd>Esc</kbd> to cancel, or <kbd>P</kbd> to switch to [precise transfer](#5-precise-transfer-for-code-and-files). Precise transfer needs the remote cursor to be in a terminal.
4. Progress appears in the bottom-right corner while typing. **已送出** (Sent) appears in the top-right corner when it finishes.

> [!IMPORTANT]
> **Do not touch the keyboard or mouse while typing.** Any key press or click stops typing immediately. This keeps your own keystrokes from mixing in and stops text from landing in the wrong place.

### If typing stops partway

The notification tells you which line it stopped at, and **the unsent text is loaded into the toolbar panel**:

1. Move the remote cursor back to where typing stopped.
2. Click the TypeShuttle toolbar icon. The panel already holds the rest of the text.
3. Click **送出到遠端** (Send to remote).

### Be careful in terminals

When the remote cursor is in a terminal, **each line of multi-line text runs as soon as it is typed**. If the copied text ends with a newline, TypeShuttle does not press Enter for it by default, so you can check the command before running it yourself.

## 4. The toolbar panel

Click the TypeShuttle toolbar icon to open the panel. Use it when you want to review or edit text first, or to send a file.

- **直接打字** (Direct typing): paste or edit the text. Check the line count, character count and estimated time, then click **送出到遠端** (Send to remote).
  - **這次送出 Tab 鍵（Makefile 等）** (Send Tab keys this time, for Makefiles and similar): by default each Tab becomes 4 spaces. Tick this only for content that needs real Tab characters.
  - **換行鍵** (Newline key): in chat apps such as Teams or Slack, Enter sends the message. Choose Shift+Enter to paste several lines as one message.
- **精確傳輸** (Precise transfer): see the next section.

## 5. Precise transfer for code and files

When text is typed directly, remote programs may "help" by indenting it or closing brackets. Precise transfer compresses the content, sends it as letters and digits, and rebuilds an **identical file** on the remote side that you can check with sha256.

**Use it for:** code, YAML, JSON and scripts; content that must arrive exactly; text longer than 2,000 characters; files up to 1 MB.

**Steps:**

1. Open a **terminal** (bash) in the remote session and leave the cursor at the prompt.
2. Click the TypeShuttle icon and switch to **精確傳輸** (Precise transfer).
3. Paste text, or click **或選擇檔案** (or choose a file).
4. The panel shows where the file will be saved, its original size, how many lines will be typed, the estimated time and the **sha256**.
5. Click **送出到遠端終端機** (Send to remote terminal).
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

Click **設定** (Settings) in the top-right corner of the panel. Changes are saved automatically.

| Setting | Default | Notes |
|---|---|---|
| **送出速度** (Typing speed) | **標準** (Normal) | Switch to **保守** (Safe) if characters go missing or arrive out of order. **快** (Fast) suits stable connections and short text. |
| **Tab 轉成幾個空格** (Spaces per Tab) | 4 | |
| **預設換行鍵** (Default newline key) | Enter | Choose Shift+Enter if you mostly paste into remote chat apps. |
| **保留結尾換行** (Keep trailing newline) | Off | When on, Enter is pressed after the last line too. |
| **超過幾個字要先確認** (Confirm above this many characters) | 500 | Multi-line text always asks for confirmation. |
| **超過幾個字建議改用精確傳輸** (Suggest precise transfer above this many characters) | 2,000 | |
| **直接打字上限（字）** (Direct typing limit, characters) | 50,000 | |
| **精確傳輸上限（KB）** (Precise transfer limit, KB) | 1,024 | |
| **遠端存檔目錄** (Remote folder) | `~/typeshuttle-inbox` | Letters, digits and `. _ - /` only. May start with `~/`. |
| **已啟用的網站** (Enabled sites) | | Removing a site also revokes its access. |

## 8. Troubleshooting

**Nothing happens when I press Ctrl+Shift+V**
- Click the TypeShuttle icon. If the panel offers **在此網站啟用** (Enable on this site), this address is not enabled yet. A different address, such as a new server, needs enabling again.
- Click once inside the remote session, then press the hotkey again.
- **剪貼簿是空的，或只有圖片等非文字內容。** (The clipboard is empty or has no text) means there was nothing to type. Copying an image does not work.

**Characters go missing or arrive out of order**
Set **送出速度** (Typing speed) to **保守** (Safe).

**Will the remote input method mangle Chinese or Japanese text?**
No. TypeShuttle sends the text itself rather than key codes, so the remote input method's mode does not matter on clients that accept text input. See [clients](clients.md) for details.

**Every line of my text ran as a command**
The remote cursor was in a terminal. To create a file from a terminal, use [precise transfer](#5-precise-transfer-for-code-and-files).

**Developer mode is missing, or the extension was disabled**
The browser may be managed by an organization. Open `chrome://management` (or `edge://management`). If it says the browser is managed, ask your administrator whether extensions can be installed.

**The browser asks me to disable developer mode extensions**
Extensions installed with Load unpacked can trigger this prompt. Choose to keep the extension.

**The panel says 找不到遠端桌面 (Remote desktop not found)**
The remote session is not connected yet, or the connection dropped. When the remote screen appears, click **重新檢查** (Check again).

## 9. Update and remove

**Update:**
1. Unzip the new version and **replace** the files in your existing folder.
2. Open `chrome://extensions` and click the reload button (↻) on the TypeShuttle card.
3. Reload the remote desktop page, or close and reopen the panel.

**Remove:** click **Remove** on the TypeShuttle card in `chrome://extensions`, then delete the folder.
