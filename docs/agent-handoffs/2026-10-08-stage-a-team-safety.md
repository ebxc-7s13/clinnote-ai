# Task Handoff

## Owner

clinical-safety-engineer (teammate `safety`, Stage A agent-team test)

## Task

Shared Task #3, "Task C — Clinical safety review". I reviewed the reconciled ClinNote specifications for remaining conflicts between the product workflow, evidence retrieval and clinical safety. BUILD_PLAN Phase 0 (Stage A reconciliation review).

## Status

COMPLETED. This is a documentation review only. No spec was edited; every finding below is reported with a proposed fix.

## What Changed

This review is an independent check of the reconciled specs against ADR-021 to ADR-033. **Verdict for the documentation baseline: FAIL (Gate 6 would not be passable as specified).** Four HIGH findings make the safety matrix either unpassable or passable without real coverage. No application exists, so no implementation gate was evaluated.

### HIGH (would fail, or invalidate, Gate 6)

- **H1 — The Gate 6 criteria are out of date.**
  - `QUALITY-GATES.md` Gate 6 says "all applicable CS-01…CS-24 tests pass".
  - `CLINICAL-SAFETY.md` §18, `TESTING.md` §7 and §15 define CS-01…CS-31 plus CS-16a.
  - As written, Gate 6 could PASS without CS-16a or CS-25…CS-31. Those cover finalize ≠ confirm, unidentified discontinuation, medication and allergy contradictions, distinguishable AI inference, reference images, and AI provenance limits.
  - The gate text also lacks the rule "a pending test never counts as passing" (`TESTING.md` §13a, §15).
  - **Fix:** change Gate 6 to "all applicable CS-01…CS-31 including CS-16a; pending = not passing". **Owner:** chief-architect.
- **H2 — Three documents disagree on what the candidate stage needs from the evidence stage (ADR-023).**

  | Document | Candidate stage may start when evidence is… |
  |---|---|
  | `ARCHITECTURE.md` §8, row "Evidence stage FAILED/SKIPPED" | FAILED or SKIPPED, in which case it "runs on facts alone… no citations" |
  | `DATA_MODEL.md` §5.2 | COMPLETED, PARTIAL or SKIPPED (FAILED blocks) |
  | `TESTING.md` §13a pipeline-order test | COMPLETED only |

  - The ARCHITECTURE row contradicts ADR-023's reason: possibilities must be grounded in validated sources.
  - Whichever document the implementation follows, the safety-corpus order test fails, or the test has to be relaxed.
  - **Fix:**
    - The candidate stage requires evidenceState COMPLETED or PARTIAL. A NO_RESULTS evidence result counts as COMPLETED, and the app shows "No evidence found" honestly.
    - If evidence is FAILED or SKIPPED, candidateState becomes SKIPPED and the app shows "Possibilities unavailable: evidence retrieval did not complete".
    - Align ARCHITECTURE §8, DATA_MODEL §5.2 (a stage-specific rule) and TESTING §13a, and record this as an ADR-023 clarification.
  - **Owners:** chief-architect (ARCHITECTURE, ADR), data-engineer, qa-test-engineer, ai-clinical-engineer.
- **H3 — Correcting a speaker role after extraction conflicts with the immutable originProvenance.**
  - These documents require a role correction to update the provenance of affected facts:
    - `CLINICAL-SAFETY.md` §15 and CS-15
    - `PRODUCT_SPEC.md` FR-22.3
    - `BUILD_PLAN.md` Phase 9 tests
  - Against them:
    - `DATA_MODEL.md` §3.2 rule 1 makes originProvenance immutable.
    - Rule 5 maps role to provenance only at extraction time.
    - §5.3 has no transition for a role correction.
  - If code changes only `provenance`, the UI keeps showing origin "Clinician-stated" for words the patient said. If it changes origin in place, it breaks rule 1.
  - The same gap applies to transcript edits: TESTING S13 says "downstream facts re-flagged", but there is no field or reason for that.
  - **Fix:**
    - A role or segment correction after extraction makes code re-derive the affected PROVISIONAL facts as new versions. Each new version gets its origin from the corrected role and stays PROVISIONAL. The old version is kept, and an AuditEvent ROLE_MAPPING_CHANGED is written.
    - Affected CONFIRMED facts are never changed silently. They get needsClarification with a new ClarificationReason, SOURCE_CHANGED.
  - **Owners:** data-engineer, product-clinical-architect (FR-22.3), clinical-safety-engineer (CS-15 wording).
