# Task Handoff

## Owner

clinical-safety-engineer (teammate `safety`, Stage A agent-team test, run 2)

## Task

Shared Task #3, "Task C — Clinical safety review". I reviewed the reconciled ClinNote specifications for remaining conflicts between the product workflow, evidence retrieval and clinical safety. This is BUILD_PLAN Phase 0 (Stage A reconciliation review, run 2).

## Status

COMPLETED. This was a documentation review only. I edited no spec and no other file. Every finding below comes with a proposed fix and owner.

## What Changed

I re-checked the run-1 findings (H1–H4, M1–M8, L1–L6) against the corrected specs. I then looked for new conflicts introduced or left by ADR-034, ADR-035, ADR-036 and CS-32…CS-37, and checked that each CS test can be run in the phase that schedules it.

**Gate 6 documentation verdict: FAIL.** This is a spec-consistency verdict only; no implementation exists. Four HIGH findings leave Gate 6 not cleanly passable without relaxing a rule, or let R2 output escape the gate:
- S2-01: the S13 / CS-15 correction path breaks validation rule 6 or §4.10.
- S2-02: the note halves of CS-18, CS-19 and CS-20 have no validator that can reject a deliberately wrong mock output, so they stay pending.
- S2-05: CS rows are scheduled whole in phases that cannot run all of their assertions, "applicable" is undefined, and CS-19 is scheduled nowhere.
- S2-14: job-11 query concepts can name conditions nobody stated, so condition suggestions reach the R1 evidence screen with the flag OFF. Raised by `evidence`; agreed.

Run 1 is largely fixed: 17 of 18 findings are RESOLVED. L6 is open, as the run-1 fix intended. The new findings are narrower than run 1's.

### Run-1 verification

| ID | Result | Evidence |
|---|---|---|
| H1 | RESOLVED | `QUALITY-GATES.md` Gate 6 "Pass criteria" now requires all applicable CS-01…CS-37, including CS-16a, and says "pending test never counts as passing". It matches `TESTING.md` §7 and §15 item 2 |
| H2 | RESOLVED | `ARCHITECTURE.md` §8 row "Evidence stage FAILED/SKIPPED, or empty bundle", `DATA_MODEL.md` §5.2 candidate precondition and `TESTING.md` §13a "Pipeline-order and gating tests" now agree: flag ON, plus COMPLETED/PARTIAL, plus a non-empty bundle; otherwise SKIPPED (ADR-034 point 1) |
| H3 | RESOLVED (residual, see S2-01) | `DATA_MODEL.md` §3.2 rule 8, §3.10 SOURCE_CHANGED and §5.3 last two transitions; `PRODUCT_SPEC.md` FR-22.3; `CLINICAL-SAFETY.md` §15 and CS-15; ADR-035 point 1 |
| H4 | RESOLVED | CS-07 is rewritten (UNKNOWN / HEDGED_STATEMENT, flag-ON variant in Phase 13). `CLINICAL-SAFETY.md` §9 table and `AI.md` §7 match. `BUILD_PLAN.md` Phase 10 Tests leave CS-11 to Phase 11, and Phase 13 Tests run the CS-07 flag-ON variant |
| M1 | RESOLVED | ADR-034 point 3; `DATA_MODEL.md` §5.2 "note" line and §4.14 last bullet; `AI.md` job 15 and §5.1 rule 12; `PRODUCT_SPEC.md` FR-21.2 and FR-18.9; CS-32 |
| M2 | RESOLVED | ADR-034 point 4; `AI.md` jobs 11 and 12; `DATA_MODEL.md` §4.14, §4.15 and §6 rule 17; `ARCHITECTURE.md` §6.4; CS-33 |
| M3 | RESOLVED | ADR-035 point 5; `DATA_MODEL.md` §4.7; `CLINICAL-SAFETY.md` §11; `AI.md` job 4; `TESTING.md` §6 row "The medication was stopped."; CS-36 |
| M4 | RESOLVED | `DATA_MODEL.md` §3.2 (rootOriginProvenance, rules 1, 4 and 5), §6 rule 16; `PRODUCT_SPEC.md` FR-23.3 and §5.2; `UI-UX.md` lines 26 and 158; ADR-035 points 3–4 |
| M5 | RESOLVED for the detector (residual in the views, see S2-03) | `DATA_MODEL.md` §9 "Detection"; ADR-035 point 6; `BUILD_PLAN.md` Phase 10 task 6 |
| M6 | RESOLVED | ADR-034 point 4; `DATA_MODEL.md` §4.14; `AI.md` job 12, job 13 and §5.1 rule 11; CS-16 now covers named sources |
| M7 | RESOLVED | `PRODUCT_SPEC.md` §12 item 6; `BUILD_PLAN.md` Phase 14 completion; `TESTING.md` §15 release paragraph and S2 |
| M8 | RESOLVED (stale ADR text, see S2-13) | `AI.md` §15 and `BUILD_PLAN.md` cross-phase rule 8 list 10, 11, 12, 13 and 15; Phase 11 and Phase 12 completion criteria include Gate 6 |
| L1 | RESOLVED | CS-34 and CS-35 in `CLINICAL-SAFETY.md` §18; `TESTING.md` §6 |
| L2 | RESOLVED (residual wording, see S2-09) | `UI-UX.md` line 211 "Finalize note"; `DATA_MODEL.md` §4.18 CLINICIAN_FINALIZED; `ARCHITECTURE.md` §6.5 |
| L3 | RESOLVED | ADR-034 point 6; `CLINICAL-SAFETY.md` §6; `DATA_MODEL.md` §4.14 |
| L4 | RESOLVED | ADR-023 decision ("clinician-triggered regeneration; no automatic candidate-driven retrieval loop"); `ARCHITECTURE.md` §6.4 |
| L5 | RESOLVED for the two cited cases (the same class recurs, see S2-05) | `BUILD_PLAN.md` Phase 9 Tests (provenance assertions moved to Phase 10); Phase 13 Tests (CS-18 note part moved to Phase 15) |
| L6 | NOT RESOLVED (expected; the fix is due after Stage A) | `PROJECT-STATUS.md` "Open Findings" table rows F-01…F-14 still say OPEN |

