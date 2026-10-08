# Task Handoff

## Owner

evidence-research-engineer (teammate `evidence`, Stage A agent-team test)

## Task

Task #2 (Task B): Evidence architecture review. Question: "Review the reconciled ClinNote specifications and identify any remaining conflicts between product workflow, evidence retrieval, and clinical safety." This is a Phase 0 (Stage A) documentation review.

## Status

COMPLETED

## What Changed

This is a documentation review only. No spec was edited, no code was written, no external API was called, and nothing was committed.

I checked the reconciled evidence architecture against the Stage A ADRs: ADR-023 (evidence before possibilities), ADR-025 (R2 flag), ADR-028 (ranking/dedup/cache) and ADR-029 (no images).

Resolved, with no remaining conflict found:
- F-01: canonical order. PRODUCT_SPEC §6, ARCHITECTURE §6.4, AI.md §3, EVIDENCE-SOURCES §17 and BUILD_PLAN 11–13 agree.
- F-02: Phase 11 labels are displayed only after the 1a validation.
- F-03: RxNorm sends a sanitized term only.
- F-13: tiers per record, deterministic ranking, on-device cache, complete routing table.

Remaining conflicts:

1. **HIGH: candidate generation after evidence failure.**
   - ARCHITECTURE §8 (row "Evidence stage FAILED/SKIPPED") says "candidate generation still runs on facts alone".
   - This contradicts DATA_MODEL §5.2, where a stage starts only after the previous one is COMPLETED, PARTIAL or SKIPPED (FAILED is excluded).
   - It also contradicts ADR-023's grounding rationale (ARCHITECTURE §6.4 "Why evidence comes before candidates"), the AI.md §3 job 12 input (facts + validated bundle) and PRODUCT_SPEC FR-18.5.
   - DATA_MODEL §5.2 itself still lets the candidate stage start when evidence is SKIPPED, which means ungrounded possibilities.
2. **MEDIUM-HIGH: CS-16 does not cover AI job 16.**
   - AI.md §3 job 16 "cites sources by ID". It is built in BUILD_PLAN Phase 13 task 4 and is not behind `possibilitiesEnabled`.
   - CLINICAL-SAFETY §18 CS-16 covers "synthesis or candidate output" only, and AI.md §5.1 validator 10 names candidates and synthesis only.
   - So the only releasable AI text that cites evidence has no named fabricated-citation test. ADR-024/Gate 6 require only the "applicable" CS tests.
3. **MEDIUM: the sanitizer forbids identifiers that the medication flow needs.**
   - ARCHITECTURE §6.4 says the sanitizer rejects "digit sequences resembling identifiers". API_CATALOG §2 says "identifiers are never sent", and PRIVACY §7 (data-sent table) says "any identifier" is not sent.
   - But API_CATALOG §14 (openFDA: "drug names / identifiers"), §15 (application numbers), §16 (NDC codes) and §18 (DailyMed: "RxCUI / set IDs") must send public product identifiers. The RxNorm → DailyMed flow depends on them.
   - "Identifier" is not split into patient identifiers and public product/record identifiers.
4. **MEDIUM: the disagreement-display test sits only in the R2 phase.**
   - FR-17.5 and EVIDENCE-SOURCES §8 require that source disagreement be shown on the evidence screen. That is Feature 17, Phase 12, R1.
   - BUILD_PLAN Phase 12 completion moves S17 to Phase 13 as "synthesis-based", and job 13 synthesis runs only per candidate behind the default-off R2 flag.
   - As a result, the releasable R1 evidence screen has no test for disagreement display.
5. **LOW-MEDIUM: three different conditions for the U.S. regulatory label.**
   - CLINICAL-SAFETY §12: "U.S.-specific where applicable".
   - EVIDENCE-SOURCES §4.1: "Outside the US, the card states…". The app has no location input and should not collect one (PRIVACY §7: no location sent).
   - BUILD_PLAN Phase 11 task 4: "when OD-011 includes non-US markets".
6. **LOW-MEDIUM: automatic NCI retrieval can bring in trial records.**
   - EVIDENCE-SOURCES §17 routes cancer-related concepts to CANCER_INFO automatically. API_CATALOG §29 maps CANCER_INFO to NCI, and API_CATALOG §25 says NCI returns trial records.
   - This contradicts EVIDENCE-SOURCES §17 "trials … only on clinician request" and API_CATALOG §21 "clinician-initiated, not automatic". Trial records shown without a request also come close to CLINICAL-SAFETY §3 (no enrollment recommendation).
7. **LOW: the order of ranking, deduplication and the per-group cap.**
   - EVIDENCE-SOURCES §17 and ARCHITECTURE §6.4 rank before deduplicating, and §14 step 5 caps each group at 5 during ranking.
   - Deduplicating after the cap can show fewer than 5 records even though more exist.
8. **LOW: GUIDELINE group vs LITERATURE ordering.**
   - EVIDENCE-SOURCES §2 labels a guideline-type literature record GUIDELINE (Tier 2), and §14.1 puts the GUIDELINE group before LITERATURE.
   - But §14.3 also orders "practice guideline" first *within* LITERATURE, so the group a guideline record belongs to is ambiguous.
