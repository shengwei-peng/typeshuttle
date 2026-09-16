# Security Policy

## Supported versions

Only the latest release receives security fixes. Please update before reporting.

## Reporting a vulnerability

Please do not report security problems in public issues, discussions or pull requests.

Report privately through GitHub:

1. Open the repository's **Security** tab.
2. Choose **Report a vulnerability**, or go directly to <https://github.com/shengwei-peng/typeshuttle/security/advisories/new>.

If you can't use GitHub, email **ken90516@gmail.com** with "TypeShuttle security" in the subject.

Please include:

- The TypeShuttle version, browser and version, and operating system.
- The remote desktop client involved, if any.
- Steps to reproduce, or a proof of concept.
- What an attacker could achieve, and under what conditions.

Leave out real hostnames, credentials and screenshots of confidential systems. A minimal local page that reproduces the problem is ideal.

## What to expect

TypeShuttle is maintained by one person on a best-effort basis. I aim to:

- Acknowledge your report within 7 days.
- Agree on a fix and a disclosure date with you after confirming the issue.
- Credit you in the advisory and release notes, unless you prefer to stay anonymous.

## Scope

Reports are especially welcome in these areas:

- **Content script injection:** code or text reaching a site the user did not enable, or a page script influencing what the extension types.
- **Clipboard handling:** a page obtaining clipboard contents it should not, or triggering a send without the user's hotkey or panel action.
- **Overlay isolation:** a page reading the confirmation dialog's preview or clicking its buttons.
- **Precise transfer:** a file name, directory or setting that injects extra shell commands into the generated `base64 -d` heredoc.
- **Permissions:** the extension obtaining broader host permissions than the sites the user enabled.

Out of scope:

- What the remote desktop client, the remote session or its applications do with text you intentionally send.
- Attacks that require an already compromised browser, extension installation or operating system.
- Issues in unsupported versions or in modified builds.
