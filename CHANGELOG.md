# Changelog

All notable changes to ClinNote AI. Versions follow [Semantic Versioning](https://semver.org/); the Android `versionCode` increases with every release.

Status words: **tested** = covered by automated tests and/or the Android emulator run recorded in `docs/BUILD_REPORT.md`; **not tested on a physical device** is stated where it applies.

## [1.2.0] — 2026-10-09 — first public GitHub release

`ai.clinnote.app`, versionCode 3, arm64-v8a APK.

### Added
- Public distribution through GitHub Releases: release-signed APK, `SHA256SUMS.txt` and published signing-certificate fingerprint.
- Dedicated release signing key (RSA 4096) replacing the Android debug key; release builds refuse to fall back to the debug key (`mobile/plugins/withReleaseSigning.js`).
- Reproducible release script `mobile/scripts/build-release.sh` (artifacts outside the repository, never overwritten, debug-certificate check, 16 KB page-alignment check, checksums).
- Original ClinNote app icon and splash artwork (`mobile/scripts/generate-icons.js`), replacing the Expo template images.
- In-app links (About, Privacy) to the privacy policy, security policy, third-party notices, issues and releases.
- "Not a medical device" disclaimer on the About screen.
- Open-source project files: MIT `LICENSE`, `PRIVACY.md`, `SECURITY.md`, `CONTRIBUTING.md`, `THIRD_PARTY_NOTICES.md`, this changelog, issue templates and a minimal CI workflow (typecheck, lint, tests, secret scan).

### Changed
- Signing identity: 1.2.0 is signed with the new release key, so it **cannot update** the debug-signed 1.0.0/1.1.0 test builds in place. Export data, uninstall the old build, then install 1.2.0 (see README → Updating).
- README rewritten for users and developers.

### Fixed
- Nothing functional; app behaviour is the same as 1.1.0.

### Known limitations
- Not clinically validated; no regulatory approval; synthetic data only.
- Cloud AI is not configured in the public APK (no backend, no key). Rule-based English extraction, manual entry and public evidence look-ups work without it.
- Transcription quality depends on the phone's speech-recognition service. Non-English languages are implemented but **not verified on a device**; automatic fact extraction is English-only.
- Medication information is U.S. label data (openFDA/DailyMed); no interaction checker; no dosing.
- Live microphone use, haptics and TalkBack of 1.2.0 are **not tested on a physical device**; 1.0.0 was used on the owner's phone.

## [1.1.0] — 2026-10-09 — test build (not publicly released, debug-signed)

### Added
- Multi-segment consultations: Pause, Resume, Finish segment, Finalize consultation and Add more conversation.
- Whole-visit reconciliation over the canonical transcript, duplicate protection, correction detection and conflicts.
- Transcript review tools: correct text/speaker, split, merge, mark uncertain, exclude duplicate, add typed utterance.
- Code-built structured clinical report (sections A–S) with versions and PDF/JSON/text export.
- Patient-detail extraction (age, occupation, language) with profile-mismatch conflicts.
- Medication label sections (boxed warning, contraindications, warnings, interactions section) quoted with source.
- Language registry gated by the device speech service; glass UI with haptics; in-app reminders.

### Fixed
- Data loss when adding a segment after facts were extracted on another screen (regression test added).
- Demo utterance dropped on pause.

## [1.0.0] — 2026-10-09 — test build (not publicly released, debug-signed)

### Added
- Patients, visits with automatic timestamps, consent, live on-device transcription, speaker roles.
- Deterministic rule-based fact extraction with information state, provenance and review status.
- Evidence look-ups from public NLM/FDA/Europe PMC services; editable SOAP/general/progress notes; visit comparison; timeline; encrypted local JSON storage; export.
