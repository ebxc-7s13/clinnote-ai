# Task Handoff

## Owner

evidence-research-engineer (teammate `evidence`, Stage A agent-team test, run 2)

## Task

Shared task #2 (Task B): Evidence architecture review, run 2. Question: "Review the reconciled ClinNote specifications and identify any remaining conflicts between product workflow, evidence retrieval, and clinical safety." Phase 0 (Stage A) documentation review. It checks the run-1 findings 1–12 against the corrected specs and looks for new conflicts, especially any introduced by ADR-034 and ADR-036.

## Status

COMPLETED

## What Changed

This was a documentation review only. I wrote no application code, called no external provider API and edited no spec. The lead is the single writer for Stage A (ADR-033). The only file created is this handoff.

### Run-1 verification

| Run-1 finding | Verdict | Evidence | Residual (new ID) |
|---|---|---|---|
| 1 Candidates after evidence failure (HIGH) | RESOLVED | DECISIONS ADR-034 decision 1. ARCHITECTURE §8 row "Evidence stage FAILED/SKIPPED, or empty bundle". DATA_MODEL §5.2 candidate precondition. PRODUCT_SPEC FR-18.7. TESTING §13a gating tests. CLINICAL-SAFETY §18 CS-37 | E2-13: EVIDENCE-SOURCES §17 and AI.md §3 state the gate without the evidenceState condition |
| 2 CS-16 does not cover job 16 | RESOLVED | CLINICAL-SAFETY §18 CS-16 row names job 16. AI.md §3 job 16 validators "(CS-16)". AI.md §5.1 validator 10. BUILD_PLAN Phase 13 task 4 and Tests | E2-07: validator 11 and EVIDENCE-SOURCES §9/§10 still cover synthesis/candidates only |
| 3 Identifier classes | NOT RESOLVED (partial) | Fixed in ADR-036 decision 1, ARCHITECTURE §6.4, API_CATALOG §2, PRIVACY §7 and DATA_MODEL §4.15. Still says "never identifiers" in PRODUCT_SPEC FR-17.1 (rank 2, which outranks the fixed docs), BUILD_PLAN Phase 11 task 1a and Tests, and API_CATALOG §12/§13/§14 privacy rows | E2-03 |
| 4 Disagreement test only in R2 phase | RESOLVED | TESTING §13 S17 split into S17a/S17b. BUILD_PLAN Phase 12 Tests and Completion (S17a). EVIDENCE-SOURCES §14 step 6. UI-UX Screen 12 | E2-06: S17a cannot be met as specified |
| 5 Three U.S.-label conditions | RESOLVED | ADR-036 decision 7. CLINICAL-SAFETY §12. EVIDENCE-SOURCES §4.1. BUILD_PLAN Phase 11 task 4. API_CATALOG §19 | E2-11: RxNorm labeling |
| 6 Automatic NCI trials | RESOLVED | ADR-036 decision 3. EVIDENCE-SOURCES §4.8, §4.12, §17. API_CATALOG §21, §25, §29. CLINICAL-SAFETY §12 | E2-02: no deterministic enforcement. E2-11: provider interface |
| 7 Rank/dedup/cap order | RESOLVED (residual) | ADR-036 decision 4. EVIDENCE-SOURCES §14 intro and step 5, §17. ARCHITECTURE §6.4 | E2-10: BUILD_PLAN Phase 12 task 4 still says "tier, dedup, rank, cap" |
| 8 Guideline group | RESOLVED | ADR-036 decision 5. EVIDENCE-SOURCES §2 last tier bullet, §14 step 3 | — |
| 9 Dedup vs cited versions | RESOLVED | EVIDENCE-SOURCES §15 (scope is one result set; cited versions kept), §16. DATA_MODEL §6 rule 8 | E2-06: the S17a example depends on versions that dedup removes |
| 10 Route names as source types | RESOLVED | ADR-036 decision 6. EVIDENCE-SOURCES §17 "selects routes" and the Route → EvidenceSourceType table | E2-11: NDC route missing in API_CATALOG §29 |
| 11 Sanitizer manual/autocomplete paths | RESOLVED (residual) | ADR-036 decision 2. ARCHITECTURE §6.4. API_CATALOG §2. DATA_MODEL §4.15. BUILD_PLAN Phase 12 task 3. UI-UX Screen 12 | E2-09: rejection UX unspecified. E2-13: IC-018 does not cite ADR-036 |
| 12 Stale references | NOT RESOLVED (2 of 3 parts fixed) | Fixed: API_CATALOG §3 item 6 and §19 now cite OD-011; TESTING §8 lists CS-16 and CS-16a separately. Open: PROJECT-STATUS "Open Findings" still lists F-01…F-14 as OPEN (the file is unmodified in the working tree) | E2-13 |

