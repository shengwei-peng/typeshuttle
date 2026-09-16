# Contributing to TypeShuttle

Thanks for helping. Bug reports, compatibility reports for remote desktop clients, documentation fixes and code are all welcome.

Please follow standard open-source etiquette. To report a security problem, use [SECURITY.md](SECURITY.md), not a public issue.

## Before you start

- **Bugs and features:** open an issue first for anything bigger than a small fix, so we can agree on the approach before you write code.
- **Client compatibility:** if you tried TypeShuttle with a remote desktop client, file a [client compatibility report](https://github.com/shengwei-peng/typeshuttle/issues/new?template=client_compatibility.yml), whether it worked or not.
- **Confidential details:** never include hostnames, URLs, account names or screenshots from a work environment in issues, pull requests, test fixtures or docs.

## Development setup

Requirements: Node.js 22 or newer, and Chrome or Edge for manual testing.

```bash
git clone https://github.com/shengwei-peng/typeshuttle.git
cd typeshuttle
npm ci
npx playwright install chromium   # browser for the e2e tests
```

To load your build, run `npm run build`, open `chrome://extensions` (or `edge://extensions`), turn on Developer mode, choose **Load unpacked** and select `dist/extension`.

## Scripts

| Command | What it does |
|---|---|
| `npm test` | Unit tests with coverage. Fails below 80% lines, functions or branches. |
| `npm run test:e2e` | Builds the test variant (`dist/extension-test`) and runs the Playwright tests against the client emulator pages. |
| `npm run build` | Builds the extension into `dist/extension`. |
| `npm run package` | Builds and zips the extension into `release/typeshuttle-<version>.zip`, printing its sha256. |
| `npm run docs:check` | Fails if a translation is out of sync with its English source. |
| `npm run docs:stamp -- <file>` | Marks a translation as reviewed against the current English source. |
| `npm run icons` | Renders `assets/icons/*.png` from `assets/logo.svg` (48 and 128 px) and `assets/logo-small.svg` (16 and 32 px, drawn on a 16 px grid). Needs the Playwright Chromium. |

## Project layout

[docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) explains how the extension is organized, how text travels from the clipboard to the remote session, and why key design decisions were made. Read it before changing the typing engine or an adapter.

In short: pure logic lives in `src/core/` and is unit tested; browser-facing code lives in `src/content/`, `src/popup/`, `src/options/` and `src/background.js` and is covered by the e2e tests.

## How we work

- **Test first.** Write a failing test, make it pass, then refactor. New logic in `src/core/` needs unit tests; user-visible behavior needs an e2e test.
- **Keep changes small.** One concern per pull request. Small files and short functions are preferred.
- **No debug output.** Remove `console.log` and similar before opening a pull request.
- **Match the surrounding code.** Follow the existing naming, comment style and immutable data patterns.

## Commit messages

Commits follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>: <description>

<optional body>
```

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `ci`. Mark breaking changes with `!` (for example `feat!: ...`) or a `BREAKING CHANGE:` footer.

Releases and [CHANGELOG.md](../CHANGELOG.md) are generated from these messages by release-please, so write the description for users, not for yourself.

## Pull requests

1. Fork the repository and create a branch from `main`.
2. Make your change with tests.
3. Run `npm test`, `npm run test:e2e` and `npm run docs:check` locally.
4. Update the docs affected by your change (see [Translations](#translations)).
5. Open the pull request and fill in the template.

Pull requests need passing CI before they are merged. A maintainer may ask for changes; please don't take it personally.

## Adding support for a remote desktop client

Every client handles keyboard input differently, so support is added the same way each time:

1. **Research the client's input handling.** Find the element that receives keyboard focus and which events the client listens to (`keydown`, `keypress`, `input`, `composition*`, `paste`). Note how it treats newlines, Tab, IME text and characters outside the Basic Multilingual Plane.
2. **Build a feasibility prototype.** From the browser's DevTools console on a real session, confirm that inserted text and synthetic Enter/Tab key events reach the remote side intact. Record exactly what works and what doesn't.
3. **Write the adapter.** Add it under `src/content/`, implementing the same interface as the existing Citrix adapter (`isAvailable`, `insertText`, `pressNewline`, `pressTab`), and keep client-specific quirks inside it.
4. **Add an emulator page and e2e tests.** Add a page under `test/e2e/` that reproduces the behaviors you recorded, and Playwright tests that fail without your adapter's workarounds.
5. **Add a manual checklist.** Add a section for the client to [docs/testing.md](../docs/testing.md) so anyone can repeat the check on a real session before a release.
6. **Document it.** Describe the client's behaviors and known issues in [docs/clients.md](../docs/clients.md) with its verification status.

Emulator pages are not a substitute for a real session. A client is only marked as verified after the manual checklist passes on a real deployment.

## Translations

English is the source of truth. The translated files are:

| English source | Translation |
|---|---|
| `README.md` | `README.zh-TW.md` |
| `docs/user-guide.md` | `docs/user-guide.zh-TW.md` |

Each translation starts with a stamp line recording the English text it was reviewed against:

```
<!-- translation-of: README.md sha256:0123456789abcdef -->
```

The rules:

- If you change an English source, update its translation in the same pull request, then run `npm run docs:stamp -- <translation file>`. Don't edit the stamp by hand.
- CI runs `npm run docs:check` and fails when an English source changed but its translation was not re-stamped.
- If you can't update the translation yourself, say so in the pull request description and a maintainer will handle it. Don't re-stamp a translation you haven't updated.
- Simplified Chinese (zh-CN) must be adapted term by term for mainland usage, not machine-converted from Traditional Chinese.

## License

By contributing, you agree that your contributions are licensed under the [Apache License 2.0](../LICENSE).