### New findings

#### HIGH

- **S2-01 — Re-derivation after a correction is defined as deterministic, but it can't be for text corrections or for role changes that affect the category.**
  - **Severity:** HIGH
  - **Files:**
    - `DATA_MODEL.md` §3.2 rule 8, §3.9 (DETERMINISTIC_RULE), §4.10, §5.3, and §6 rules 6 and 12
    - ADR-035 point 1
    - `PRODUCT_SPEC.md` FR-22.3
    - `CLINICAL-SAFETY.md` §15 and CS-15
    - `TESTING.md` §13 S13 and §6 row "Role corrected after extraction"
  - **Conflict:** Rule 8 says code re-derives each affected PROVISIONAL fact as a new version with derivation DETERMINISTIC_RULE. That works only when the value and category stay valid, which fails in three cases:
    - A **text** correction (S13), e.g. "BP 142 over 91" corrected to "BP 124 over 91", or "fever" corrected to "no fever". Code cannot re-compute the value or the informationState. Copying the old value breaks §6 rule 6 (every number in the value must appear in the source segment). It would also keep a negation the corrected text no longer supports.
    - A role change **DOCTOR → PATIENT** on an Assessment. The result is a PATIENT_REPORTED Assessment, which §4.10 forbids ("an assessment exists only when the clinician stated it").
    - A role change **PATIENT → DOCTOR**. Job 7 (assessment) and job 8 (plan) read only DOCTOR segments, so stated assessments and plans in that segment were never extracted. No deterministic step can create them.
  - **Result:** S13 cannot pass as specified unless validation rule 6 or §4.10 is relaxed, which is forbidden.
  - **Proposed fix (ADR-035 clarification):**
    1. On a role correction that keeps the category valid (PATIENT ↔ UNKNOWN/OTHER, or any change for categories other than ASSESSMENT and PLAN), keep deterministic re-derivation.
    2. On a text correction, or a role correction that touches ASSESSMENT or PLAN, or crosses into DOCTOR, handle it in three steps:
       - Code supersedes the affected PROVISIONAL facts. They stay visible as history, with needsClarification SOURCE_CHANGED.
       - The affected segments are re-extracted through the normal pipeline: jobs 2–9, all §5.1 validators, and code-assigned provenance.
       - If cloud processing is unavailable, the facts stay flagged for manual review.
    3. CONFIRMED facts stay as they are now: unchanged and flagged.
    4. Add a CS row for the S13 text-correction case: a number changed in the transcript must never survive in a PROVISIONAL fact.
  - **Proposed owners:** data-engineer (§3.2, §5.3), ai-clinical-engineer (re-extraction path), product-clinical-architect (FR-22.3 wording), clinical-safety-engineer (CS-15 and new row), chief-architect (ADR).

- **S2-02 — No validator can reject an invented diagnosis, plan or examination finding in note text.**
  - **Severity:** HIGH
  - **Files:**
    - `AI.md` §3 job 15 (output "note text") and §5.1 rules 7 and 12
    - `DATA_MODEL.md` §4.18 (`content` is a single string)
    - `ARCHITECTURE.md` §6.5
    - `CLINICAL-SAFETY.md` CS-18 (note part), CS-19 and CS-20
    - `TESTING.md` §13a item 4 and "Harness self-tests"
  - **Conflict:** §13a requires every deliberately wrong mock output to be rejected by a validator. Until then the CS test is pending, and pending is not passing. Job 15 returns free text, and its validators check only four things:
    - numbers and negation against facts
    - a NOT_DISCUSSED phrase list
    - conflicts
    - absence of candidate text

    None of them catches invented content such as:
    - "Assessment: likely viral bronchitis" for a cough-only transcript (CS-18)
    - "Plan: start salbutamol" when no plan was stated (CS-19)
    - "Chest clear on auscultation" when no exam was described (CS-20); the rule-7 phrase list only catches normal-exam wording
  - **Result:** Gate 6 for Phase 15 is either blocked indefinitely, or "passed" on a phrase list that does not cover the requirement. The requirement is "never invent clinical information" (`CLAUDE.md` §6).
  - **Proposed fix:**
    - Job 15 returns structured note statements. Each statement has a `sourceFactIds` list or a `conflictId`, and code assembles the text.
    - New `AI.md` §5.1 rule 13:
      - every clinical statement references at least one current, non-rejected fact or an OPEN conflict
      - ASSESSMENT-section statements reference only ASSESSMENT facts (CLINICIAN_STATED or CONFIRMED)
      - PLAN-section statements reference only PLAN facts
      - EXAMINATION-section statements reference only EXAMINATION_FINDING or VITAL_SIGN facts
      - statements without a reference are rejected
    - The phrase list stays as a second layer.
    - `DATA_MODEL.md` §4.18 adds optional per-statement fact references for AI_DRAFT versions.
  - **Proposed owners:** ai-clinical-engineer (job 15 schema and validator), data-engineer (§4.18), clinical-safety-engineer (CS-18, CS-19 and CS-20 fixtures).

