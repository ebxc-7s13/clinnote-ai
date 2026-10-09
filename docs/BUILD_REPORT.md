# ClinNote AI — Public GitHub Release Report

Written 2026-10-09 (UTC) from the repository state and command output produced in this session. A previous report is not evidence. Status words: **DONE** (performed and verified) · **TESTED** · **NOT DONE** · **BLOCKED**.

ClinNote 1.2.0 is development-stage software for synthetic data only. It is not clinically validated and has no regulatory approval.

## Repository

- URL: https://github.com/ebxc-7s13/clinnote-ai (resolved from `git remote -v` and `gh repo view`)
- Visibility: **PRIVATE — NOT YET PUBLIC (BLOCKED).** `gh repo edit --visibility public --accept-visibility-change-consequences` returned `HTTP 403: Resource not accessible by integration`: the Codespace `GITHUB_TOKEN` can push but has no repository-admin permission. The owner must change visibility (see Remaining Human Actions).
- GitHub now detects the license: `licenseInfo: MIT License`.

## License

`LICENSE` — MIT, "Copyright (c) 2026 SRV (github.com/ebxc-7s13) and ClinNote AI contributors" (from the Git author configuration; no institution invented). README states the license does not certify clinical accuracy, regulatory compliance or third-party rights. Dependency audit found no license incompatible with MIT redistribution (`THIRD_PARTY_NOTICES.md`).

## Release

- Version 1.2.0, versionCode 3 (1.0.0 = 1, 1.1.0 = 2; no earlier tag or GitHub Release existed — `git tag`, `gh release list` empty).
- Tag `v1.2.0`: **NOT CREATED.** Release URL: **none exists yet.**
- Reason: the command that creates the tag and the release was refused by this session's permission policy (publishing a public surface needs the owner's explicit approval). Nothing partial was created (verified: no local or remote tags, no releases).
- Prepared, ready to upload: `~/clinnote-artifacts/release-v1.2.0/` — `ClinNote-1.2.0-arm64-v8a-release.apk`, `SHA256SUMS.txt`, `RELEASE_NOTES.md`.

## Android APK

| Item | Value (command evidence) |
|---|---|
| Filename | `ClinNote-1.2.0-arm64-v8a-release.apk` (`~/clinnote-artifacts/` and `release-v1.2.0/`) |
| Size | 44,365,613 bytes |
| SHA-256 | `9291fb3efbc94d272da6e6ac204c545f17f239fdf688ed22f4a2db90fad3f9a7` (`sha256sum`; staged copy re-checked with `sha256sum -c`: OK) |
| Signing | `apksigner verify`: v2 scheme verified; signer `CN=ClinNote Upload Key, O=ClinNote`, certificate SHA-256 `94a47ba688db35c153056400af52cf75cee67428c98d714d5dc81ebe661d4d99` — **not the debug certificate** (the build script fails on `CN=Android Debug`) |
| Package / version | `aapt2 dump badging`: `ai.clinnote.app`, versionCode 3, versionName 1.2.0, minSdk 24, targetSdk 36 |
| Architecture | `native-code: 'arm64-v8a'` only (21 native libraries, all arm64) |
| Debug flags | no `android:debuggable`; `allowBackup=false` |
| Permissions | INTERNET, RECORD_AUDIO, VIBRATE, app-internal DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION (same as 1.1.0) |
| 16 KB alignment | `zipalign -c -P 16 4`: Verification successful |
| Secrets in APK | grep over the unpacked APK: no `AIza…`, `BEGIN PRIVATE KEY`, `supabase.co`, `service_role`, `GEMINI_API_KEY`, `storePassword`; two `sk-`/`hf_` matches are false positives (an R8 lambda name and icon names) |
| Model weights | none (no `.tflite/.onnx/.bin/.pt/.gguf/.safetensors`) |
| FREE_ONLY_MODE | present in the JS bundle as the hard constant and the Settings chip text |
| AAB | not built for this release (not installable by users; `CLINNOTE_BUILD_AAB=1` builds one) |

Build: `bash mobile/scripts/build-release.sh` (JDK 21, `expo prebuild` + `gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`), BUILD SUCCESSFUL in 19 m 32 s. Earlier 1.0.0/1.1.0 artifacts kept unchanged; `ClinNote-test.apk` in the repo root is untracked and now git-ignored.

