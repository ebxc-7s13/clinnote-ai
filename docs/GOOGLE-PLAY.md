# ClinNote AI — Google Play Preparation

> **Paused (2026-10-09, ADR-055).** ClinNote is distributed through GitHub Releases. This document and `docs/play-store/` are kept for a later Play submission.

**Current Google Play policies, forms and requirements must be checked immediately before submission.** Policies change frequently; nothing in this document replaces the current Google Play Developer Policy Center and Play Console Help.

ClinNote holds no regulatory approval, certification or clinical validation, and no Play material may suggest otherwise.

---

## 1. Account Requirements

- VERIFIED 2026-10-09 (Play Console Requirements, https://support.google.com/googleplay/android-developer/answer/10788890): "developers providing the following services must register as an Organization", including "Health apps, such as Medical apps and Human Subjects Research apps." An organization account needs a D-U-N-S number. **ClinNote must be published from an organization account.**
- Identity verification and contact details completed.
- VERIFIED 2026-10-09 (https://support.google.com/googleplay/android-developer/answer/14151465): personal accounts created after November 13, 2023 need "a minimum of 12 testers who have been opted in continuously for at least 14 days" in a closed test before production. This applies to personal accounts; internal testing is available immediately.

## 2. Health-App Declaration

VERIFIED 2026-10-09 (Health Content and Services, https://support.google.com/googleplay/android-developer/answer/16679511; declaration, https://support.google.com/googleplay/android-developer/answer/14738291): every published app completes the Health apps declaration; health apps need a privacy policy link in Play Console **and** a link or text inside the app; non-regulated apps state in the description that the app is "not a medical device and does not diagnose, treat, cure, or prevent any medical condition"; apps "must also remind users to consult a healthcare professional for medical advice, diagnosis, or treatment". 1.2.0 shows both statements on the About screen and has the privacy text in-app (Settings → Privacy). Draft answers: `docs/play-store/data-safety.md`.

ClinNote processes health information and provides AI-assisted clinical documentation and evidence review for healthcare professionals. Complete the Health apps declaration in Play Console describing:

- intended users: healthcare professionals
- functionality: documentation, transcription, evidence lookup
- not intended to diagnose, treat or prescribe
- regulatory status: none claimed. Before any release, the formal regulatory assessment required by ADR-025 must be documented for each target market (OD-011). If it concludes the app, or a feature such as R2 "possibilities to review", is a regulated medical device in a market, provide the required clearance documentation, or do not release there or with that feature.

## 3. Sensitive Health Information

- Health data stays on the device; processing by cloud providers is disclosed.
- No health data used for advertising; no advertising SDKs.
- No data sale.

## 4. Microphone Permission

- `RECORD_AUDIO` — core feature; requested at first recording with rationale.
- If the Phase 7 ADR chooses background recording: foreground service (microphone type) permissions, notification permission, and any Play foreground-service declaration with a demonstration video — VERIFY.
- No location, contacts, phone, SMS, or other unrelated permissions.

## 5. Privacy Policy

A public privacy policy URL is required before production. It must accurately describe: audio handling and temporary retention, transcription, AI processing and providers, local storage, absence of cloud backup, third-party services, deletion, security, user controls, contact. Derived from `PRIVACY.md` §7 and reviewed by a qualified person.

## 6. Data Safety

Expected answers (confirm against the built app):

| Topic | Expected |
|---|---|
| Audio collected | Yes — voice/sound recordings, transmitted to service providers for transcription; not stored by ClinNote servers |
| Health info | Yes — processed by AI service providers for app functionality |
| Personal identifiers | Optional name/DOB stored on device only; not transmitted |
| Encrypted in transit | Yes |
| Deletion | Users can delete data in-app |
| Shared for advertising | No |
| Location / contacts / device IDs | Not collected |
| Crash data | No in-app crash SDK (ADR-030); Google Play Android vitals only (VERIFY declaration needs) |
| Account info | Clinician email for sign-in (Supabase Auth, ADR-032); not linked to patient data |

## 7. App Description

States clearly: for healthcare professionals; documentation and evidence-review assistant; AI output requires clinician review; does not diagnose, prescribe or replace clinical judgment.

## 8. Medical Claims

Never claim: FDA approval, CDSCO approval, CE certification, clinical validation, medical-device certification, accuracy guarantees, "replaces doctors", "diagnoses", "definitive medical advice".

## 9. AI-Generated Content

Review current Play policy on AI-generated content; provide in-app reporting/feedback mechanism if required — VERIFY.

## 10. Target SDK

VERIFIED 2026-10-09 (https://developer.android.com/google/play/requirements/target-sdk): "Starting August 31 2026: New apps and app updates must target Android 16 (API level 36) or higher" (extension possible to November 1, 2026). ClinNote 1.2.0 targets and compiles against API 36 (Expo SDK 57 default), verified with `aapt2 dump badging`.

16 KB page sizes (https://developer.android.com/guide/practices/page-sizes, verified 2026-10-09): apps targeting Android 15+ must support 16 KB pages on 64-bit devices; from February 1, 2027 non-compliant updates cannot be released. Checked per build with `zipalign -c -P 16 4`.

## 11. Release Build and Signing (ADR-054)

Google Play App Signing (verified 2026-10-09, https://support.google.com/googleplay/android-developer/answer/9842756): new apps are enrolled automatically; Google holds the app signing key, the developer signs uploads with an **upload key** (RSA ≥ 2048). A lost or compromised upload key can be reset in Play Console.

**Create the upload key once** (outside Git):

```bash
bash mobile/scripts/create-upload-key.sh                              # random password, never printed
CLINNOTE_SIGNING_INTERACTIVE=1 bash mobile/scripts/create-upload-key.sh  # or type your own
```

It writes `~/.clinnote-signing/` (mode 700): `clinnote-upload.jks` (PKCS12, RSA 4096, SHA256withRSA, 30 years), `signing.properties` (the only place the password exists) and `upload_certificate.pem` (public). The script refuses to overwrite an existing key or to write inside the repository. Equivalent manual command:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore ~/.clinnote-signing/clinnote-upload.jks \
  -alias clinnote-upload -keyalg RSA -keysize 4096 -sigalg SHA256withRSA -validity 10950 \
  -dname "CN=ClinNote Upload Key, O=ClinNote"      # keytool prompts for the password
```

**Back up** (do this before the Codespace is deleted): download the whole `~/.clinnote-signing/` folder (Codespaces file explorer → right-click → Download, or `gh codespace cp -e 'remote:~/.clinnote-signing/*' ./clinnote-signing/`), keep it in two places you control (e.g. an encrypted password-manager attachment and an encrypted offline drive), and keep the password with it. Never e-mail it, never put it in Git, a chat, an issue or cloud storage without encryption. If it is lost: create a new key and request an upload-key reset (Play Console → Protected with Play → Play Store protection → Manage Play app signing → Request upload key reset, with the new `upload_certificate.pem`).

**Build**: `JAVA_HOME=<JDK 17+> bash mobile/scripts/build-release.sh`. It runs `expo prebuild` (the `withReleaseSigning` plugin injects the release signing config), builds the AAB (armeabi-v7a, arm64-v8a, x86_64) and an arm64-v8a APK into `~/clinnote-artifacts/`, refuses to overwrite artifacts, and fails if either is debug-signed. Gradle reads the key from `$CLINNOTE_SIGNING_PROPERTIES` or `~/.clinnote-signing/signing.properties`; without it every release task fails (no debug fallback). `versionCode` increases with every upload (1.0.0 = 1, 1.1.0 = 2, 1.2.0 = 3).

**Upgrade caveat:** builds signed with the debug key (1.0.0, 1.1.0) cannot be updated in place by upload-key or Play-signed builds. Export data, uninstall, then install. GitHub-release APKs (upload key) and Play installs (Google's app signing key) cannot update each other either.

## 12. Store Listing

App name, short description, full description (§7), category (Medical or Productivity — decide at submission), contact email, privacy policy URL, content rating questionnaire.

## 13. Screenshots

Synthetic patients only (`P-9xxxxx`, fictional names); no real clinical data; show provisional labels honestly; no claims in captions that violate §8.

## 14. Support

Support email and web page; response process for data deletion questions and incident reports.

## 15. Testing

Internal testing → closed testing (meeting current account requirements) → production with staged rollout. Testers use synthetic patients and are instructed not to enter real patient information.

## 16. Production Readiness Checklist

Status 2026-10-09 (1.2.0): signing, target SDK, AAB, in-app disclaimers and drafts are done; every unticked item needs the project owner.

- [ ] Current Play policies re-checked on submission date
- [ ] Formal regulatory assessment (ADR-025) documented for each release country (OD-011); R2 flag OFF unless the assessment permits it
- [ ] OD-006 retention resolved; OD-010 license resolved; OD-011 target markets resolved
- [x] Target SDK meets current requirement (API 36, verified)
- [x] Upload-key-signed AAB built and verified (1.2.0) — [ ] device-tested by the owner
- [ ] Privacy policy published and consistent with Data Safety (draft: `docs/play-store/privacy-policy.md`)
- [ ] Organization developer account (required for health apps)
- [ ] Data Safety form completed (draft: `docs/play-store/data-safety.md`)
- [ ] Health apps declaration completed
- [ ] Permissions declarations completed (and foreground-service declaration if applicable)
- [x] Store listing draft free of prohibited claims (`docs/play-store/store-listing.md`)
- [ ] Screenshots synthetic only
- [ ] Support contact working
- [ ] Closed testing requirements met
- [ ] Security, privacy, clinical-safety acceptance criteria met (Phase 25)
