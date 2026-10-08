# ClinNote AI — Product Specification

This is the product authority (`CLAUDE.md`, Section 2). Data structures referenced here are defined in `DATA_MODEL.md`; restrictive safety, security and privacy requirements prevail over anything here (`CLAUDE.md` §2, ADR-018).

---

## 1. Product Vision

ClinNote is an ambient clinical memory and evidence-review system.

It turns a clinical conversation into structured, source-traceable clinical memory and source-linked evidence, without forcing the clinician to type everything during the consultation, and without taking clinical decisions away from the clinician.

Value proposition: *"Turn a clinical conversation into structured clinical memory and source-linked evidence without forcing the clinician to type everything manually."*

## 2. Target Users

- doctors
- dentists
- specialists
- outpatient clinicians
- appropriate healthcare professionals

V1 scope: one clinician, one Android device, outpatient-style consultations. The patient does not use the app.

## 3. Main Problems

ClinNote addresses four problems observed in outpatient consultations.

### 3.1 Documentation Burden

The clinician must listen, ask, remember and type simultaneously. Documentation competes with attention to the patient.

### 3.2 Information Fragmentation

Symptoms, medications, investigations and plans end up scattered across free text, memory and separate systems.

### 3.3 Poor Continuity Between Visits

At a follow-up visit the clinician must reconstruct what was said last time, what changed, and what is still pending.

### 3.4 Manual Searching for Medication/Evidence Information

Looking up labeling, regulatory status or literature for a mentioned medication or condition takes time away from the consultation.

## 4. Product Principles

1. **Listen first** — capture conversation naturally.
2. **Structure, do not invent** — organize what was said; never fabricate.
3. **Evidence must be traceable** — every evidence item has a real source.
4. **Clinician remains in control** — AI output is provisional until confirmed (ADR-007).
5. **Memory is longitudinal** — visits build a patient timeline.
6. **Privacy by minimization** — collect the least data necessary (ADR-005).
7. **API-first AI** — no local model downloads (ADR-002, ADR-003).

## 5. Information Semantics

Every clinical fact carries three independent attributes (ADR-015). They must never be conflated.

### 5.1 Information State — what was said about the finding

| Value | Meaning | Example |
|---|---|---|
| NOT_DISCUSSED | The topic was not raised in the visit | Allergies never mentioned |
| NEGATIVE | Explicitly stated as absent | "No fever." "Denies chest pain." |
| POSITIVE | Explicitly stated as present | "Cough for three weeks." |
| UNKNOWN | Raised, but the answer is unclear or uncertain | "I'm not sure if I had a fever." |

NOT_DISCUSSED ≠ NEGATIVE. A topic that was not discussed is never documented as absent or normal.

(The earlier instruction text spelled this value `NOT_DISCUSSSED`; the canonical spelling is `NOT_DISCUSSED`.)

### 5.2 Provenance — where the information came from

| Value | Meaning |
|---|---|
| PATIENT_REPORTED | Said by the patient or companion |
| CLINICIAN_STATED | Said by the clinician during the conversation |
| MEASURED | An instrument reading or measurement recorded as such |
| TRANSCRIPTION | Raw transcript content not yet attributed to a speaker role |
| AI_EXTRACTED | Produced by an AI transformation without other attribution |
| EXTERNAL_SOURCE | From an external evidence/terminology provider |
| CLINICIAN_CONFIRMED | Explicitly confirmed by the clinician in the app |

`DATA_MODEL.md` also defines UNKNOWN for provenance that cannot be determined.

### 5.3 Review Status — whether the clinician accepted it

PROVISIONAL (default for all AI output) · CONFIRMED · REJECTED · UNKNOWN.

### 5.4 Combined examples

| Statement | Information state | Provenance | Status |
|---|---|---|---|
| Patient: "No fever." | NEGATIVE | PATIENT_REPORTED | PROVISIONAL |
| Clinician: "BP is 142 over 91." | POSITIVE (value 142/91 mmHg) | MEASURED | PROVISIONAL |
| Allergies never mentioned | NOT_DISCUSSED | — (no fact source) | — |
| Clinician confirms extracted cough | POSITIVE | CLINICIAN_CONFIRMED | CONFIRMED |

