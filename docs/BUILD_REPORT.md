# ClinNote AI — Final Build Report

Written on 2026-10-09 (UTC) from the repository state and from command output produced in the M3/M4 session. A previous report is not evidence. Branch `feat/v1-app`; commits are listed under **Git**.

Status words: **IMPLEMENTED** (code exists) · **TESTED** (automated tests ran and passed in this session) · **PARTIALLY TESTED** · **NOT TESTED** · **BLOCKED**.

## Overall Status

ClinNote is a working Android application for **synthetic development data**. The full consultation workflow runs end to end on an Android 14 emulator from a release APK: create patient → visit → consent → record (synthetic script) → transcript with speaker labels → stop → speaker-role confirmation → fact extraction → evidence from live public sources → clinical review → note → finalize → save → reopen after restart → second visit → what changed → export → offline access. No crash, and no JS or native-module error, appeared in logcat.

It is **not** production-ready, clinically validated or approved by any regulator. Real-patient use is BLOCKED by owner decisions (see **Known Blockers**).

| Gate (owner §29) | Result | Evidence |
|---|---|---|
| Core workflow works | TESTED | jest UI flow test + emulator E2E (§Android Build) |
| Data persists | TESTED | restart tests (jest, new store instance) + emulator force-stop/relaunch |
| Transcript works | TESTED (synthetic script + mocked recognizer); live microphone NOT TESTED | the emulator image has no speech service and no audio input |
| AI extraction works | rule-based extraction TESTED; Gemini path TESTED with mocks only | no Gemini key exists (owner) |
| Evidence works where configured | TESTED | 9 free public APIs live, 11/11 checks, plus a live run on the emulator |
| Clinician review works | TESTED | unit + UI tests |
| Note works | TESTED | unit + UI + emulator |
| Return visit works | TESTED | workflow test + emulator ("Weight changed from 72 kg to 70 kg (−2 kg)") |
| Export works | PARTIALLY TESTED | rendering and audit tested; on the emulator the share sheet opened, but no receiving app was exercised and the PDF file was not inspected |
| Safety tests pass | TESTED | safety suites pass (counts under **Tests**) |
| Security audit pass | TESTED (repository scan) | §Security |
| Android build pass | TESTED | release APK built; launched and driven on the emulator |

## M3 Status

**IMPLEMENTED + TESTED** (jest UI tests, emulator). There are 27 route files in `mobile/src/app`, built with Expo Router (ADR-049).

| # | Screen | Route | Status |
|---|---|---|---|
| 1 | Onboarding | `onboarding.tsx` (Stack.Protected) | TESTED (UI + emulator) |
| 2 | Home | `(tabs)/index.tsx` | TESTED |
| 3 | Patients | `(tabs)/patients.tsx` | IMPLEMENTED |
| 4 | Patient Search | `search.tsx` | TESTED (emulator, offline) |
| 5 | Patient Overview + Returning Patient | `patient/[patientId]/index.tsx` | TESTED |
| 6 | Timeline (+ symptom course) | `patient/[patientId]/timeline.tsx` | TESTED (emulator opened; domain tests) |
| 7 | Start Visit | `visit/start.tsx` | TESTED |
| 8 | Consent | `visit/…/consent.tsx` | TESTED |
| 9–10 | Live Recording + Live Transcript | `visit/…/record.tsx` | TESTED with the synthetic script; live microphone NOT TESTED |
| — | Transcript (roles, correction, relabel, jump to time) | `visit/…/transcript.tsx` | TESTED (roles); correction domain-tested |
| 11 | Clinical Facts (+ fact detail, conflicts, manual entry) | `visit/…/facts.tsx`, `fact/[factId].tsx` | TESTED |
| 12 | Clinical Review | `visit/…/review.tsx` | TESTED |
| 13 | Evidence | `visit/…/evidence.tsx` | TESTED (emulator, live) |
| 14 | Medication (list + information) | `visit/…/medications.tsx`, `medication/[factId].tsx` | IMPLEMENTED; adapters live-tested |
| 15 | Note Editor | `visit/…/note.tsx` | TESTED |
| 16 | Follow-Up | `followups.tsx` | IMPLEMENTED |
| 17 | Visit Comparison | `visit/…/compare.tsx` | TESTED |
| 18 | Settings | `(tabs)/settings.tsx` | IMPLEMENTED |
| 19 | Privacy | `privacy.tsx` | IMPLEMENTED |
| 20 | About | `about.tsx` | IMPLEMENTED |
| — | Visits tab, visit hub | `(tabs)/visits.tsx`, `visit/…/index.tsx` | IMPLEMENTED |

