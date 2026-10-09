# ClinNote AI — Transcription and Clinical Report Upgrade

Written 2026-10-09 (UTC) from the repository state and from command output produced in this session. A previous report is not evidence. Branch `main`. Status words: **TESTED** (ran and passed here) · **IMPLEMENTED** · **NOT TESTED** · **BLOCKED**.

ClinNote 1.1.0 is a development build for **synthetic data only**. It is not clinically validated, not production-ready and has no regulatory approval.

## Changes Implemented

Decisions: ADR-050 (multi-segment consultations and reconciliation), ADR-051 (structured report), ADR-052 (language registry; OD-007 partially resolved), ADR-053 (liquid-glass UI, in-app reminders). Existing behaviour (patients, visits, automatic date/time, encrypted storage, evidence, notes, comparison, export) is unchanged; v1 visits migrate on read.

## Recording Controls

- Pause, Resume, Finish segment and Finalize consultation are separate actions, offered per state by a tested state machine (`domain/consultation.ts`): IDLE, REQUESTING_PERMISSION, RECORDING (Pause + Finish segment), PAUSED (Resume + Finish segment), PROCESSING_SEGMENT, SEGMENT_COMPLETE (Review new transcript, Reconcile complete visit, Continue conversation, Finalize consultation), CONSULTATION_OPEN, FINALIZING, FINALIZED (Add more conversation), ERROR, RECOVERABLE.
- The hero card shows patient reference, visit start, state with pulse, total and segment time, microphone status, language and last-saved time; a strip lists the segments. Double presses are ignored (action lock + idempotent domain functions).
- **Fixed on device:** pausing the demo script while an utterance was in progress dropped it; the in-progress utterance is now kept (same rule as the live recognizer).

## Multi-Segment Consultation

- `RecordingSegment` (SEG-0001 …) with start/end, pauses, language, provider and clock offset; utterances carry `recordingSegmentId`, `language`, `addedAt`, `origin`. Visit `startedAt` is never reset; all timestamps are UTC, shown in local time.
- Add more conversation after extraction or finalization appends a segment; earlier segments, facts and notes stay untouched until the clinician reconciles; reopening is audited.
- **Data-loss bug found by the emulator run and fixed:** the recording screen saved a stale in-memory visit when a second segment was added after facts had been extracted on another screen, which discarded the role confirmations and facts. The screen now re-reads the visit when it regains focus and before starting a segment or finalizing. A regression UI test reproduces the path; it fails without the fix (13 facts → 1) and passes with it.

## Transcript Reconciliation

- Canonical transcript: all segments, ordered, excluded utterances left out, no duplicates. Extraction and reconciliation use it; `transcriptVersion` / `reconciledTranscriptVersion` show when the facts are out of date.
- Duplicate safety: identical utterance within 6 s dropped; kept partial replaced by its final; recognizer pause no longer stores the same words twice.
- Transcript review: correct text/speaker, split, merge with next, mark uncertain, exclude duplicate (confirmed, restorable), add typed utterance; every change kept in `segmentRevisions`; facts citing a changed utterance return to review. Replay is not available (temporary audio is never kept, ADR-014).
- Conflicts: explicit corrections ("actually", "sorry …") are recognised and shown as current pending confirmation; otherwise both statements stay as a conflict; CURRENT vs stopped medication opens a conflict; profile mismatches open PROFILE_MISMATCH conflicts. Repetitions are marked, never deleted.

## Multilingual Support

- Registry: Auto-detect, English, Telugu, Hindi, Bengali, Tamil, Kannada, Malayalam. A language is selectable only if the device speech service reports it (`getSupportedLocales`, Android 13+); otherwise the reason is shown. Auto-detect needs Android 14 and two downloaded languages (verified API levels, developer.android.com, 2026-10-09).
- Each segment/utterance stores its language; text is never translated in place; no translation service. Automatic extraction is English-only (a Hinglish "fever nahi hai" is never turned into "fever present"); cloud final pass English-only.
- Status: English TESTED (jest, emulator demo). **All other languages: IMPLEMENTED BUT NOT VERIFIED ON DEVICE** (the emulator image has no speech service).

## Clinical Fact Extraction