- **S2-05 — CS rows are scheduled whole in phases that cannot run all their assertions, "applicable" is undefined, and CS-19 is not scheduled.**
  - **Severity:** HIGH
  - **Files:**
    - `BUILD_PLAN.md` Phase 4 Tests, Phase 10 Tests, Phase 11 Tests, Phase 12 Tests, Phase 13 Tests, Phase 15 Tests, and Phase 18 Tests (no CS ID)
    - `CLINICAL-SAFETY.md` §18
    - `QUALITY-GATES.md` Gate 6 ("all applicable")
    - `TESTING.md` §15 item 2
  - **Conflict:** The lead's question was whether every CS test can run in the phase that schedules it. Many cannot; the "Earliest phase" column shows when each part becomes runnable:

    | CS | Scheduled in | Assertion that cannot run there | Earliest phase |
    |---|---|---|---|
    | CS-01, CS-04, CS-08, CS-10 | P10 | note part (job 15) | P15 |
    | CS-27 | P10 (also P4 data level, P15) | "note renders a conflict" | P15 |
    | CS-14, CS-28 | P10 | "both shown" / "displayed prominently" (conflict display) | P14 |
    | CS-12 | P4, P10, P11 | "not discussed this visit" (comparison display) | P16 |
    | CS-24 | P13 | comparison display | P16 |
    | CS-30 | P12 | "no AI text implies a patient match": no free-text job exists in P12 (also S2-06) | P13, P15 |
    | CS-32 | P15 | "exported": the Export feature is built in P18, and P18 lists no CS test | P18 |
    | CS-19 | **no phase** | P10 lists CS-12–CS-15 and CS-21, so CS-16–CS-20 are skipped there; CS-19 is not scheduled anywhere | P10 (facts), P15 (note) |

  - **Result:** "Pending never counts as passing", and "applicable" has no definition. So Gate 6 in P10, P12, P13 and P15 is either blocked, or decided ad hoc by whoever judges what is applicable. Run-1 L5 fixed only two instances of this pattern.
  - **Proposed fix:**
    - Add a "Phase(s)" column to `CLINICAL-SAFETY.md` §18 and split multi-stage rows into lettered parts, e.g. CS-01a extraction P10 and CS-01b note P15. Gate 6 "applicable" then means the parts whose phase is at or before the current phase. Release requires all parts.
    - Schedule CS-19a in P10 and CS-19b in P15.
    - Add CS-04, CS-25, CS-27, CS-28 and CS-32 export parts to the Phase 18 Tests, plus Gate 6 PASS in Phase 18 completion (Export touches clinical data, `CLAUDE.md` §12).
  - **Proposed owners:** clinical-safety-engineer (§18 table), chief-architect (BUILD_PLAN, QUALITY-GATES), qa-test-engineer (harness tags).

- **S2-14 — Evidence queries can introduce conditions nobody stated, a channel that leaks R2 output with the flag OFF.**
  - **Severity:** HIGH
  - **Raised by:** `evidence`; I verified it and agree.
  - **Files:**
    - `AI.md` §3 job 11 (validators: "concepts only" plus the sanitizer) and §5.1 rule 1 (checks only that the IDs exist)
    - `EVIDENCE-SOURCES.md` §17 ("Job 11 selects routes"; "cancer-related concepts → CANCER_INFO") and §4.12 ("never implies the patient has cancer")
    - `DECISIONS.md` ADR-025 (R2 = output that "suggests conditions for a specific patient")
    - `CLINICAL-SAFETY.md` CS-37 and CS-18
  - **Conflict:** Nothing checks that a concept term comes from its source fact.
    - Synthetic example: the facts are cough 3 weeks, weight loss and night sweats. Job 11 can emit "lung cancer" or "tuberculosis" as concepts, with those sourceFactIds.
    - The R1 evidence screen then automatically shows condition-specific evidence and NCI pages for this patient. That is a patient-specific condition suggestion while `possibilitiesEnabled` is OFF.
    - CS-37 still passes, because it only checks the job 12/13 executions. CS-18 still passes, because it only checks assessments and note wording.
  - **Proposed fix:**
    - (a) Grounding validator: every concept term equals, or is a deterministic normalization of, its source fact's conceptKey or value. My preference is that concept selection itself becomes deterministic code from conceptKey.
    - (b) Code chooses routes from the fact category. Model route output is ignored; automatic TRIALS, CHEMICAL or PUBLIC_HEALTH is rejected.
    - (c) CANCER_INFO only when a stated fact is itself cancer-related.
    - (d) Evidence cards show "Retrieved for: <concept> (<informationState>)", or "Clinician search" for manual queries.
    - (e) New CS-38, "No unstated condition in evidence queries" (P12; corpus area "possibility containment (R2)"). The deliberately wrong mock concepts "lung cancer" and "tuberculosis" must be rejected.
  - **Proposed owners:** evidence-research-engineer, ai-clinical-engineer, clinical-safety-engineer (CS-38, after approval).
  - **Shared position with evidence:** AGREED (evidence records it as E2-01; routes as E2-02). HIGH; a new CS row rather than an extension of CS-37 or CS-18. Evidence prefers deterministic concepts from conceptKey and will put both options to the lead.