## 6. Core Workflow

```text
Create/select patient
→ Start visit
→ Consent
→ Start recording
→ Live transcription + speaker separation          (LIVE STAGE)
→ Stop recording
→ Final transcript + speaker role confirmation    (POST-CONSULTATION STAGE)
→ Clinical fact extraction
→ Provisional patient profile updates
→ Possibilities to review
→ Evidence retrieval
→ Clinician review
→ Note generation
→ Clinician edit
→ Clinician confirmation
→ Save encounter
→ Longitudinal memory
→ Next visit comparison
```

A visit can also be completed entirely manually without recording.

## 7. Core Features and Functional Requirements

Requirement IDs (FR-x.y) are referenced by `TESTING.md` and `BUILD_PLAN.md`.

### Feature 1 — Patient Creation

- FR-1.1 Create a patient with an auto-generated internal reference (`P-000001` format). The reference is the only mandatory field.
- FR-1.2 Optional fields: name, date of birth, age, sex.
- FR-1.3 If date of birth is entered, age is derived; otherwise age may be entered directly.
- FR-1.4 Creation works offline.
- FR-1.5 Creation writes an AuditEvent.

### Feature 2 — Patient Search

- FR-2.1 Search by reference, name (if stored), and age/sex filters.
- FR-2.2 Search is local and works offline.
- FR-2.3 Results show reference, optional name, age, sex and last visit date.
- FR-2.4 Search queries are never logged or sent to analytics.

### Feature 3 — Visit Creation

- FR-3.1 Start a visit from a patient or from Home (select/create patient first).
- FR-3.2 A visit records start time and an initial state for every pipeline stage (`DATA_MODEL.md`, Visit).
- FR-3.3 The clinician chooses the note type (SOAP / General / Progress); it can be changed later.
- FR-3.4 A visit can proceed in manual mode without recording.

### Feature 4 — Consent

- FR-4.1 Recording cannot start until the clinician attests that appropriate consent was obtained; this creates a ConsentRecord with state CONFIRMED.
- FR-4.2 If consent is declined, the visit continues in manual mode and a ConsentRecord with state DECLINED is stored.
- FR-4.3 Withdrawal during recording stops recording immediately and records WITHDRAWN; already-captured transcript handling follows the clinician's choice (keep or discard).
- FR-4.4 The app does not determine what consent the law requires; it records the clinician's attestation.

### Feature 5 — Ambient Recording

- FR-5.1 Requires RECORD_AUDIO permission, requested at first use with an explanation.
- FR-5.2 Recording state is always visible (text + icon, not color alone) with an elapsed timer.
- FR-5.3 Pause, resume and stop are always one tap away.
- FR-5.4 Interruptions (phone call, app backgrounding, audio device change) pause recording and are shown to the clinician.
- FR-5.5 Raw audio is temporary (ADR-014).

### Feature 6 — Live Transcription

- FR-6.1 Live transcript segments appear during recording with speaker labels where available.
- FR-6.2 Low-confidence words are visibly marked.
- FR-6.3 Network loss shows a banner; transcript captured so far is preserved; manual entry remains available.
- FR-6.4 Live segments are replaced by final segments after the post-consultation pass.

### Feature 7 — Speaker Diarization

- FR-7.1 Segments are attributed to anonymous speakers and mapped to roles DOCTOR / PATIENT / OTHER / UNKNOWN.
- FR-7.2 The proposed mapping is shown after recording; the clinician can correct it before extraction runs.
- FR-7.3 No civil-identity recognition and no voiceprints.

### Feature 8 — Clinical Fact Extraction