Speaker-aware rule-based extraction unchanged and extended; English medical vocabulary biasing passed to the recognizer (EXTRA_BIASING_STRINGS, API 33). Provenance still assigned by code from the confirmed role; everything stays PROVISIONAL until a clinician confirms.

## Patient Information Extraction

New `DEMOGRAPHIC` facts: age, occupation, education/class, language, name — from what was said only (questions never ground a value; sex never inferred). Profile adds optional occupation and preferred language. The profile is never overwritten by code; "Use the stated value in the profile" is an explicit, audited clinician action.

## Report Generation

`domain/report.ts` builds the owner's sections A–S by code from validated facts: patient table with source/status, visit table and segments, chief complaint, HPI and explicit negatives, history (confirmed / patient-reported / clinician-stated / uncertain), medications (current / previous / reported stopped / proposed change / uncertain / on record not discussed), allergies (recorded / documented none / denied / not discussed / uncertain), vitals, examination, investigations (completed / pending / planned / unknown), consolidated facts, information changes with chronology, possibilities (R2, in-app only), medication evidence, assessment, plan, follow-up with due date, longitudinal comparison, sources, uncertainties, review and completeness (PRESENT / NOT_DISCUSSED / UNKNOWN / CONFLICTED / NOT_APPLICABLE). Versions are stored; saving confirms nothing. Export as PDF, text or JSON (source and derived data separate; possibilities excluded).

## Medication Evidence

Label sections for medications already mentioned: indications as stated, boxed warning, contraindications, warnings and the drug-interactions section (openFDA field `drug_interactions`, verified live 2026-10-09), quoted with source and retrieval time. Medication options never include new medications, doses or suitability; without label records the report shows **INSUFFICIENT VERIFIED EVIDENCE FOR MEDICATION OPTIONS**.

## Literature Evidence

Unchanged adapters. Concepts now ranked (confirmed → stated more often → presenting complaint); a concept signature flags evidence as outdated after material changes ("Refresh evidence"). Live run: `LIVE_EVIDENCE=1 npx jest src/__tests__/live.test.ts` → **11/11 passed** (RxNorm, DailyMed, openFDA label, Drugs@FDA, recalls, PubMed, Europe PMC, MedlinePlus, ClinicalTrials.gov, PubChem, Clinical Tables).

## Free-Only Verification

`FREE_ONLY_MODE` unchanged (hard constant, app and backend). New dependencies: `expo-linear-gradient` ~57.0.2 and `expo-haptics` ~57.0.3 (Expo SDK, free, on-device). No new runtime service, no paid API, no paid fallback. Quota handling unchanged (one call, no retry).

## Privacy Verification

- ADR-047 gate unchanged: cloud AI only for synthetic demo visits; real-patient visits stay on-device.
- No secrets in the diff (scan for `AIza`, `sk-`, `hf_`, `BEGIN PRIVATE KEY`, `*_API_KEY=` values, `SERVICE_ROLE`: none). No logging in app code.
- Permissions in the 1.1.0 APK (`aapt2 dump badging`): INTERNET, RECORD_AUDIO, VIBRATE, internal DYNAMIC_RECEIVER — identical to 1.0.0. No notification permission (reminders are in-app).
- Patient details are never searched or sent to the R2 job; tests use synthetic data only.

## Automated Test Results

Run 2026-10-09 in the Codespace (Node v24, jest-expo 57):

| Command | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `CI=1 npx expo lint` | 0 problems |
| `npx expo-doctor` | 21/21 |
| `npx jest` | **150 passed, 0 failed, 11 skipped** (live suite opt-in); run twice consecutively, same result |
| `LIVE_EVIDENCE=1 npx jest src/__tests__/live.test.ts` | 11/11 (real network) |
| `cd backend && npm test` / `npm run typecheck` | 5/5 / clean |