Summary: 10 RESOLVED (1, 2, 4, 5, 6, 7, 8, 9, 10, 11; residuals noted for 1, 2, 4, 5, 6, 7, 9, 10, 11) and 2 NOT RESOLVED, both partial (3, 12).

### New findings (run 2)

**E2-01 — HIGH — Job 11 can introduce unstated conditions, which puts patient-specific suggestions on the R1 evidence screen while the flag is OFF.**
- Files and sections: AI.md §3 job 11 and §5.1 (validator 1); EVIDENCE-SOURCES §4.12 and §17 (staged route selection); DECISIONS ADR-025 tier table (R1 vs R2) and ADR-023 "Why evidence comes before candidates" (ARCHITECTURE §6.4); CLINICAL-SAFETY §18 CS-18 and CS-37; UI-UX Screen 12.
- Conflict:
  - Job 11 is an LLM job. Its only validators are "concepts only" plus the sanitizer. Validator 1 checks that the sourceFactIds exist, but nothing checks that a concept term comes from its source fact.
  - So a symptom cluster (synthetic: cough 3 weeks, weight loss, night sweats) can produce the concepts "lung cancer" or "tuberculosis". Those trigger automatic literature and NCI CANCER_INFO cards for this patient.
  - That is a condition suggestion for a specific patient (ADR-025 R2) on the R1 screen, with `possibilitiesEnabled` OFF. It also breaks EVIDENCE-SOURCES §4.12 ("never implies the patient has cancer").
  - It brings back the hypothesis-driven retrieval that ADR-023 removed.
  - CS-37 checks only jobs 12/13 and ClinicalCandidate. CS-18 checks only assessments and note wording, so no test catches this.
  - Separately, UNKNOWN (hedged) facts also drive automatic retrieval (ADR-034 decision 4), and the cards do not show which concept, or which informationState, a record was retrieved for.
- Proposed fix (ADR, refining ADR-023/ADR-034):
  - (a) a deterministic job-11 grounding validator: every concept term equals, or deterministically normalizes from, its source fact's conceptKey/value; no new condition terms
  - (b) routes are chosen by code from the fact category (see E2-02)
  - (c) CANCER_INFO only when a stated POSITIVE/UNKNOWN fact is itself cancer-related
  - (d) a new CS row, CS-38, Phase 12 (agreed with `safety`): symptom-only and symptom-cluster transcripts → no query concept naming an unstated condition, and no CANCER_INFO route
  - (e) every automatic evidence card shows "Retrieved for: <concept> (<informationState>)", with UNKNOWN shown as "uncertain". CLINICIAN_MANUAL cards show "Clinician search" (agreed with `safety`)
  - Preferred over (a): concept selection is deterministic code from conceptKey, with the LLM used for phrasing only (agreed with `safety`)
- Proposed owner: chief-architect (ADR); ai-clinical-engineer (validator); evidence-research-engineer (route rules, card field in IC-010); clinical-safety-engineer (CS row, mandatory review); product-clinical-architect (FR-17.x wording).

**E2-02 — MEDIUM — "No automatic trials" and the "clinician request only" routes depend on model output.**
- Files and sections: EVIDENCE-SOURCES §17 ("Job 11 selects routes"); AI.md §3 job 11 output ("concept queries per provider route"); ADR-036 decision 3; API_CATALOG §21, §29; BUILD_PLAN Phase 12 task 3 and Tests.
- Conflict:
  - ADR-036 requires that TRIALS, CHEMICAL and PUBLIC_HEALTH never run automatically. But the route is part of job 11's model output.
  - No validator rejects these routes in AUTOMATIC queries, and no Phase 12 test checks it.
  - The model also decides what counts as "cancer-related" (CANCER_INFO).
- Proposed fix:
  - Route selection moves to a deterministic code table: FactCategory plus normalized concept → allowed routes.
  - The backend and the device reject any AUTOMATIC EvidenceQuery whose route is TRIALS, CHEMICAL or PUBLIC_HEALTH (origin check).
  - Add a Phase 12 test: a mock job-11 output requesting TRIALS → rejected, and zero ClinicalTrialProvider ProviderExecutions.
- Proposed owner: evidence-research-engineer (routing rules); backend-api-engineer (origin check); qa-test-engineer (test).