- **H4 — CS-07 conflicts with the R2 flag, the hedge rules and the phase plan.**
  - Three places map "Patient may have asthma." to a "Possibility to review (PROVISIONAL)":
    - `CLINICAL-SAFETY.md` §9 table
    - CS-07
    - `AI.md` §7
  - But possibilities are produced only by job 12:
    - job 12 is built in Phase 13 behind `possibilitiesEnabled`, which defaults OFF (ADR-025)
    - CS-07 is scheduled in Phase 10 (`BUILD_PLAN.md` P10, "CS-01–CS-15")
  - The same documents' hedge rules require informationState UNKNOWN or HEDGED_STATEMENT: CLINICAL-SAFETY §9, `AI.md` §5.1 rule 9, and job 7.
  - Results:
    - CS-07 cannot pass in Phase 10. It stays pending, and pending means not passing, so Phase 10 Gate 6 is blocked.
    - It is untestable when the flag is OFF.
    - It would relabel a clinician's own hedged words as an AI possibility.
  - CS-11 has the same phase problem: it needs RxNorm normalization candidates, which arrive in Phase 11, but it is listed in the Phase 10 range.
  - **Fix:**
    - CS-07 expects an extracted fact: an Assessment if the speaker is DOCTOR, a HISTORY_MEDICAL fact if PATIENT. It has informationState UNKNOWN, hedged wording preserved, PROVISIONAL status and needsClarification HEDGED_STATEMENT, and there is no CONFIRMED assessment.
    - A separate flag-ON Phase 13 assertion checks that any related candidate is PROVISIONAL.
    - Remove CS-07 and CS-11 from the P10 range and keep CS-11 in P11.
  - **Owners:** clinical-safety-engineer (CS-07, §9), ai-clinical-engineer (AI.md §7), chief-architect (BUILD_PLAN).

### MEDIUM

- **M1 — Candidates in notes.**
  - `DATA_MODEL.md` §5.2 says the note "includes candidates only if candidateState COMPLETED".
  - Against it:
    - `AI.md` job 15's input does not include candidates.
    - `ARCHITECTURE.md` §6.5 and `PRODUCT_SPEC.md` FR-21.2 are silent.
  - A PROVISIONAL R2 candidate rendered in a finalizable or exportable note enters the record as if documented, because finalizing does not confirm (CS-25).
  - **Fix:** notes render only CONFIRMED assessments, including candidates the clinician confirmed. They never render PROVISIONAL or DISMISSED candidates. Add a CS row. **Owners:** data-engineer, ai-clinical-engineer, clinical-safety-engineer.
- **M2 — Negation can be inverted through evidence and candidates.**
  - Job 11's input is all "facts (non-rejected)" (`AI.md` §3, `ARCHITECTURE.md` §6.4), which includes NEGATIVE and UNKNOWN facts.
  - Job 12's validators check only that fact IDs exist (`AI.md` §3; `DATA_MODEL.md` §4.14 has no state rule).
  - So "Patient denies fever" could become a *supporting* fact, or a query treating fever as present.
  - **Fix:**
    - Concepts carry informationState.
    - Job 12 validator:
      - supportingFactIds must be POSITIVE, or UNKNOWN when labeled as such
      - NEGATIVE facts may appear only as contradicting facts
      - NOT_DISCUSSED may appear only as missing information
      - REJECTED facts are excluded
    - Add a CS row.
  - **Owners:** ai-clinical-engineer, clinical-safety-engineer.
- **M3 — Discontinuation across segments is undefined.**
  - `TESTING.md` §6 allows DISCONTINUED "if the medication is identified in context".
  - Against it:
    - `DATA_MODEL.md` §6 rule 9 allows it only when "stated explicitly for an identified medication in a segment".
    - §3.2 rule 7 says multi-segment content is AI_EXTRACTED.
    - `AI.md` job 4 says "explicit statement".
  - The common question-and-answer case is unspecified: DOCTOR "Still on amlodipine?", then PATIENT "No, I stopped it."
  - **Fix:** decide explicitly. My recommendation: PROVISIONAL DISCONTINUED is allowed with AI_EXTRACTED / AI_INFERENCE and the label "AI INFERENCE — VERIFY", only when the medication is named in the cited segments. Add a CS row. **Owners:** data-engineer, clinical-safety-engineer.
