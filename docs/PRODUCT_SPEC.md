# ClinNote AI — Product Specification

This document is the product authority. See `CLAUDE.md` for precedence rules.

## 1. Product Definition

ClinNote AI is an ambient clinical documentation and evidence-review workspace for healthcare professionals.

The core value proposition is:

"Turn a clinical conversation into structured clinical memory and source-linked evidence without forcing the clinician to type everything manually."

## 2. Primary User

The primary user is a clinician conducting a consultation.

Potential users:

- physicians
- dentists
- specialists
- outpatient clinicians
- other healthcare professionals where the workflow is appropriate

V1 is a single-clinician, single-device product. Multi-user clinics, shared records and EHR integration are out of scope for V1 (see Section 16).

The patient is not a user of the application. Patient-friendly explanations are produced for the clinician to share at their discretion.

## 3. Core User Problem

During a consultation, the clinician must simultaneously:

- listen to the patient
- ask questions
- remember answers
- document symptoms
- document history
- record medications
- record investigations
- formulate an assessment
- create a plan
- remember previous visits

This creates documentation burden and fragmented information.

ClinNote attempts to reduce documentation burden without removing clinician control.

## 4. Product Goal

The application should allow a clinician to spend less time manually documenting a consultation while gaining faster access to:

- what the patient said
- what the clinician documented
- what changed since the previous visit
- relevant medication information
- relevant biomedical evidence
- unresolved follow-up items

## 5. Product Principles

### Principle 1 — Listen First

The system should capture conversation naturally rather than forcing structured manual entry during the consultation.

### Principle 2 — Structure, Do Not Invent

The AI may organize information but must not fabricate information.

### Principle 3 — Evidence Must Be Traceable

Clinical evidence must have source attribution.

### Principle 4 — Clinician Remains in Control

Important generated information requires review and confirmation.

### Principle 5 — Patient Memory Is Longitudinal

A patient's information should not be treated as isolated encounters.

### Principle 6 — Privacy by Minimization

Collect the least patient information necessary.

### Principle 7 — API-First AI

Avoid unnecessary local model downloads.

## 6. Core Workflow

```text
Create/select patient
        ↓
Start visit
        ↓
Consent
        ↓
Start recording
        ↓
Live transcription                  (live stage)
        ↓
Speaker separation
        ↓
Stop recording
        ↓
Final transcript                    (post-consultation stage)
        ↓
Clinical fact extraction
        ↓
Patient profile update (provisional)
        ↓
Clinical topics for review
        ↓
Clinical evidence retrieval
        ↓
Clinician review
        ↓
Note generation
        ↓
Note editing
        ↓
Clinician confirmation
        ↓
Save encounter
```

The live/post-consultation split is defined in `ARCHITECTURE.md` Section 7 and ADR-008.

Patient profile updates proposed from a visit remain PROVISIONAL until the clinician confirms them. Confirmed items become part of the longitudinal record.

A visit can also be completed entirely manually (no recording) — see Section 15 and BUILD_PLAN Phase 4.

## 7. Returning Patient Workflow

```text
Open patient
    ↓
Overview
    ↓
Previous visit summary
    ↓
Changes since previous visit
    ↓
Pending follow-up
    ↓
Current medications
    ↓
Start new visit
```

"Changes since previous visit" compares only explicitly documented information. Absence of an item in the newer visit is shown as "not discussed this visit", never as resolution or discontinuation.

## 8. Patient Profile

Each patient profile can contain:

- internal patient reference (required, e.g. `P-000001`)
- optional name
- age
- sex
- optional date of birth
- medical history
- surgical history
- family history
- social history
- allergies
- medications
- active problems
- clinician-confirmed diagnoses
- investigations
- appointments
- follow-up tasks
- encounter timeline

Only the internal patient reference is mandatory. All identifying fields are optional (see `PRIVACY.md`).

## 9. Encounter

An encounter (stored as a `Visit`, see `DATA_MODEL.md`) contains:

- encounter ID
- patient ID
- date/time
- consent state
- transcript
- speaker segments
- clinical facts
- symptoms
- medications
- allergies
- investigations
- assessment
- plan
- follow-up
- clinical candidates (possibilities to review)
- evidence queries
- evidence sources
- generated note
- clinician edits
- clinician confirmation state
- audit events

## 10. Clinical Possibility System

Use:

POSSIBILITIES TO REVIEW

instead of:

AUTOMATIC DIAGNOSIS

Each possibility should contain:

- condition/topic
- why it surfaced
- supporting facts
- contradicting facts
- missing information
- relevant evidence

Do not use arbitrary probability numbers.

A possibility can be DISMISSED or CONFIRMED_BY_CLINICIAN. Only a clinician action can turn a possibility into a clinician-confirmed assessment.

## 11. Medication System

When medications are mentioned:

1. extract the raw medication wording
2. normalize using a medication terminology service
3. identify the standardized medication
4. retrieve relevant authoritative medication information
5. display the information
6. allow clinician correction
7. preserve provenance

If normalization is ambiguous (several candidate concepts) the candidates are shown and none is selected automatically.

ClinNote does not suggest doses, substitutions or changes.

## 12. Evidence System

The evidence engine should distinguish:

REGULATORY

LITERATURE

GUIDELINE

PATIENT_EDUCATION

CLINICAL_TRIAL

TERMINOLOGY

CHEMICAL_INFORMATION

PUBLIC_HEALTH

These are the `sourceType` values defined in `DATA_MODEL.md`.

## 13. Clinical Images

Images shown beside evidence must be explicitly marked as reference/illustrative material.

The system must never imply that a reference image proves that the patient's condition matches the image.

Images must come from legally usable sources.

V1 does not capture or analyse patient images.

The reference-image source is an OPEN DECISION (`DECISIONS.md`, OD-008). Until it is resolved, the image feature is not implemented.

## 14. Note Types

V1:

- SOAP Note
- General Clinical Note
- Progress Note

Every note starts as an AI_DRAFT (or a manual draft), is editable, and is only finalized by explicit clinician confirmation.

## 15. Offline Behavior

Without Internet:

- patient profiles work
- previous encounters work
- timeline works
- notes work
- manual entry works
- local search works
- export works

Cloud AI and external evidence retrieval can fail gracefully.

Live transcription requires network connectivity in the API-first architecture. If connectivity is lost during a visit, the clinician is informed and can continue with manual entry. Whether audio may be buffered locally for later transcription is governed by the temporary-audio rules in `SPEECH.md` and `PRIVACY.md`.

## 16. Core Non-Goals

V1 does not include:

- autonomous diagnosis
- autonomous treatment decisions
- autonomous prescribing
- dosage adjustment
- emergency triage
- autonomous radiology interpretation
- autonomous pathology interpretation
- autonomous cancer diagnosis
- autonomous medication substitution
- patient-image analysis
- EHR integration
- billing / claim coding
- multi-clinician shared records
- cloud sync of patient records
- iOS release

## 17. Success Criteria

A clinician should be able to:

1. create a patient
2. start a visit
3. record a synthetic consultation
4. see speaker-separated transcript
5. see extracted clinical facts
6. review evidence
7. edit the generated note
8. confirm information
9. save the encounter
10. reopen the patient
11. start a new visit
12. compare the new visit with the previous visit

All success criteria are demonstrated with synthetic data only.