**E2-03 — MEDIUM — ADR-036 identifier classes did not reach PRODUCT_SPEC or BUILD_PLAN Phase 11.**
- Files and sections: PRODUCT_SPEC FR-17.1 ("never identifiers"); BUILD_PLAN Phase 11 task 1a ("identifier-free tests") and Tests ("no rawName, transcript text or identifiers sent"); API_CATALOG §12, §13 and §14 privacy rows ("No identifiers"); ADR-036 Consequences (omits PRODUCT_SPEC).
- Conflict:
  - PRODUCT_SPEC ranks 2nd, above ARCHITECTURE (4th) and API_CATALOG (6th). Read literally, FR-17.1 forbids the RxCUI/set ID label lookup that ARCHITECTURE §6.4 and BUILD_PLAN Phase 11 task 4 require.
  - The Phase 11 test as written would fail a correct implementation.
- Proposed fix:
  - FR-17.1 becomes "never patient identifiers, transcript text or raw medication wording; public product/record identifiers only as typed fields per ADR-036".
  - The BUILD_PLAN Phase 11 wording becomes "no patient identifiers; public identifiers only as typed fields from validated responses".
  - The API_CATALOG §12–§14 rows become "No patient identifiers".
  - Add PRODUCT_SPEC and BUILD_PLAN to ADR-036 Consequences.
- Proposed owner: product-clinical-architect (FR-17.1); chief-architect (BUILD_PLAN, ADR text); evidence-research-engineer (API_CATALOG).

**E2-04 — MEDIUM — The RxCUI used for a label lookup has an undefined origin and an undefined selection gate.**
- Files and sections: ADR-036 decision 1 ("values came from a stored, validated provider response"); EVIDENCE-SOURCES §17 route table (MEDICATION_STANDARD "not shown as evidence"); DATA_MODEL §4.7 (`rxcui`, `normalizationCandidates`, no `responseValidated`), §4.15 `productIdentifiers`, §7.4; BUILD_PLAN Phase 11 tasks 3–4; PRODUCT_SPEC FR-11.2; CLINICAL-SAFETY §11, CS-11; UI-UX Screen 13.
- Conflict:
  - It is not stated whether the RxNorm response is stored as an EvidenceSource. If it is not, its RxCUI fails ADR-036's "stored, validated" condition.
  - Phase 11 task 4 does not say whether the label lookup waits for the clinician to select an RxCUI when normalization is ambiguous.
  - "Ambiguous" is not defined for RxNorm approximate matches, so a single approximate (sound-alike) match could be auto-used. The result is a DailyMed label for the wrong drug, contrary to FR-11.2 and CS-11.
- Proposed fix:
  - A label lookup runs only when `Medication.rxcui` was set either by a single exact match in a schema-validated RxNorm response, or by clinician selection.
  - Approximate-only or multiple matches mean no label lookup until the clinician selects.
  - Record the RxNorm response as a hidden TERMINOLOGY EvidenceSource, or add `responseValidated` to `normalizationCandidates`.
  - Extend CS-11: no label EvidenceSource exists for an unselected candidate.
- Proposed owner: evidence-research-engineer (IC-010, MedicationProvider rules); data-engineer (DATA_MODEL §4.7); clinical-safety-engineer (CS-11 review).