- **M4 — Edits erase the original source.**
  - Under `DATA_MODEL.md` §3.2 rule 4, an edit creates a version whose origin is CLINICIAN_CONFIRMED.
  - Three places require the original source to stay visible:
    - `CLINICAL-SAFETY.md` §4: "originProvenance is always shown… still reveals whether it was patient-reported, clinician-stated or AI-inferred"
    - `PRODUCT_SPEC.md` FR-23.3
    - `UI-UX.md` Screen 10, line 142
  - Rule 5 also lets a clinician "reattribute to PATIENT_REPORTED, recorded as an edit". That contradicts rule 4, §3.9 (CLINICIAN_EDIT allows only CLINICIAN_CONFIRMED) and §6 rule 12.
  - **Fix:**
    - Every version inherits the root origin and displays it.
    - Define reattribution as its own clinician action with a validation rule, or remove it.
  - **Owners:** data-engineer, product-clinical-architect.
- **M5 — The cross-visit conflict detection scope is inconsistent.**
  - `DATA_MODEL.md` §9's definition covers "non-rejected facts", but its Detection paragraph covers only "CONFIRMED facts from earlier visits".
  - Because finalizing does not confirm, unreviewed earlier POSITIVE medications or history never conflict. They also drop out of view: §10.2 shows only CONFIRMED facts, plus PROVISIONAL mentions from the latest visit only.
  - **Fix:** the detector also covers non-rejected PROVISIONAL facts from earlier visits, with their status shown. **Owner:** data-engineer.
- **M6 — Possibilities can mention evidence that was not retrieved.**
  - `AI.md` job 12 says "evidence not in the bundle is listed under missing information".
  - `ARCHITECTURE.md` §8 says "missing evidence is listed under missing information".
  - Both let the model name guidelines or papers that were never retrieved. CS-16 checks only identifiers, so this would be an uncited reference.
  - **Fix:**
    - missingInformation is limited to clinical information that was not discussed.
    - The app shows evidence gaps deterministically.
    - A validator rejects source titles or guideline names in candidate free text.
  - **Owners:** ai-clinical-engineer, evidence-research-engineer.
- **M7 — Release criteria depend on R2.**
  - These all require possibilities:
    - `PRODUCT_SPEC.md` §12, criterion 6 ("review possibilities and evidence")
    - `PRODUCT_SPEC.md` §6, core workflow
    - `BUILD_PLAN.md` Phase 14 completion (criteria 5, 6 and 8)
    - `TESTING.md` §15, release requires all 24 scenarios end to end, including S2 "candidates PROVISIONAL"
  - ADR-025 forbids releasing R2, and Phase 13 requires the flag OFF in release builds.
  - **Fix:**
    - Split criterion 6 into R1 evidence review (a release criterion) and R2 possibilities (flag ON, synthetic data, not for release).
    - Release E2E asserts that possibilities are hidden.
  - **Owners:** product-clinical-architect, qa-test-engineer, chief-architect.
- **M8 — The AI completion gate omits phases that deliver AI.**
  - `AI.md` §15 and `BUILD_PLAN.md` rule 8 list only Phases 10, 13 and 15.
  - Phase 12 delivers AI job 11 (query generation) without Gate 6 in its completion criteria.
  - Phase 11 runs CS-11, CS-12, CS-13 and CS-17 without Gate 6 in its completion criteria.
  - **Fix:** add Phase 12 to the AI gate, and add Gate 6 PASS to the completion criteria of P11 and P12. **Owners:** chief-architect, ai-clinical-engineer.

### LOW

- **L1 — Two mandatory cases have no CS ID.** "Doctor says the patient has asthma" (`TESTING.md` §6, `AI.md` §7) and "Maybe metformin?" (`CLINICAL-SAFETY.md` §9, S22 only) have no CS ID, so a CS-ID-driven Gate 6 can skip them.
  - **Fix:** add CS-32 and CS-33. **Owner:** clinical-safety-engineer, after owner approval.
- **L2 — The finalize action is named like a confirmation.**
  - `UI-UX.md` Screen 13 (line 195) has a "Confirm and finalize" button.
  - `ARCHITECTURE.md` §6.5 records finalize as NoteVersion source CLINICIAN_CONFIRMED.
  - Both blur "finalize ≠ confirm" (CS-25).
  - **Fix:** rename them "Finalize note" and CLINICIAN_FINALIZED. **Owners:** ux-designer, data-engineer, chief-architect.