UI follows UI-UX §2: status always shown as text + icon, touch targets ≥ 48 dp, light/dark/system themes, accessibility labels and roles. Device testing found and fixed one defect: fixed bottom actions were hidden behind the navigation bar.

## M4 Status

**PARTIALLY TESTED.** Tests, audits, release APK and emulator E2E are done. Remaining: a physical device, the live microphone, TalkBack, a Play-signed AAB, and the Gemini live call.

## Implemented Features

Encrypted local patient and visit records; consent gate; live recording with timer, pause/resume/stop and withdraw; DOCTOR/PATIENT/OTHER/UNKNOWN labels; speaker mapping; transcript correction (SOURCE_CHANGED); deterministic extraction with the AI path validated; provenance, information state and review status kept separate; conflicts kept and reviewable; derived views (medications, allergies, problems, follow-ups); evidence pipeline; R2 possibilities behind a default-off development flag; code-rendered notes with versions and finalize ≠ confirm; deterministic visit comparison; timeline and symptom course; follow-up management; local search; PDF/text export with draft marker and audit; offline manual mode.

## Speech

- Level 1 (live): Android `SpeechRecognizer` via expo-speech-recognition, preferring on-device recognition (ADR-048). It is IMPLEMENTED. The controller failure modes are TESTED with a mocked native module: permission denied, auto-restart after silence, stop after repeated failures, and a dangling partial committed on stop (`speech.test.ts`, 5/5). The live microphone is **NOT TESTED**: the emulator image has no speech service or audio input.
- Level 2 (final transcript): Gemini transcription via the backend, for synthetic demo visits only (ADR-047). IMPLEMENTED; TESTED with mocks (backend 5/5); live call NOT TESTED (no key).
- Temporary audio is captured only when it can be used (backend configured, cloud on, demo patient) and deleted after use or within 24 h (ADR-014).

## Speaker Diarization

The clinician tags the speaker live, and roles are confirmed on the Transcript screen before extraction (ADR-021): TESTED (UI test and emulator). Per-segment relabel flags dependent facts SOURCE_CHANGED: TESTED. Gemini diarization: mock-tested only.

## AI

- Backend: Supabase Edge Functions calling the Gemini free tier. `FREE_ONLY_MODE` is hard-on, there is an allowlist of free-tier models (verified 2026-10-09, API_CATALOG §31), and a 429 maps to QUOTA_EXHAUSTED with no retry and no paid fallback. This is TESTED (backend 5/5) but **not deployed** and the **live call is NOT TESTED**.
- **Privacy gate (ADR-047, new):** the free tier may use submitted content to improve Google's products, so backend AI runs only for synthetic demo visits. TESTED: a non-demo visit never calls transcribe or runJob.
- AI output is schema- and semantics-validated. Invented diagnosis, medication, dose, allergy, investigation, vital, physical finding and history items are discarded: TESTED (`hallucination.test.ts`, 9 categories plus a dose-change case).

## Clinical Extraction

Deterministic extraction runs on the device and is TESTED, including the owner-required cases:

