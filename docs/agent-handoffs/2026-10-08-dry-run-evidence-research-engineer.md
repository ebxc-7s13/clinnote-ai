# Task Handoff

## Owner

evidence-research-engineer

## Task

T2 (P0-AS-3 dry run): evidence-retrieval and external-API analysis for the implementation dependency graph. BUILD_PLAN Phase 0 (analysis of Phases 8, 10–13, 19, 20, 24, 25).

## Status

COMPLETED (analysis only; no provider verification performed, as instructed for this dry run)

## What Changed

Read CLAUDE.md, PROJECT-STATUS, BUILD_PLAN (Phases 0–25), DECISIONS, AGENT-COMMUNICATION, API_CATALOG (incl. §29–§31), EVIDENCE-SOURCES, AI.md, ARCHITECTURE, DATA_MODEL §3–§6, CLINICAL-SAFETY, PRIVACY §6–§7/§17, SECURITY (logging), TESTING, INTEGRATION-CONTRACTS, AGENT-TASK-GRAPH. Produced dependency findings and five ranked concerns below.

## Files Changed

`docs/agent-handoffs/2026-10-08-dry-run-evidence-research-engineer.md` (this file, new). No other file edited.

## Interfaces Changed

none (findings affect IC-009, IC-010, IC-011, IC-015 timing; no change made)

## Dependencies

**(a) Phase-order dependencies imposed by evidence/medication work**

1. **Backend before any adapter.** All evidence/medication adapters run on the backend (BUILD_PLAN.md:361; ARCHITECTURE.md §3.6; ADR-012). They need the backend scaffold, auth (OD-004 / IC-004), routing config (IC-015) and ProviderExecution (IC-013), all created in Phase 8 task 4. Phase 8 bundles that scaffold with the speech choice (OD-001, OD-007), so a slip in OD-001 also blocks Phases 11–12. Suggestion: separate the backend scaffold from OD-001 in the plan. It would still need OD-004.
2. **Data model.** EvidenceQuery/EvidenceSource tables (DATA_MODEL §4.15–§4.16, IC-001, Phase 4) and `Visit.evidenceState` (IC-003, Phase 6) must exist before Phase 11 task 4. Phase 11 stores labels "as EvidenceSources" (BUILD_PLAN.md:339).
3. **AI / OD-002.** Phase 11 needs AI job 4 medication output (Phase 10). Phase 12 needs AI job 11 query generation (AI.md:55), which is an LLM job. The Phase Overview (BUILD_PLAN.md:36) lists only OD-008 for Phase 12, so the OD-002 gate is implicit through Phase 10 and should be stated. The adapters, manual evidence search (task 7) and citation validator do not need an LLM. They can be built and contract-tested on recorded public fixtures before OD-002 is resolved.
4. **Verification points (VBI).** Phase 11 task 1 covers RxNorm, DailyMed and openFDA label/NDC/Drugs@FDA. Phase 12 task 1 covers PubMed → MedlinePlus → Europe PMC → ClinicalTrials.gov → Clinical Tables → PubChem → WHO → NCI. Phase 20 fills the PRIVACY §7 provider table. Phase 25 task 1 re-verifies all providers. Early read-only research in Phases 5–7 (AGENT-TASK-GRAPH §4) does not satisfy Cross-Phase Rule 6 (BUILD_PLAN.md:16). It must be redone at the start of the phase that uses it and logged in API_CATALOG §31. Optional keys (NCBI_API_KEY, OPENFDA_API_KEY) are owner actions. No provider is verified yet (API_CATALOG.md:615).
5. **Can Phases 11 and 12 run in parallel?** Partly. They can at the adapter level (disjoint providers, AGENT-TASK-GRAPH.md:46,75), but only if IC-010 (EvidenceProvider + EvidenceSource shape) is frozen before Phase 11. IC-010 currently says "First needed: Phase 12" (INTEGRATION-CONTRACTS.md:37). They cannot run in parallel at the feature level. Phase 11 label retrieval needs Phase 12 persistence (task 4), and medication-related evidence queries should use RxCUIs from Phase 11.
6. **Does the current order honor this?** Mostly. The exceptions are the inversions in Concern 1 (TOP) and the IC-010 timing above.

**(c) Agent dependencies**

- I depend on:
  - backend-api-engineer: scaffold, auth, routing, secrets, response-schema validation hooks (IC-004/013/015).
  - ai-clinical-engineer: job 4 output, jobs 11/12/13/16 schemas, IC-008/IC-011.
  - data-engineer: IC-001/IC-003 evidence entities and stage state.
  - security-privacy-engineer: provider data terms, placement of the identifier-free check, PRIVACY §7 table.
  - clinical-safety-engineer: mandatory review of CS-16/CS-17, S16/S17 and tier labels.
  - product-clinical-architect: ranking and display requirements.
  - project owner: OD-005, OD-008 and optional API keys.
- Depend on me:
  - ai-clinical-engineer: EvidenceSources for jobs 13 and 16.
  - mobile-android-engineer: evidence cards, Medication Information screen, ambiguity UI.
  - qa-test-engineer: recorded public fixtures and adapter contract tests.
  - security-privacy-engineer: Phase 20 provider table.
  - devops-android-release-engineer: Phase 24 Data Safety inputs.
  - integration-reviewer: Phase 25 re-verification.

