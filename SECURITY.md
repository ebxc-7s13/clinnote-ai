# Security Policy

## Supported versions

| Version | Supported |
|---|---|
| 1.2.x (latest GitHub Release) | Yes |
| 1.0.0, 1.1.0 (debug-signed test builds, never publicly released) | No — install the latest release |

Only the latest release receives fixes. Security fixes are published as a new release with a higher version.

## Reporting a vulnerability — privately

**Do not open a public issue for a security problem.**

Use GitHub's private vulnerability reporting: open the repository's **Security** tab → **Report a vulnerability** (direct link: <https://github.com/ebxc-7s13/clinnote-ai/security/advisories/new>). The report is visible only to the maintainer.

If that form is unavailable, open a public issue that says only "requesting a private security contact" — no details — and the maintainer will reply with a private channel.

### What to include

- the affected version (Settings → About) and Android version/device
- the component (local storage, export, evidence look-ups, build/signing, backend functions, CI)
- the impact and step-by-step reproduction using **synthetic data only**
- any proof-of-concept, kept minimal

### What never to include, anywhere

- real patient information, screenshots of real records or real recordings
- working API keys, tokens, passwords or keystores (yours or anyone's) — describe the class of problem instead
- a ready-to-use exploit in a public place

## What to expect

ClinNote is maintained by a single volunteer maintainer, so there is no guaranteed response time. The goal is to acknowledge a report within 7 days, agree on an assessment, fix confirmed issues in a new release, and then publish a GitHub Security Advisory crediting the reporter (unless they prefer otherwise). Please allow time for a fix before disclosing publicly; coordinated disclosure after 90 days is the default.

## Security design (summary)

- No private API key is in the app, its source, `EXPO_PUBLIC_*` variables or the APK. Optional AI keys live only in a self-hosted backend's secret store.
- Local records are encrypted at rest (AES-256-GCM, key in Android Keystore-backed secure storage); Android cloud backup is disabled.
- All network traffic uses HTTPS. Evidence look-ups send clinical terms only, never identifiers.
- Release APKs are signed with a dedicated release key that is kept offline and never committed or uploaded. Each release lists its SHA-256 checksum and signing-certificate fingerprint — verify both before installing (see the README).
- CI runs with read-only permissions, mock providers and synthetic data, and scans for secrets with gitleaks.

Detailed engineering requirements: [docs/SECURITY.md](docs/SECURITY.md).

## Dependency updates

Dependencies are pinned by `mobile/package-lock.json`. `npm audit` findings are reviewed before each release; advisories in build-time-only tooling that does not ship in the APK are recorded rather than force-upgraded. Dependency updates arrive as normal releases.

## If a credential leaks

1. Revoke or rotate the credential at the provider **first**.
2. Remove it from the code, then — with the maintainer's approval — purge it from Git history.
3. Publish a new release if the leaked value was ever inside an APK.
4. Record what happened (without the secret) in a security advisory.

The release signing key cannot be rotated in place without breaking updates for installed copies. If it is ever compromised, the maintainer will announce it here and in a release, and users must uninstall and reinstall after exporting their data.