- **L3 — Who orders possibilities is undefined.** `CLINICAL-SAFETY.md` §6 orders them "by directness of link" but does not say who computes the order. If the LLM output order is used, it can imply likelihood (ADR-016; ADR-025 open question on non-ranked lists).
  - **Fix:** code computes a deterministic, neutral order. **Owners:** clinical-safety-engineer, ai-clinical-engineer.
- **L4 — Manual search results can drive candidates.**
  - Under `ARCHITECTURE.md` §6.4, results of a manual search started from a candidate "can be cited on regeneration".
  - That is a candidate-driven retrieval loop, which ADR-023's future-review condition says needs an ADR.
  - **Fix:** clarify in ADR-023. **Owners:** evidence-research-engineer, chief-architect.
- **L5 — Tests are scheduled in phases that cannot run them.**
  - Phase 9 "mapping correction changes provenance": no facts exist until Phase 10.
  - Phase 13 CS-18 "no diagnosis wording in note": the note job arrives in Phase 15.
  - **Fix:** move these assertions to the phase that can test them. **Owner:** chief-architect.
- **L6 — PROJECT-STATUS is stale.** `PROJECT-STATUS.md` "Open Findings" still lists F-01…F-14 as OPEN, while ADR-021…ADR-032 state that they are resolved. The file is not in the modified set.
  - **Fix:** update after Stage A. **Owner:** chief-architect.

### Checked with no conflict found

- NOT_DISCUSSED vs NEGATIVE: §3.1, §10.3, FR-12, CS-04 and CS-05.
- Numeric preservation: §10 and AI §5.1 rule 2.
- MEASURED restricted to manual entry: CS-31 and §3.2.
- Positive allergy never hidden while a conflict is OPEN: §9 rule 6 and CS-28.
- AI never confirms or completes: §6 rule 9 and CS-23.
- Fake PMID and FDA rejection: CS-16a and CS-17.
- No reference images: CS-30.
- No live AI: ADR-027.

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team-safety.md (this file only)

## Interfaces Changed

none

## Dependencies

- Relied on:
  - CLAUDE.md
  - docs/PROJECT-STATUS.md
  - docs/DECISIONS.md (ADR-021…ADR-033)
  - docs/CLINICAL-SAFETY.md
  - docs/TESTING.md §6, §7, §13, §13a and §15
  - docs/DATA_MODEL.md §3, §5, §6, §8, §9 and §10
  - docs/AI.md §3, §5, §6, §7 and §15
  - docs/PRODUCT_SPEC.md §5, §6, §7 and §12
  - docs/ARCHITECTURE.md §6.4, §6.5 and §8
  - docs/BUILD_PLAN.md Phases 9–16
  - docs/QUALITY-GATES.md Gate 6
  - docs/UI-UX.md
  - docs/AGENT-OWNERSHIP.md
- Depends on this: Task D, the lead's synthesis.

## Tests

none — documentation review task (0 tests)

## Evidence