## Tests

none — documentation/analysis task

## Evidence

- Start `date -u`: 2026-10-08T03:43:58Z · end of analysis: 2026-10-08T03:46:03Z
- Citations are file:line from the Read tool on the current working tree (the base commit is e1961ef; the coordination docs are still untracked).

## Known Limitations

- Dry run: no WebFetch/WebSearch, so every API_CATALOG field marked VBI is still unverified. This includes the openFDA disclaimer wording (API_CATALOG.md:278) and the NCBI rate limits (:224).
- I did not review UI-UX, SPEECH, DEPLOYMENT or GOOGLE-PLAY in depth.

## Risks

**Concerns (ranked)**

1. **TOP CONCERN — Evidence phase-order inversion (Phases 11 → 12 → 13).**
   - AI job 11 takes "facts, candidates" as input (AI.md:55), and EvidenceQuery has a `candidateId` (DATA_MODEL.md:230). But candidates come from job 12 in Phase 13 (BUILD_PLAN.md:387), which runs after Phase 12. ARCHITECTURE §6.4 (lines 177–180) builds queries from facts only.
   - Phase 12 completion requires S17 and the citation-validation tests (BUILD_PLAN.md:378). Both depend on evidence synthesis (job 13: EVIDENCE-SOURCES §8 line 122, CS-16), which is only built in Phase 13 (BUILD_PLAN.md:388).
   - Phase 11 task 4 stores labels as EvidenceSources (:339) before Phase 12 builds EvidenceSource persistence (:363).
   - Safety impact: the CS-16 hallucinated-citation gate could be marked passed in Phase 12 against a synthesis job that does not exist yet, and candidate-linked evidence (FR-18.2) has no defined phase.
2. **Raw medication wording sent to providers contradicts PRIVACY.**
   - API_CATALOG §19 (line 378) sends "Raw medication wording" to RxNorm and marks privacy "None" (:382). PRIVACY §7 (line 62) says transcript text is never sent to evidence/terminology providers. AI.md:55 bans free transcript text in queries. PRIVACY outranks API_CATALOG.
   - Phase 11 tests (BUILD_PLAN.md:349) have no identifier-free query test; only Phase 12 does (:376).
   - Where the identifier-free check runs is not specified. The backend never receives name, DOB or patient reference, so the check must run on the device.
3. **US-only medication/regulatory sources with no jurisdiction decision.**
   - RxNorm, DailyMed, openFDA and NDC are US-centric (API_CATALOG.md:320,383). Phase 11 cites OD-005 as a blocker (BUILD_PLAN.md:353) but lists no OD gate (:35). OD-005 is only due "before Phase 14" (DECISIONS.md:203).
   - For a non-US brand, approximate matching can return only wrong US candidates, and the label of a different product is then shown as Tier 1. Clinician selection (CS-11) does not help when the candidate list contains no correct option.
4. **Ranking and deduplication undefined; tier and routing gaps.**
   - EVIDENCE-SOURCES has no ranking or deduplication rules, and Phase 12 has no such task (BUILD_PLAN.md:360–368).
   - Tiers are assigned per provider, but NCI appears in Tier 1 and Tier 4. ClinicalTrials.gov, PubChem and WHO are Tier 1, above guidelines and literature (EVIDENCE-SOURCES.md:17–20).
   - Routing (API_CATALOG §29) has no route for PubChem, WHO, NCI, Orange Book or openFDA adverse events/enforcement/shortages. No phase verifies or implements those openFDA datasets, although EVIDENCE-SOURCES §3/§4.1 lists them.
   - Phase 12 task 2 (:361) omits the Terminology, Chemical and PublicHealth adapters, which task 1 verifies and TESTING §4 (line 24) requires to have contract tests.
5. **Cache location and freshness integrity unspecified.**
   - Phase 12 task 5 "Caching and freshness marking" (BUILD_PLAN.md:364) and the many "cache" notes in API_CATALOG do not say whether caching happens on the device or the backend.
   - A backend cache keyed by query text conflicts with the stateless backend (ADR-012; ARCHITECTURE.md:81) and with the rule that query text is never logged (SECURITY.md:118).
   - The 30-day stale rule (EVIDENCE-SOURCES.md:116) needs `retrievedAt` to be the original provider fetch time, not the time of a cache hit.

## Required Follow-up

- chief-architect: resolve Concern 1. Options are: (a) move the EvidenceSource store, IC-010 and the citation validator ahead of Phase 11; (b) define Phase 12 as facts-based queries with candidate-based re-query in Phase 13; (c) move the CS-16/S17 synthesis assertions to Phase 13 completion. Record the choice as an ADR and update BUILD_PLAN, AI.md job 11 and IC-010 "First needed".
- clinical-safety-engineer: review Concerns 1 and 3 (CS-16 gate placement; wrong-jurisdiction normalization).
- security-privacy-engineer with evidence-research-engineer: reconcile API_CATALOG §19 with PRIVACY §7, specify the on-device identifier-free check, and add it to Phase 11 tests.
- project owner via chief-architect: decide whether OD-005 (at least target countries) gates Phase 11.
- evidence-research-engineer (after docs are approved): add ranking/dedup/caching sections to EVIDENCE-SOURCES and complete the routing table §29.

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes, by chief-architect; TOP CONCERN to clinical-safety-engineer
