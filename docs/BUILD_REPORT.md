# ClinNote AI — Build Report

## Phase

Phase 0 — Documentation Initialization

## Date

2026-10-08

## Repository

- Branch: `main`
- Starting state: single initial commit (`3a742bc`) containing a one-line `README.md`.
- Ending state: documentation foundation committed (commit message `docs: initialize ClinNote AI product and engineering specification`). The commit hash is recorded in `git log`; a report cannot contain the hash of the commit that includes it.

## Work Completed

- Created the full documentation set defined for Phase 0, using the supplied specification text as the base.
- Extended the base text where needed to make the documents complete and internally consistent (details under Consistency Audit).
- Recorded 15 ADRs and 10 open decisions.
- Ran the documentation consistency check described in `TESTING.md` (Documentation Tests).

## Files Created

- `CLAUDE.md`
- `docs/PRODUCT_SPEC.md`
- `docs/BUILD_PLAN.md`
- `docs/ARCHITECTURE.md`
- `docs/API_CATALOG.md`
- `docs/DATA_MODEL.md`
- `docs/SPEECH.md`
- `docs/AI.md`
- `docs/EVIDENCE-SOURCES.md`
- `docs/SECURITY.md`
- `docs/PRIVACY.md`
- `docs/CLINICAL-SAFETY.md`
- `docs/UI-UX.md`
- `docs/TESTING.md`
- `docs/DEPLOYMENT.md`
- `docs/GOOGLE-PLAY.md`
- `docs/PROJECT-STATUS.md`
- `docs/BUILD_REPORT.md`
- `docs/DECISIONS.md`

## Files Modified

- `README.md` (replaced one-line placeholder with project README)

## Consistency Audit

Contradictions and gaps found in the base specification text and fixed:

1. **Enum typo.** `NOT_DISCUSSSED` (three S) in CLAUDE.md and TESTING.md → `NOT_DISCUSSED`, matching DATA_MODEL.md.
2. **Conflated enums.** CLAUDE.md listed information states and provenance types in one list, missing MEASURED and TRANSCRIPTION. Split into information state / provenance / review status, aligned with DATA_MODEL.md; ADR-013 added.
3. **ClinicalFact had no information-state field** although the rules require NOT_DISCUSSED/NEGATIVE to be stored. Added `informationState` to ClinicalFact, Symptom and Allergy.
4. **Entities listed but undefined.** Allergy, Assessment, Plan, Appointment, EvidenceQuery, ConsentRecord and AuditEvent were listed in DATA_MODEL.md without definitions. Defined.
5. **Visit state enums undefined.** Added values for consentState, recordingState, pipeline-stage states and noteState.
6. **Confidence undefined.** ARCHITECTURE.md used `Confidence: HIGH` with no enum. Added ConfidenceLevel to DATA_MODEL.md, stated it is not a clinical probability.
7. **Evidence source types.** PRODUCT_SPEC.md used spaced names ("PATIENT EDUCATION"); normalized to enum values used in DATA_MODEL.md and added a tier field and source-type mapping in EVIDENCE-SOURCES.md.
8. **Server-side keys vs. device streaming.** SECURITY.md forbids keys on device, but SPEECH.md needs live streaming from the device. Added short-lived token / backend proxy design to ARCHITECTURE.md, SPEECH.md and SECURITY.md.
9. **Audio retention mismatch.** SPEECH.md said "delete after processing"; PRIVACY.md allowed clinician-chosen retention; neither covered failed processing. Aligned both and added a 24-hour maximum (ADR-012).
10. **Anthropic listed as an LLM in AI.md but absent from API_CATALOG.md**; `SUPABASE_SERVICE_ROLE_KEY` in SECURITY.md but absent from the catalog. Added both; marked which variables are public configuration.
11. **"Required secret" wording implied keys exist.** Changed to "server-side secret (future)" and stated no keys exist.
12. **ImageProvider interface with no image source.** Recorded as OD-008; feature gated.
13. **Tests and security only at the end of BUILD_PLAN.md** contradicted "no feature complete until tested". Added cross-phase rules: tests and security baseline from Phase 1.
14. **Clinical-safety test coverage gaps.** TESTING.md lacked tests for incorrect speaker labels, hallucinated citations/diagnoses, fabricated treatment, numerical integrity and the "absent medication ≠ discontinued" rule. Added critical tests and a Clinical Safety Test Matrix.
15. **Workflow order.** PRODUCT_SPEC.md core workflow placed full extraction before "stop recording", contradicting the live/post-consultation split (ADR-008). Reordered.
16. **Background recording permissions.** GOOGLE-PLAY.md listed only RECORD_AUDIO; background recording on Android needs a microphone foreground service. Documented in SPEECH.md and GOOGLE-PLAY.md, marked VERIFY BEFORE IMPLEMENTATION.
17. **Rollback.** DEPLOYMENT.md implied app rollback; clarified that Play does not support downgrades and that rollback is server-side flags or a new release.
18. **Unverified API claims.** Added a verification status table to API_CATALOG.md with every provider marked VERIFY BEFORE IMPLEMENTATION.

Checks performed (all passed after fixes): required files present and non-empty; no unqualified placeholders; every OD-/ADR- reference defined in DECISIONS.md; no regulatory-approval or validation claims (only prohibitions); no secret-like strings; no real patient data; no assumption that keys or model weights exist.

## Application Code

NOT STARTED

## Dependencies

NOT STARTED

## API Credentials

NONE USED

## Model Downloads

NONE

## Tests

Documentation consistency tests only.

## Clinical Data

NO REAL PATIENT DATA USED

## Security

No runtime implementation yet.

Documentation-level security requirements created.

## Privacy

No runtime patient-data processing implemented.

Privacy requirements documented.

## Clinical Safety

Clinical-safety requirements documented.

## External Verification

No external provider documentation was fetched during this phase. All provider capabilities are recorded as intended roles and marked VERIFY BEFORE IMPLEMENTATION in `API_CATALOG.md`.

## Open Decisions

Full detail in `DECISIONS.md`:

- OD-001 Primary speech provider (Phase 6)
- OD-002 Primary LLM provider/model (Phase 8)
- OD-003 Local storage encryption mechanism (before distributed builds)
- OD-004 Backend authentication / clinician accounts (Phase 6)
- OD-005 Target jurisdictions and regulatory classification (before Phase 15)
- OD-006 Data retention policy (before Phase 15)
- OD-007 Supported consultation languages (before OD-001)
- OD-008 Reference image source (before any image feature)
- OD-009 Crash reporting provider (Phase 12)
- OD-010 License (before public release)

## Blockers

None for Phases 1–5. Later phases are gated by the open decisions above.

## Next Phase

Phase 1 — Repository and Development Foundation (`BUILD_PLAN.md`).