- FR-8.1 Extraction runs on the final transcript after recording stops.
- FR-8.2 Each fact has category, original wording (`value`), optional normalized value, unit, information state, provenance, review status PROVISIONAL, source segment and confidence.
- FR-8.3 Negations and uncertainty are preserved (`CLINICAL-SAFETY.md`).
- FR-8.4 Numbers are copied exactly from the source segment.
- FR-8.5 If extraction fails, transcript and manual entry remain available and retry is offered.

### Feature 9 — Patient Profile

- FR-9.1 Profile shows reference, optional identity fields, active problems, medications, allergies, history, investigations, follow-ups and timeline.
- FR-9.2 Facts from a visit propose profile updates; they remain PROVISIONAL until confirmed.
- FR-9.3 Allergy status shows NOT DISCUSSED when no allergy information exists.

### Feature 10 — Symptoms

- FR-10.1 Captures name, information state, onset, duration, severity, frequency, location, character, triggers, relieving/aggravating factors, associated symptoms.
- FR-10.2 Fields not mentioned remain empty — never inferred.

### Feature 11 — Medications

- FR-11.1 Captures raw wording, normalized name, RxCUI, dose, route, frequency, duration, status (CURRENT / PREVIOUS / DISCONTINUED / UNKNOWN), provenance.
- FR-11.2 Normalization ambiguity shows all candidates; none is auto-selected.
- FR-11.3 A medication absent from a later visit is never marked DISCONTINUED automatically.
- FR-11.4 No dose suggestions, substitutions or changes.

### Feature 12 — Allergies

- FR-12.1 Captures substance, reaction, severity, information state, provenance.
- FR-12.2 "No known allergies" only when explicitly stated (information state NEGATIVE).
- FR-12.3 Not discussed → NOT_DISCUSSED.

### Feature 13 — Investigations

- FR-13.1 Captures test name, value, unit, date, status (ORDERED / SCHEDULED / COMPLETED / RESULT_AVAILABLE / RESULT_DISCUSSED / PENDING / UNKNOWN), result text, provenance.
- FR-13.2 Values and units are preserved exactly.
- FR-13.3 Pending investigations surface at the next visit.

### Feature 14 — Assessment

- FR-14.1 Only assessments explicitly stated by the clinician are extracted as assessments.
- FR-14.2 AI-generated possibilities are never stored as assessments unless the clinician confirms one (it is then linked to the originating ClinicalCandidate).

### Feature 15 — Plan

- FR-15.1 Only plan items explicitly stated in the visit are extracted.
- FR-15.2 AI never proposes treatment plans.

### Feature 16 — Follow-Up

- FR-16.1 Follow-up items stated in the visit (date, reason, task) are extracted as PENDING.
- FR-16.2 Only the clinician can mark them COMPLETED or CANCELLED.
- FR-16.3 Pending follow-ups appear on Home and on the patient overview.

### Feature 17 — Evidence Search

- FR-17.1 After extraction, evidence queries are generated from clinical concepts (never identifiers) and sent through the backend to selected providers (ADR-010).
- FR-17.2 The clinician can also run a manual evidence search.
- FR-17.3 Each result is an EvidenceSource with provider, source type, tier, title, identifier, dates, retrieval time, URL, excerpt and limitations.
- FR-17.4 "No evidence found" is shown as such; gaps are not filled with unsourced AI text.
- FR-17.5 Source disagreement is shown, not resolved silently.

Evidence source types: REGULATORY, LITERATURE, GUIDELINE, PATIENT_EDUCATION, CLINICAL_TRIAL, TERMINOLOGY, CHEMICAL_INFORMATION, PUBLIC_HEALTH.

### Feature 18 — Clinical Possibilities

- FR-18.1 Presented under the heading **Possibilities to review**, never "Diagnosis" (ADR-008).
- FR-18.2 Each possibility shows topic, why it surfaced, supporting facts, contradicting facts, missing information and linked evidence.
- FR-18.3 No probability numbers or likelihood ranking (ADR-016).
- FR-18.4 Clinician actions: Dismiss, Confirm as assessment.

### Feature 19 — Evidence Citations

