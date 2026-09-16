# Privacy Policy

TypeShuttle types text and small files into browser-based remote desktops. It is designed to handle what you send only long enough to send it.

## Summary

- TypeShuttle makes **no network requests** of its own. It has no servers, analytics, telemetry or crash reporting.
- The text and files you send are **never written to disk** by the extension.
- It works **only on sites you enable**, one site at a time.

## What the extension handles

### Clipboard

TypeShuttle never reads your clipboard in the background and does not request the clipboard read permission. It receives clipboard text only when you press **Ctrl+Shift+V** (**Cmd+Shift+V** on macOS) on a site you enabled: the browser then fires a paste event carrying the clipboard text, and TypeShuttle uses that text for this one send. Paste events created by the page itself are ignored.

### Text and files you send from the panel

Text you type into the toolbar panel, and files you choose for precise transfer, are read in the panel and passed to the page to be typed. They are not stored or uploaded. Files are limited to the size set in the options (1 MB by default).

### Leftover text after an interrupted send

If direct typing is interrupted (for example, you press a key or switch tabs), the part that was not typed yet is kept so you can finish sending it from the panel. An interrupted precise transfer keeps nothing; you send it again from the start. Leftover text is stored in `chrome.storage.session`, which lives in memory only, and it is removed when you:

- send it or clear it from the panel,
- close that tab, or
- exit the browser.

### Settings

Your options (speed, newline key, confirmation thresholds, size limits and the remote folder for precise transfer) are stored in `chrome.storage.sync`. If browser sync is turned on, your browser may sync these settings to your other signed-in devices. Settings never contain the text or files you send.

### Site access

TypeShuttle has no standing access to any website when installed. Clicking its toolbar icon gives it temporary access to the current tab only, so the panel can check whether the page is a remote desktop it can work with. When you choose **在此網站啟用** (Enable on this site) in the panel, or grant site access in `chrome://extensions`, it asks for access to that one host only. You can remove a site in the options page or in the browser's extension settings at any time, which also revokes the permission.

## What the remote side receives

Sending text to a remote desktop is the point of the extension. Once text is typed into the remote session, the remote desktop client, the remote computer and the applications running there handle it under their own policies, which may include logging or recording. TypeShuttle has no control over that.

## Changes

Changes to this policy are recorded in the repository history and noted in the release notes.

## Contact

Questions about privacy: **ken90516@gmail.com**, or open an issue at <https://github.com/shengwei-peng/typeshuttle/issues>.