#### MEDIUM

- **S2-03 — Earlier-visit PROVISIONAL facts disappear from the derived views, while the conflict detector still uses them.**
  - **Severity:** MEDIUM
  - **Files:**
    - `DATA_MODEL.md` §10.2 point 5 ("PROVISIONAL medication mentions from the latest visit") and §10.1
    - `PRODUCT_SPEC.md` FR-9.4, FR-23.2, FR-25.1 and FR-25.3
    - `DATA_MODEL.md` §9 "Detection"
    - ADR-035 point 6
    - `UI-UX.md` line 83
  - **Conflict:**
    - Finalize ≠ confirm, so visit-1 facts can stay PROVISIONAL for good. Synthetic example: visit 1 has "I take warfarin 5 mg daily", PATIENT_REPORTED and PROVISIONAL, and the note is finalized unreviewed.
    - At visit 2, warfarin is in neither "current medications" (CONFIRMED only) nor "Proposed — needs review" (latest visit only).
    - Yet ADR-035 point 6 still uses that fact in CROSS_VISIT conflicts. A conflict can therefore reference a medication that no view lists, which goes against FR-25.3 and `CLINICAL-SAFETY.md` §14 ("never choose silently").
  - **Proposed fix:** In §10.2 point 5 and FR-9.4, "Proposed — needs review" lists every current-version, non-rejected PROVISIONAL mention from any visit, with its visit date. A mention not repeated later is annotated "not discussed since <date>". Apply the same rule in §10.1 to PROVISIONAL HISTORY_MEDICAL facts and assessments.
  - **Proposed owners:** data-engineer (§10), product-clinical-architect (FR-9.4), ux-accessibility-engineer (`UI-UX.md` line 83).
  - Sent to `product`; see Messages.
  - **Shared position with product: AGREED.** Product confirms there is no product reason for the latest-visit-only scope, and adds three refinements:
    1. The Proposed list holds current PROVISIONAL mentions from any visit: not superseded, not REJECTED, not resolved away (product finding P2-01).
    2. An item leaves the list only through a clinician action on that medication identity, never by age or absence. Earlier-visit items are grouped under "From earlier visits — not reviewed" on Screen 4, with a count on Screen 16.
    3. The same rule applies to §10.1.
  - **Safety caveat, sent to product:** a later CONFIRMED record removes an earlier PROVISIONAL mention only when no OPEN FactConflict involves them. Otherwise the earlier mention stays visible with "Conflict — review". **Product accepted the caveat.**
  - **Proposed CS case:** an earlier-visit PROVISIONAL medication not mentioned at visit 2 stays in Proposed with "not discussed since <date>" (see S2-10).

- **S2-04 — The provenance/derivation pairing rule rejects every clinician confirmation.**
  - **Severity:** MEDIUM
  - **Files:**
    - `DATA_MODEL.md` §3.9 ("Allowed provenance" column), §6 rule 11, §3.2 rule 2, §5.3 (confirm keeps the version), §5.4 (candidate → Assessment) and §8.5
    - `BUILD_PLAN.md` Phase 4 Tests ("provenance/derivation validation")
  - **Conflict:**
    - Confirmation changes `provenance` to CLINICIAN_CONFIRMED in place and keeps `derivationMethod`.
    - §3.9 does not allow CLINICIAN_CONFIRMED with VERBATIM_EXTRACTION, NORMALIZED_EXTRACTION or AI_INFERENCE. Rule 11 states "AI_INFERENCE requires provenance AI_EXTRACTED".
    - Read literally, the Phase 4 repository validator rejects every confirmation and every candidate confirmation. The likely workaround is to weaken rule 11, but §8.5 relies on rule 11 for CS-29.
    - The candidate-created Assessment (§5.4) also has no defined derivationMethod or sourceSegmentIds.
  - **Proposed fix:**
    - Rule 11 and §3.9 apply to the pair (`originProvenance`, `derivationMethod`). Current `provenance` may differ only as CLINICIAN_CONFIRMED with status CONFIRMED and a CLINICIAN actor.
    - The §5.4 Assessment gets derivation AI_INFERENCE, origin AI_EXTRACTED, sourceSegmentIds equal to the union of the supporting facts' segments, and `linkedCandidateId`.
  - **Proposed owner:** data-engineer.

- **S2-06 — CS-30's AI-text half has no validator.**
  - **Severity:** MEDIUM
  - **Files:**
    - `CLINICAL-SAFETY.md` CS-30 and §13
    - `AI.md` §5.1 (no image-match rule)
    - `TESTING.md` §13a item 3 (a "reference-image 'match' phrasing" fixture exists)
    - `BUILD_PLAN.md` Phase 12 Tests (CS-30 is not in Phase 13 or 15)
  - **Conflict:** The adversarial fixture exists, but no validator rejects it. Under the §13a rule, the AI-text half of CS-30 therefore stays pending in every phase.
  - **Proposed fix:**
    - Add `AI.md` §5.1 rule 14: candidate, synthesis, job 16 and note free text must not contain image-match or patient-match phrasing (deterministic list: "matches the image", "consistent with the picture", "looks like the reference"…).
    - Schedule CS-30b in P13 and P15.
  - **Proposed owners:** ai-clinical-engineer, clinical-safety-engineer.