| Case | Result |
|---|---|
| "Patient denies fever." | NEGATIVE |
| "Allergies were not discussed." | NOT_DISCUSSED, never NKDA |
| "Patient may have asthma." | PROVISIONAL, not CONFIRMED |
| "I stopped my medication." | PATIENT_REPORTED, no discontinuation |
| "Start amoxicillin." | CLINICIAN_STATED PLAN |
| Medication correction (500 → 1000 mg) | both kept, open conflict, "Conflict — review" in the note |

Other properties, all TESTED:
- Provenance is assigned by code from the confirmed role.
- AI never assigns CLINICIAN_CONFIRMED or MEASURED.
- Numbers are preserved exactly. Number words are normalized to digits ("three weeks" → "3 weeks"), and the value is unchanged.

## Evidence APIs

All free and keyless, all live-verified on 2026-10-09 (`LIVE_EVIDENCE=1 npx jest live`, **11/11 pass**). Every record carried a title, source, identifier, https URL and retrieval timestamp. Results:

| Source | Live check result |
|---|---|
| PubMed | 5 PMIDs, re-resolved |
| Europe PMC | 5 |
| MedlinePlus | 2 (medlineplus.gov only) |
| ClinicalTrials.gov | 5 NCT ids (clinician request only) |
| PubChem | CID 4091 |
| NLM Clinical Tables | 6 suggestions |

Live search also ran on the emulator (state "done", 23.3 s). When nothing is retrieved, the screen shows **NO VERIFIED EVIDENCE FOUND** (UI test). Reference images are not shown: no source has a verified reuse license (OD-008).

## Medication APIs

| Source | Live check result |
|---|---|
| RxNorm | metformin → RxCUI 6809 |
| DailyMed | 3 SPL set IDs |
| openFDA label | 1 |
| Drugs@FDA | 3 ANDA records |
| openFDA recalls | 3 |

All TESTED live. **Two M2 adapter bugs were found and fixed:**
1. openFDA RxCUI lists were joined with `+`, which is URL-encoded to `%2B` and matched nothing. Label, Drugs@FDA and recall lookups were silently empty. They now use explicit `OR`, with a regression test.
2. RxNorm product lists now rank single-ingredient products first, so combination products no longer crowd out the products openFDA indexes.

No automatic choice is made among several RxNorm candidates (CS-11), and doses are never altered.

## Patient Storage

AES-256-GCM per-document encrypted JSON with atomic writes, and a Keystore-backed key (ADR-046, which supersedes ADR-013 and was recorded retrospectively): TESTED. `allowBackup=false`.

Performance fix: saving a visit no longer decrypts every visit of the patient. For 30 visits in Node this went from 475 ms to 22 ms.

## Longitudinal Timeline

Timeline grouped by visit, with category filters, confirmed-only assessments, and provisional items labeled. The symptom course shows absence as "not discussed": TESTED (domain + UI).

## Returning Patient

The Patient Overview shows: last visit, what changed (a deterministic diff that shows both stated values with dates, labels provisional items, and invents no trend words), current confirmed medications, allergies, investigations, follow-up, symptom course, and proposed items needing review. TESTED (jest + emulator).

## Export

Note export (PDF via expo-print, or plain text) and patient summary go through the share sheet with the UI-UX §4 warning. Draft exports carry "DRAFT — not finalized by clinician". Possibilities are never included. An AuditEvent is written for each export. Rendering, audit, the no-note error and offline export are TESTED. On the emulator the share sheet opened; the receiving app and PDF content are **NOT TESTED**.

## Security

Repository scan on 2026-10-09 for `AIza`, `sk-`, `hf_`, `BEGIN PRIVATE KEY`, `GEMINI_/OPENAI_/ASSEMBLYAI_/DEEPGRAM_API_KEY=<value>` and `SUPABASE_SERVICE_ROLE`: **no secret values found**. The only matches are empty-value examples in hook tests and rule text.

- `.env.example` files contain names only. No `.env` is committed.
- The app uses only the `EXPO_PUBLIC_SUPABASE_URL/ANON_KEY` (public by design), `NCBI_EMAIL` and `APP_VARIANT` variables. No private key exists in mobile code or the APK.
- No analytics, crash-reporting or tracking SDK is present.
- Backend logs contain job name, outcome and duration only.