Signing key: the ADR-054 key already existed in `~/.clinnote-signing/` (mode 700/600, RSA 4096, SHA256withRSA, valid to 2056-10-01); it was reused as the permanent release key (ADR-055). It is outside Git, not in the APK, not uploaded, not in CI. Passwords were not printed.

## Emulator verification (x86_64 twin build)

The arm64 APK cannot run on the x86_64 emulator, so an x86_64 APK was built from the same commit and signed with the same key (`~/clinnote-artifacts/ClinNote-1.2.0-x86_64-release.apk`, emulator only, not for publication). Android 14 AOSP emulator, headless, animations off, driver `~/clinnote-e2e/run11.py`:

- clean install → onboarding → Home → synthetic demo patient P-000001 with DEMO label → consent → record (Pause/Resume/Finish segment states) → transcript grouped by SEG-0001 → facts → second segment → Finalize → Add more conversation offered → reconcile conflict (cough duration correction) → occupation from segment 2 → visit tracker → report (patient details, allergies as stated, nothing invented) → report version saved → JSON export share sheet → Home reminders → force-stop and relaunch with data persisted → returning-visit comparison "weight 72 → 70 kg": **all PASS**.
- The script's final "Timeline" tap failed once on scroll timing (the button was on screen in the UI dump); repeated manually: timeline opened — PASS. Logcat crash buffer: no ClinNote entry; 0 JS/native-module errors. About screen shows the new "Report an issue" and "Third-party notices" links: PASS.
- Signature migration: 1.1.0 (debug) installed, then `adb install -r` 1.2.0 → `INSTALL_FAILED_UPDATE_INCOMPATIBLE … signatures do not match`; 1.1.0 stayed installed. This matches README → Updating. Clean install of 1.2.0: Success, cold start `Status: ok`.
- Packaged launcher icon checked: new ClinNote artwork (Expo logo removed).

**Not tested on a physical device:** 1.2.0 overall, live microphone, non-English speech, haptics, TalkBack, PDF export into a receiving app.

## GitHub Release

- Creation status: **NOT DONE** (see Release). Uploaded assets: none. Download verification: not possible yet.

## README

Rewritten: description, Quick Download (latest-release link resolved from the real remote), features (implemented only), install, checksum and certificate verification, updating and debug-key migration, first launch, how to use (synthetic example covered by `readme-example.test.ts`), transcription, evidence and medication, storage, API keys and cloud AI, free-only, limitations, clinical safety, troubleshooting (11 cases), developers (commands verified against `package.json`), structure, license, security, support, releases.

Corrected during verification: the first draft's example ("How long have you had the cough?" / "About three weeks.") does **not** produce a cough fact — the rule-based extractor does not join a question with a bare answer. The README now uses a stated complaint and documents the limitation; a test asserts both.

## Privacy

`PRIVACY.md` written from the source: AES-256-GCM per document with a Keystore-backed key (`crypto.ts`, `container.ts`), `allowBackup=false`, on-device speech when available (`requiresOnDeviceRecognition`), audio files only for configured-backend demo visits (`record.tsx` `captureAudio`), evidence hosts from `providers/evidence`, no analytics SDK, deletion paths in Settings/patient/visit. In-app Privacy screen now links to it. No legal-compliance claim.

## Security

