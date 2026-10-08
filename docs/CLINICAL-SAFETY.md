# ClinNote AI — Clinical Safety Requirements

This document has the highest precedence of all specifications (`CLAUDE.md`, Authority Precedence).

## Fundamental Principle

ClinNote assists the clinician.

ClinNote does not replace clinical judgment.

## Allowed AI Behavior

ClinNote may:

- organize clinician information
- extract facts
- summarize conversation
- compare previous and current encounters
- retrieve literature
- retrieve regulatory information
- surface topics for clinician review
- provide patient-friendly explanations
- generate editable documentation

## Prohibited V1 Behavior

ClinNote must not autonomously:

- diagnose
- prescribe
- change medication
- suggest or calculate patient-specific doses
- determine emergency status
- provide definitive treatment
- confirm disease
- claim medical certainty
- invent examination findings
- mark a follow-up as completed

## Possibilities

Use:

POSSIBILITIES TO REVIEW

rather than:

DIAGNOSIS

Each possibility must show:

- reason surfaced
- supporting findings
- contradicting findings
- missing information
- evidence

No numerical probability or ranking score is shown (ADR-014). Possibilities are not ordered by likelihood; they are ordered by how directly they relate to documented facts, and the UI must not imply that the first item is the most likely diagnosis.

## Provenance

Every clinically significant generated statement must have a source.

Possible sources (full list in `DATA_MODEL.md`, Provenance Types):

PATIENT_REPORTED

CLINICIAN_STATED

MEASURED

TRANSCRIPTION

AI_EXTRACTED

EXTERNAL_SOURCE

CLINICIAN_CONFIRMED

## Information State

Information state (NOT_DISCUSSED / NEGATIVE / POSITIVE / UNKNOWN), provenance and review status are independent attributes (ADR-013). A NEGATIVE finding can be PATIENT_REPORTED and PROVISIONAL; a POSITIVE finding can be CLINICIAN_CONFIRMED.

## Missing Data

"Not discussed" must never become:

"negative"

Example:

Correct:

Allergy status: NOT DISCUSSED

Incorrect:

No known allergies

Generated notes must render NOT_DISCUSSED items either as "not discussed" or omit them; they must never be rendered as normal/negative findings (e.g. no auto-filled "ROS otherwise negative", no "examination normal" unless stated).

## Negation

Preserve:

"No fever."

"Denies chest pain."

"No history of diabetes."

"Never smoked."

## Uncertainty

If speech is uncertain:

[unclear]

If AI interpretation is uncertain:

AI INFERENCE — VERIFY

Patient-expressed uncertainty ("maybe", "I think", "not sure") is preserved as UNKNOWN information state or as hedged wording, never upgraded to POSITIVE.

## Numerical Integrity

Never silently change:

- blood pressure
- temperature
- oxygen saturation
- medication dose
- laboratory value
- duration
- weight
- height

## Medication Safety

Medication extraction must preserve:

- raw wording
- normalized identity
- dose
- route
- frequency
- duration
- source

A missing medication on a later visit does not prove discontinuation.

Ambiguous medication names (sound-alike, multiple RxNorm candidates) are shown with all candidates and require clinician selection.

## Speaker Attribution

Incorrect speaker labels can change provenance (patient-reported vs clinician-stated). Role mapping is clinician-correctable (`SPEECH.md`), and facts derived from UNKNOWN-speaker segments carry provenance TRANSCRIPTION or UNKNOWN, not PATIENT_REPORTED or CLINICIAN_STATED.

## Contradictions

If two facts conflict:

display the conflict.

Do not silently choose.

This applies within a visit (patient corrects themselves; patient vs clinician statements) and across visits (history differs from previous visit).

## Evidence Safety

Evidence must be:

- source-linked
- timestamped
- distinguishable by source type

Do not fabricate citations.

## Clinical Confirmation

Important generated clinical information remains provisional until clinician confirmation.

A note cannot be FINALIZED without explicit clinician action. Finalizing a note does not auto-confirm every provisional fact; facts the clinician did not review remain PROVISIONAL and are shown as such.

## Reference Images

Images shown beside evidence are illustrative/reference content unless a validated patient-image analysis system exists later.

Do not imply:

"The patient's lesion is identical to this image."

## Emergency Content

ClinNote does not perform triage. If the transcript contains content that might indicate an emergency, ClinNote does not classify it; it simply appears in the transcript and extracted facts like any other content. The app must not imply that the absence of a warning means the absence of an emergency.

## Regulatory Position

ClinNote has no regulatory approval, certification or clinical validation. Whether the product is regulated as software as a medical device in a target market is OPEN DECISION OD-005. The prohibited behaviours above are partly intended to keep V1 within a documentation/review-support scope, but that scope classification must be confirmed by qualified regulatory advice before release.

## Safety Testing

Create tests for:

- negation
- uncertainty
- medication ambiguity
- contradictory history
- missing allergies
- missing values
- incorrect speaker labels
- hallucinated citations
- hallucinated diagnoses
- fabricated treatment
- numerical integrity
- prompt injection in transcript

The mapping of these to concrete test cases is in `TESTING.md`, Clinical Safety Test Matrix.
