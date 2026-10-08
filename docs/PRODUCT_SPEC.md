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

The authoritative definitions and derivation rules are in `DATA_MODEL.md` §3.2, §3.9 and §8 (ADR-021). Summary:

| Value | Meaning |
|---|---|
| PATIENT_REPORTED | Said near-verbatim in a segment whose clinician-confirmed speaker role is PATIENT |
| CLINICIAN_STATED | Said near-verbatim in a segment whose clinician-confirmed speaker role is DOCTOR. PROVISIONAL until reviewed |
| MEASURED | A measurement entered by the clinician in the app's measurement fields. Never assigned by AI; a spoken reading is CLINICIAN_STATED |
| TRANSCRIPTION | From a segment whose speaker role is UNKNOWN, OTHER or unconfirmed |
| AI_EXTRACTED | AI inference: content not stated verbatim in one segment. Labeled "AI inference — verify" |
| EXTERNAL_SOURCE | From an external evidence or terminology provider |
| CLINICIAN_CONFIRMED | Personally asserted by the clinician in the app: entered, edited or confirmed |
| UNKNOWN | Cannot be determined; never produced by V1 pipelines |

Every fact also keeps an immutable `originProvenance` and `rootOriginProvenance`, so a confirmed or edited fact still shows where it came from (e.g. "Patient-reported · Confirmed by clinician", "Edited by clinician · originally patient-reported") (ADR-021, ADR-035).

### 5.3 Review Status — whether the clinician accepted it

PROVISIONAL (default for all AI output) · CONFIRMED · REJECTED · UNKNOWN.

### 5.4 Combined examples

| Statement | Information state | Provenance | Status |
|---|---|---|---|
| Patient: "No fever." | NEGATIVE | PATIENT_REPORTED | PROVISIONAL |
| Clinician: "BP is 142 over 91." | POSITIVE (value 142/91 mmHg) | CLINICIAN_STATED (not MEASURED: spoken, extracted by AI) | PROVISIONAL |
| Clinician types BP 142/91 into the vitals fields | POSITIVE | MEASURED | CONFIRMED |
| Doctor: "The patient has asthma." | POSITIVE (Assessment) | CLINICIAN_STATED | PROVISIONAL until confirmed in-app |
| Allergies never mentioned | NOT_DISCUSSED | — (no fact source) | — |
| Clinician confirms extracted cough | POSITIVE | CLINICIAN_CONFIRMED (origin PATIENT_REPORTED) | CONFIRMED |
| AI combines "cough since the wedding" + "wedding was 3 weeks ago" into "cough ~3 weeks" | POSITIVE | AI_EXTRACTED (AI inference — verify) | PROVISIONAL |

## 6. Core Workflow

```text
Create/select patient
→ Start visit
→ Consent
→ Start recording
→ Live transcription + speaker separation          (LIVE STAGE)
→ Stop recording
→ Final transcript + speaker role confirmation    (POST-CONSULTATION STAGE)
→ Clinical fact extraction (provenance assigned by code; contradictions detected)
→ Provisional patient profile update proposals
→ Clinical concepts → evidence search queries
→ Authoritative evidence retrieval (validated, deduplicated, ranked, stored)     (R1)
→ [R2 only — possibilitiesEnabled ON, default OFF, ADR-025]
   Possibilities to review (grounded in facts + retrieved evidence; skipped unless evidence COMPLETED/PARTIAL with a non-empty citable bundle, `DATA_MODEL.md` §5.2)
   → supporting findings · contradicting findings · missing information · source citations
→ Clinician review (facts, conflicts, evidence)
→ Note generation (from facts and confirmed information only; never from possibilities)
→ Clinician edit
→ Clinician confirmation of individual facts, then note finalization (finalizing confirms no fact)
→ Save encounter
→ Longitudinal memory
→ Next visit comparison
```

A visit can also be completed entirely manually without recording.

The order of evidence retrieval before possibilities is canonical (ADR-023), and is the same in `ARCHITECTURE.md` §6.4, `AI.md` §3, `EVIDENCE-SOURCES.md` §17 and `BUILD_PLAN.md` Phases 11–13. During recording, only the transcript is shown (ADR-027).

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
- FR-8.6 Extraction runs only after the clinician confirms the speaker mapping (FR-7.2). Provenance is assigned by deterministic code from the confirmed role and derivation method, never by the AI model.
- FR-8.7 Contradictory statements (e.g. "I don't take any medications" … "I take metformin"; "No allergies" … "I am allergic to penicillin") are both kept, linked by a conflict marked "Conflict — review", and never silently overwritten. A later statement supersedes an earlier one only when the clinician resolves the conflict (`DATA_MODEL.md` §9).
- FR-8.8 Uncertain or unidentifiable statements ("maybe metformin?", "the medication was stopped" without a name) are flagged "Needs clarification" and never converted into confident facts or status changes.
- FR-8.9 Nothing discussed disappears silently. Statements whose context is unclear (conditional, or about another person) are kept as "Needs clarification — context" for the clinician. Extraction items that fail validation are listed as "Not extracted — check transcript", with a link to the segment. "Not discussed" is shown only when code finds nothing on that topic (ADR-045).

