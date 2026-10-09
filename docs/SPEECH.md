# ClinNote AI — Speech Architecture

How ClinNote turns consultation audio into a speaker-labeled transcript.

## 1. Objective

Convert a clinician-patient conversation into a speaker-labeled, timestamped transcript without manual typing, using cloud speech APIs (no local model downloads — ADR-002, ADR-003).

## 2. Pipeline

```text
Microphone
→ Consent gate (ConsentRecord CONFIRMED)
→ Audio capture (app-private temporary storage)
→ Audio stream
→ Voice Activity Detection / segmentation (provider-side or lightweight library)
→ Speech recognition (STT)
→ Speaker diarization
→ Speaker role mapping (proposal → clinician confirmation)
→ Live transcript (display)
→ Final transcript (post-consultation pass)
→ Clinician correction
→ Clinical extraction (`AI.md`)
```

## 3. Microphone

- Permission `RECORD_AUDIO` requested at first recording with a plain-language rationale.
- Denial → manual mode with instructions to enable later.
- Audio source: device microphone or connected headset/Bluetooth device; device changes pause recording and notify the clinician.
- Recording state always visible (`UI-UX.md` Live Recording).
- Background/screen-off behavior: Android requires a microphone-type foreground service with a persistent notification for recording outside the foreground. VERIFY BEFORE IMPLEMENTATION against current Android/Expo docs; record approach as an ADR in BUILD_PLAN Phase 7. Until then: recording pauses when the app leaves the foreground.

## 4. Consent

Recording starts only after the clinician attests that the required consent was obtained according to applicable law, institutional policy and clinical workflow. This creates a ConsentRecord (CONFIRMED). The app does not decide what consent is legally required.

Withdrawal stops recording immediately; the clinician chooses whether to keep or discard what was captured.

## 5. Audio Stream

- Audio is captured in chunks and streamed to the speech provider using a short-lived token issued by the backend, or through a backend proxy if the provider has no token mechanism (`ARCHITECTURE.md` §3.5). Long-lived keys never reach the device.
- Chunks are buffered in app-private storage for the final pass and for recovery after network loss.

## 6. Temporary Audio

Raw audio is not retained permanently (ADR-014):

- deleted after the final transcript succeeds
- deleted when the visit is discarded
- deleted after at most 24 hours regardless of outcome
- kept longer only if the clinician explicitly opts in for that visit (off by default)
- never in logs, analytics, crash reports, backups exported by the app, or shared storage

## 7. Voice Activity Detection

VAD/segmentation is handled by the provider's streaming endpoint where available. If client-side silence detection is needed (e.g. to avoid streaming long silences), it must be a lightweight library without model downloads. VBI.

## 8. Speech-to-Text

### 8.1 Live Transcript

Purpose: immediate feedback. Segments `isFinal=false`. Low-confidence words are visibly marked. Not used for extraction.

### 8.2 Final Transcript

Purpose: extraction, note generation, evidence queries, permanent record. Produced after stop by the provider's higher-accuracy (pre-recorded/async) processing where practical. Final segments replace live segments.

## 9. Speaker Diarization

Produces anonymous labels (Speaker A, B, …) per segment. Some providers diarize only in post-recording processing; that is acceptable because extraction runs post-consultation (ADR-010). Live display may show "Speaker A/B" or no labels.

## 10. Speaker Role Mapping

Roles:

| Role | Meaning |
|---|---|
| DOCTOR | the clinician (any profession) |
| PATIENT | the patient |
| OTHER | companion, interpreter, other staff |
| UNKNOWN | not determined |

Process:

1. A deterministic heuristic proposes roles (e.g. speaker asking most questions → DOCTOR).
2. The clinician sees the proposal after recording and confirms or corrects with one tap per speaker.
3. Clinical extraction does not start until the mapping is confirmed (`speakerMappingState = COMPLETED`). Segments the clinician leaves as UNKNOWN, or marks as OTHER, produce facts with provenance TRANSCRIPTION, never PATIENT_REPORTED or CLINICIAN_STATED (`DATA_MODEL.md` §3.2, §8.3; ADR-021).
4. Every conversation-derived fact copies its source segment's speakerId, speakerRole and startTime, and records segment IDs, derivation method and confidence.

ClinNote does not perform civil-identity recognition from voice and does not create or store biometric voiceprints in V1.

## 11. Correction

The clinician can edit final transcript text and speaker roles. Edits set `editedByClinician` and create AuditEvents. If facts were already extracted from a changed segment (`DATA_MODEL.md` §3.2 rule 8, ADR-038, ADR-043):
- a role-only correction that keeps the fact category valid re-derives the affected provisional facts as new versions; their provenance follows the corrected role, and their derivation is kept
- a text correction, or a role change that makes the category invalid, marks the affected provisional facts "Needs clarification — source changed"; they are excluded from automatic use until every cited segment is re-extracted, or until the clinician confirms, edits or rejects them
- confirmed facts are flagged and never changed silently

## 12. Recovery

| Situation | Behavior |
|---|---|
| Network loss | Live transcript stops; banner; audio continues buffering locally (≤24 h); final pass runs when network returns |
| Provider error/timeout | Retry; fallback provider if configured; else manual |
| App killed | Recorder state persisted; on reopen offer to finalize from buffered audio |
| Phone call | Recording pauses; resumes on clinician action |
| Bluetooth mic disconnect | Pause and notify |
| Empty transcript | Inform clinician; offer manual entry |
| Partial transcript | Keep what exists; mark stage PARTIAL |
| Low confidence | Mark words; never auto-correct medical terms silently |
| Speaker uncertainty | UNKNOWN role |

