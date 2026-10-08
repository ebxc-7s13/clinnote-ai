# ClinNote AI — Privacy Requirements

## Privacy Philosophy

Collect the minimum information required.

Prefer local-first storage.

Avoid unnecessary cloud storage of clinical information.

## Patient Identity

A patient reference should be sufficient for normal operation.

Example:

P-000001

The system should not require a full legal identity simply to create a clinical note.

Name and date of birth are optional fields (`DATA_MODEL.md`).

## Recording

Recording requires explicit user initiation and appropriate consent workflow.

The microphone must have a visible active state.

Consent is recorded as a `ConsentRecord`; recording cannot start without one (`SPEECH.md`).

## Audio

Raw audio should not be retained permanently by default.

Temporary audio should be deleted after successful processing unless the clinician explicitly chooses retention.

Regardless of processing outcome, temporary audio is deleted after the maximum temporary retention period (default 24 hours, ADR-012) unless the clinician explicitly chose retention for that visit. Explicit retention is opt-in per visit and is off by default.

## Cloud Processing

If a cloud provider processes clinical text or audio:

- disclose that processing
- send minimum necessary data
- use secure transport
- protect credentials
- review provider terms
- verify applicable data-processing requirements

The backend does not persist clinical content (`ARCHITECTURE.md` Section 4). Data sent to providers is subject to that provider's retention terms, which must be reviewed and recorded before production.

Evidence queries contain clinical concepts only, never identifiers (`ARCHITECTURE.md` Section 10).

The clinician can disable cloud AI features in Settings; the app then operates in manual mode.

## Development

Only synthetic patient data may be used during development.

## Analytics

Do not send:

- transcript
- patient identifier
- medication
- symptoms
- diagnosis
- clinical note
- audio

to product analytics.

V1 ships without product analytics. Adding analytics requires an ADR and a privacy review.

## Crash Reports

Do not include clinical content.

See `SECURITY.md`, Crash Reporting.

## Data Minimization

Avoid collecting:

- location
- contacts
- unrelated device information
- unnecessary identifiers

## De-identification

Automated redaction may remove obvious identifiers.

It must NOT be described as guaranteed anonymization.

## Data Retention

Document exact retention policies before production release (OPEN DECISION OD-006).

Default principle:

keep patient records locally unless cloud storage is explicitly required.

V1 has no cloud storage of patient records (ADR-015). Local records are kept until the clinician deletes them. Deletion and uninstall remove local data; because there is no cloud copy in V1, there is no backup — the clinician must be told this.

## User Controls

The user should be able to:

- delete patient
- delete visit
- delete notes
- delete drafts
- manage exported data
- control optional cloud features

Deleting a patient deletes all their visits, transcripts, facts, notes, evidence records and temporary audio.

## Third-Party Providers

Before production:

document:

- provider
- data sent
- purpose
- location/processing
- retention
- user-facing disclosure
- contractual suitability

Use this table (populated when providers are selected):

| Provider | Data sent | Purpose | Processing location | Retention | Disclosure | Contract status |
|---|---|---|---|---|---|---|
| Speech provider (OD-001) | audio stream | transcription, diarization | VERIFY | VERIFY | privacy policy + in-app | VERIFY |
| LLM provider (OD-002) | transcript text, structured facts | extraction, notes, synthesis | VERIFY | VERIFY | privacy policy + in-app | VERIFY |
| Evidence providers | clinical concept queries (no identifiers) | evidence retrieval | VERIFY | VERIFY | privacy policy | public APIs, terms review |
| Backend host (Supabase) | all of the above in transit | proxy, routing | VERIFY | not persisted by ClinNote | privacy policy | VERIFY |

## Jurisdiction

Applicable health-privacy law (e.g. India DPDP Act, US HIPAA, EU GDPR) depends on target markets — OPEN DECISION OD-005. This document states technical requirements that are expected to be necessary under any of them, but compliance with a specific law is not claimed.

## Privacy Policy

A public-facing legal privacy policy must be created separately before Play Store production release.

This technical document does not itself constitute legal advice or a final public privacy policy.