- Secret scan: gitleaks 8.28.0 `git --log-opts=--all`: 21 commits, **no leaks**; `gitleaks dir` over the working tree: no leaks; pattern grep over all revisions: only documentation mentions; no `.env`, keystore, certificate, recording, APK or AAB ever committed (`git log --all --name-only`). Patient references in history are app-generated synthetic `P-000001`/`P-900001`. Commit author e-mail `ebxc7s13@gmail.com` is in history and becomes public with the repository (owner's address, not patient data).
- CI (`.github/workflows/ci.yml`, `permissions: contents: read`, no secrets): run 37951192605 on `e5509db` — mobile, backend, secret-scan all **success**.
- `SECURITY.md`: private reporting via GitHub private vulnerability reporting (to be enabled by the owner after the repository is public), what to include/exclude, expectations, rotation.
- Dependency review: `npm audit --omit=dev` — 62 advisories (0 critical, 45 high, 17 moderate), nearly all in build/test tooling (jest, Metro, Expo CLI/config, node-forge in code-signing tooling, braces/micromatch DoS). Runtime path: `decode-uri-component`/`query-string` via expo-router (DoS on malformed deep links) and `uuid` buffer check; fixes require major upgrades (expo-router 58, React Native 0.87, Expo SDK change) and were **not applied** in this release. Recorded as a known risk.
- `.gitignore` extended: `.env*`, `*.jks`, `*.keystore`, `*.p12`, `*.pem`, `*.key`, `signing.properties`, `key.properties`, APK/AAB, checksums, recordings.

## Free-Only

- App: `FREE_ONLY_MODE = true` hard constant; public APK built without `EXPO_PUBLIC_SUPABASE_*` → cloud AI NOT_CONFIGURED; no private key anywhere in the client.
- Backend (optional, not deployed): refuses requests when `FREE_ONLY_MODE` is switched off; only verified free-tier models; one call, no paid retry.
- Runtime network services: public NLM, FDA and Europe PMC APIs (keyless, rate-limited) and the device's own speech service. No paid API, subscription, billing or paid fallback.

## Tests

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `CI=1 npx expo lint` | exit 0 |
| `npx jest` | **161 passed, 0 failed, 11 skipped** (live suite opt-in); 13 suites incl. clinical-safety suites |
| `npx jest src/__tests__/readme-example.test.ts` | 4/4 |
| `npx expo-doctor` | 21/21 |
| `cd backend && npm test` / `npm run typecheck` | 5/5 / clean |
| gitleaks history + tree | no leaks |
| GitHub Actions CI | success (3/3 jobs) |
| Release build + verification | success (above) |
| Emulator acceptance | PASS (above) |

## Source Build

Validated in this Codespace: `npm ci`-installed tree, typecheck, lint, tests, expo-doctor, prebuild and release build with documented commands. CI independently ran `npm ci`, typecheck, lint and tests on a clean GitHub runner (Node 24). Finding: JDK 25 made the `react-native-worklets` CMake configure step fail; JDK 21 works — documented in README. A release build requires a signing key; others create their own with `create-upload-key.sh` (their APK then cannot update official releases). Only the owner can produce official releases.

## Known Limitations

Not clinically validated; synthetic data only; cloud AI absent in the public APK; transcription depends on the device speech service; non-English not verified on a device; extraction English-only and does not join question + bare answer; no import/sync; uninstall deletes data; npm audit advisories open; 1.2.0 not tested on a physical phone.

## Remaining Human Actions (owner)

1. **Back up `~/.clinnote-signing/`** to two offline locations now (the Codespace is disposable; losing the key breaks updates for every user).
2. **Make the repository public:** GitHub → repository → Settings → General → Danger Zone → *Change visibility* → Public (or, with an admin-scoped login, `gh repo edit ebxc-7s13/clinnote-ai --visibility public --accept-visibility-change-consequences`).
3. **Create the release** (or allow this session to run it):
   ```bash
   cd /workspaces/clinnote-ai && git tag -a v1.2.0 -m "ClinNote 1.2.0 — first public GitHub release" e5509db && git push origin v1.2.0
   cd ~/clinnote-artifacts/release-v1.2.0 && sha256sum -c SHA256SUMS.txt
   gh release create v1.2.0 ClinNote-1.2.0-arm64-v8a-release.apk SHA256SUMS.txt --repo ebxc-7s13/clinnote-ai --title "ClinNote 1.2.0" --notes-file RELEASE_NOTES.md --verify-tag --latest
   ```
4. **Verify the public download** in an empty directory: `gh release download v1.2.0 --repo ebxc-7s13/clinnote-ai && sha256sum -c SHA256SUMS.txt`, and open https://github.com/ebxc-7s13/clinnote-ai/releases/latest while logged out.
5. Enable **Private vulnerability reporting** (Settings → Code security) once public, so the SECURITY.md link works.
6. Optional: add a repository description and topics; install 1.2.0 on a physical phone and test the live microphone.

## Git

- Branch `main`; release-preparation commit `e5509db` pushed (`1af76c0..e5509db main -> main`); this report and `terminal_report.txt` follow in a docs commit (see `terminal_report.txt` for its hash and push result).
- No tags. Working tree clean before this report.

## Next Action

Owner completes steps 1–5 above; then the release URL, asset sizes and download checksum are recorded here.