- H1: `docs/QUALITY-GATES.md` Gate 6, "Pass criteria", vs `docs/CLINICAL-SAFETY.md` §18, `docs/TESTING.md` §7 and §15.
- H2: `docs/ARCHITECTURE.md` §8, row "Evidence stage FAILED/SKIPPED", vs `docs/DATA_MODEL.md` §5.2 (stage start rule) vs `docs/TESTING.md` §13a ("Pipeline-order tests") vs `docs/DECISIONS.md` ADR-023.
- H3: `docs/CLINICAL-SAFETY.md` §15 and CS-15, `docs/PRODUCT_SPEC.md` FR-22.3, and `docs/BUILD_PLAN.md` Phase 9 Tests, vs `docs/DATA_MODEL.md` §3.2 rules 1 and 5 and §5.3; `docs/TESTING.md` §13 S13.
- H4: `docs/CLINICAL-SAFETY.md` §9 table and CS-07, and `docs/AI.md` §7, vs `docs/AI.md` §3 job 12 and §5.1 rule 9, `docs/BUILD_PLAN.md` Phase 10 Tests ("CS-01–CS-15"), Phase 11 and Phase 13 task 1, and `docs/DECISIONS.md` ADR-025.
- M1: `docs/DATA_MODEL.md` §5.2 (note line) vs `docs/AI.md` §3 job 15 input, `docs/ARCHITECTURE.md` §6.5, `docs/PRODUCT_SPEC.md` FR-21.2 and CS-25.
- M2: `docs/AI.md` §3 jobs 11 and 12, `docs/ARCHITECTURE.md` §6.4 ("non-rejected"), `docs/DATA_MODEL.md` §4.14.
- M3: `docs/TESTING.md` §6 row "The medication was stopped." vs `docs/DATA_MODEL.md` §6 rule 9 and §3.2 rule 7, and `docs/AI.md` §3 job 4.
- M4: `docs/DATA_MODEL.md` §3.2 rules 4 and 5, §3.9 (CLINICIAN_EDIT) and §6 rule 12, vs `docs/CLINICAL-SAFETY.md` §4, `docs/PRODUCT_SPEC.md` FR-23.3 and `docs/UI-UX.md` line 142.
- M5: `docs/DATA_MODEL.md` §9 "Definition" vs §9 "Detection", and §10.2.
- M6: `docs/AI.md` §3 job 12 validators, `docs/ARCHITECTURE.md` §8 (same row as H2), CS-16.
- M7: `docs/PRODUCT_SPEC.md` §6 and §12 item 6, `docs/BUILD_PLAN.md` Phase 13 Tests and Phase 14 completion, and `docs/TESTING.md` §15 and S2, vs `docs/DECISIONS.md` ADR-025.
- M8: `docs/AI.md` §15 and `docs/BUILD_PLAN.md` rule 8, vs `docs/BUILD_PLAN.md` Phase 12 task 3 and the completion criteria of Phases 11 and 12.
- L1: `docs/TESTING.md` §6 rows 42 and 46, and `docs/CLINICAL-SAFETY.md` §9 and §18.
- L2: `docs/UI-UX.md` line 195 and `docs/ARCHITECTURE.md` §6.5.
- L3: `docs/CLINICAL-SAFETY.md` §6, and `docs/DECISIONS.md` ADR-016 and ADR-025 open questions.
- L4: `docs/ARCHITECTURE.md` §6.4, last paragraph, and `docs/DECISIONS.md` ADR-023, future review condition.
- L5: `docs/BUILD_PLAN.md` Phase 9 Tests and Phase 13 Tests.
- L6: `docs/PROJECT-STATUS.md` "Open Findings" vs `docs/DECISIONS.md` ADR-021…ADR-032.

## Known Limitations

- I did not review in depth: SPEECH, SECURITY, PRIVACY, EVIDENCE-SOURCES, API_CATALOG, or UI-UX beyond the grep hits listed above.
- The findings come from the working-tree state on 2026-10-08, which has uncommitted reconciliation edits. No commit hash is available for that state.
- There is no implementation, so no gate was run against code.

## Risks

- If H1–H4 are not fixed before Phase 10, Gate 6 will either be unpassable or be "passed" on stale criteria.
- M1 and M7 create pressure to expose R2 output in released notes or builds.
- H3 and M4 allow patient words to appear permanently as clinician statements, or AI inference to appear as clinician-authored.

## Required Follow-up

- H1, H2 (ADR-023 clarification), L5, L6 and the BUILD_PLAN part of H4: chief-architect.
- H3, M3, M4 and M5: data-engineer, with clinical-safety-engineer review.
- H4 (CS-07 and §9 text), L1 (CS-32 and CS-33) and CS rows for M1 and M2: clinical-safety-engineer, after lead approval to edit `CLINICAL-SAFETY.md`.
- M1, M2, M6 and M8: ai-clinical-engineer.
- FR-22.3 (H3), M4 wording and M7: product-clinical-architect.
- Pipeline-order test and S2 release split: qa-test-engineer.
- L2: ux-designer.
- L4 and M6: evidence-research-engineer.

## Messages

| Direction | Counterpart | First line | UTC time |
|---|---|---|---|
| sent | product | [STAGE-A-MSG] Provenance concern: PRODUCT_SPEC FR-22.3 lets the clinician correct speaker roles after extraction, but DATA_MODEL makes originProvenance immutable, so the original source can stay wrong for good. | 2026-10-08T04:22:46Z |
| received | evidence | not yet received | — |
| received | product (reply) | not yet received | — |

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes, by chief-architect. H1–H4 also need re-review by clinical-safety-engineer after the fixes.

## Next Action

chief-architect assigns the H1–H4 fixes to their owners before any Phase 6–15 work. Then clinical-safety-engineer re-reviews the amended specs and issues a Gate 6 documentation verdict.
