# ClinNote AI — Technical Privacy Specification

This is a technical specification. It is not legal advice and not a public privacy policy. **Production deployment requires legal/privacy review.** ClinNote does not claim compliance with any law (e.g. HIPAA, GDPR, India's DPDP Act) merely by following this document; applicable law depends on target jurisdictions (OD-005).

---

## 1. Data Minimization

- Collect only what the clinical documentation workflow needs.
- No location, contacts, phone state, SMS, advertising ID or unrelated device data.
- Send the minimum necessary data to each external provider (§7).
- V1 has no product analytics.

## 2. Patient Identifiers

- The only required identifier is an internal reference (`P-000001`).
- Name and date of birth are optional and never required to create a note.
- Identifiers are never sent to AI or evidence providers (§7).
- Identifiers are never logged.

## 3. Local-First Storage

- Patient records live only on the clinician's device (ADR-005, ADR-017).
- No cloud backup or sync in V1. The clinician is told that uninstalling the app or losing the device loses the data unless exported.
- The backend stores no clinical content.
- Encryption at rest: SQLCipher with a Keystore-backed key (`SECURITY.md` §8, ADR-031).

## 4. Audio Handling

- Recording only after clinician-attested consent (§11) with a visible recording indicator.
- Raw audio is temporary: deleted after the final transcript succeeds, when the visit is discarded, or after 24 hours at most (ADR-014).
- Retention beyond that only by explicit per-visit clinician opt-in, off by default.
- Audio is sent only to the selected speech provider.
- No voiceprints or biometric identifiers.

## 5. Transcript Handling

- Stored locally as part of the visit.
- Sent to the LLM provider for the current visit's AI jobs only.
- Editable by the clinician; deletable with the visit.
- Never in logs, analytics or crash reports.

## 6. Cloud Processing

When a cloud provider processes audio or text, ClinNote must:

- disclose it in-app (before first recording) and in the privacy policy
- send minimum necessary data
- use TLS
- keep credentials server-side
- review and record provider retention, training-use and processing-location terms
- verify applicable data-processing agreements for the target jurisdiction before production

The clinician can turn off cloud AI features in Settings; ClinNote then works in manual mode.

## 7. Provider Data Handling

| Provider category | Data sent | Never sent |
|---|---|---|
| Speech (OD-001) | audio stream | name, DOB, reference |
| LLM (OD-002) | current-visit transcript, structured facts, evidence excerpts, age/sex if stored | name, DOB, reference, other visits' transcripts |
| Evidence/terminology | clinical concept terms, drug names; typed public product/record identifiers (RxCUI, set ID, NDC, application no., PMID, NCT, CID) taken from validated provider responses (ADR-036) | any patient identifier (name, DOB, reference, contact details), transcript text, dates, location |
| Backend host | all of the above in transit | — (not persisted) |

Third-party provider table (completed in BUILD_PLAN Phase 20 before production):

| Provider | Data sent | Purpose | Processing location | Retention | User-facing disclosure | Contractual suitability |
|---|---|---|---|---|---|---|
| Speech provider (OD-001) | audio | transcription, diarization | VERIFY | VERIFY | in-app + privacy policy | VERIFY |
| LLM provider (OD-002) | text, facts | AI jobs | VERIFY | VERIFY | in-app + privacy policy | VERIFY |
| Evidence providers | concept queries | evidence | VERIFY | VERIFY | privacy policy | public API terms |
| Supabase (backend) | in-transit requests; non-clinical rate-limit counters keyed by an opaque user id (ADR-042) | proxy, routing, abuse control | VERIFY | clinical content not persisted; counters deleted after the longest window + 24 h and on account deletion | privacy policy + Data Safety (account/app-activity data) | VERIFY |
| Supabase Auth (ADR-032) | clinician email and auth tokens (no patient data) | clinician sign-in, abuse control | VERIFY | VERIFY | privacy policy + Data Safety | VERIFY |
| Crash reporting | none: no SDK in V1 (ADR-030); Google Play Android vitals only | stability | Google | per Play terms (VERIFY) | privacy policy | Play developer terms |

## 8. Analytics

V1 ships with no product analytics. If analytics are added later (ADR required), they must never include transcript, patient identifiers, medications, symptoms, diagnoses, notes, audio or evidence queries.

## 9. Crash Reporting

V1 has no crash-reporting SDK (ADR-030). Only Google Play Android vitals collects crash data (VERIFY exact fields). No clinical content is ever sent.

## 10. Retention

- Local records: kept until the clinician deletes them. Required retention periods for medical records vary by jurisdiction and institution — OPEN DECISION OD-006 (legal input required). ClinNote does not auto-delete clinical records in V1.
- Temporary audio: ≤24 hours (ADR-014).
- Backend: no clinical content retained; technical logs retained for a limited period to be set in OD-006.
- Provider-side retention: as per provider terms, documented in §7.

## 11. Consent

- Clinician attests consent before recording (ConsentRecord).
- The app explains what is recorded and where it is processed so the clinician can inform the patient.
- The app does not determine the legally required form of consent.
- Withdrawal stops recording; captured content kept or discarded by clinician choice.

## 12. Deletion

The clinician can delete a patient, a visit, notes, drafts, transcripts and temporary audio. Deleting a patient cascades to all related records and files. Exports already shared outside the app cannot be recalled; the export warning states this.

## 13. Export

- Explicit action only, with warning, audited.
- Exported content is chosen by the clinician (e.g. note only, without transcript).

## 14. Synthetic Development Data

Only synthetic patients, transcripts and audio in development, tests, fixtures, screenshots, store listings and issue reports. Synthetic names are obviously fictional.

## 15. De-identification Limitations

Automated redaction (regex- or API-level) may remove some obvious identifiers. **Regex/API-level redaction does NOT guarantee anonymization.** ClinNote never describes redacted content as anonymous or de-identified in a legal sense. Clinical narratives can contain indirect identifiers (rare conditions, occupations, places, dates).

## 16. User Controls

Delete patient · delete visit · delete notes · delete drafts · manage exports · enable/disable cloud AI · view what is sent to which provider category.

## 17. Privacy Acceptance Criteria

1. No clinical content in logs, analytics or crash reports during the full synthetic E2E suite.
2. Evidence queries contain no patient identifiers (automated test).
3. LLM payloads contain no name, DOB or reference (automated test).
4. Temporary audio absent after success, discard and 24 hours (tests).
5. Patient deletion removes all related data (test).
6. In-app processing disclosure shown before first recording.
7. Provider table (§7) completed with verified terms.
8. Public privacy policy reviewed by a qualified person and consistent with the Play Data Safety form.
