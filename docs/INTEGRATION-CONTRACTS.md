# ClinNote AI — Integration Contracts

The register of interfaces between agents' subsystems. An interface may only change through an entry here plus a direct message to affected agents, who acknowledge before merge.

---

## 1. Change Notice Format

```markdown
### IC-<nnn> — <interface name>
- Status: PROPOSED | ACKNOWLEDGED | MERGED | REJECTED
- Owner: <agent>
- WHAT CHANGED: ...
- WHY: ...
- BEFORE: <signature / schema / behavior>
- AFTER: <signature / schema / behavior>
- MIGRATION NEEDED?: yes/no — <steps>
- BREAKING?: yes/no
- AFFECTED AGENTS: <names> — acknowledged: <names + date>
- TESTS: <contract tests added/updated + results>
- Related ADR: <ADR-nnn or none>
```

## 2. Planned Interfaces (defined in docs; no code yet)

| ID | Interface | Producer (owner) | Consumers | Source of truth | First needed |
|---|---|---|---|---|---|
| IC-001 | Domain entities and enums | data-engineer | all app agents, ai-clinical-engineer | `DATA_MODEL.md` §3–§4 | Phase 4 |
| IC-002 | Repository / StorageProvider API | data-engineer | mobile-android-engineer | `ARCHITECTURE.md` §3.4, `DATA_MODEL.md` | Phase 4 |
| IC-003 | Visit pipeline stage states and stage-specific preconditions (incl. candidate gating, ADR-034) | data-engineer | mobile, speech, ai, evidence, safety | `DATA_MODEL.md` §5.2 | Phase 6 |
| IC-004 | Backend authentication (Supabase Auth clinician accounts): header format, token refresh, 401/403/429 response shapes, signed-out behavior (FR-28.4) | backend-api-engineer | mobile-android-engineer; reviewers security-privacy-engineer, qa-test-engineer | ADR-032, `SECURITY.md` §10 | Phase 7 (sign-in method VBI at Phase 7) |
| IC-005 | Speech token / proxy endpoint | backend-api-engineer + speech-diarization-engineer | mobile-android-engineer | `SPEECH.md` §5, §13 | Phase 8 |
| IC-006 | SpeechProvider / DiarizationProvider | speech-diarization-engineer | backend, mobile | `API_CATALOG.md` §11 | Phase 8 |
| IC-007 | Final transcript format (TranscriptSegment + roles) | speech-diarization-engineer | ai-clinical-engineer | `DATA_MODEL.md` §4.4 | Phase 9 |
| IC-008 | LLMProvider and job I/O schemas (LLM jobs 1–10 and 12–16; job 11 is deterministic code, ADR-039; job 15 returns structured statements, ADR-040) | ai-clinical-engineer | backend, mobile | `AI.md` §3–§5 | Phase 10 |
| IC-009 | MedicationProvider (RxNorm normalization) | evidence-research-engineer | ai, mobile | `API_CATALOG.md` §19 | Phase 11 |
| IC-010 | EvidenceProvider family and EvidenceSource shape | evidence-research-engineer | ai, mobile, backend | `EVIDENCE-SOURCES.md`, `DATA_MODEL.md` §4.16 | Phase 11 (frozen before Phase 11 so Phases 11 ∥ 12 adapters can proceed; dry-run concern 15) |
| IC-011 | Evidence citation contract for jobs 12, 13 and 16 (evidence IDs within the citable bundle only; no source named outside the bundle) | ai-clinical-engineer + evidence-research-engineer | mobile, clinical-safety | `AI.md` §5.1 rules 10–11, `EVIDENCE-SOURCES.md` §9 | Phase 12 |
| IC-012 | Structured visit-comparison diff | ai-clinical-engineer (deterministic diff) | mobile | `ARCHITECTURE.md` §6.6 | Phase 13 |
| IC-013 | ProviderExecution record and its transport: the backend generates `executionId` and returns the technical fields in the response envelope (`execution`), including attempt and FALLBACK_USED; the device stores the record and attaches `visitId` locally (no visit ID is sent) | backend-api-engineer | data, mobile; populated by speech, ai, evidence (job, jobVersion, model) | `DATA_MODEL.md` §4.20 | Phase 7 |
| IC-014 | Export format | mobile-android-engineer | security-privacy-engineer (review) | `PRODUCT_SPEC.md` Feature 26 | Phase 18 |
| IC-015 | Provider routing configuration: per route `enabled`, primary, fallback order, retry (max 1), timeout, `trigger` (AUTOMATIC / CLINICIAN_REQUEST_ONLY; for TRIALS, CHEMICAL and PUBLIC_HEALTH it is a code constant that configuration can only restrict, ADR-043) and `scope` (e.g. NCI information pages only); an unset route is disabled | backend-api-engineer | speech, ai, evidence, devops | `API_CATALOG.md` §29; ADR-036 | Phase 7 |
| IC-016 | Extraction item → fact promotion and provenance assignment | data-engineer (rules) + ai-clinical-engineer (item schema) | mobile, safety | `DATA_MODEL.md` §3.2, §3.9, §8; ADR-021 | Phase 4 (rules), Phase 10 (items) |
| IC-017 | FactConflict detection and resolution | data-engineer | ai, mobile, safety | `DATA_MODEL.md` §4.21, §5.7, §9; ADR-022 | Phase 4 |
| IC-018 | Evidence query sanitizer (allow-list) for every path: automatic job-11 queries, clinician manual search, terminology autocomplete; two identifier classes (patient identifiers never; typed public product/record identifiers from validated responses only) | evidence-research-engineer + security-privacy-engineer | backend, ai, mobile | `ARCHITECTURE.md` §6.4; ADR-028, ADR-036; F-03 | Phase 11 |
| IC-019a | Server feature flags `possibilitiesEnabled` and `patientExplanationEnabled` (R2 regulatory gates): authoritative values in backend configuration (default OFF), served only by the authenticated `/config` endpoint. The app skips the stage when OFF, and the backend LLM endpoint refuses jobs 12, 13 and 16 with `FEATURE_DISABLED` and creates no ProviderExecution (defense in depth, CS-37) | backend-api-engineer | mobile, ai, ux, clinical-safety | ADR-025, ADR-034, ADR-041, ADR-042 | Phase 7 |
| IC-019b | Local setting `cloudProcessingEnabled` (AppSettings, FR-28): when OFF, the app sends nothing to the backend | mobile-android-engineer | backend (no requests expected when OFF), ux, security-privacy | `DATA_MODEL.md` §4.24; PRODUCT_SPEC Feature 28 | Phase 3 |

## 3. Change Log

No code-level interface changes are recorded yet (no code exists). The first entries are expected in BUILD_PLAN Phase 4.

Stage A documentation refinements (2026-10-08, from the backend contract review in `docs/agent-handoffs/2026-10-08-stage-a-team2-backend.md`):
- IC-004: wire-contract scope and reviewers named; first needed in Phase 7.
- IC-013: transport defined.
- IC-015: config fields defined.
- IC-019 split into IC-019a (server, regulatory) and IC-019b (local setting); server-side enforcement recorded in ADR-034.
- IC-003: candidate gating added.
