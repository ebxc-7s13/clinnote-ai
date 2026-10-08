# Task Handoff

## Owner

evidence-research-engineer (teammate `evidence`, Stage A agent-team test, run 2 re-check)

## Task

[STAGE-A2-RECHECK]. I re-checked the lead's fixes for evidence findings E2-01 to E2-14 and flagged anything new the fixes introduced or exposed (E3-xx). This is a Phase 0 (Stage A) documentation review.

## Status

COMPLETED

## What Changed

This was a documentation review only. I wrote no application code, called no external provider API and edited no existing file. The only file created is this one.

### Verification of E2-01 … E2-14

| Finding | Verdict | Evidence (file:section) | Residual |
|---|---|---|---|
| E2-01 Job 11 brings in unstated conditions (HIGH) | RESOLVED (job 11 is deterministic) | DECISIONS ADR-039 decision 1; AI.md §3 job 11 row; ARCHITECTURE §6.4; DATA_MODEL §4.15; EVIDENCE-SOURCES §17 "Staged route selection"; PRODUCT_SPEC FR-17.1; CLINICAL-SAFETY §18 CS-38, §18a Phase 12; BUILD_PLAN Phase 12 task 3 | The same risk now comes in upstream through job 2's `conceptKey`: **E3-01 (HIGH)**. Family-history facts are also routed: **E3-02** |
| E2-02 Routes depend on the model | RESOLVED | ADR-039 decision 1; API_CATALOG §29 routing schema (`trigger`, backend rejects AUTOMATIC on CLINICIAN_REQUEST_ONLY); INTEGRATION-CONTRACTS IC-015; DATA_MODEL §4.15; CS-38 | `trigger` can be changed in configuration: E3-05 |
| E2-03 ADR-036 identifier classes not propagated | NOT RESOLVED (partial; now LOW) | Fixed: PRODUCT_SPEC FR-17.1; BUILD_PLAN Phase 11 Tests (new line); ADR-036 Consequences. Still contradictory: BUILD_PLAN Phase 11 task 1a ("identifier-free tests"), the Phase 11 Tests line "sanitizer: no rawName, transcript text or identifiers sent" (which now contradicts the new line in the same list), and the API_CATALOG §12 ("No identifiers in queries"), §13 and §14 ("No identifiers") privacy rows | Say "patient identifiers" in those four places |
| E2-04 Label-lookup gate / RxCUI origin | RESOLVED (decision) | ADR-039 decision 3; BUILD_PLAN Phase 11 task 4 and Tests; CLINICAL-SAFETY §12, §18a Phase 11 | Still open (LOW): DATA_MODEL §4.7 has no rule for how `rxcui` is set, no `responseValidated` on `normalizationCandidates`, and no stated storage for the RxNorm response. The CLINICAL-SAFETY §18 CS-11 "Expected" cell still says only "candidates shown; none auto-selected", so the gate exists only in §18a |
| E2-05 Cache vs visit bundle; recall refetch | RESOLVED | ADR-039 decision 4; EVIDENCE-SOURCES §16; DATA_MODEL §4.16 (`visitId`, `cachedFromEvidenceId`); ARCHITECTURE §6.4; BUILD_PLAN Phase 12 task 4a and Tests | — |
| E2-06 S17a cannot be met | RESOLVED (closed rules defined) | ADR-039 decision 5; EVIDENCE-SOURCES §8, §14 step 6; PRODUCT_SPEC FR-17.5 | Rule (b) is likely to fire on almost every multi-manufacturer drug: **E3-03** |
| E2-07 Job 16 source naming | RESOLVED | AI.md §5.1 rule 11; EVIDENCE-SOURCES §9 item 5; INTEGRATION-CONTRACTS IC-011; ADR-041 | EVIDENCE-SOURCES §10 "Tests" still says "synthesis output" only (cosmetic) |
| E2-08 PARTIAL-bundle candidates | RESOLVED | DATA_MODEL §4.14 (`evidenceStateAtGeneration`, `failedRoutes`); ADR-039 decision 6 | — |
| E2-09 Sanitizer over-blocking; rejection UX | NOT RESOLVED (partial; LOW) | Fixed: digits inside clinical terms are allowed, and a rejected query shows its reason (ARCHITECTURE §6.4; UI-UX Screen 12). Still open: "locations" stays on the reject list with no exemption for disease names that contain places ("Lyme disease", "West Nile virus", "Japanese encephalitis", "Rocky Mountain spotted fever"). Automatic concepts are now conceptKeys, so these facts would get no evidence at all | Restrict location rejection to the patient's own stored address values and to address patterns; add those terms as sanitizer tests |
| E2-10 BUILD_PLAN order; dedup winner | RESOLVED | BUILD_PLAN Phase 12 task 4; EVIDENCE-SOURCES §15 ("the record from the route's primary provider wins") | — |
| E2-11 NDC route; RxNorm label; NCI trials interface | RESOLVED | API_CATALOG §29 PRODUCT_IDENTIFICATION; EVIDENCE-SOURCES §4.1, §17 table; CLINICAL-SAFETY §12; UI-UX §2 label table and Screen 12; ARCHITECTURE §3.6 ClinicalTrialProvider | The API_CATALOG §19 "Production suitability" row still says RxNorm "records labeled 'U.S. regulatory information' (ADR-036)" |
| E2-12 CS-33 loophole | RESOLVED | CLINICAL-SAFETY §18 CS-33 part A; §18a Phase 12; AI.md §3 job 11 | — |
| E2-13 Stale references / gate wording | NOT RESOLVED (partial) | Fixed: PROJECT-STATUS (F-01…F-14 RESOLVED; OD statuses in the summary); INTEGRATION-CONTRACTS IC-018 cites ADR-036. Still open: EVIDENCE-SOURCES §17 R2 bracket, AI.md §3 "Execution order" and the job 12 header, and the ARCHITECTURE §6.4 "R2 boundary" line still say only "flag ON and the bundle is non-empty". They omit "evidence COMPLETED or PARTIAL", and they say "bundle" where DATA_MODEL §5.2 now says "**citable** bundle". A bundle holding only CLINICAL_TRIAL or PUBLIC_HEALTH records satisfies the weaker wording | Align all four to DATA_MODEL §5.2 |
| E2-14 Evidence staleness / SKIPPED re-entry / manual results | RESOLVED | ADR-039 decision 6; DATA_MODEL §4.14, §4.16 (`factsChangedSinceRetrieval`, `citable`), §5.2 clinician-only transitions; EVIDENCE-SOURCES §16; PRODUCT_SPEC FR-17.6; UI-UX Screen 12 | Wording residuals: E3-06 |

