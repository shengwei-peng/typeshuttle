# Changelog

All notable changes to this project are documented in this file. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html), and entries are generated from [Conventional Commits](https://www.conventionalcommits.org/) by [release-please](https://github.com/googleapis/release-please).

## [0.1.1](https://github.com/shengwei-peng/typeshuttle/compare/v0.1.0...v0.1.1) (2026-09-16)


### Bug Fixes

* **ci:** evaluate release-please output as string equality in workflow ([d8b615d](https://github.com/shengwei-peng/typeshuttle/commit/d8b615d21eaf8f5de38eba00c89a054662c607e5))

## 0.1.0 (2026-09-16)

### Features

* Paste clipboard text into browser-based remote desktops (Citrix Workspace HTML5) without clipboard sync
* Unicode direct typing bypassing remote IME / keyboard layout issues
* Configurable typing speed, spaces per tab, and trailing newline trimming
* Precise transfer mode: byte-exact gzip + base64 file and text transfer with SHA-256 integrity verification
* Safe by default: instant interruption on physical keypress or mouse click, key release guard, and confirmation dialog for multi-line/long text
* Resumable direct typing: interrupted text is kept in the toolbar panel to continue sending
* Minimal permissions: site access requested per-host on demand, no `clipboardRead`, no `debugger`, no network requests