- **S2-07 — Possibilities can use one side of an OPEN conflict as support, and detecting a new conflict does not mark them outdated.**
  - **Severity:** MEDIUM
  - **Files:**
    - `AI.md` job 12 (input "facts (with informationState and review status)", without the OPEN-conflict exclusion that job 11 has)
    - `DATA_MODEL.md` §4.14 and §9 rule 5 (lists notes, proposals and comparisons, but not candidates)
    - ADR-034 points 4–5
    - `PRODUCT_SPEC.md` FR-18.8
    - `CLINICAL-SAFETY.md` §14
  - **Conflict:** Synthetic example: "I don't take any medications" … "I take metformin". A candidate can cite the metformin fact as supporting while the blanket denial is ignored. That silently picks a side.
    - FR-18.8 marks a candidate outdated on "conflict-resolved", but not on "conflict detected" after generation, for example after a later manual entry or a cross-visit check.
  - **Proposed fix:**
    - Add candidates to the §9 rule 5 list.
    - Job-12 validator: a fact in an OPEN conflict may be referenced only if every fact of that conflict is referenced (as supporting or contradicting), and code shows "Conflict — review" on the candidate.
    - Add "conflict detected" to the staleness triggers (§4.14, FR-18.8).
  - **Proposed owners:** ai-clinical-engineer, data-engineer, product-clinical-architect.

- **S2-08 — Reported speech is not distinguished from a clinician statement.**
  - **Severity:** MEDIUM
  - **Files:**
    - `TESTING.md` §6 row "Doctor says the patient has asthma." (no speaker role given)
    - `CLINICAL-SAFETY.md` CS-34 (DOCTOR role) and §18 corpus area "speaker provenance"
    - `AI.md` job 7
    - `DATA_MODEL.md` §8.3
  - **Conflict:**
    - The §6 row can be encoded as a fixture spoken by PATIENT or UNKNOWN that still expects CLINICIAN_STATED. That would be content-based provenance, which ADR-021 forbids.
    - No test covers a patient reporting a past diagnosis, e.g. PATIENT "My doctor told me I have asthma". The expected result is HISTORY_MEDICAL, POSITIVE, PATIENT_REPORTED, PROVISIONAL; never an Assessment, never CLINICIAN_STATED.
  - **Proposed fix:**
    - Rewrite the §6 row as `DOCTOR: "The patient has asthma."`.
    - Add a CS row for the reported-speech case, in the P10 corpus area "speaker provenance".
  - **Proposed owners:** clinical-safety-engineer (CS row, with owner approval), qa-test-engineer (§6 row).

#### LOW

- **S2-09 — "Confirm" wording still sits on the note path.**
  - **Severity:** LOW
  - **Files:**
    - `PRODUCT_SPEC.md` FR-21.3 ("AI draft — review before confirming") and §6 workflow ("→ Clinician confirmation → Save encounter")
    - `UI-UX.md` line 211
    - `BUILD_PLAN.md` Phase 15 task 5
  - **Conflict:** This wording blurs CS-25 (finalize ≠ confirm).
  - **Proposed fix:**
    - Change the label to "AI draft — review before finalizing".
    - In the workflow, use "Clinician confirms facts → Clinician finalizes note".
  - **Proposed owners:** product-clinical-architect, ux-accessibility-engineer.

- **S2-10 — Safety expectations with no CS ID.**
  - **Severity:** LOW
  - **Files:**
    - `BUILD_PLAN.md` Phase 15 Tests, last bullet: a PROVISIONAL "no allergies" is never rendered as NKDA (`DATA_MODEL.md` §10.3; `AI.md` job 15)
    - `TESTING.md` S13: transcript-text correction
    - S2-03: earlier-visit PROVISIONAL visibility
  - **Conflict:** Gate 6 is driven by CS IDs, so it can skip these.
  - **Proposed fix:** Add CS rows (CS-38 onward), with S2-01 and S2-08, after owner approval.
  - **Proposed owner:** clinical-safety-engineer.

- **S2-11 — Patient-friendly explanation (job 16) has no tier and no advice validator.**
  - **Severity:** LOW
  - **Files:**
    - `AI.md` job 16 ("no new advice")
    - `DECISIONS.md` ADR-025 tier table (job 16 not listed)
    - `BUILD_PLAN.md` Phase 13 task 4 (not flag-gated)
  - **Conflict:** A patient-specific explanation of a CONFIRMED assessment can drift into treatment advice, i.e. R2/R3. No deterministic check enforces "no new advice".
  - **Proposed fix:**
    - Assign job 16 a tier in ADR-025. My proposal: R2 behind the flag until assessed, or R1 limited to quoting PATIENT_EDUCATION excerpts.
    - Add a validator (no dose, frequency or treatment-directive patterns) and a CS row.
  - **Proposed owners:** chief-architect, ai-clinical-engineer, product-clinical-architect.

- **S2-12 — No staleness rule for evidence.**
  - **Severity:** LOW
  - **Files:**
    - ADR-034 point 5 (candidates only)
    - `DATA_MODEL.md` §4.15 (sourceFactIds without versions)
    - `ARCHITECTURE.md` §6.4
  - **Conflict:**
    - After a fact edit or re-derivation (e.g. fever POSITIVE → NEGATIVE after S2-01), the stored queries and bundle still reflect the superseded fact.
    - It is undefined whether a clinician "Regenerate" re-runs job 11 and retrieval first.
  - **Proposed fix:**
    - EvidenceQuery stores source fact version IDs, and the evidence screen marks queries outdated when they change.
    - Regeneration re-runs job 11 and retrieval before job 12.
  - **Proposed owners:** evidence-research-engineer, ai-clinical-engineer.

