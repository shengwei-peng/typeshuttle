# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and entries are generated from [Conventional Commits](https://www.conventionalcommits.org/) by [release-please](https://github.com/googleapis/release-please).

## [0.2.0](https://github.com/shengwei-peng/typeshuttle/compare/v0.1.0...v0.2.0) (2026-11-17)


### Features

* add an English interface alongside Traditional Chinese, with an interface language setting ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))
* warn when text contains non-ASCII characters and add an optional extra Enter after such lines ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))


### Bug Fixes

* cap precise transfer at the normal speed ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))
* keep leading, trailing and repeated spaces when typing into Citrix ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))
* label the panel file picker in the interface language ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))
* send Enter and Tab without keypress so Citrix does not type stray characters ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))
* show the whole dialog preview, including the remaining line count ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))
* slow the default typing speeds so long text in remote terminals no longer drops keys ([775c4c2](https://github.com/shengwei-peng/typeshuttle/commit/775c4c2c6a9205dbfa57a2f2b8db1ac1e93446ff))

## 0.1.0 (2026-09-16)

### Features

* Paste clipboard text into browser-based remote desktops (Citrix Workspace HTML5) without clipboard sync
* Unicode direct typing bypassing remote IME / keyboard layout issues
* Configurable typing speed, spaces per tab, and trailing newline trimming
* Precise transfer mode: byte-exact gzip + base64 file and text transfer with SHA-256 integrity verification
* Safe by default: instant interruption on physical keypress or mouse click, key release guard, and confirmation dialog for multi-line/long text
* Resumable direct typing: interrupted text is kept in the toolbar panel to continue sending
* Minimal permissions: site access requested per-host on demand, no `clipboardRead`, no `debugger`, no network requests
