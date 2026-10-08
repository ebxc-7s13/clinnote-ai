# ClinNote AI — Speech Architecture

## Objective

Convert a real clinician-patient conversation into a speaker-labeled transcript without requiring manual typing.

## Pipeline

```text
Microphone
   ↓
Audio Stream
   ↓
Voice Activity Detection / Speech Segmentation
   ↓
Speech Recognition
   ↓
Speaker Diarization
   ↓
Speaker Role Mapping
   ↓
Timestamped Transcript
   ↓
Clinical Extraction
```

Voice activity detection and segmentation are expected to be performed by the speech provider or by lightweight platform/library code. No speech or VAD model weights are downloaded (ADR-002).

## Speaker Roles

DOCTOR

PATIENT

OTHER

UNKNOWN

The system does not need to determine the civil identity of a speaker from their voice.

The goal is role separation.

No voiceprints or speaker-identification biometrics are created or stored.

### Speaker Role Mapping

Diarization produces anonymous speaker labels (e.g. Speaker A, Speaker B). Mapping to roles:

1. A heuristic or AI step proposes a mapping (e.g. the speaker who asks most questions → DOCTOR).
2. The proposed mapping is shown to the clinician, who can correct it with one action per speaker.
3. Until confirmed, uncertain segments use UNKNOWN.

Role mapping matters clinically: PATIENT_REPORTED vs CLINICIAN_STATED provenance depends on it (`DATA_MODEL.md`).

## Consent

Recording must not start until the clinician indicates that the required consent has been obtained according to applicable law, institutional policy, and clinical workflow.

The app records this as a `ConsentRecord` (`DATA_MODEL.md`). The app does not determine what consent is legally required; that remains the clinician's responsibility.

The user must always see that recording is active.

## Android Recording Constraints

- Permission: `RECORD_AUDIO`, requested only when the clinician first starts a recording.
- If recording must continue while the app is in the background or the screen is off, Android requires a foreground service of type microphone with a persistent notification, plus the corresponding manifest permissions and Play Console declarations. VERIFY BEFORE IMPLEMENTATION against current Android and Expo documentation; record the chosen approach as an ADR in Phase 5.
- V1 default: recording runs while the visit screen is active; leaving the screen or backgrounding pauses or continues per the verified approach, and the state is always visible.

## Temporary Audio

Raw audio should not be permanently stored by default.

Where temporary storage is unavoidable (e.g. buffering during network loss, final-transcript pass):

- minimize duration
- protect access (app-private storage only, never shared/external storage)
- delete after successful processing
- delete when the visit is discarded
- enforce a maximum temporary retention (default 24 hours, ADR-012) after which audio is deleted even if processing did not succeed
- do not place audio in logs
- do not send audio to analytics
- do not include audio in crash reports

Retaining audio beyond this requires an explicit clinician choice per visit (`PRIVACY.md`, Audio). This option is disabled by default.

## Provider Strategy

Potential providers:

AssemblyAI

Deepgram

OpenAI

Gemini

The exact production provider will be selected (OPEN DECISION OD-001) after:

- quality testing
- latency testing
- Android compatibility testing
- pricing review
- privacy review
- data-processing review
- language support review (OD-007)

All providers are accessed through `SpeechProvider` (and `DiarizationProvider` where separate). Private keys stay on the backend; streaming uses short-lived tokens or a backend proxy (`ARCHITECTURE.md` Section 4).

## Live vs Final Transcript

LIVE TRANSCRIPT

Purpose:

- show current conversation
- provide immediate feedback

FINAL TRANSCRIPT

Purpose:

- downstream clinical extraction
- note generation
- evidence query generation
- permanent encounter record

Where practical, the final transcript should undergo a higher-quality final processing step.

Live segments have `isFinal = false`; they are replaced by final segments once available. The clinician can edit the final transcript; edits are recorded as AuditEvents.

## Speech Failure Modes

Handle:

- microphone permission denial
- recognizer unavailable
- network loss
- provider failure
- timeouts
- empty transcript
- partial transcript
- low confidence
- speaker uncertainty
- application interruption
- phone call interruption
- Bluetooth microphone failure

In every case: the transcript captured so far is persisted, the clinician is told what happened, and manual entry remains available (`ARCHITECTURE.md` Section 8).

## Clinical Safety

Speech recognition must not silently turn uncertain speech into a confident medical fact.

Examples:

Audio:

"maybe metformin?"

should remain uncertain.

Audio:

"patient denies chest pain"

must preserve the negation.

Audio:

"history of diabetes"

must not become:

"no diabetes."

Low-confidence words are displayed as `[unclear]` or visibly flagged (`CLINICAL-SAFETY.md`, Uncertainty).

## Development

Use synthetic audio and synthetic transcripts.

Do not place real patient recordings into the repository.

## Model Downloads

No large speech-model downloads are required for the initial architecture.

Use APIs/cloud services.