### Feature 9 — Patient Profile

- FR-9.1 Profile shows reference, optional identity fields, active problems, medications, allergies, history, investigations, follow-ups and timeline.
- FR-9.2 Facts from a visit propose profile updates; they remain PROVISIONAL until confirmed.
- FR-9.3 Allergy status shows NOT DISCUSSED only when no allergy information exists. A provisional "no allergies" statement shows "No allergies reported — needs review"; an unclear answer shows "Allergy status unclear — needs clarification"; "No known allergies" requires a confirmed explicit statement; a positive allergy always shows (`DATA_MODEL.md` §10.3).
- FR-9.4 **Active problems** = clinician-curated problem-list entries with status ACTIVE (created only from confirmed assessments, confirmed history or manual entry). **Current medications** = the most recent CONFIRMED record per medication with status CURRENT. A medication stays current until a CONFIRMED record says otherwise, and is annotated "not discussed since <date>" when absent. PROVISIONAL items from **any** visit appear only in a separate "Proposed — needs review" list, dated, and leave it only by a clinician action (`DATA_MODEL.md` §10, ADR-038). Possibilities never appear in the profile.

### Feature 10 — Symptoms

- FR-10.1 Captures name, information state, onset, duration, severity, frequency, location, character, triggers, relieving/aggravating factors, associated symptoms.
- FR-10.2 Fields not mentioned remain empty — never inferred.

### Feature 11 — Medications

- FR-11.1 Captures raw wording (`rawName`), normalized name, RxCUI, dose, route, frequency, duration, taking status (`takingStatus`: CURRENT / PREVIOUS / DISCONTINUED / UNKNOWN), information state, provenance and review status (`DATA_MODEL.md` §4.7). Taking status and information state are separate: "maybe metformin?" is UNKNOWN / UNKNOWN with "Needs clarification".
- FR-11.2 Normalization ambiguity shows all candidates; none is auto-selected.
- FR-11.3 A medication absent from a later visit is never marked DISCONTINUED automatically.
- FR-11.4 No dose suggestions, substitutions or changes.
- FR-11.5 A patient saying they stopped a medication creates only a PROVISIONAL DISCONTINUED record ("AI inference — verify" when it needs a question and its answer, CS-13, CS-36). The medication stays in current medications until the clinician confirms that record (`DATA_MODEL.md` §10.2). A statement that names no medication changes no taking status (CS-26).

### Feature 12 — Allergies

- FR-12.1 Captures substance, reaction, severity, information state, provenance.
- FR-12.2 An explicit "no allergies" statement is captured as NEGATIVE (substance `ANY`). It is shown as "No known allergies" only after the clinician confirms it and while no allergy is POSITIVE; until confirmed, it shows "No allergies reported — needs review" (FR-9.3, `DATA_MODEL.md` §10.3).
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

- FR-16.1 Definite follow-up items stated in the visit (date, interval, reason, task) are extracted as PENDING. Conditional advice ("come back if…") is recorded as plan text with its condition, never as a pending follow-up (ADR-045).
- FR-16.2 Only the clinician can mark them COMPLETED or CANCELLED.
- FR-16.3 Pending follow-ups appear on Home and on the patient overview.

### Feature 17 — Evidence Search

- FR-17.1 After extraction, evidence queries are generated **by deterministic code** from the stated facts' concepts (never patient identifiers, transcript text or raw medication wording; public product/record identifiers only as typed values from validated responses, ADR-036), sanitized on the device, and sent through the backend to selected providers (ADR-010, ADR-023, ADR-039). Automatic retrieval never searches for a condition nobody stated. Evidence retrieval happens **before** possibility generation.
- FR-17.2 The clinician can also run a manual evidence search.
- FR-17.3 Each result is an EvidenceSource with provider, source type, tier, title, identifier, dates, retrieval time, URL, excerpt and limitations.
- FR-17.4 "No evidence found" is shown as such; gaps are not filled with unsourced AI text.
- FR-17.5 Source disagreement is shown, not resolved silently: records are shown side by side with dates, and a "Sources differ — compare" marker appears under the closed rules in `EVIDENCE-SOURCES.md` §14 (ADR-039).
- FR-17.6 Each card shows what it was retrieved for ("Retrieved for: <concept> (<state>)" or "Clinician search"). Evidence never re-runs automatically. When the facts it was retrieved for change, it shows "Based on facts that changed since retrieval", and the clinician can "Re-run evidence search".
- FR-17.7 Clinical-trial and public-health searches run only when the clinician asks (ADR-036).
- FR-17.8 A fact whose concept key is UNMAPPED is never searched automatically (`DATA_MODEL.md` §4.15). When UNMAPPED is the only reason a fact produced no automatic query (it meets every other condition of the §4.15 table, and its category has an automatic route in `EVIDENCE-SOURCES.md` §17: MEDICATION, SYMPTOM, HISTORY_MEDICAL or ASSESSMENT), the evidence screen lists it: 'Not searched automatically: "<value as stated>" (not in ClinNote's concept list). This does not mean the finding is absent or unimportant. You can run a manual search.' Facts excluded by design (other categories, family or social history, unconfirmed AI inference) get no per-fact notice. The "Run a manual search" action pre-fills the manual search field with the value as an editable draft. Nothing is sent, logged or cached until the clinician submits. The query then takes the normal manual path through the on-device sanitizer (a rejection shows its reason) and is stored as a clinician search (CLINICIAN_MANUAL), never AUTOMATIC. The notice never enters notes, exports or possibility gating.