**Permission audit** (merged release manifest, `aapt2 dump badging`): INTERNET, RECORD_AUDIO, VIBRATE (normal, no prompt, added by a library) and an internal androidx `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`. The following are explicitly blocked: location, contacts, SMS, phone, camera, storage/media, overlay, and (since this session) USE_BIOMETRIC/USE_FINGERPRINT. No notification permission is requested.

NOT DONE: dependency CVE triage (`npm audit` reports advisories in build-time dependencies, not reviewed) and backend authentication (OD-004).

## Privacy

- Raw audio is temporary, captured only for demo visits with a configured backend, and deleted after use or within 24 h.
- No voiceprints are kept.
- Development fixtures are synthetic ("Demo Patient (synthetic)", "Test Person"). The demo uses P-000001, labeled DEMO DATA.
- Evidence queries carry only sanitized clinical terms. The live test checked that no name or reference left the device.
- No clinical text goes to logs or analytics.
- Cloud processing is disclosed in onboarding, Settings, Consent and Privacy, including the free-tier training-use term.

Open item: the PRIVACY §7 provider table still has VERIFY entries (processing location and retention per provider). No legal compliance is claimed.

## Clinical Safety

Every owner §16 and §17 case is TESTED (see **Clinical Extraction** and **AI**). In addition:

- Citations must come from the retrieved bundle. Invented PMID, NCT, FDA/dose statements, probabilities, "final diagnosis" wording, invented fact ids and evidence-free possibilities are all rejected.
- PMIDs that do not re-resolve are dropped. Malformed openFDA payloads are rejected.
- R2 possibilities are off in production builds, verified on the emulator. They never enter notes or exports.
- Finalizing a note confirms no fact, verified on the emulator ("Unreviewed facts at finalize: 11").
- Allergies are never shown as NKDA unless confirmed.

## Tests

Commands run on 2026-10-09 in the Codespace (Node v24.21.0, jest-expo 57):

| Command | Result |
|---|---|
| `npx tsc --noEmit` (mobile) | clean |
| `CI=1 npx expo lint` | 0 problems |
| `npx expo-doctor` | 21/21 checks passed |
| `npx jest` | **123 passed, 0 failed, 11 skipped** (the live suite is opt-in). 10 test files cover safety (extraction, downstream, hallucination), pipeline/provider failure, storage, end-to-end workflow, speech failure modes, Expo Router UI (9 tests incl. the full consent→finalize flow) and Node performance |
| `LIVE_EVIDENCE=1 npx jest src/__tests__/live.test.ts` | 11/11 passed (real network) |
| `cd backend && npm test` / `npm run typecheck` | 5/5 passed / clean |

Failure scenarios TESTED, all with no data loss:
- Gemini unavailable
- speech/transcription failure
- network offline
- evidence provider failure
- malformed AI JSON
- free quota exhausted (one call, no retry, no paid fallback)
- microphone permission denied (mock)
- recording interrupted, with an unfinished visit recovered after restart
- application restart
- export failure

Flaky tests: none observed.

## Android Build

Build path: free local Gradle build (no EAS account needed). JDK 21, Android SDK cmdline-tools/platform 36, NDK via Gradle, `npx expo prebuild --platform android`, then:

```
cd mobile/android && ./gradlew assembleRelease bundleRelease -PreactNativeArchitectures=arm64-v8a \
  -Pkotlin.compiler.execution.strategy=in-process "-Dorg.gradle.jvmargs=-Xmx3g" --max-workers=2 --no-daemon
```

1. **First attempt: FAILED.** The JVM was killed during C++ compilation: memory pressure on the 7.9 GB host from Gradle, the Kotlin daemon and concurrent jest. There was no compiler error.
2. **Retry with an in-process Kotlin compiler: BUILD SUCCESSFUL in 25m 53s.**
3. A permission rebuild succeeded in 20m 47s.
4. An x86_64 variant for the emulator succeeded in 11m 34s.