- **S2-13 — Stale lists.**
  - **Severity:** LOW
  - **Files:**
    - `DECISIONS.md` ADR-024 decision text ("No AI phase (10, 13, 15)")
    - `AI.md` §15, `BUILD_PLAN.md` rule 8 and `TESTING.md` §13a (10–13 and 15)
    - `TESTING.md` §13a "Minimum areas" (no "possibility containment (R2)", which `CLINICAL-SAFETY.md` §18 maps to CS-32 and CS-37)
  - **Proposed fix:**
    - Add a refinement note in ADR-034, or a superseding line; accepted ADRs are not edited.
    - Add the area to §13a.
  - **Proposed owners:** chief-architect, qa-test-engineer.

- **S2-15 — The job-11 half of CS-33 leaves a loophole.**
  - **Severity:** LOW
  - **Raised by:** `evidence` (E2-12); agreed.
  - **Files:** `CLINICAL-SAFETY.md` CS-33 ("job-11 concepts carry NEGATIVE facts' state or exclude them"), `DECISIONS.md` ADR-034 decision 4, `AI.md` §3 job 11.
  - **Conflict:** ADR-034 and job 11 exclude NEGATIVE facts entirely, but CS-33 also accepts "carry state". That is a weaker expected result than the spec.
  - **Proposed fix:** the job-11 half (P12) expects NEGATIVE, NOT_DISCUSSED, REJECTED, superseded and OPEN-conflict facts to be excluded from automatic job-11 input, and a mock concept sourced from such a fact to be rejected. The job-12 half (P13) is unchanged.
  - **Proposed owner:** clinical-safety-engineer, after approval to edit `CLINICAL-SAFETY.md`.
  - **Shared position with evidence:** AGREED.

### Minimum safety-corpus coverage check

Every minimum area in `TESTING.md` §13a maps to at least one CS ID in `CLINICAL-SAFETY.md` §18:
- negation: CS-01, CS-02, CS-33
- unknown information: CS-05, CS-06, CS-07
- speaker provenance: CS-15, CS-34
- medication ambiguity: CS-11, CS-26, CS-35, CS-36
- dose preservation: CS-08, CS-09, CS-10
- allergy state: CS-04, CS-05, CS-28
- contradiction: CS-14, CS-27, CS-28
- AI inference: CS-29, CS-31
- fake citation: CS-16
- fake PMID: CS-16a
- fake FDA record: CS-17
- reference-image interpretation: CS-30

The gaps are in depth, not presence:
- reference-image: the AI-text half has no validator (S2-06)
- speaker provenance: no reported-speech or text-correction case (S2-01, S2-08)
- allergy state: the PROVISIONAL NEGATIVE `ANY` case has no CS ID (S2-10)

### Checked, no conflict found

- ADR-034 flag-OFF behavior is consistent across five documents: `DATA_MODEL.md` §6 rule 18, `AI.md` §3, `ARCHITECTURE.md` §6.4, `PRODUCT_SPEC.md` FR-18.6 and `TESTING.md` §15. With the flag OFF there are no job 12/13 executions and no ClinicalCandidate (CS-37).
- The note is independent of candidates in `DATA_MODEL.md` §5.2, `AI.md` job 15, `ARCHITECTURE.md` §6.5 and FR-21.2.
- ADR-036 public identifiers are allowed only as typed fields from validated responses (`ARCHITECTURE.md` §6.4 sanitizer). This keeps CS-16 and CS-16a intact, because the model never types an identifier.
- Automatic trial retrieval is removed (`EVIDENCE-SOURCES.md` §17; `CLINICAL-SAFETY.md` §12), which removes the enrollment-recommendation risk.
- CS-36 is consistent across `DATA_MODEL.md` §4.7 and §6 rule 9, `AI.md` job 4, `CLINICAL-SAFETY.md` §11 and `TESTING.md` §6.
- A POSITIVE allergy is never hidden: `DATA_MODEL.md` §9 rule 6 and §10.3, FR-9.3, `UI-UX.md` line 83.

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team2-safety.md (this file only)

## Interfaces Changed

none

## Dependencies

- Relied on:
  - CLAUDE.md
  - .claude/rules/clinical-safety.md
  - docs/DECISIONS.md (ADR-021…ADR-037, OD list)
  - docs/CLINICAL-SAFETY.md (all)
  - docs/TESTING.md §6, §7, §13, §13a and §15
  - docs/DATA_MODEL.md §2–§10
  - docs/AI.md (all)
  - docs/QUALITY-GATES.md Gate 6
  - docs/BUILD_PLAN.md cross-phase rules and Phases 4, 6, 9–18
  - docs/PRODUCT_SPEC.md §5, §6, §7 (Features 8–26) and §12
  - docs/ARCHITECTURE.md §6.4–§6.6 and §8
  - docs/EVIDENCE-SOURCES.md §17
  - docs/UI-UX.md (grep for the cited lines)
  - docs/PROJECT-STATUS.md
  - the run-1 handoff docs/agent-handoffs/2026-10-08-stage-a-team-safety.md
- Depends on this: Task D (lead synthesis, `2026-10-08-stage-a-team2-synthesis.md`).

## Tests