Totals: 11 RESOLVED, 3 NOT RESOLVED (E2-03, E2-09, E2-13; all partial, all now LOW).

### New findings (E3-xx)

**E3-01 — HIGH — Unstated conditions can still reach automatic evidence through job 2's `conceptKey`.**
- Files and sections: AI.md §3 job 2 (output includes `conceptKey`; the validators cover segment refs, numbers and negation only); DATA_MODEL §4.5 `conceptKey` row ("deterministic key … normalized symptom name"), §8.2 (the LLM emits it), §8.3 (promotion checks do not include `conceptKey`); ADR-039 decision 1 and AI.md §3 job 11 (concepts = the facts' conceptKeys); CLINICAL-SAFETY §18 CS-38 (it injects only into job 11); DATA_MODEL §3.2 rule 7 (AI_INFERENCE facts are allowed).
- Conflict:
  - Making job 11 deterministic moved trust onto `conceptKey`, but `conceptKey` is produced by the LLM in job 2, and nothing checks it.
  - An AI_INFERENCE fact (value "cough three weeks, night sweats, weight loss") can carry the conceptKey "tuberculosis" or "lung cancer". It is POSITIVE and PROVISIONAL, and it drives automatic retrieval before the clinician has reviewed anything.
  - If the key is in the cancer list, CANCER_INFO follows.
  - This is the same R2 leak onto the R1 screen as E2-01 with the flag OFF, and CS-38 does not catch it.
- Proposed fix:
  - (a) A job-2 promotion check (DATA_MODEL §8.3, AI.md §5.1 new rule): `conceptKey` must be a deterministic normalization of a span in the cited source segment(s), or, for MEDICATION, the normalized name or an RxCUI from RxNorm. Otherwise the item is rejected or gets conceptKey `UNMAPPED`, and no query is built from it.
  - (b) AI_EXTRACTED / AI_INFERENCE facts are excluded from automatic job-11 input until the clinician confirms them (the restrictive option).
  - (c) Extend CS-38 with a part B: a mock job-2 output whose conceptKey names an unstated condition produces no fact and no query.
- Proposed owner: chief-architect (ADR refining ADR-039); ai-clinical-engineer (validator); data-engineer (§8.3); clinical-safety-engineer (CS-38 part B, mandatory review).

**E3-02 — MEDIUM — Family-history facts drive patient-directed evidence, including CANCER_INFO.**
- Files and sections: EVIDENCE-SOURCES §4.12 ("never implies the patient has cancer"), §17 "Staged route selection" (keyed by "symptoms and conditions", with no FactCategory list; the CANCER_INFO rule has no category restriction); ADR-039 decision 1; DATA_MODEL §3.6 (HISTORY_FAMILY, HISTORY_SOCIAL); CS-38.
- Conflict:
  - A PATIENT_REPORTED POSITIVE HISTORY_FAMILY fact ("my mother had breast cancer", conceptKey "breast cancer") satisfies "a stated, current POSITIVE fact whose conceptKey is in the cancer concept list".
  - So the patient's evidence screen shows NCI cancer pages "Retrieved for: breast cancer (POSITIVE)", which implies the patient has cancer.
- Proposed fix:
  - The route table is keyed by FactCategory. HISTORY_FAMILY and HISTORY_SOCIAL produce no automatic queries; at most they could later get a clinician-requested search labeled "family history".
  - CANCER_INFO only from HISTORY_MEDICAL or ASSESSMENT facts.
  - "Retrieved for" shows the category.
  - Add a CS-38 family-history case.
- Proposed owner: evidence-research-engineer (route table); chief-architect (ADR-039 amendment); clinical-safety-engineer (CS-38 case).

**E3-03 — MEDIUM — Disagreement rule (b) will fire on nearly every multi-manufacturer drug, so the marker loses its meaning.**
- Files and sections: ADR-039 decision 5(b); EVIDENCE-SOURCES §14 step 6(b), §8; PRODUCT_SPEC FR-17.5; TESTING §13 S17a; BUILD_PLAN Phase 12 Completion criteria.
- Conflict:
  - Labels from different manufacturers (different SPL set IDs) that map to the same RxCUI routinely differ in the text of a same-named section: revision wording, inactive ingredients, formatting, how-supplied.
  - "Differs in text" has no normalization or comparison definition, so it would show "Sources differ — compare" for most drugs. A marker that is almost always present trains clinicians to ignore it.
  - Rule (b) also assumes several set IDs are fetched per RxCUI, but no task says how many labels MEDICATION_LABEL retrieves.
- Proposed fix (evidence recommendation):
  - Narrow (b) to structural differences that code can detect: one label has a Boxed Warning or a Contraindications section and the other does not, or the section headings in a fixed list differ.
  - Or drop (b) and keep (a) only.
  - Either way, state how many labels per RxCUI are retrieved (proposal: the most recent `updatedAt` per labeler, capped by §14 step 5).
  - S17a fixtures must include a "same text, different set IDs → no marker" negative case.
- Note: this is a provider-dependent detail. SPL section codes must be verified against the DailyMed documentation at Phase 11.
- Proposed owner: evidence-research-engineer; qa-test-engineer (S17a fixtures); clinical-safety-engineer (review).

**E3-04 — LOW — ADR-036 was edited in place instead of being superseded or amended by reference.**
- Files and sections: DECISIONS "Future Decisions" ("Supersede rather than edit accepted ADRs"); ADR-036 decision 7 (RxNorm wording changed) and Consequences (PRODUCT_SPEC FR-17.1 and BUILD_PLAN Phases 11–12 added, and "aligned" claimed while E2-03 residuals remain).
- Conflict:
  - The accepted ADR text changed with no amendment marker, so the decision history is lost.
  - ADR-036 Consequences claims alignment that is not yet true for BUILD_PLAN Phase 11.
- Proposed fix:
  - Add "Amended 2026-10-08 by ADR-039 (decision 7 wording, consequences)" to ADR-036, and list the amendment in ADR-039.
  - Correct the Consequences once E2-03 is fully fixed.
- Proposed owner: chief-architect.

**E3-05 — LOW — The clinician-only trigger can be changed in configuration, and there are two route tables.**
- Files and sections: API_CATALOG §29 ("Routing lives in backend configuration and can disable a provider without an app release"; `trigger` is a configuration field); INTEGRATION-CONTRACTS IC-015; EVIDENCE-SOURCES §17 and ADR-039 decision 1 (a "code-owned route table" on the device); ADR-036 decision 3.
- Conflict:
  - The safety rule "TRIALS, CHEMICAL and PUBLIC_HEALTH never automatic" is held in mutable backend configuration. A configuration change could set `trigger: AUTOMATIC` with no release, no ADR and no test run.
  - The device's code-owned route table and the backend routing configuration are two sources of truth, with no precedence stated.
- Proposed fix:
  - These three routes are CLINICIAN_REQUEST_ONLY as a code constant on both device and backend. Configuration may only restrict (disable, or narrow `scope`), never widen.
  - The device route table decides which routes are requested; backend configuration decides which providers serve them.
  - Add a test: configuration with `trigger: AUTOMATIC` on TRIALS is rejected at load.
- Proposed owner: backend-api-engineer (IC-015); evidence-research-engineer (§29).

**E3-06 — LOW — Wording inconsistencies introduced by the E2-14 fix.**
- Files and sections: DATA_MODEL §4.15 (the field list says `sourceFactIds`, but the text says `sourceFactVersionIds` records the versions used); DATA_MODEL §5.2 ("after a successful evidence **retry**", while the clinician action is named "Re-run evidence search", and a COMPLETED-but-empty run cannot be "retried" under the generic FAILED|PARTIAL retry); ARCHITECTURE §6.4 manual-search paragraph (still only "from a candidate", whereas ADR-039 decision 6 lets all manual results join the bundle); ARCHITECTURE §8 ("cloud stages queued for retry" versus "evidence never re-runs automatically").
- Proposed fix:
  - Use `sourceFactVersionIds` in the field list.
  - In §5.2, say "after an evidence retry or Re-run evidence search that leaves the citable bundle non-empty".
  - Extend ARCHITECTURE §6.4 to every CLINICIAN_MANUAL query.
  - In ARCHITECTURE §8, state that resuming a first run that never completed is not a re-run.
- Proposed owner: data-engineer (§4.15, §5.2); chief-architect (ARCHITECTURE).

## Files Changed

- docs/agent-handoffs/2026-10-08-stage-a-team2-evidence-recheck.md (new). No existing file was edited.

## Interfaces Changed

None changed. Proposed changes for the owners:
- IC-010: category in "Retrieved for" (E3-02); label-count rule (E3-03)
- IC-015: non-widenable `trigger` (E3-05)
- IC-018: location rule (E2-09 residual)
- the job-2 output contract (`conceptKey` grounding, E3-01; ai-clinical-engineer)

## Dependencies

- Relied on:
  - DECISIONS ADR-036, ADR-038, ADR-039, ADR-040, ADR-041 and ADR-042, plus the "Future Decisions" rule
  - EVIDENCE-SOURCES §1, §4.1, §4.12, §7–§10, §14–§17
  - API_CATALOG §12–§19, §29
  - ARCHITECTURE §3.5, §3.6, §6.4, §8
  - DATA_MODEL §3.2, §3.6, §4.5, §4.7, §4.14–§4.16, §5.2, §8.2, §8.3
  - AI.md §3 and §5.1
  - PRODUCT_SPEC FR-17.x and FR-21.6
  - BUILD_PLAN Phases 11–12
  - CLINICAL-SAFETY §12, §18 and §18a
  - INTEGRATION-CONTRACTS IC-011, IC-015, IC-018 and IC-019a
  - UI-UX §2 and Screen 12
  - PROJECT-STATUS
  - my run-2 handoff `docs/agent-handoffs/2026-10-08-stage-a-team2-evidence.md`
- Depends on this: the lead's run-2 synthesis and the Stage A close.

## Tests

none — documentation review task (0 tests)

## Evidence

- Verification table above (file and section for each E2 item).
- E3-01: AI.md §3 job 2 row and job 11 row; DATA_MODEL §4.5 `conceptKey` row, §8.2, §8.3 promotion checks 1–5 (none checks `conceptKey`); §3.2 rule 7; DECISIONS ADR-039 decision 1; CLINICAL-SAFETY §18 CS-38.
- E3-02: EVIDENCE-SOURCES §4.12, §17 "Staged route selection" bullets 2–3; DECISIONS ADR-039 decision 1 (CANCER_INFO condition); DATA_MODEL §3.6.
- E3-03: DECISIONS ADR-039 decision 5(b); EVIDENCE-SOURCES §8, §14 step 6; PRODUCT_SPEC FR-17.5; BUILD_PLAN Phase 12 Completion criteria; TESTING §13 S17.
- E3-04: DECISIONS "Future Decisions" line ("Supersede rather than edit accepted ADRs"); ADR-036 decision 7 and Consequences; BUILD_PLAN Phase 11 task 1a and Tests.
- E3-05: API_CATALOG §29 (routing text and schema); INTEGRATION-CONTRACTS IC-015; EVIDENCE-SOURCES §17; DECISIONS ADR-036 decision 3, ADR-039 decision 1.
- E3-06: DATA_MODEL §4.15 (field list vs paragraph), §5.2 clinician-only transitions; ARCHITECTURE §6.4 (manual-search paragraph), §8 ("Backend unavailable" row); DECISIONS ADR-039 decision 6.
- Working tree: the specs were reviewed as uncommitted modifications on `main` (head `63e1a19`), 2026-10-08T08:42Z UTC.

## Known Limitations

- This was a documentation-only review. No provider was verified (API_CATALOG §31 is still empty).
- E3-03 depends on how DailyMed exposes SPL sections and per-labeler set IDs, and E2-04 on how RxNorm distinguishes exact from approximate matches. Both must be verified against the official documentation at Phase 11.
- I did not re-review ADR-038, ADR-040 or ADR-042 beyond their evidence touchpoints.
- I did not exchange messages with other teammates during this re-check. The agreements recorded in the run-2 handoff still stand.

## Risks

- E3-01: the E2-01 harm (an unstated condition, including cancer information, appearing on the R1 evidence screen with R2 flags OFF) stays possible through job 2, and CS-38 passes anyway.
- E3-02: a family history of cancer shows the patient cancer information "retrieved for" them.
- E3-03: alert fatigue on the disagreement marker, or a Phase 12 completion that is met but means nothing.
- E3-05: the trial-automation ban can be lifted silently through configuration.

## Required Follow-up

1. E3-01 (HIGH): chief-architect writes an ADR refining ADR-039. ai-clinical-engineer and data-engineer add the `conceptKey` grounding check and the AI_INFERENCE exclusion. clinical-safety-engineer adds CS-38 part B and does the mandatory review.
2. E3-02 and E3-03 (MEDIUM): evidence-research-engineer, with clinical-safety-engineer reviewing. qa-test-engineer handles the S17a fixtures.
3. E2-03, E2-09 and E2-13 residuals, plus E3-04 to E3-06 (LOW): the lead can batch them into one edit (owners as listed).

## Receiving Agent

chief-architect (team-lead) — REVIEW REQUIRED: yes, by chief-architect. clinical-safety-engineer must review E3-01, E3-02 and E3-03 (mandatory safety review of evidence changes). backend-api-engineer must review E3-05.

## Next Action

chief-architect decides E3-01 (HIGH). The restrictive minimum is to exclude AI_INFERENCE facts from automatic job-11 input and add the `conceptKey` grounding check. That should happen before Stage A is closed.