5. The final arm64 APK + AAB build succeeded in 4m 27s (artifacts below).

**Emulator E2E** (Android 14 AOSP x86_64 AVD, headless, software GPU, 2 vCPU; release APK `ai.clinnote.app` 1.0.0, driven by adb/uiautomator scripts kept outside the repository):
- PASS: app launches; onboarding with explicit acknowledgement; Home empty state
- PASS: synthetic demo patient P-000001 with DEMO label; allergy status "Not discussed"
- PASS: "● RECORDING" timer screen; DOCTOR/PATIENT labels; roles confirmed
- PASS: facts with PATIENT_REPORTED and "Transcript T-0002"; fever "denied / absent"
- PASS: live evidence search done with identifiers; no possibilities in the production build
- PASS: note generated and finalized; export share sheet opened
- PASS: second visit; force-stop and relaunch with data intact; "Weight changed from 72 kg to 70 kg"; timeline
- PASS: airplane mode — app opens and local search finds P-000001
- PASS: no ClinNote entry in the logcat crash buffer; 0 ReactNativeJS/native-module errors

Defects found on the device and fixed:
- bottom actions were hidden behind the navigation bar
- the demo status claimed the microphone was listening

The emulator's own launcher showed an ANR dialog once; the test driver dismissed it.

**Measured timings (emulator: software-rendered, 2 vCPU host — NOT representative of a phone):**

| Step | Time |
|---|---|
| Cold launch to onboarding | 9.8 s / 18.2 s (first install) |
| Cold launch with data | 10.1 s |
| Stop → transcript | 2.4 s |
| Extraction → facts | 6.1 s / 5.8 s |
| Evidence search (live network) | 23.3 s |
| Patient overview load | 2.2 s |

Node (not device) timings: load a 30-visit patient 0.5–1.3 s; save a visit 22 ms; timeline / compare / note / export ≤ 7 ms. Physical-device performance is NOT TESTED.

### Android Build — Artifacts

Final build (source = commit `84f94aa`): `./gradlew assembleRelease bundleRelease -PreactNativeArchitectures=arm64-v8a …` → **BUILD SUCCESSFUL in 4m 27s**. The artifacts are stored outside the repository, in `~/clinnote-artifacts/` in the Codespace; they are not committed.

| Artifact | Available? | Path | SHA-256 |
|---|---|---|---|
| APK (arm64-v8a, release, installable) | **YES** | `~/clinnote-artifacts/ClinNote-1.0.0-arm64-v8a-release.apk` (44.4 MB) | `0af81800264725004cf90dff24eb223a1f1a78767227b3d4fec089fa9a0a467f` |
| APK (x86_64, emulator test build) | YES | `~/clinnote-artifacts/ClinNote-1.0.0-x86_64-release.apk` | `4b33cc20c387c140d9bf33c56028c83054913112ba5ba7ef0dbbec55b55f26c5` |
| AAB (arm64-v8a) | **YES, but NOT uploadable to Google Play** | `~/clinnote-artifacts/ClinNote-1.0.0-release.aab` (33.7 MB) | `27959d78622941652c091b8ff3bcfdc775fd46f6ab6c3e95965f9d98f97d7d86` |

- **Signing:** both are signed with the Android **debug** certificate (`CN=Android Debug`), which is the Expo template's default for release builds. A Play-uploadable AAB needs the owner's upload key or EAS-managed credentials, and should include all ABIs (`reactNativeArchitectures` default). **BLOCKED** on owner credentials; not pretended.
- Application id `ai.clinnote.app` (provisional, ADR-049), versionCode 1, versionName 1.0.0, targetSdk 36. The build variant resolves to `production` (no `EXPO_PUBLIC_APP_VARIANT` set), so R2 cannot be enabled.
- The emulator E2E ran on the x86_64 build made before the final one-line demo-label fix (`84f94aa`). That fix and the arm64 APK itself have not been run on a device.