none — documentation review task (0 tests)

## Evidence

- Run-1 verification: the file and section references are in the table above. L6: `docs/PROJECT-STATUS.md` lines 76–89 (F-01…F-14 "OPEN").
- S2-01:
  - `docs/DATA_MODEL.md` §3.2 rule 8, §3.9 DETERMINISTIC_RULE row, §4.10, §5.3, and §6 rules 6 and 12
  - `docs/DECISIONS.md` ADR-035 point 1
  - `docs/PRODUCT_SPEC.md` FR-22.3
  - `docs/CLINICAL-SAFETY.md` §15 and CS-15
  - `docs/TESTING.md` §13 S13
  - `docs/AI.md` §3 jobs 7–8 (input "DOCTOR segments")
- S2-02:
  - `docs/AI.md` §3 job 15 and §5.1 rules 7 and 12
  - `docs/DATA_MODEL.md` §4.18
  - `docs/ARCHITECTURE.md` §6.5
  - `docs/CLINICAL-SAFETY.md` CS-18, CS-19 and CS-20
  - `docs/TESTING.md` §13a items 3–4 and "Harness self-tests"
- S2-03:
  - `docs/DATA_MODEL.md` §10.1, §10.2 point 5 and §9 "Detection"
  - `docs/DECISIONS.md` ADR-035 point 6
  - `docs/PRODUCT_SPEC.md` FR-9.4, FR-23.2, FR-25.1 and FR-25.3
  - `docs/UI-UX.md` line 83
- S2-04:
  - `docs/DATA_MODEL.md` §3.2 rule 2, §3.9, §5.3, §5.4, §6 rule 11 and §8.5
  - `docs/BUILD_PLAN.md` Phase 4 Tests
- S2-05:
  - `docs/BUILD_PLAN.md` line 367 (Phase 10 CS list)
  - CS-19 has no match in BUILD_PLAN: I ran `grep -n "CS-19\b" docs/BUILD_PLAN.md` and it returned nothing
  - lines 184–185 (Phase 4), 400–406 (Phase 11), 433–441 (Phase 12), 466–468 (Phase 13), 520–526 (Phase 15)
  - Phase 18 Tests (no CS ID)
  - `docs/QUALITY-GATES.md` Gate 6
  - `docs/TESTING.md` §15 item 2
- S2-06:
  - `docs/CLINICAL-SAFETY.md` §13 and CS-30
  - `docs/AI.md` §5.1 (rules 1–12)
  - `docs/TESTING.md` §13a item 3
  - `docs/BUILD_PLAN.md` line 441
- S2-07:
  - `docs/AI.md` §3 jobs 11 and 12
  - `docs/DATA_MODEL.md` §4.14 and §9 rule 5
  - `docs/DECISIONS.md` ADR-034 points 4–5
  - `docs/PRODUCT_SPEC.md` FR-18.8
  - `docs/CLINICAL-SAFETY.md` §14
- S2-08:
  - `docs/TESTING.md` §6 row "Doctor says the patient has asthma."
  - `docs/CLINICAL-SAFETY.md` CS-34
  - `docs/PRODUCT_SPEC.md` §5.4 row `Doctor: "The patient has asthma."`
  - `docs/DATA_MODEL.md` §8.3
- S2-09:
  - `docs/PRODUCT_SPEC.md` FR-21.3 (line 287) and §6 (line 125)
  - `docs/UI-UX.md` line 211
  - `docs/BUILD_PLAN.md` line 509
- S2-10:
  - `docs/BUILD_PLAN.md` Phase 15 Tests, last bullet
  - `docs/DATA_MODEL.md` §10.3
  - `docs/TESTING.md` S13
- S2-11:
  - `docs/AI.md` §3 job 16
  - `docs/DECISIONS.md` ADR-025 tier table
  - `docs/BUILD_PLAN.md` Phase 13 task 4
- S2-12:
  - `docs/DECISIONS.md` ADR-034 point 5
  - `docs/DATA_MODEL.md` §4.15
  - `docs/ARCHITECTURE.md` §6.4
- S2-13:
  - `docs/DECISIONS.md` ADR-024 "Decision"
  - `docs/AI.md` §15
  - `docs/BUILD_PLAN.md` cross-phase rule 8
  - `docs/TESTING.md` §13a "Minimum areas"
  - `docs/CLINICAL-SAFETY.md` §18 coverage table
- S2-15: `docs/CLINICAL-SAFETY.md` CS-33; `docs/DECISIONS.md` ADR-034 decision 4; `docs/AI.md` §3 job 11.
- S2-14:
  - `docs/AI.md` §3 job 11 and §5.1 rule 1
  - `docs/EVIDENCE-SOURCES.md` §17 ("Staged route selection") and §4.12
  - `docs/DECISIONS.md` ADR-025 R2 row
  - `docs/CLINICAL-SAFETY.md` CS-18 and CS-37
  - message from `evidence` (Messages table)
- No commit hash. The review covers the uncommitted working tree on 2026-10-08.

## Known Limitations

- I did not review in depth: SPEECH, SECURITY, PRIVACY, API_CATALOG, GOOGLE-PLAY or DEPLOYMENT. I read UI-UX only through targeted greps.
- The findings reflect the uncommitted working tree on 2026-10-08.
- No implementation exists, so the Gate 6 verdict covers spec consistency only. It is not a test result.

## Risks