- FR-19.1 Every citation shown comes from a provider response stored as an EvidenceSource.
- FR-19.2 AI text may reference evidence only by internal evidence ID; the app renders the citation from stored metadata.
- FR-19.3 Any identifier (PMID, NCT, set ID, RxCUI) not in the evidence bundle is rejected.

### Feature 20 — Reference Images

- FR-20.1 Images beside evidence are labeled "Reference image — illustrative only".
- FR-20.2 The app never implies a patient's condition matches an image.
- FR-20.3 Only legally usable sources. Source selection is OPEN DECISION OD-008; the feature is not implemented until resolved.
- FR-20.4 V1 does not capture or analyse patient images.

### Feature 21 — Note Generation

- FR-21.1 Note types: SOAP, General Clinical Note, Progress Note.
- FR-21.2 Drafts are generated only from the visit's facts and confirmed information; NOT_DISCUSSED items are omitted or written as "not discussed", never as normal.
- FR-21.3 Draft is labeled "AI draft — review before confirming".
- FR-21.4 If generation fails, a manual draft is available.

### Feature 22 — Clinician Editing

- FR-22.1 Free text editing of notes; every save creates a NoteVersion.
- FR-22.2 Clinician can edit, confirm or reject individual facts.
- FR-22.3 Clinician can correct the transcript and speaker roles; edits are audited.

### Feature 23 — Clinician Confirmation

- FR-23.1 A note is FINALIZED only by explicit clinician action.
- FR-23.2 Finalizing a note does not auto-confirm unreviewed facts.
- FR-23.3 Confirmed items set status CONFIRMED and provenance CLINICIAN_CONFIRMED; original provenance is kept in the audit trail.

### Feature 24 — Longitudinal Timeline

- FR-24.1 Shows visits, symptoms, medication events, investigation events, follow-ups and confirmed assessments over time.
- FR-24.2 Provisional items are visually distinct from confirmed items.

### Feature 25 — Return-Visit Comparison

- FR-25.1 Opening a returning patient shows: last visit, what changed, current medications, pending items, follow-up.
- FR-25.2 Comparison uses only explicitly documented information.
- FR-25.3 Items absent in the new visit are shown as "not discussed this visit", never as resolved or discontinued.

### Feature 26 — Export

- FR-26.1 Export a finalized or draft note (PDF and plain text formats).
- FR-26.2 A warning explains the file will leave the app's protected storage.
- FR-26.3 Each export writes an AuditEvent.
- FR-26.4 Export works offline.

## 8. Returning Patient Workflow

```text
Open patient → Overview → Previous visit summary → Changes since previous visit
→ Pending follow-up → Current medications → Start new visit
```

## 9. Offline Behavior

Without Internet: patient profiles, previous visits, timeline, notes, manual entry, local search and export all work. Live transcription, AI extraction and evidence retrieval require network access and fail gracefully, preserving all local data.

## 10. Prohibited V1 Functionality

V1 must not include:

- autonomous diagnosis
- autonomous treatment decisions
- autonomous prescribing
- dose calculation or dosage adjustment
- medication substitution suggestions
- emergency triage or urgency classification
- autonomous radiology interpretation
- autonomous pathology interpretation
- autonomous cancer diagnosis
- patient-image capture or analysis
- probability scores for conditions
- automatic trial-enrollment recommendations
- billing/claim coding from terminology matches
- marking follow-ups complete without the clinician

## 11. Out of Scope for V1 (non-safety)

- EHR integration
- multi-clinician / clinic accounts and shared records
- cloud backup or sync of patient records (ADR-017)
- iOS release
- patient-facing app

## 12. Success Criteria

Demonstrated with synthetic data only. A clinician can:

1. create a patient
2. start a visit
3. record a synthetic consultation
4. see a speaker-separated transcript
5. see extracted clinical facts with provenance
6. review possibilities and evidence
7. edit the generated note
8. confirm information
9. save the encounter
10. reopen the patient
11. start a new visit
12. compare the new visit with the previous visit