9. **LOW: deduplication vs cited versions.**
   - EVIDENCE-SOURCES §15 keeps "only the latest version" for a DailyMed set ID.
   - EVIDENCE-SOURCES §16 keeps old records cited by a candidate or note, and DATA_MODEL §6 rule 8 requires a candidate's evidence IDs to stay in the bundle as it was at generation time.
   - The scope of §15 (one result set vs the whole store) is undefined.
10. **LOW: route names used as source types.**
    - EVIDENCE-SOURCES §17 "selects source types" but lists route names (MEDICATION_STANDARD, LITERATURE_PRIMARY, CANCER_INFO…) from API_CATALOG §29.
    - These are not DATA_MODEL §3.7 EvidenceSourceType values, and no table maps routes to source types.
11. **LOW: manual and lookup paths for the sanitizer are not stated.**
    - DATA_MODEL §4.15 says CLINICIAN_MANUAL conceptTerms are "sanitized", but ARCHITECTURE §6.4 describes the sanitizer only in the job-11 path.
    - NLM Clinical Tables sends clinician-typed "partial term strings" (API_CATALOG §22). API_CATALOG §2 covers terminology requests generally, but the manual and autocomplete paths are not stated in ARCHITECTURE or IC-018.
12. **LOW: stale references.**
    - API_CATALOG §3 item 6 and §19 cite OD-005 for jurisdiction/US coverage. Target markets are now OD-011 (ADR-025, F-04).
    - TESTING §8 labels the fake PMID test "CS-16", but it is CS-16a (CLINICAL-SAFETY §18).
    - PROJECT-STATUS "Open Findings" still lists F-01…F-14 as OPEN, although ADR-021…ADR-033 record resolutions.

## Files Changed

- docs/agent-handoffs/2026-10-08-stage-a-team-evidence.md (this handoff; new). No other file was edited.

## Interfaces Changed

None. The review affects proposed changes to IC-010 (EvidenceSource shape: the route→sourceType mapping, version retention), IC-011 (citation contract: adding job 16) and IC-018 (sanitizer: identifier classes, manual and lookup paths). Those changes would be made by their owners.

## Dependencies

- Relied on: CLAUDE.md; PROJECT-STATUS; DECISIONS ADR-021–ADR-033 and OD-001–OD-011; EVIDENCE-SOURCES (all); API_CATALOG (all); ARCHITECTURE §3.5–§3.6, §5, §6.4, §7, §8; AI.md §3, §5.1, §15; CLINICAL-SAFETY §3, §12, §18; DATA_MODEL §3.7, §4.14–§4.16, §5.2, §6; PRODUCT_SPEC §6, Features 17–19; BUILD_PLAN Phases 11–14; TESTING §7, §8, §13; PRIVACY §7; INTEGRATION-CONTRACTS IC-010/011/018/019.
- Depends on this: Task D (chief-architect synthesis).

## Tests

none — documentation review task (0 tests)

## Evidence

- Finding 1: ARCHITECTURE.md §8 (table row "Evidence stage FAILED/SKIPPED"); DATA_MODEL.md §5.2 (sentence "A stage may start only when the previous stage is COMPLETED, PARTIAL or SKIPPED"); DECISIONS.md ADR-023 Reason; ARCHITECTURE.md §6.4 "Why evidence comes before candidates"; AI.md §3 job 12; PRODUCT_SPEC.md FR-18.5.
- Finding 2: AI.md §3 job 16 and §5.1 validator 10; CLINICAL-SAFETY.md §18 CS-16; BUILD_PLAN.md Phase 13 tasks 4 and Tests; AI.md §15; DECISIONS.md ADR-024.
- Finding 3: ARCHITECTURE.md §6.4 sanitizer line; API_CATALOG.md §2 (Query sanitization), §14, §15, §16, §18 "Data sent" rows; PRIVACY.md §7 table (Evidence/terminology row); INTEGRATION-CONTRACTS.md IC-018.
- Finding 4: PRODUCT_SPEC.md FR-17.5; EVIDENCE-SOURCES.md §8; BUILD_PLAN.md Phase 12 Completion criteria and Phase 13 Tests; TESTING.md §13 S17; AI.md §3 job 13 input; DECISIONS.md ADR-025 R2 row.
- Finding 5: CLINICAL-SAFETY.md §12; EVIDENCE-SOURCES.md §4.1; BUILD_PLAN.md Phase 11 task 4.
- Finding 6: EVIDENCE-SOURCES.md §17 (Staged source selection); API_CATALOG.md §21, §25, §29; CLINICAL-SAFETY.md §3.
- Finding 7: EVIDENCE-SOURCES.md §14 step 5, §17; ARCHITECTURE.md §6.4.
- Finding 8: EVIDENCE-SOURCES.md §2 (Tier 2 paragraph), §14 steps 1 and 3.
- Finding 9: EVIDENCE-SOURCES.md §15, §16; DATA_MODEL.md §6 rule 8.
- Finding 10: EVIDENCE-SOURCES.md §17; API_CATALOG.md §29; DATA_MODEL.md §3.7.
- Finding 11: DATA_MODEL.md §4.15; ARCHITECTURE.md §6.4; API_CATALOG.md §2, §22; INTEGRATION-CONTRACTS.md IC-018.
- Finding 12: API_CATALOG.md §3 item 6, §19; DECISIONS.md OD-011; TESTING.md §8; CLINICAL-SAFETY.md §18; PROJECT-STATUS.md "Open Findings".