Transcript captured so far is never discarded by a failure.

## 13. Cloud API Architecture

```text
App recorder → (short-lived token) → Speech provider streaming endpoint → live segments → App
App (after stop) → Backend /speech/finalize → Speech provider async endpoint → final segments + diarization → App
```

All via the `SpeechProvider` / `DiarizationProvider` interfaces. Every call records a ProviderExecution (no content).

## 14. Candidate Provider Comparison

Selection is OPEN DECISION OD-001. The table records what must be evaluated; no claims are made until verified with official documentation and synthetic tests.

| Criterion | AssemblyAI | Deepgram | OpenAI | Gemini |
|---|---|---|---|---|
| Accuracy (medical vocabulary) | evaluate | evaluate | evaluate | evaluate |
| Latency (live) | evaluate | evaluate | evaluate | likely final-pass only — VBI |
| Streaming | offered — VBI | offered — VBI | realtime API — VBI | VBI |
| Diarization | offered — VBI live vs post | offered — VBI | VBI | via prompt — VBI reliability |
| Cost | VBI | VBI | VBI | VBI |
| Privacy (retention, training, region) | VBI | VBI | VBI | VBI (tier-dependent) |
| Android support (client token / WebSocket from RN) | VBI | VBI | VBI | via backend |

Evaluation method: the same set of synthetic consultations (scripted, read by volunteers who consent, no real patients) with reference transcripts; measure word error rate on medical terms, negation preservation, speaker attribution accuracy, latency, cost per hour.

Recommended architecture regardless of choice: one streaming provider for live display, optionally a different provider for the final pass if it is materially more accurate.

## 15. Fallback Strategy

```text
STT_PRIMARY → STT_FALLBACK (if configured and verified) → manual entry
```

Fallback switching happens on the backend via routing configuration; the app is unaware of which provider served the request except through ProviderExecution metadata.

## 16. Languages

Registry and rules: ADR-052, `mobile/src/domain/languages.ts`. Candidates: English, Telugu, Hindi, Bengali, Tamil, Kannada, Malayalam, plus Auto-detect.

| Path | Language support | Verified |
|---|---|---|
| Android SpeechRecognizer (live, all patients) | whatever the device's speech service reports via `getSupportedLocales` (Android 13+); English always offered | per device at runtime; Android ≤ 12 reports nothing → English only |
| Auto-detect | `EXTRA_ENABLE_LANGUAGE_SWITCH` + allowed languages (API 34), only downloaded languages | developer.android.com RecognizerIntent, 2026-10-09; device behaviour NOT VERIFIED |
| Cloud final pass (Gemini, synthetic demo only) | English only in V1 | other languages not verified → disabled |
| Rule-based extraction | English only | negation/hedging cues are English (ADR-050 d11) |
| Translation | none | no free, verified service |

Each segment and utterance stores its language. Non-English text is kept verbatim and never auto-extracted. Telugu, Hindi and the others are **IMPLEMENTED BUT NOT VERIFIED ON DEVICE**.

## 17. Clinical Safety

Speech recognition must not silently turn uncertain speech into a confident fact.

| Audio | Required handling |
|---|---|
| "maybe metformin?" | remains uncertain (UNKNOWN / hedged), not a confirmed medication |
| "patient denies chest pain" | negation preserved → NEGATIVE |
| "history of diabetes" | POSITIVE; must not become "no diabetes" |
| mumbled dose | `[unclear]`, no guessed number |

## 18. Development

Synthetic audio and synthetic transcripts only. No real patient recordings in the repository, tests or issue trackers. Audio files are excluded by `.gitignore`.

## 19. Model Downloads

None. No Whisper, diarization or VAD models are downloaded.

## 20. Multi-Segment Recording and Duplicate Safety (ADR-050)

- A consultation is one or more recording segments. Pause / Resume / Finish segment / Finalize consultation are separate actions; finishing a segment never finalizes; "Add more conversation" appends a new segment to the same visit.
- The recognizer runs in restarted chunks (end / silence / timeout). Each final result is one utterance; there is no audio overlap between chunks, so nothing is merged automatically. A sentence split by a restart stays as two utterances, which the clinician can merge on the Transcript screen.
- **Partial vs final:** on pause the recognizer is stopped and its final result is awaited for 1.5 s; the partial is kept (origin PARTIAL_COMMIT, confidence LOW) only if no final arrives. A final that extends a kept partial replaces it. An identical utterance within 6 s in the same segment is dropped.
- Four distinct transcript layers: partial (display only), segment transcript (stored utterances of one segment), canonical visit transcript (all segments, ordered, excluded utterances left out), clinician-corrected transcript (same utterances with edits; originals kept in `segmentRevisions`).
- Recognizer options (verified 2026-10-09, RecognizerIntent reference + expo-speech-recognition 57.1 types): `continuous`, `interimResults`, `addsPunctuation` (EXTRA_ENABLE_FORMATTING, API 33), on-device preference with fallback, and **medical-vocabulary biasing** (`contextualStrings` → EXTRA_BIASING_STRINGS, API 33, English only; ignored by services that do not support it). Android records 16 kHz mono WAV per chunk when temporary audio is captured (demo + backend only).
- Biasing changes recognition hints only. No transcript text is rewritten afterwards except by the clinician.
- The cloud final pass replaces only the utterances of its own segment, with time offsets on the visit clock and segment-prefixed speaker labels; it never replaces utterances already cited by a current fact.
- Replay: not available — temporary audio is deleted after transcription (ADR-014).