- **S2-01:** if unfixed, a corrected transcript number or negation can survive in a PROVISIONAL fact, or the validator gets relaxed to let S13 pass.
- **S2-02:** without fact-referenced note statements, an invented diagnosis or plan can reach a finalized note and export, and only a phrase list would stand in the way.
- **S2-05:** an undefined "applicable" invites per-phase judgment calls on Gate 6.
- **S2-14:** release builds (flag OFF) could still show patient-specific condition suggestions through the evidence screen, which defeats the ADR-025 gate.
- **S2-03:** an unreviewed medication from an earlier visit (e.g. an anticoagulant) can drop out of every view.

## Required Follow-up

- **evidence-research-engineer + ai-clinical-engineer:** S2-14 (job-11 grounding validator, deterministic routes, card "retrieved for" label).
- **chief-architect:** S2-01 (ADR-035 clarification), S2-05 (BUILD_PLAN, QUALITY-GATES), S2-11 (ADR-025 tier), S2-13, and L6 (PROJECT-STATUS).
- **data-engineer:** S2-01 (§3.2 and §5.3), S2-02 (§4.18), S2-03 (§10), S2-04 (rule 11 and §5.4), S2-07 (§9 rule 5 and §4.14).
- **ai-clinical-engineer:** S2-01 (re-extraction path), S2-02 (job 15 schema and §5.1 rule 13), S2-06 (§5.1 rule 14), S2-07 (job-12 validator), S2-11, S2-12.
- **product-clinical-architect:** S2-01 (FR-22.3), S2-03 (FR-9.4), S2-07 (FR-18.8), S2-09 (FR-21.3 and §6).
- **clinical-safety-engineer:** with lead approval to edit `CLINICAL-SAFETY.md`, the S2-05 phase column, new CS rows for S2-01, S2-02, S2-06, S2-08, S2-10 and S2-14 (CS-38), and the S2-15 CS-33 wording.
- **qa-test-engineer:** S2-05 (harness phase tags), S2-08 (`TESTING.md` §6 row), S2-13.
- **evidence-research-engineer:** S2-12.
- **ux-accessibility-engineer:** S2-03 (`UI-UX.md` line 83), S2-09.

## Messages

| Direction | Counterpart | First line | UTC time |
|---|---|---|---|
| sent | product | [STAGE-A2-MSG] safety -> product: Earlier-visit PROVISIONAL medications disappear from the current-medications view, even though the conflict detector still uses them. | 2026-10-08T08:26Z |
| received | team-lead | (task_assignment JSON for task #3) | 2026-10-08T08:25Z |
| received | team-lead | Lead note: teammates in this session did not receive the Task tools. I have marked task #3 as in_progress with owner safety on your behalf. | ~2026-10-08T08:29Z |
| received | evidence | [STAGE-A2-MSG] Evidence safety: AI job 11 can introduce conditions nobody stated into evidence queries, which leaks R2-like output onto the R1 evidence screen while the possibilities flag is OFF. | ~2026-10-08T08:29Z |
| sent | evidence | [STAGE-A2-MSG] safety -> evidence: Agreed, this is HIGH, and it should be a new CS row rather than an extension of CS-37 or CS-18. | 2026-10-08T08:29Z |
| received | product | [STAGE-A2-MSG] RE: earlier-visit PROVISIONAL medications disappearing. Product agrees: there is no product reason for the latest-visit-only scope, and FR-9.4 should state the wider rule. | ~2026-10-08T08:31Z |
| sent | product | [STAGE-A2-MSG] safety -> product: I agree with your S2-03 refinements 1–3, with one caveat on removal by a later CONFIRMED record. | 2026-10-08T08:31Z |
| sent | team-lead | [STAGE-A2-RESULT] safety: 14 findings (4 HIGH); Gate 6 doc verdict FAIL | 2026-10-08T08:32Z |
| received | evidence | [STAGE-A2-MSG] evidence -> safety: Agreed on all points. I'm recording E2-01 = S2-14 as HIGH, AGREED, with proposed row CS-38 in Phase 12. | ~2026-10-08T08:33Z |
| received | product | [STAGE-A2-MSG] RE: S2-03 caveat — accepted. A later CONFIRMED record never removes an earlier PROVISIONAL mention while an OPEN conflict links them. | ~2026-10-08T08:33Z |
| sent | evidence | [STAGE-A2-MSG] safety -> evidence: Agreed on E2-12. The "carry state OR exclude" in CS-33 is a loophole, and the job-11 half should match ADR-034 decision 4 and AI.md job 11. | 2026-10-08T08:33Z |
| sent | product | [STAGE-A2-MSG] safety -> product: Thanks. S2-03 is closed between us as AGREED (product + safety), including the caveat that a confirmation never settles a conflict as a side effect. No further open points from safety. | 2026-10-08T08:33Z |
| sent | team-lead | [STAGE-A2-RESULT] safety (update): 15 findings (4 HIGH); Gate 6 doc verdict FAIL | 2026-10-08T08:33Z |

## Receiving Agent

chief-architect (team-lead) — REVIEW REQUIRED: yes, by chief-architect. After the HIGH findings S2-01, S2-02, S2-05 and S2-14 are fixed, clinical-safety-engineer must re-review them before the Gate 6 documentation verdict can change to PASS.

## Next Action

chief-architect triages S2-01, S2-02, S2-05 and S2-14 in the Task D synthesis and assigns the fixes. Then clinical-safety-engineer re-reviews and reissues the Gate 6 documentation verdict.