## Known Limitations

- This was a documentation-only review. No provider was verified (API_CATALOG §31 is still empty), and none of the findings rests on provider behavior.
- I did not review UI-UX, SECURITY, DEPLOYMENT or GOOGLE-PLAY in depth.
- The findings were checked against the working tree on 2026-10-08. Those spec changes are uncommitted (git status shows the docs modified).

## Risks

- Finding 1, if not fixed: candidates generated with no grounding evidence after a retrieval failure. That defeats ADR-023, and the candidates could be mistaken for evidence-backed possibilities.
- Finding 2: fabricated citations in a patient-education draft that is releasable (non-R2).
- Finding 3: either the sanitizer blocks label retrieval, or an implementer weakens it ad hoc to make DailyMed work, which is an uncontrolled privacy relaxation.
- Finding 4: the R1 release would ship disagreement display without a passing test.

## Required Follow-up

1. Finding 1 (proposed owner: chief-architect for the ADR; ai-clinical-engineer and data-engineer; clinical-safety-engineer reviews).
   - Candidate stage requires evidenceState COMPLETED or PARTIAL. NO_RESULTS counts as COMPLETED and shows "no evidence found".
   - Evidence FAILED blocks the candidate stage and offers retry. Evidence SKIPPED makes the candidate stage SKIPPED.
   - Delete the "facts alone" row in ARCHITECTURE §8 and add a scenario test.
2. Finding 2 (clinical-safety-engineer; ai-clinical-engineer).
   - Widen CS-16 to every AI output that references evidence (jobs 12, 13, 16, and 15 if notes render citations).
   - Add job 16 to AI.md §5.1 validator 10.
   - Restrict job 16 citations to PATIENT_EDUCATION records in the stored bundle.
3. Finding 3 (evidence-research-engineer with security-privacy-engineer; IC-018).
   - Define two classes: patient identifiers, which are never sent; and public product/record identifiers (RxCUI, set ID, NDC, application number), which may be sent.
   - Product identifiers go only as typed parameters, and only when the value came from a validated provider response stored on the device.
   - Amend the ARCHITECTURE §6.4, API_CATALOG §2 and PRIVACY §7 wording, and add sanitizer tests.
4. Finding 4 (qa-test-engineer and evidence-research-engineer; chief-architect edits BUILD_PLAN).
   - Split S17: S17a is deterministic evidence-card display of conflicting records with dates and sources (Phase 12, R1). S17b is the synthesis stating the disagreement (Phase 13).
5. Finding 5 (evidence-research-engineer; chief-architect for BUILD_PLAN; clinical-safety-engineer reviews).
   - In V1, always label content derived from FDA, DailyMed, RxNorm or NDC as "U.S. regulatory information", whatever the market. This is the restrictive option.
6. Finding 6 (evidence-research-engineer): automatic CANCER_INFO is limited to NCI information pages. NCI trial search becomes a clinician-requested TRIALS route.
7. Findings 7–10 (evidence-research-engineer):
   - Pipeline order: validation → per-record tier → deduplication → ranking → per-group cap. Mirror it in ARCHITECTURE §6.4 (chief-architect).
   - A guideline-type literature record takes sourceType GUIDELINE; remove it from the §14.3 list.
   - Scope §15 to one result set. A cited older version is kept and marked "newer version available".
   - Add a route→EvidenceSourceType table to API_CATALOG §29 and say "routes" in §17.
8. Finding 11 (evidence-research-engineer, security-privacy-engineer): state in ARCHITECTURE §6.4 and IC-018 that manual searches and terminology autocomplete pass through the same on-device sanitizer, and that a rejection is shown to the clinician.
9. Finding 12: OD-005 → OD-011 in API_CATALOG (evidence-research-engineer); CS-16 → CS-16a in TESTING §8 (qa-test-engineer); refresh the F-01…F-14 statuses in PROJECT-STATUS (chief-architect).

## Messages

| Direction | Counterpart | First line | UTC time |
|---|---|---|---|
| sent | safety (clinical-safety-engineer) | `[STAGE-A-MSG] Citation safety: CS-16 does not cover AI job 16 (patient-friendly explanation), the only evidence-citing AI output outside the R2 flag.` | 2026-10-08T04:21:08Z |
| received | product (product-clinical-architect) | not yet received | — |
| received | safety (reply) | not yet received | — |

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes, by chief-architect (Task D synthesis); clinical-safety-engineer must review findings 1, 2, 4 and 5 (mandatory safety review of evidence changes)

## Next Action

chief-architect consolidates these findings in Task D and assigns finding 1 (HIGH) to an ADR. In the meantime, evidence replies to any `[STAGE-A-MSG]` from product or safety and updates the Messages section.