**E2-05 — MEDIUM — It is undefined how a cache hit links to the visit's bundle, and there is no refresh rule for automatic retrieval.**
- Files and sections: EVIDENCE-SOURCES §16 (cache keyed by provider and sanitized query, across visits); DATA_MODEL §4.16 (one `queryId` per EvidenceSource), §4.14, §6 rule 8 (candidate evidence IDs must belong to the same visit's bundle); EVIDENCE-SOURCES §7 (stale marking only).
- Conflict:
  - A cache hit returns a record whose `queryId` points to an earlier visit, possibly of another patient. Then one of two things happens:
    - rule 8 rejects every candidate that cites it, or
    - the bundle links to another patient's EvidenceQuery and its `sourceFactIds`. That is a wrong-patient display risk in "why did this appear", on the same device.
  - Also, nothing says whether automatic retrieval may use a cached REGULATORY_SAFETY result (recalls, shortages) instead of fetching again. A new recall could go unseen; the card is only marked "may be outdated".
- Proposed fix:
  - A cache hit creates a visit-scoped record (a copy with `cachedFromEvidenceId` and the original `retrievedAt`, or a join entity EvidenceQueryResult). It never exposes another visit's query or facts.
  - REGULATORY_SAFETY is always fetched again on automatic runs, and other regulatory records older than 30 days are fetched again automatically.
  - Tests: a cross-patient cache hit exposes no foreign `sourceFactIds`; candidate validation accepts cached records linked to the current visit.
- Proposed owner: evidence-research-engineer (§16); data-engineer (DATA_MODEL §4.16); security-privacy-engineer (review).

**E2-06 — MEDIUM — The S17a deterministic disagreement marker cannot be met as specified.**
- Files and sections: EVIDENCE-SOURCES §8, §14 step 6, §15; PRODUCT_SPEC FR-17.5; TESTING §13 S17; BUILD_PLAN Phase 12 Completion criteria (S17a must pass).
- Conflict:
  - The main example in §14 step 6, "two label versions with different section content", cannot happen, because §15 keeps only the latest version of a set ID within a result set.
  - "Conflicting statements that code can detect" is undefined. Labels from different manufacturers (different set IDs) almost always differ in text, so a text-difference rule would fire on nearly every drug.
  - Literature conflicts ("conflicting studies", §8) cannot be detected deterministically in R1.
  - So a Phase 12 completion criterion has no testable definition.
- Proposed fix:
  - Replace step 6 with a closed rule list:
    - (i) an enforcement/recall or shortage record exists for a product whose current label is shown → "Safety communication — compare"
    - (ii) the deduplicated set ID had a newer version than one cited in a candidate or note → "Newer version available"
    - (iii) the same RxCUI maps to labels with different `updatedAt` from DailyMed vs openFDA → "Sources differ — compare"
  - For literature, R1 shows both records with dates and makes no disagreement claim.
  - Amend FR-17.5 and S17a to match.
- Proposed owner: evidence-research-engineer (§8, §14); qa-test-engineer (S17a); product-clinical-architect (FR-17.5); clinical-safety-engineer (review).

**E2-07 — LOW — The job 16 "names a non-bundle source" check has no validator.**
- Files and sections: CLINICAL-SAFETY §18 CS-16 (includes job 16 and "naming a source/guideline that is not a bundle record"); AI.md §5.1 validator 11 (candidate and synthesis only); EVIDENCE-SOURCES §9 item 5 and §10 ("synthesis" only); INTEGRATION-CONTRACTS IC-011 ("Evidence synthesis citation contract").
- Conflict: CS-16 expects job 16 output to be rejected when it names a source that is not in the bundle, but no validator is specified for that.
- Proposed fix:
  - Validator 11 covers jobs 12, 13 and 16.
  - EVIDENCE-SOURCES §9 and §10 say "any AI output that references evidence".
  - Rename IC-011 to "AI citation contract (jobs 12, 13, 16)".
- Proposed owner: ai-clinical-engineer; evidence-research-engineer (§9/§10, IC-011).

**E2-08 — LOW — Candidates generated from a PARTIAL bundle do not show that evidence was incomplete.**
- Files and sections: ADR-034 decision 1 (PARTIAL allowed); DATA_MODEL §4.14 (no record of evidence completeness); ARCHITECTURE §8 ("failed provider marked" on the evidence screen only).
- Conflict: For example, a possibility generated after DailyMed failed looks the same as one generated with complete evidence.
- Proposed fix:
  - The candidate records `evidenceStateAtGeneration` and the failed routes.
  - The UI shows "Generated with incomplete evidence: <routes> failed" (R2, flag ON only).
- Proposed owner: data-engineer; ux-accessibility-engineer; clinical-safety-engineer (review).

**E2-09 — LOW — The sanitizer rules would reject legitimate concept terms, and rejection UX is unspecified.**
- Files and sections: ARCHITECTURE §6.4 sanitizer ("rejects … dates, locations … untyped digit sequences"); INTEGRATION-CONTRACTS IC-018; UI-UX Screen 12 (manual search).
- Conflict:
  - The digit rule would reject terms such as "type 2 diabetes", "COVID-19", "vitamin B12" and "HbA1c".
  - The location rule would reject "Lyme disease", "West Nile virus" and "Japanese encephalitis".
  - Implementers would then weaken the sanitizer ad hoc. Nothing says what the clinician sees when a manual search is rejected.
- Proposed fix:
  - Define identifier rejection by patterns, plus the patient's own stored values (name, reference, DOB) matched on the device.
  - Digits are allowed inside a term that matches the fact conceptKey or a terminology response.
  - A rejection shows the reason ("query contains patient-identifying content").
  - Add sanitizer tests for each of the terms above.
- Proposed owner: evidence-research-engineer and security-privacy-engineer (IC-018).

**E2-10 — LOW — The processing order is still inconsistent in BUILD_PLAN, and the deduplication winner is undefined.**
- Files and sections: BUILD_PLAN Phase 12 task 4 ("Per-record tier assignment, deduplication, deterministic ranking and the per-group cap, in that order"), compared with ADR-036 decision 4, EVIDENCE-SOURCES §14 and §17, and ARCHITECTURE §6.4 (dedup before tier). Also EVIDENCE-SOURCES §15 ("One EvidenceSource is kept per item").
- Conflict:
  - BUILD_PLAN puts tier assignment before deduplication; the other documents put deduplication first.
  - §15 does not say which provider's record survives a PubMed/Europe PMC duplicate, so the result is not deterministic.
- Proposed fix:
  - Reorder BUILD_PLAN Phase 12 task 4 to validate → dedup → tier/group → rank → cap.
  - Add to §15: the primary-route record is kept (PubMed over Europe PMC; DailyMed over openFDA label), and the others go to `alternateIdentifiers`.
- Proposed owner: chief-architect (BUILD_PLAN); evidence-research-engineer (§15).

**E2-11 — LOW — Routing, interface and labeling are inconsistent.**
- Files and sections: API_CATALOG §29 (REGULATORY_SOURCE = "openFDA / Drugs@FDA", no NDC, while §29 claims "Every provider … has a route"); EVIDENCE-SOURCES §17 table (REGULATORY_SOURCE includes NDC; MEDICATION_STANDARD "not shown as evidence"); EVIDENCE-SOURCES §4.1, CLINICAL-SAFETY §12 and UI-UX Screen 12 ("every … RxNorm card/record" labeled "U.S. regulatory information"); ARCHITECTURE §3.6 (ClinicalTrialProvider = ClinicalTrials.gov only; NCI only under HealthInformationProvider).
- Conflict:
  - NDC has no route in API_CATALOG §29.
  - RxNorm has no evidence card to label. It is terminology, so calling it "regulatory" contradicts EVIDENCE-SOURCES §1 and the CLINICAL-SAFETY §12 principle that regulatory information is labeled as regulatory.
  - NCI trial records have no trial-provider interface.
- Proposed fix:
  - Add NDC to §29 REGULATORY_SOURCE.
  - Label RxNorm-derived displays (Screen 13) as "U.S. drug terminology (RxNorm)".
  - Add NCI trials to ClinicalTrialProvider.
- Proposed owner: evidence-research-engineer (API_CATALOG, EVIDENCE-SOURCES); chief-architect (ARCHITECTURE §3.6); clinical-safety-engineer (§12 wording).

**E2-12 — LOW — CS-33 accepts behavior that ADR-034 forbids.**
- Files and sections: CLINICAL-SAFETY §18 CS-33 ("job-11 concepts carry NEGATIVE facts' state **or** exclude them"); ADR-034 decision 4, AI.md §3 job 11 input, DATA_MODEL §4.15 (automatic job 11 uses POSITIVE or UNKNOWN facts only).
- Conflict: CS-33 would pass an implementation that sends NEGATIVE facts to job 11, which the input rule excludes.
- Proposed fix (AGREED with `safety`, S2-15): in the CS-33 job-11 half (Phase 12), NEGATIVE, NOT_DISCUSSED, REJECTED, superseded and OPEN-conflict facts are excluded from automatic job-11 input, and a mock concept whose sourceFactIds include such a fact is rejected. The job-12 half (Phase 13) is unchanged.
- Proposed owner: clinical-safety-engineer.

**E2-13 — LOW — Stale references and incomplete gate wording.**
- Files and sections: PROJECT-STATUS "Open Findings" (F-01…F-14 still OPEN) and "Current Blockers" (OD-003, OD-004, OD-005 and OD-009 listed as future decisions, but ADR-025/ADR-030/ADR-031/ADR-032 resolve them); INTEGRATION-CONTRACTS IC-018 sources (ADR-028 and F-03, no ADR-036); EVIDENCE-SOURCES §17 R2 bracket and AI.md §3 execution order and job 12 header ("flag ON and bundle non-empty" without "evidence COMPLETED or PARTIAL", which ADR-034 decision 1 and DATA_MODEL §5.2 require).
- Proposed fix: Refresh PROJECT-STATUS at Stage A close; add ADR-036 to IC-018; add the evidenceState condition to the two gate statements.
- Proposed owner: chief-architect (PROJECT-STATUS, IC-018); evidence-research-engineer (EVIDENCE-SOURCES §17); ai-clinical-engineer (AI.md §3).

**E2-14 — MEDIUM — Evidence goes stale after fact review, a SKIPPED candidate stage has no re-entry, and the citability of manual results is unclear (raised jointly with `product`).**
- Files and sections: DATA_MODEL §4.15 (EvidenceQuery.sourceFactIds, used by no rule), §4.14, §5.2 (evidence re-runs only FAILED|PARTIAL → retry; the candidate stage only COMPLETED → IN_PROGRESS); ADR-034 decisions 1 and 5; ARCHITECTURE §6.4 (manual search "from a candidate" only); PRODUCT_SPEC FR-17.2; EVIDENCE-SOURCES §7, §16; CLINICAL-SAFETY §3; EVIDENCE-SOURCES §4.11.
- Conflict:
  - Automatic retrieval uses PROVISIONAL facts before review. After the clinician edits or rejects a fact, the bundle still reflects the old concepts, and nothing marks it.
  - A candidate stage SKIPPED for failed or empty evidence can never be re-entered after a successful retry.
  - Manual searches without a candidate have no defined citability. If every manual result joined the citable bundle, clinician-requested trial or WHO records could be cited next to a patient-specific possibility.
- Proposed fix (AGREED with `product`, see Messages; (c) wording per evidence):
  - (a) evidence never re-runs automatically
  - (b) a clinician action "Re-run evidence search", named differently from the per-record §16 "refresh", re-runs job 11 on current facts through the sanitizer, keeping cited records
  - (c) when ANY of a query's sourceFactIds is edited, rejected, superseded or resolved away, code marks the records "Based on facts that changed since retrieval". Records whose query source facts are ALL rejected or resolved away leave the job-12 citable bundle, and Regenerate offers to re-run evidence first
  - (d) `candidateState SKIPPED --clinician generate--> IN_PROGRESS`, flag ON only, with ADR-034 decision 1 preconditions re-checked. A manual search alone does not unlock it; the evidence stage itself must reach COMPLETED or PARTIAL
  - (e) every CLINICIAN_MANUAL result joins the visit bundle and is citable only on clinician-triggered generation, except CLINICAL_TRIAL and PUBLIC_HEALTH records, which are never citable by jobs 12/13
- Proposed owner: chief-architect (ADR refining ADR-034); data-engineer (§4.15, §5.2); product-clinical-architect (FR-17.x, FR-18.x); evidence-research-engineer (§16 naming, the citable-bundle rule); clinical-safety-engineer (review).

## Files Changed

- docs/agent-handoffs/2026-10-08-stage-a-team2-evidence.md (this handoff; new). No other file was edited.

## Interfaces Changed

None changed. Proposed changes for the owners:
- IC-010: card field "retrieved for concept/state" (E2-01); a visit-scoped cache link (E2-05); RxNorm response recording (E2-04)
- IC-011: scope widened to jobs 12, 13 and 16 (E2-07)
- IC-018: deterministic route origin check (E2-02); pattern-based identifier rules and rejection UX (E2-09); ADR-036 reference (E2-13)

## Dependencies

- Relied on: CLAUDE.md; DECISIONS ADR-023, ADR-025, ADR-028, ADR-029, ADR-033–ADR-037, OD-001–OD-011; EVIDENCE-SOURCES (all); API_CATALOG §1–§3, §12–§26, §29–§31; ARCHITECTURE §3.5, §3.6, §5, §6.4, §6.5, §7, §8; AI.md §3, §5, §5.1, §7, §15; PRIVACY §2, §6, §7; DATA_MODEL §3, §4.2, §4.7, §4.14–§4.16, §4.20, §5.2, §6, §7.4; CLINICAL-SAFETY §3, §11, §12, §18; BUILD_PLAN Phases 11–14; PRODUCT_SPEC §6, Features 11, 17–21; TESTING §8, §13, §13a; UI-UX Screens 11–13; INTEGRATION-CONTRACTS; PROJECT-STATUS; run-1 handoff `docs/agent-handoffs/2026-10-08-stage-a-team-evidence.md`.
- Depends on this: the lead's run-2 synthesis (`docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md`, referenced by ADR-033).

## Tests

none — documentation review task (0 tests)

## Evidence

- Run-1 verification: see the table in "What Changed". Each row cites file and section.
- E2-01: AI.md §3 job 11 row, §5.1 validator 1; EVIDENCE-SOURCES §4.12, §17 "Staged route selection"; DECISIONS ADR-025 tier table, ADR-023 Decision; ARCHITECTURE §6.4 "Why evidence comes before candidates"; CLINICAL-SAFETY §18 CS-18, CS-37; UI-UX Screen 12 primary elements.
- E2-02: EVIDENCE-SOURCES §17; AI.md §3 job 11 Output column; DECISIONS ADR-036 decision 3; API_CATALOG §21, §29; BUILD_PLAN Phase 12 task 3 and Tests.
- E2-03: PRODUCT_SPEC FR-17.1; BUILD_PLAN Phase 11 task 1a and Tests; API_CATALOG §12, §13, §14 "Privacy considerations" rows; DECISIONS ADR-036 Consequences; CLAUDE.md §2 authority order.
- E2-04: DECISIONS ADR-036 decision 1; EVIDENCE-SOURCES §17 route table; DATA_MODEL §4.7, §4.15, §7.4; BUILD_PLAN Phase 11 tasks 3–4; PRODUCT_SPEC FR-11.2; CLINICAL-SAFETY §11, §18 CS-11; UI-UX Screen 13.
- E2-05: EVIDENCE-SOURCES §7, §16; DATA_MODEL §4.14, §4.16, §6 rule 8.
- E2-06: EVIDENCE-SOURCES §8, §14 step 6, §15; PRODUCT_SPEC FR-17.5; TESTING §13 S17; BUILD_PLAN Phase 12 Completion criteria.
- E2-07: CLINICAL-SAFETY §18 CS-16; AI.md §5.1 validators 10–11; EVIDENCE-SOURCES §9 item 5, §10; INTEGRATION-CONTRACTS IC-011.
- E2-08: DECISIONS ADR-034 decision 1; DATA_MODEL §4.14; ARCHITECTURE §8.
- E2-09: ARCHITECTURE §6.4 sanitizer block; INTEGRATION-CONTRACTS IC-018; UI-UX Screen 12.
- E2-10: BUILD_PLAN Phase 12 task 4; DECISIONS ADR-036 decision 4; EVIDENCE-SOURCES §14, §15, §17; ARCHITECTURE §6.4.
- E2-11: API_CATALOG §29; EVIDENCE-SOURCES §1, §4.1, §17; CLINICAL-SAFETY §12; UI-UX Screens 12–13; ARCHITECTURE §3.6.
- E2-12: CLINICAL-SAFETY §18 CS-33; DECISIONS ADR-034 decision 4; AI.md §3 job 11; DATA_MODEL §4.15.
- E2-14: DATA_MODEL §4.14, §4.15, §5.2; DECISIONS ADR-034 decisions 1 and 5; ARCHITECTURE §6.4 (manual-search paragraph); PRODUCT_SPEC FR-17.2; EVIDENCE-SOURCES §4.11, §7, §16; CLINICAL-SAFETY §3; product's [STAGE-A2-MSG].
- E2-13: PROJECT-STATUS "Open Findings" and "Current Blockers"; INTEGRATION-CONTRACTS IC-018; EVIDENCE-SOURCES §17 pipeline block; AI.md §3 execution order and job 12 row; DATA_MODEL §5.2.
- Working tree state: the specs were reviewed as uncommitted modifications on `main` (head `63e1a19`). PROJECT-STATUS.md is not modified in the working tree.

## Known Limitations

- This was a documentation-only review. No provider was verified (API_CATALOG §31 is still empty), and none of the findings rests on provider behavior. E2-04 (RxNorm approximate-match behavior) and E2-06 (label version fields) must be confirmed against official documentation at Phase 11.
- SECURITY, DEPLOYMENT, GOOGLE-PLAY and SPEECH were not reviewed.
- Shared task #2 could not be claimed or completed with TaskUpdate: the Task tools were not available in this teammate session (ADR-037 says they are inherited from the lead session; here they were not). The lead set task #2 to in_progress, owner evidence, on my behalf and will mark it completed.

## Risks

- E2-01: possibilities-like condition suggestions, including cancer information, reach real users in an R1 release with no R2 assessment and no test catching it.
- E2-04: a label for the wrong drug is displayed after an approximate RxNorm match.
- E2-05: a wrong-patient linkage in evidence provenance, or an unseen new recall from a cached safety result.
- E2-03: a literal reading of PRODUCT_SPEC blocks the medication label flow, or invites an ad hoc relaxation.
- E2-06: Phase 12 cannot complete, or S17a is satisfied by a meaningless marker.

## Required Follow-up

1. E2-01 (HIGH): chief-architect writes an ADR. ai-clinical-engineer adds the grounding validator. clinical-safety-engineer adds CS-38 and does the mandatory review. evidence-research-engineer adds the card "retrieved for" field (IC-010).
2. E2-02: evidence-research-engineer (deterministic routing table) with backend-api-engineer (AUTOMATIC origin check); qa-test-engineer writes the test.
3. E2-03: product-clinical-architect (FR-17.1); chief-architect (BUILD_PLAN Phase 11, ADR-036 Consequences); evidence-research-engineer (API_CATALOG §12–§14).
4. E2-04: evidence-research-engineer and data-engineer; clinical-safety-engineer reviews CS-11.
5. E2-05: evidence-research-engineer and data-engineer; security-privacy-engineer reviews.
6. E2-06: evidence-research-engineer, qa-test-engineer, product-clinical-architect; clinical-safety-engineer reviews.
7. E2-14: chief-architect (ADR refining ADR-034) with data-engineer, product-clinical-architect and evidence-research-engineer; clinical-safety-engineer reviews.
8. E2-07 to E2-13 (LOW): owners as listed per finding. They can be batched into one reconciliation edit by the lead.

## Messages

| Direction | Counterpart | First line | UTC time |
|---|---|---|---|
| sent | safety (clinical-safety-engineer) | `[STAGE-A2-MSG] Evidence safety: AI job 11 can introduce conditions nobody stated into evidence queries, which leaks R2-like output onto the R1 evidence screen while the possibilities flag is OFF.` | 2026-10-08T08:26Z |
| received | product (product-clinical-architect) | `[STAGE-A2-MSG] Clinician-workflow question: once the clinician reviews facts, the evidence bundle can go stale, and a SKIPPED candidate stage has no way back in.` | ~2026-10-08T08:30Z |
| sent | product (reply) | `[STAGE-A2-MSG] Reply on bundle staleness and SKIPPED re-entry: I agree with (a)–(d) with refinements, and with (e) in part. Details below.` | ~2026-10-08T08:32Z |
| received | team-lead | task_assignment for task #2, plus a note that teammates lack the Task tools and the lead updates task status | 2026-10-08T08:25Z |
| received | safety | `[STAGE-A2-MSG] safety -> evidence: Agreed, this is HIGH, and it should be a new CS row rather than an extension of CS-37 or CS-18.` | ~2026-10-08T08:35Z |
| received | product | `[STAGE-A2-MSG] RE: bundle staleness and SKIPPED re-entry — product accepts your shared position in full. Record it as AGREED.` | ~2026-10-08T08:35Z |
| sent | product | `[STAGE-A2-MSG] Confirmed: E2-14 / P2-04 is recorded as AGREED, with one wording correction to (c) before the lead copies the text.` | ~2026-10-08T08:37Z |
| sent | safety | `[STAGE-A2-MSG] evidence -> safety: Agreed on all points. I'm recording E2-01 = S2-14 as HIGH, AGREED, with proposed row CS-38 in Phase 12.` | ~2026-10-08T08:37Z |
| received | product | `[STAGE-A2-MSG] RE: (c) wording — accepted. Citable-bundle removal only when ALL source facts are REJECTED or resolved away.` | ~2026-10-08T08:40Z |
| received | safety | `[STAGE-A2-MSG] safety -> evidence: Agreed on E2-12. The "carry state OR exclude" in CS-33 is a loophole, and the job-11 half should match ADR-034 decision 4 and AI.md job 11.` | ~2026-10-08T08:43Z |

Agreement record:
- **E2-01 with `safety`: AGREED (HIGH).** Safety records it as S2-14.
  - It becomes a new CS row, CS-38 "No unstated condition in evidence queries" (Phase 12; corpus area "possibility containment (R2)"), not an extension of CS-37 or CS-18.
  - Both prefer deterministic concept selection from conceptKey, with the LLM limited to phrasing. If job 11 stays an LLM job, the grounding validator is mandatory.
  - Routes come from code by fact category.
  - Cards show "Retrieved for: <concept> (<informationState>)", or "Clinician search" for CLINICIAN_MANUAL results.
- **E2-12 with `safety`: AGREED (LOW).** Safety records it as S2-15.
  - New CS-33 expected result, job-11 half (Phase 12): NEGATIVE, NOT_DISCUSSED, REJECTED, superseded and OPEN-conflict facts are excluded from automatic job-11 input, and a mock concept whose sourceFactIds include such a fact is rejected.
  - The job-12 half (Phase 13) is unchanged.
- **E2-14 with `product`: AGREED.** Product records it as P2-04 and owns the FR-17.2, FR-18.7 and FR-18.8 text.
  - The wording of (c) is settled, and product accepted it:
    - The marker triggers when ANY source fact is edited, rejected, superseded or resolved away.
    - Records are removed from the citable bundle only when ALL source facts are REJECTED or resolved away. Records behind edited facts stay citable, with the marker.
    - Product's P2-04 carries the same text, including the "Clinician search" card label.
- **Disagreements:** none.

## Receiving Agent

chief-architect (team-lead) — REVIEW REQUIRED: yes, by chief-architect (run-2 synthesis). clinical-safety-engineer must review E2-01, E2-04, E2-06 and E2-12 (mandatory safety review of evidence changes). security-privacy-engineer must review E2-05 and E2-09.

## Next Action

chief-architect triages E2-01 (HIGH) into an ADR in the run-2 synthesis. In the meantime, evidence replies to any `[STAGE-A2-MSG]` from product or safety and updates the Messages section.