Evidence source types: REGULATORY, LITERATURE, GUIDELINE, PATIENT_EDUCATION, CLINICAL_TRIAL, TERMINOLOGY, CHEMICAL_INFORMATION, PUBLIC_HEALTH.

### Feature 18 — Clinical Possibilities

- FR-18.1 Presented under the heading **Possibilities to review**, never "Diagnosis" (ADR-008).
- FR-18.2 Each possibility shows topic, why it surfaced, supporting facts, contradicting facts, missing information and linked evidence.
- FR-18.3 No probability numbers or likelihood ranking (ADR-016).
- FR-18.4 Clinician actions: Dismiss, Confirm as assessment.
- FR-18.5 Possibilities are generated from facts plus the already-retrieved evidence bundle. Their citations are restricted to that bundle (ADR-023).
- FR-18.6 Possibilities to review are regulatory tier R2 (ADR-025): implemented behind a default-off flag and not released to real users before a formal regulatory assessment. When the flag is OFF, jobs 12 and 13 are not executed and no possibility is created (ADR-034).
- FR-18.7 Possibilities are generated only when the candidate-stage precondition in `DATA_MODEL.md` §5.2 holds: the flag is ON, evidence retrieval completed or partially completed, and at least one citable source exists. Otherwise the section states why none were generated, and the clinician can "Re-run evidence search" and then generate. They are never generated from facts alone.
- FR-18.8 When a fact a possibility relies on changes (edited, rejected, superseded, conflict-resolved, or newly in conflict), the possibility shows "Outdated — facts changed since generation" and cannot be confirmed. Only the clinician can regenerate; earlier possibilities and decisions are kept. Facts in an open conflict are never shown as supporting a possibility (ADR-038).
- FR-18.9 Possibilities are listed in a neutral alphabetical order, and the UI states that order carries no meaning. Possibilities never enter notes or exports; only an assessment the clinician confirms from one can.

### Feature 19 — Evidence Citations

- FR-19.1 Every citation shown comes from a provider response stored as an EvidenceSource.
- FR-19.2 AI text may reference evidence only by internal evidence ID; the app renders the citation from stored metadata.
- FR-19.3 Any identifier (PMID, NCT, set ID, RxCUI) not in the evidence bundle is rejected.

### Feature 20 — Reference Images

- FR-20.0 **V1 displays no reference images** (OD-008 resolved by descoping, ADR-029). Evidence cards may link to authoritative source pages.
- FR-20.1 If a later ADR enables images, they are labeled "ILLUSTRATIVE / REFERENCE IMAGE".
- FR-20.2 The app never implies a patient's condition matches an image.
- FR-20.3 Only legally usable sources, with source URL, license and retrieval time. Link out instead of rehosting when licensing is uncertain.
- FR-20.4 V1 does not capture or analyse patient images.

### Feature 21 — Note Generation

- FR-21.1 Note types: SOAP, General Clinical Note, Progress Note.
- FR-21.2 Drafts are generated only from the visit's facts and confirmed information, never from possibilities (ADR-034); NOT_DISCUSSED items are omitted or written as "not discussed", never as normal. Drafting is available as soon as extraction finishes or for a manual visit; it does not wait for evidence or possibilities.
- FR-21.3 Draft is labeled "AI draft — review before finalizing".
- FR-21.4 If generation fails, a manual draft is available.
- FR-21.5 The clinician can regenerate an AI draft before finalizing; earlier versions are kept (ADR-040). Every AI-drafted statement is traceable to the facts it came from.
- FR-21.6 **Patient-friendly explanation (R2, ADR-041).** Behind a default-off flag: the clinician may request a plain-language draft explaining CONFIRMED facts, citing patient-education sources from the evidence bundle only. It contains no dose, treatment, diagnosis or triage wording. It is a draft for the clinician, and the app never sends it to a patient. It is not released before the formal regulatory assessment.