## Free-Only Verification

| Provider | Purpose | Free? | Credential? | Paid fallback? | Data sent |
|---|---|---|---|---|---|
| Android SpeechRecognizer (device) | live transcript | yes | none | none | audio to the device's speech service (on-device preferred) |
| Google Gemini API, free tier (via Supabase function) | final transcript, extraction, R2 possibilities | yes (verified 2026-10-09; free-tier content used to improve Google products → synthetic only, ADR-047) | server-side key, not yet created | **none** (`FREE_ONLY_MODE`, model allowlist, 429 → QUOTA_EXHAUSTED) | demo-visit audio/transcript only |
| Supabase Edge Functions | key custody, routing | free plan (VERIFY at project creation) | anon key (public) | none | in transit only |
| RxNorm, DailyMed, openFDA, PubMed, Europe PMC, MedlinePlus, ClinicalTrials.gov, PubChem, NLM Clinical Tables | evidence/terminology | yes, keyless | none | none | sanitized clinical terms; public identifiers |
| Local Gradle build / Android SDK / emulator | build and test | yes | none | n/a | none |

No paid service is configured or reachable from the code. No model weights were downloaded. The emulator system image is an OS image, not an AI model.

## API Keys Required

None for the current synthetic-data functionality. Optional, all created by the owner only:
- `GEMINI_API_KEY`: backend secret, in a Google Cloud project **without billing**.
- `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`: public values, set after deploying the functions.
- `EXPO_PUBLIC_NCBI_EMAIL`: optional.

## Known Limitations

- Live microphone transcription has not been verified on hardware.
- The Gemini path has never been run against the real API.
- Diarization for real patients relies on live tagging plus clinician confirmation.
- Clinician sign-in (FR-28.4) is not implemented.
- Note type is chosen in the editor, not on Start Visit.
- Manual vital entry does not parse numeric attributes.
- Search scans decrypted documents in memory.
- No TalkBack or font-scaling audit has been run on a device.
- PDF content and share targets have not been inspected.
- No GitHub Actions CI exists yet.

## Known Blockers

All need the owner:
1. The free-only rule conflicts with data terms for real-patient AI: the Gemini free tier may use content for product improvement (ADR-047, OD-002).
2. OD-001 speech provider for production.
3. OD-004 backend authentication.
4. OD-006 retention.
5. OD-011 target markets.
6. The ADR-025 formal regulatory assessment before any R2 release.
7. Google Play: developer account, upload key / Play App Signing, Data Safety form, privacy policy URL, support contact.
8. Expo account for EAS builds (optional; a local build works).

## Git

Branch `feat/v1-app`, ahead of `main`.

| Commit | Description |
|---|---|
| `72d96d9` | M1 |
| `c652e57` | M2 |
| `1874258` | feat: complete ClinNote consultation workflow |
| `4eacbe8` | test: complete ClinNote validation suite |
| `f4efc06` | feat: complete clinical evidence review |
| `247d37c` | fix: save a visit without decrypting every visit |
| `84f94aa` | fix: device-tested bottom actions, permissions and demo status |

Generated `mobile/android/` is git-ignored (Continuous Native Generation). APK/AAB artifacts are not committed.

## Commit

See the terminal report entry for the final docs commit hash and push result.

## Next Human Action

1. Review and merge `feat/v1-app` into `main` (pushed to `origin/main` per the standing instruction if all verification passes; see the terminal report).
2. Install the APK on a physical Android phone and test the live microphone with synthetic speech only.
3. Decide the AI path for real patients (ADR-047/OD-002) and the speech provider (OD-001).
4. If wanted: create a Google Cloud project **without billing** and a Gemini key, deploy the Supabase functions, then set the public URL and anon key for a demo-data AI run.
5. Create the Play developer account and upload key; commission the ADR-025 regulatory assessment.
