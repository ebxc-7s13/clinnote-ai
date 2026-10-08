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
| IC-003 | Visit pipeline stage states | data-engineer | mobile, speech, ai, evidence | `DATA_MODEL.md` §5.2 | Phase 6 |
| IC-004 | Backend authentication | backend-api-engineer | mobile-android-engineer | OD-004 | Phase 8 |
| IC-005 | Speech token / proxy endpoint | backend-api-engineer + speech-diarization-engineer | mobile-android-engineer | `SPEECH.md` §5, §13 | Phase 8 |
| IC-006 | SpeechProvider / DiarizationProvider | speech-diarization-engineer | backend, mobile | `API_CATALOG.md` §11 | Phase 8 |
| IC-007 | Final transcript format (TranscriptSegment + roles) | speech-diarization-engineer | ai-clinical-engineer | `DATA_MODEL.md` §4.4 | Phase 9 |
| IC-008 | LLMProvider and job I/O schemas (jobs 1–16) | ai-clinical-engineer | backend, mobile | `AI.md` §3–§5 | Phase 10 |
| IC-009 | MedicationProvider (RxNorm normalization) | evidence-research-engineer | ai, mobile | `API_CATALOG.md` §19 | Phase 11 |
| IC-010 | EvidenceProvider family and EvidenceSource shape | evidence-research-engineer | ai, mobile, backend | `EVIDENCE-SOURCES.md`, `DATA_MODEL.md` §4.16 | Phase 11 (frozen before Phase 11 so Phases 11 ∥ 12 adapters can proceed; dry-run concern 15) |
| IC-011 | Evidence synthesis citation contract (evidence IDs only) | ai-clinical-engineer + evidence-research-engineer | mobile | `AI.md` §5.1, `EVIDENCE-SOURCES.md` §9 | Phase 12 |
| IC-012 | Structured visit-comparison diff | ai-clinical-engineer (deterministic diff) | mobile | `ARCHITECTURE.md` §6.6 | Phase 13 |
| IC-013 | ProviderExecution record | backend-api-engineer | data, mobile | `DATA_MODEL.md` §4.20 | Phase 8 |
| IC-014 | Export format | mobile-android-engineer | security-privacy-engineer (review) | `PRODUCT_SPEC.md` Feature 26 | Phase 18 |
| IC-015 | Provider routing configuration | backend-api-engineer | speech, ai, evidence, devops | `API_CATALOG.md` §29 | Phase 8 |

## 3. Change Log

No interface changes recorded yet (no code exists). The first entries are expected in BUILD_PLAN Phase 4.