New tests (27): `consultation.test.ts` 22 (cases A–E, report accuracy with the owner's synthetic transcript, JSON export, transcript tools, migration, languages, non-English never extracted, follow-up dates, reminders), `speech.test.ts` +2, `ui.test.tsx` +3 (recording phases, two segments + finalize + add more, report screen, data-loss regression). No safety test was removed or weakened. One test-only defect fixed: an async `waitFor` left an act scope open and made the next UI test hang.

## Android Build

Free local Gradle build (no EAS). `npx expo prebuild --platform android --no-install`, then `./gradlew assembleRelease bundleRelease -PreactNativeArchitectures=arm64-v8a -Pkotlin.compiler.execution.strategy=in-process "-Dorg.gradle.jvmargs=-Xmx3g -XX:MaxMetaspaceSize=768m" --max-workers=1 --no-daemon`.

- First attempt FAILED: Gradle daemon killed (memory, no compile error). Incremental retry: BUILD SUCCESSFUL.
- Rebuilt twice after device findings (data-loss fix; opaque action bars, tab bar inset, glass shadow artifact). Final: arm64 BUILD SUCCESSFUL 4m 15s; x86_64 (emulator) 3m 18s.
- Debug-signed like 1.0.0 (Play signing BLOCKED on owner keys).

**Emulator E2E** (Android 14 AOSP x86_64, headless, animations off → reduce-motion path; driver `~/clinnote-e2e/run11.py`, outside the repository). Final build, all PASS: onboarding → demo patient P-000001 (DEMO label) → consent → record → pause (Resume + Finish only) → resume → finish segment (Continue + Finalize offered) → transcript grouped by SEG-0001 → facts → second segment → both segments listed → finalize → Add more offered → reconcile → cough-duration correction shown as conflict, occupation "teacher" from segment 2 → visit tracker → report (patient details, allergies "denied" as stated, nothing invented) → report version 1 saved → JSON export share sheet opened → Home reminders → returning visit, relaunch, comparison "Weight changed from 72 kg to 70 kg" → timeline. No ClinNote entry in the crash buffer; 0 JS/native-module errors. Cold launch 7.4–8.9 s (software-rendered emulator, not representative). Normal-motion rendering was checked by screenshot.

## APK Path

- `~/clinnote-artifacts/ClinNote-1.1.0-arm64-v8a-release.apk` (phone)
- `~/clinnote-artifacts/ClinNote-1.1.0-release.aab`
- `~/clinnote-artifacts/ClinNote-1.1.0-x86_64-release.apk` (emulator only)
- 1.0.0 artifacts kept unchanged in the same directory.

## APK Size

arm64 APK 44,582,689 bytes (42.5 MiB); AAB 33,786,301 bytes; x86_64 APK 45,027,770 bytes. Package `ai.clinnote.app`, versionName 1.1.0, versionCode 2.

## APK Checksum

```
97cea34a5a08680b988dcd2b9c6c1b4e5f3197ab9406a8f5c7c7191c8090401e  ClinNote-1.1.0-arm64-v8a-release.apk
d2c399490ac2828109bf6c7029eaf499fc614210f7fac63e45910ca380cb0c8c  ClinNote-1.1.0-release.aab
822208212afcf1c931d546ca22b6e6c0feef8d51519e41a4c286c6c5e3d2515b  ClinNote-1.1.0-x86_64-release.apk
```

(also in `~/clinnote-artifacts/ClinNote-1.1.0.sha256`)

## Features Tested on Physical Device

None in this session. 1.0.0 was installed and used by the owner; 1.1.0 has not been on a phone yet.

## Features Not Yet Tested on Physical Device

Everything in 1.1.0, in particular: live microphone with pause/resume and multiple segments; medical-vocabulary biasing; Telugu/Hindi/Bengali/Tamil/Kannada/Malayalam and Auto-detect availability on a real speech service; haptics; the glass UI with animations on (emulator ran with animations off); PDF/JSON export into a receiving app; TalkBack.

## Known Limitations

- Transcription accuracy depends on the device's Android speech service; biasing helps only where supported; nothing rewrites transcript text automatically.
- Automatic fact extraction is English-only; other languages are documented manually. No translation.
- Medication information is U.S. label data (openFDA/DailyMed); no interaction checker (RxNav's interaction API is not used); no treatment suggestions.
- Reminders appear only when the app is opened (no notifications by design).
- Replay of audio is not available (no audio retention).
- Report export carries a DRAFT label always; finalization of the note is separate.

## Remaining Blockers

Owner decisions unchanged: OD-001 / OD-002 (production speech/LLM provider and free-only vs. data terms, ADR-047), OD-004, OD-006, OD-011, the ADR-025 regulatory assessment (R2), Google Play account and upload key. Physical-device verification of 1.1.0 by the owner.

## Git Commit

See `terminal_report.txt` for the commit hashes and push result of this change set.