### Feature 22 — Clinician Editing

- FR-22.1 Free text editing of notes; every save creates a NoteVersion.
- FR-22.2 Clinician can edit, confirm or reject individual facts, whether provisional or confirmed. An edit creates a new fact version (provenance CLINICIAN_CONFIRMED); the previous version is kept and viewable.
- FR-22.3 The clinician can correct the transcript and speaker roles; edits are audited. After extraction:
  - A role-only correction that keeps the fact category valid re-derives the affected provisional facts as new versions. Their provenance follows the corrected role, and their derivation is kept.
  - A text correction, or a role change that makes the category invalid, marks the affected provisional facts "Needs clarification — source changed". They are excluded from automatic use until every segment the affected facts cite is re-extracted (ADR-043), or until the clinician confirms, edits or rejects them.
  - Confirmed facts are flagged and never changed silently (ADR-038, ADR-043).

### Feature 23 — Clinician Confirmation

- FR-23.1 A note is FINALIZED only by explicit clinician action.
- FR-23.2 Finalizing a note does not auto-confirm unreviewed facts.
- FR-23.3 Confirmed items set status CONFIRMED and provenance CLINICIAN_CONFIRMED. The original source (root origin) stays visible, including after edits (ADR-021, ADR-035).

### Feature 24 — Longitudinal Timeline

- FR-24.1 Shows visits, symptoms, medication events, investigation events, follow-ups and confirmed assessments over time.
- FR-24.2 Provisional items are visually distinct from confirmed items.

### Feature 25 — Return-Visit Comparison

- FR-25.1 Opening a returning patient shows: last visit, what changed, current medications, pending items, follow-up.
- FR-25.2 Comparison uses only explicitly documented information.
- FR-25.3 Items absent in the new visit are shown as "not discussed this visit", never as resolved or discontinued.
- FR-25.4 The comparison uses facts eligible for automatic input only (`DATA_MODEL.md` §3.3a: superseded, rejected, resolved-away and source-changed versions excluded). Provisional items are included but labeled "Provisional — not reviewed"; items in an open conflict are shown as conflicting (`ARCHITECTURE.md` §6.6).
- FR-25.5 The comparison is computed by deterministic code. Optional AI arrangement of it (job 14 selects and orders items; code renders the text, ADR-045) adds no fact, number, date, trend or judgement ("improved", "worsened", "resolved", "controlled") that the diff does not contain, and a changed value always shows both stated values with their visit dates. A current visit never modifies an earlier visit's records.

### Feature 26 — Export

- FR-26.1 Export a finalized or draft note (PDF and plain text formats).
- FR-26.2 A warning explains the file will leave the app's protected storage.
- FR-26.3 Each export writes an AuditEvent.
- FR-26.4 Export works offline.
- FR-26.5 Exports of non-finalized notes are marked "DRAFT — not finalized by clinician" on every page. Exports show unresolved conflicts as conflicts.

### Feature 27 — Onboarding and Processing Disclosure

- FR-27.1 On first launch, onboarding explains: documentation assistant, not a doctor; recording only after consent; patient data stays on the device; audio and text are processed by cloud services; AI output is provisional.
- FR-27.2 The clinician must acknowledge onboarding. The acknowledgement and onboarding version are stored in AppSettings.
- FR-27.3 Before the first recording, a processing disclosure names the provider categories that receive data (speech, AI, evidence and terminology services) and the clinician account data (email only).

### Feature 28 — Cloud Processing Control

- FR-28.1 Settings has a "Cloud processing (transcription, AI and evidence search)" toggle. Default OFF until onboarding is acknowledged; then the clinician chooses.
- FR-28.2 When OFF: no audio or text leaves the device, including evidence searches; recording is unavailable; the app works in manual mode (all local features work).
- FR-28.3 Turning it OFF never deletes local data.
- FR-28.4 Cloud stages require a signed-in clinician account (ADR-032). When signed out, local features work and cloud stages show "Sign in to use cloud processing".
- FR-28.5 The clinician account holds the clinician's email only. No patient data is linked to it.

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

- appointment scheduling (the Appointment entity is reserved; follow-up due dates cover scheduling)
- live AI extraction during recording (ADR-027)
- reference images (ADR-029)

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
6. review evidence with citations (R1). Reviewing possibilities (R2) is demonstrated only in development/preview builds with the flag ON and synthetic data; it is not a release criterion (ADR-025)
7. edit the generated note
8. confirm information
9. save the encounter
10. reopen the patient
11. start a new visit
12. compare the new visit with the previous visit
