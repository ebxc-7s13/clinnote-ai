# ClinNote AI

> **Listen. Organize. Review. Remember.**

ClinNote AI is an Android-first ambient clinical documentation and evidence-review assistant. It helps organize consultations into editable clinical notes and structured patient histories.

ClinNote is a documentation aid for healthcare professionals. **It is not a medical device, it is not clinically validated, it has no FDA, CDSCO or CE approval, and it does not diagnose, prescribe or triage.** Everything it produces must be reviewed by a qualified clinician. Use it with **synthetic (made-up) patients**.

Free and open source ([MIT](LICENSE)). No account, no subscription, no paid API, no ads, no tracking.

---

## Quick Download

### ⬇️ [Download the latest Android APK](https://github.com/ebxc-7s13/clinnote-ai/releases/latest)

- **Latest version:** 1.2.0 (versionCode 3) — file `ClinNote-1.2.0-arm64-v8a-release.apk`
- **For:** 64-bit ARM Android phones (`arm64-v8a` — practically every Android phone sold since about 2017), Android 7.0 (API 24) or newer. It will not install on 32-bit-only phones or x86 emulators.
- **Checksum:** each release has a `SHA256SUMS.txt` file. See [Verify the download](#verify-the-download).
- Only the **`.apk`** file is meant for installing on a phone. An `.aab` (Android App Bundle) is a developer/store format and cannot be installed by tapping it.
- Only install ClinNote from this repository's [Releases page](https://github.com/ebxc-7s13/clinnote-ai/releases). ClinNote is not on Google Play.

---

## Contents

[Features](#features) · [Download and Install](#download-and-install) · [Updating](#updating-clinnote) · [First Launch](#first-launch) · [How to Use](#how-to-use) · [Transcription](#transcription) · [Evidence and Medication Information](#evidence-and-medication-information) · [Storage](#storage) · [API Keys and Cloud AI](#api-keys-and-cloud-ai) · [Free-Only Model](#free-only-model) · [Limitations](#limitations) · [Clinical Safety](#clinical-safety) · [Troubleshooting](#troubleshooting) · [For Developers](#for-developers) · [Repository Structure](#repository-structure) · [License](#license) · [Security](#security) · [Support and Contributions](#support-and-contributions) · [Releases](#releases)

---

## Features

All of these are implemented in 1.2.0 and covered by automated tests and an Android-emulator walkthrough. Hardware-dependent parts (live microphone, other languages) are noted in [Limitations](#limitations).

- **Patient records** — automatic reference (`P-000001` …); name, age, sex, occupation and preferred language are optional. Problem list, medications, allergies and history on the patient page. Synthetic demo patients are clearly labelled **DEMO DATA**.
- **Visits and timestamps** — every visit gets a code and its start time automatically; segments, edits and report versions are time-stamped (stored in UTC, shown in local time).
- **Consent before recording** — the clinician confirms verbal or written consent; "Consent declined — continue manually" is always available.
- **Recording controls** — Pause, Resume, Finish segment, Finalize consultation, and **Add more conversation** after finalizing. A strip shows every segment of the visit.
- **Multi-segment consultations** — a visit can have many recording segments; the app keeps one ordered, de-duplicated transcript and tells you when facts need to be **reconciled** with newly added conversation.
- **Transcript review** — speaker labels (Doctor / Patient / Other), correct text or speaker, split, merge, mark uncertain, exclude a duplicate (restorable), add a typed utterance. Every change is kept.
- **Structured clinical facts** — symptoms, duration, history, medications, allergies, vitals, investigations, examination, assessment, plan and follow-up. Each fact keeps **what was said** (Positive / Negative / Not discussed / Unknown), **who said it** (patient, clinician, measured, AI …) and **review status** (Provisional / Confirmed / Rejected). "Not discussed" is never turned into "negative". Contradictions are kept side by side as conflicts for you to resolve.
- **Medications and history** — medication wording kept as spoken, normalized against RxNorm; current / stopped / changed status as stated; nothing is suggested.
- **Evidence links** — public sources (NLM, FDA, Europe PMC …) searched with clinical terms only; every item opens its source page.
- **Clinical review** — a review screen to confirm, reject or edit provisional items. (The experimental "Possibilities to review" feature is switched off in this release.)
- **Editable notes** — SOAP, general or progress note drafted from the facts *you* reviewed; edit freely; Finalize; Amend creates a new version.
- **Clinical report** — a structured report (patient, visit, complaint, history, medications, allergies, vitals, investigations, plan, follow-up, changes since last visit, sources, uncertainties) built by code from the facts, saved in versions, always marked *DRAFT — clinician review required*.
- **Longitudinal timeline and visit comparison** — what changed since the last visit (e.g. "Weight changed from 72 kg to 70 kg").
- **Follow-ups and reminders** — follow-ups stated in a visit appear on Home; reminders are shown in the app (no notifications).
- **Export** — report as **PDF, JSON or text**, note export and patient summary, through the Android share sheet.
- **Search** across patients, visits and notes.
- **Privacy controls** — Cloud processing on/off, delete temporary audio, delete a visit or patient, delete all local data.
- Light / dark / system theme; consultation language selection (where the phone supports it).

## Download and Install

1. On your Android phone, open **[github.com/ebxc-7s13/clinnote-ai/releases/latest](https://github.com/ebxc-7s13/clinnote-ai/releases/latest)**.
2. Under **Assets**, tap **`ClinNote-1.2.0-arm64-v8a-release.apk`** (about 44 MB).
3. Wait until the download has fully finished.
4. Open the APK from the browser's download notification, or from the **Downloads** / **Files** app.
5. If Android says installing from this source is not allowed, tap **Settings** and turn on **Allow from this source** *for that one app* (your browser or Files app). Do not change any other security setting.
6. Go back and tap **Install**.
7. Tap **Open** to start ClinNote.
8. Read the onboarding and privacy information.
9. Tap **Create synthetic demo patient** on Home to try the app with made-up data.

About the warning: Android shows an "unknown app" / "install unknown apps" warning for any app installed outside Google Play, and Google Play Protect may ask you to scan it. This is expected for direct APK installation. Install only the APK from this repository's Releases page, and verify its checksum if you can. You can switch *Allow from this source* off again after installing.

### Verify the download

The release page lists the SHA-256 checksum in `SHA256SUMS.txt` and in the release notes.

- **Phone:** a checksum app (any "hash checker") — compare the SHA-256 value with the release notes.
- **Computer:** download both files into one folder, then run
  - Linux/macOS: `sha256sum -c SHA256SUMS.txt` (macOS: `shasum -a 256 -c SHA256SUMS.txt`)
  - Windows PowerShell: `Get-FileHash .\ClinNote-1.2.0-arm64-v8a-release.apk -Algorithm SHA256`
- **Signing certificate** (advanced, Android SDK): `apksigner verify --print-certs ClinNote-1.2.0-arm64-v8a-release.apk` must show
  `SHA-256 digest: 94a47ba688db35c153056400af52cf75cee67428c98d714d5dc81ebe661d4d99`.
  Every official ClinNote release is signed with this same certificate.

## Updating ClinNote

1. Check the [Releases page](https://github.com/ebxc-7s13/clinnote-ai/releases) for a newer version and read its release notes.
2. **Export** anything you need first (report → Export JSON/PDF, patient → Export patient summary).
3. Download and install the new APK as above. Releases from 1.2.0 on are signed with the same key and keep the same package name (`ai.clinnote.app`), so they install **over** the existing app and keep its data.

**Coming from a 1.0.0 or 1.1.0 test build?** Those were signed with a temporary development (debug) key. Android refuses to update an app whose signature has changed ("App not installed" / "package conflicts with an existing package"). You must:

1. export what you want to keep from the old build,
2. uninstall the old ClinNote — **this deletes all its local records; they cannot be recovered** (ClinNote does not use Android cloud backup),
3. install 1.2.0.

Exported JSON files are for your own records; 1.2.0 has no import function, so records do not move into the new installation.

## First Launch

1. **Onboarding** explains what ClinNote is and is not. Acknowledge it and choose:
   - **Acknowledge and turn on cloud processing** — live transcription and public evidence search may use the network (clinical terms only), or
   - **Acknowledge — manual mode (cloud off)** — nothing leaves the phone. You can change this later in **Settings → Processing**.
2. **Permissions:** the microphone permission is asked only when you first start recording. No other runtime permission is requested.
3. **Privacy notice:** *Settings → Privacy* (and [PRIVACY.md](PRIVACY.md)).
4. **Language:** *Settings → Consultation language*. Only languages your phone's speech service reports can be selected; the reason is shown for the others.
5. **Create a patient:** Home → **Create patient** (or **Create synthetic demo patient**).
6. **Start a visit:** on the patient page, **Start new visit**. The date and time are recorded automatically.
7. **Recording consent:** confirm consent (verbal or written) → **Confirm and start recording**, or **Consent declined — continue manually**.
8. **Stop a segment:** **Pause** / **Resume** while talking; **Finish segment** when a part of the conversation ends.
9. **Continue the consultation:** **Continue conversation** records another segment of the same visit.
10. **Finalize the visit:** **Finalize consultation**. If more is said later, **Add more conversation** reopens it (audited).
11. **Review the transcript:** check speakers and wording; correct, split, merge, mark uncertain.
12. **Reconcile clinical facts:** **Reconcile complete visit** after adding segments; then confirm, edit or reject facts and resolve conflicts.
13. **View evidence:** open each source; run a manual search if needed.
14. **Edit the report / note:** **Clinical report** and **Note** → **Generate draft from documented facts**, edit, **Save**, **Finalize note**.
15. **Save and reopen:** everything is saved automatically on the phone. Reopen the patient from **Patients** or **Search**.
16. **Compare visits:** on a returning patient, **Full comparison** and **Timeline**.
17. **Export:** report → **Export PDF / Export JSON / Export text**.

## How to Use

A complete walkthrough with synthetic data:

1. Home → **Create synthetic demo patient**.
2. Patient page → **Start new visit** → confirm consent → **Confirm and start recording**.
3. On a demo patient you can tap **Run synthetic demo consultation (no microphone)** to play a scripted conversation, or simply speak. Set **Current speaker** to Doctor or Patient as people talk. A short example:

   > **Doctor:** "What brings you in today?"
   > **Patient:** "I have had a cough for about three weeks."
   > **Doctor:** "Any fever?"
   > **Patient:** "No fever."

4. Tap **Finish segment**, then **Finalize consultation**.
5. Open the **transcript**: check that each line has the right speaker and wording; correct anything misheard.
6. Open **facts**. For the example you should see *cough* — **Positive**, duration *about 3 weeks*, patient-reported — and *fever* — **Negative** (denied), patient-reported. Allergies were never mentioned, so no allergy fact is created — ClinNote never writes "no known allergies" for something not discussed. Everything is **Provisional** until you confirm it. (This exact example is an automated test: `mobile/src/__tests__/readme-example.test.ts`.)

   The rule-based extractor reads what each person *states*. A bare answer to a question — Doctor: "How long have you had the cough?", Patient: "About three weeks." — is **not** turned into a cough fact; add it with **Add fact manually** or correct the transcript.
7. Confirm, edit or reject each fact. Only your confirmation makes a fact *Confirmed*.
8. **Evidence:** open the listed sources and judge them yourself. No result does not mean anything is absent.
9. **Note / Clinical report:** generate the draft from the documented facts, edit it, save it, finalize it, export it.

Treat every output as a draft that may be wrong or incomplete. ClinNote has not been validated for accuracy.

## Transcription

- **How it works:** ClinNote uses the speech-recognition service built into your phone (usually Google's). It asks for on-device recognition when the phone supports it; otherwise the phone's service decides how audio is processed (it may use its provider's servers under that provider's terms).
- **Recording controls:** Pause, Resume, Finish segment, Continue conversation, Finalize consultation, Add more conversation, Withdraw consent.
- **Speaker labels:** the phone's recognizer does not separate voices. You choose the current speaker (Doctor / Patient / Other) while recording and can correct it per line afterwards. No voiceprints.
- **Languages:** English is the tested path. Telugu, Hindi, Bengali, Tamil, Kannada, Malayalam and Auto-detect can be selected **only if your phone's speech service offers them** (language lists need Android 13+, auto-detect Android 14+). They are implemented but **not yet verified on a real device**, and automatic fact extraction is **English-only** — for other languages the transcript is kept for manual documentation. Nothing is translated.
- **Uncertainty:** recognition makes mistakes, especially with drug names, numbers and accents. Mark doubtful lines **uncertain** and correct them; check every number and unit.
- **More segments:** each segment stores its own language and time; facts made before a new segment are flagged until you reconcile.
- **Finalizing:** finalizing does not confirm any fact; review remains your job.

## Evidence and Medication Information

- Sources are free public biomedical and regulatory services: U.S. National Library of Medicine (RxNorm, DailyMed, PubMed, MedlinePlus, PubChem, ClinicalTrials.gov, Clinical Tables), U.S. FDA (openFDA labels, recalls, Drugs@FDA) and Europe PMC.
- Only clinical terms (e.g. "metformin", "cough") are sent — never names, references or transcript sentences — and only when Cloud processing is on.
- Every item shows its source and retrieval time. **Open each source and assess it.** Citations are never written by AI.
- **"No evidence found" does not prove that a condition is absent** or a medicine is safe; the service may be down, rate-limited or simply have no record.
- Medication information is quoted U.S. label text (boxed warning, contraindications, warnings, interactions section) **for clinician review**. When no label record is found the report says *INSUFFICIENT VERIFIED EVIDENCE*. ClinNote does not suggest medicines, doses or changes, does not check interactions automatically, and **never prescribes**. It does not replace professional medical judgment.

## Storage

- **Where:** all patient information is stored **only on the phone**, in ClinNote's private app storage. There is no ClinNote server or cloud database.
- **Encryption:** each record file is encrypted with AES-256-GCM; the key is kept in Android's Keystore-backed secure storage and never leaves the device.
- **Backups:** Android cloud backup is disabled for ClinNote, so records are not copied to Google Drive — and are lost if you uninstall. Export what you need.
- **What is transmitted:** with Cloud processing on, clinical terms to the public evidence services above, and audio to your phone's speech service if it does not recognize on-device. With it off, nothing. The public APK has no AI backend (see below).
- **Raw audio:** ClinNote does not keep recordings. In the public APK no audio file is written at all; in self-built AI-enabled builds a temporary file exists only until the final transcript is made (max. 24 hours). *Settings → Delete temporary audio now* clears any remainder.
- **Export:** PDF / JSON / text through the share sheet. Exported files are outside ClinNote's protection.
- **Delete:** *Delete visit*, *Delete patient*, or *Settings → Delete all local data* (also destroys the encryption key). Uninstalling deletes everything.

Full details: [PRIVACY.md](PRIVACY.md).

## API Keys and Cloud AI

- **No API key of any kind is bundled in the APK**, and you are never asked to enter one.
- The public APK has **no cloud AI configured**. *Settings* shows "Cloud AI backend not configured". Everything listed under [Features](#features) works without it: on-device transcription, rule-based fact extraction (English), manual entry, public evidence search, notes, reports, comparison and export.
- **Optional, for developers:** you can deploy the included backend (`backend/`, Supabase Edge Functions calling the Google Gemini API free tier) in your own free accounts and build your own APK pointing at it (see [For Developers](#optional-ai-backend)). Even then, **cloud AI is used only for synthetic demo patients**, because the free tier's terms allow submitted content to be used to improve the provider's products. Real-patient visits always stay on rule-based, on-device processing.
- If the free quota is exhausted, the app says *"Free AI quota is currently unavailable"*, keeps your transcript and notes unchanged and continues in manual/rule-based mode. It never retries into a paid tier.
- Never paste API keys into GitHub issues, files or pull requests.

## Free-Only Model

ClinNote is built under a strict free-only rule (`FREE_ONLY_MODE = true`, a hard-coded constant in the app and the backend):

- no paid API, paid speech recognition, paid search, paid database or paid hosting is required;
- no automatic upgrade or fallback to a paid service, no billing, no subscription;
- the optional backend refuses requests if `FREE_ONLY_MODE` is switched off and accepts only models verified as free-tier, and its documentation tells you to create the Gemini key in a project **without billing**.

Free public services have quotas, terms and occasional outages. When a service is unavailable, the affected feature (evidence look-up, optional AI) is temporarily unavailable and the app says so; your records are never lost because of it.

## Limitations

- **Not validated:** no clinical validation study, no regulatory approval. Synthetic data only.
- **Transcription** quality depends on the phone, microphone, noise and the device's speech service. Errors must be reviewed.
- **Speaker separation** is manual (you choose the current speaker).
- **Non-English languages** depend on your phone; not yet verified on a device. **Automatic extraction is English-only.** No translation.
- **Facts can be incomplete or wrong.** Rule-based extraction recognises common phrasing only and does not combine a question with a short answer ("About three weeks."); add such facts manually.
- **Evidence services** may return nothing, be slow or rate-limited. Medication labels are U.S. data.
- **No cloud AI** in the public APK.
- **No import:** exported JSON cannot be imported back. No sync between phones; one clinician, one device.
- **Reminders** appear only inside the app (no notifications).
- **No audio replay** (audio is not kept).
- **Device coverage:** 1.0.0 was used on one physical phone; 1.1.0/1.2.0 were tested on an Android 14 emulator. Live microphone, haptics and TalkBack of 1.2.0 are not yet tested on a physical device.

## Clinical Safety

- ClinNote is a **documentation and evidence-review aid**, not an independently validated diagnostic or prescribing system, and not a substitute for professional medical judgment.
- Transcription can be inaccurate. AI and rule-based output can be incorrect or incomplete. **Every note and report must be reviewed** by an appropriately qualified clinician before use.
- Evidence sources must be opened and assessed by the clinician.
- Medication information is reference material, **not a prescription** and not a recommendation.
- ClinNote never marks anything as confirmed by itself; only the clinician's action does.
- Do not use demo configurations — and never the optional free-tier cloud AI — with real, identifiable patient information.

## Troubleshooting

| Problem | What to do |
|---|---|
| **APK won't install** | Make sure the download finished (≈44 MB) and the checksum matches. Allow installs for the app you are opening it from (step 5 above). The APK is for 64-bit ARM phones with Android 7.0+; it will not install on 32-bit-only phones. Free some storage. |
| **"App not installed" when updating** | An older debug-signed test build (1.0.0/1.1.0) is installed. Export your data, uninstall it, then install. See [Updating](#updating-clinnote). |
| **App doesn't open / closes immediately** | Restart the phone and try again; make sure you installed the arm64 APK from the official Releases page. If it persists, open a bug report with your Android version and model. |
| **Microphone permission denied** | Android Settings → Apps → ClinNote → Permissions → Microphone → *Allow only while using the app*. You can also continue with manual documentation. |
| **Speech recognition unavailable** | Install or update the **Speech Recognition & Synthesis** / Google app, make sure a speech service is selected (Android Settings → System → Languages → Voice input / Speech), and, for offline recognition, download the language there. Then retry. |
| **Telugu / Hindi unavailable** | The option is enabled only when your phone's speech service lists that language (Android 13+). Add or download the language in the phone's speech settings, then reopen Settings in ClinNote. If it still is not offered, your device's service does not support it. |
| **AI request fails** | The public APK has no cloud AI: this is expected ("Cloud AI backend not configured"). Rule-based extraction and manual entry still work. In your own AI build, check the backend deployment and that the patient is a demo patient. |
| **Free quota exhausted** | Wait and retry later (free quotas reset over time). Your data is unchanged; continue manually. |
| **Evidence search returns no results** | Check that Cloud processing is on and you are online; try a simpler generic term (e.g. the generic drug name) with *Run a manual search*. No result is not evidence of absence. |
| **PDF export fails** | Try again after closing other apps; try *Export text* or *Export JSON*; make sure an app that can receive files (Files, Drive, email) is installed. |
| **Cannot update an existing installation** | Same as "App not installed": signature mismatch with a test build, or you are trying to install an *older* version over a newer one (Android blocks downgrades). |
| **Patient data is not present after reinstall** | Uninstalling deletes ClinNote's encrypted local data and its key, and Android cloud backup is off by design. Data cannot be recovered; use exported files for your records and export before reinstalling in future. |

## For Developers

### Prerequisites

- **Node.js 24 LTS** and **npm 11** (the versions used to build and test 1.2.0; `mobile/package-lock.json` pins dependencies)
- For Android builds: **JDK 21** (used for 1.2.0; with JDK 25 the native CMake configure step of `react-native-worklets` failed in testing), `JAVA_HOME` set, **Android SDK** (`ANDROID_HOME`, default `~/android-sdk`) with platform 36 and build-tools 36, ~8 GB RAM
- Optional: Expo Go is **not** sufficient (the app uses native modules); use a development build

### Install and check

```bash
git clone https://github.com/ebxc-7s13/clinnote-ai.git
cd clinnote-ai/mobile
npm ci
npm run typecheck          # tsc --noEmit
CI=1 npm run lint          # expo lint
npm test                   # jest: unit, UI, workflow and clinical-safety suites (mock providers, synthetic data)
npm run test:safety        # clinical-safety suites only
npx expo-doctor            # Expo project checks
LIVE_EVIDENCE=1 npx jest src/__tests__/live.test.ts   # optional: real calls to the public evidence APIs
cd ../backend && npm test && npm run typecheck        # backend (uses mobile/node_modules for tsc)
```

### Environment

`mobile/.env.example` lists the only build-time variables (all public by design; copy to `mobile/.env`, which is git-ignored):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | your optional AI backend (leave empty for no cloud AI — the public APK is built this way) |
| `EXPO_PUBLIC_NCBI_EMAIL` | optional contact e-mail sent to NCBI E-utilities |
| `EXPO_PUBLIC_APP_VARIANT` | `development` / `preview` / `production` |

**Never put a private key in an `EXPO_PUBLIC_*` variable** — these values are compiled into the APK.

### Run in development

```bash
cd mobile
npm run android            # expo run:android — builds a debug app and installs it on a connected device/emulator
npm start                  # expo start — Metro bundler for an installed development build
```

### Build the release APK

```bash
# once: create your own release key outside the repository (~/.clinnote-signing/, mode 600)
bash mobile/scripts/create-upload-key.sh
# build, sign, verify and checksum (artifacts in ~/clinnote-artifacts/, never overwritten)
bash mobile/scripts/build-release.sh
CLINNOTE_BUILD_AAB=1 bash mobile/scripts/build-release.sh   # also build an AAB
```

`build-release.sh` runs `expo prebuild`, then Gradle `assembleRelease` for `arm64-v8a`, verifies the APK signature, rejects the debug certificate, prints package/version/permissions, checks 16 KB page alignment and writes `ClinNote-<version>-SHA256SUMS.txt`. Release signing is injected by `mobile/plugins/withReleaseSigning.js` from `~/.clinnote-signing/signing.properties` (or `$CLINNOTE_SIGNING_PROPERTIES`); **if it is missing, the release build fails instead of falling back to the debug key.**

An APK you build is signed with *your* key, so it cannot update an official release on the same phone (and vice versa). Official releases can only be produced by the maintainer, who holds the release key. The maintainer's release procedure is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) §9a.

### Optional AI backend

`backend/supabase/functions/` contains two Supabase Edge Functions (`clinnote-ai`, `clinnote-transcribe`) that call the Google Gemini API. To use them you need your own free Supabase project and a Gemini API key created in a Google Cloud project **without billing**. Set the secrets listed in `backend/.env.example` with `supabase secrets set` (never in Git), deploy with the Supabase CLI, and put the project URL and anon key into `mobile/.env` before building. The backend has not been deployed or live-tested by the project; treat it as experimental. Cloud AI then runs for synthetic demo patients only.

## Repository Structure

```text
mobile/                     Android app (React Native + Expo SDK 57, TypeScript)
  src/app/                  screens (Expo Router): tabs, patient, visit (record, transcript, facts, review, evidence, note, report, compare)
  src/domain/               clinical domain: types, extraction, consultation state machine, report, safety rules
  src/application/          services wiring domain, storage and providers (visit pipeline, export)
  src/infrastructure/       encrypted JSON storage, speech recognizer, audio
  src/providers/            adapters: evidence APIs, optional backend (mock + real)
  src/presentation/         UI components, theme
  src/__tests__/            jest suites incl. safety/ (clinical-safety tests)
  plugins/                  Expo config plugin for release signing
  scripts/                  release build, key creation, icon generation
  assets/                   app icon and splash (original artwork)
backend/                    optional Supabase Edge Functions (Gemini, free tier) + tests
docs/                       product, architecture, data model, clinical safety, privacy, security, testing, deployment specs and ADRs
.github/                    CI workflow and issue templates
.claude/                    AI-assisted development configuration (agents, rules, hooks)
```

## License

ClinNote AI is released under the [MIT License](LICENSE). The license covers the software only; it does not certify clinical accuracy, validate medical functionality, guarantee regulatory compliance, or grant rights to third-party components, which keep their own licenses ([THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)). Evidence content shown in the app belongs to its publishers and is subject to their terms.

## Security

See [SECURITY.md](SECURITY.md). Report vulnerabilities **privately** through GitHub's [private vulnerability reporting](https://github.com/ebxc-7s13/clinnote-ai/security/advisories/new) — not in public issues, and without real patient data or working credentials.

## Support and Contributions

- **Bugs and feature requests:** [GitHub Issues](https://github.com/ebxc-7s13/clinnote-ai/issues) (templates provided). Never include real patient information.
- **Contributing:** read [CONTRIBUTING.md](CONTRIBUTING.md) — synthetic data only, no secrets, no paid services, clinical-safety tests must pass.
- Changes per version: [CHANGELOG.md](CHANGELOG.md).
- Detailed specifications: [docs/PRODUCT_SPEC.md](docs/PRODUCT_SPEC.md), [docs/CLINICAL-SAFETY.md](docs/CLINICAL-SAFETY.md), [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATA_MODEL.md](docs/DATA_MODEL.md), [docs/PROJECT-STATUS.md](docs/PROJECT-STATUS.md).

ClinNote is maintained by one volunteer; there is no guaranteed support time.

## Releases

All versions, release notes, APKs and checksums: **[github.com/ebxc-7s13/clinnote-ai/releases](https://github.com/ebxc-7s13/clinnote-ai/releases)**.
