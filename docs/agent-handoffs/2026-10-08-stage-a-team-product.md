# Task Handoff

## Owner

product (product-clinical-architect)

## Task

Task #1 (Task A): product specification review. Question: "Review the reconciled ClinNote specifications and identify any remaining conflicts between product workflow, evidence retrieval, and clinical safety." Phase 0, Stage A agent-team test.

## Status

COMPLETED. This was a documentation review. No spec was edited.

## What Changed

I reviewed the post-Stage-A specs independently and found 12 remaining conflicts or gaps (P-01 to P-12): 2 HIGH, 5 MEDIUM, 5 LOW. Each finding has a proposed fix and a proposed owner. None weakens a CLINICAL-SAFETY requirement. Every fix is equally or more restrictive.

### HIGH

**P-01: A note draft can include PROVISIONAL possibilities.**
- DATA_MODEL §5.2 (pipeline stages): note drafting "includes candidates only if candidateState COMPLETED".
- AI.md §3: execution order "12 → 13 → 15" runs the note job after candidates. The job 15 input list (facts, conflicts, review decisions, note type) has no candidates.
- PRODUCT_SPEC FR-21.2: drafts come only from "the visit's facts and confirmed information". FR-14.2: possibilities are never assessments unless the clinician confirms one.
- Effect: an unconfirmed AI possibility could enter a note draft or a draft export (FR-26.1). Finalizing does not confirm anything (FR-23.2, CS-25), so the possibility could be finalized as documentation without ever being confirmed. That breaks CLAUDE.md §5 (AI output must never silently become a confirmed diagnosis).
- No CS test covers it. CS-18 only checks diagnosis wording on a cough-only transcript.
- Proposed fix:
  - DATA_MODEL §5.2 should say: "Note drafting never includes PROVISIONAL or DISMISSED candidates. A candidate enters the note only after CONFIRMED_BY_CLINICIAN, as the resulting Assessment (provenance CLINICIAN_CONFIRMED, origin AI_EXTRACTED)."
  - AI.md §3 job 15 should state the same rule, and the execution order should show that job 15 does not wait on jobs 12–13.
  - Add a CS test: a PROVISIONAL candidate never appears in a note draft or export.
- Owners: data-engineer (DATA_MODEL), ai-clinical-engineer (AI.md), clinical-safety-engineer and qa-test-engineer (CS test), product (FR-21.2 wording).

**P-02: The `possibilitiesEnabled` flag hides possibilities but does not stop them being generated, and the candidate stage has no SKIPPED path when the flag is OFF.**
- BUILD_PLAN Phase 14 task 6 and UI-UX Screen 11 only hide the POSSIBILITIES section when the flag is OFF.
- BUILD_PLAN Phase 13 task 1, PRODUCT_SPEC FR-18.6 and ADR-025 say "behind a flag" but never say that jobs 12 and 13 do not run.
- DATA_MODEL §5.2 allows SKIPPED only for "manual mode / consent declined / cloud processing off", not for flag OFF. Its rule "a stage may start only when the previous stage is COMPLETED, PARTIAL or SKIPPED" contradicts its own exception "drafting is available after clinicalExtraction".
- Effect: in the default configuration, the R2 jobs could still run (sending fact data to the LLM), store hidden ClinicalCandidates, and, combined with P-01, feed notes released to real users. That conflicts with the "no release" rule for R2 in ADR-025.
- Proposed fix:
  - PRODUCT_SPEC FR-18.6 should say: "When possibilitiesEnabled is OFF, jobs 12 and 13 are not executed and no ClinicalCandidate is created."
  - DATA_MODEL §5.2 should add the transition `NOT_STARTED --possibilitiesEnabled OFF--> SKIPPED` for candidateState and make the note stage depend on clinicalExtraction, not on candidate.
  - AI.md §3 execution order should mark 12 and 13 as conditional on the flag.
  - BUILD_PLAN Phase 13 tests should add: "flag OFF → zero job-12/13 ProviderExecution records".
- Owners: product (FR-18.6), data-engineer, ai-clinical-engineer, chief-architect (BUILD_PLAN), qa-test-engineer.

### MEDIUM

**P-03: Evidence and possibilities are grounded on unreviewed facts, and nothing defines staleness, regeneration or the empty bundle.**
- PRODUCT_SPEC §6 and ARCHITECTURE §6.4/§7 run job 11 → retrieval → job 12 → job 13 automatically after extraction, on "non-rejected" facts (AI.md §3 job 11; ARCHITECTURE §6.4). Those facts are PROVISIONAL and include facts that need clarification or are part of an OPEN conflict.
- The clinician reviews facts on Screen 10 *before* Clinical Review (UI-UX §3).
- No document says which information states feed queries (EVIDENCE-SOURCES §17 "staged source selection").
- No document says what happens to candidates whose supportingFactIds or contradictingFactIds point to a fact that is later rejected, superseded or conflict-resolved (DATA_MODEL §4.14, §6 rule 8).
- ARCHITECTURE §6.4 mentions candidate "regeneration", but no FR, trigger or transition exists for it. DATA_MODEL §5.2 allows a re-run only from FAILED or PARTIAL.
- No document says whether job 12 runs on an empty bundle (FR-17.4, FR-18.5).
- Proposed fix:
  - Automatic job 11 excludes facts that need clarification or are in an OPEN conflict. The information states it uses are stated explicitly.
  - Candidates show "Outdated — facts changed since generation" when any referenced fact changes.
  - A clinician-triggered "Regenerate" moves candidateState COMPLETED → IN_PROGRESS. Previous candidates and their clinician decisions are kept, never deleted.
  - Job 12 does not run when the bundle is empty (candidateState SKIPPED; "No evidence retrieved — possibilities not generated").
- I asked evidence about this (see Messages). Owners: evidence-research-engineer (EVIDENCE-SOURCES §17), ai-clinical-engineer (AI.md §3), data-engineer (§5.2), product (new FR-18.7 and FR-18.8).

**P-04: Correcting a speaker role after extraction has no data representation and contradicts the provenance rules.**
- PRODUCT_SPEC FR-22.3 and SPEECH §11 let the clinician correct speaker roles after extraction, and SPEECH §11 "marks downstream facts from changed segments for re-review". DATA_MODEL has no field, ClarificationReason (§3.10) or state for "re-review".
- `originProvenance` is immutable (§3.2 rule 1). A fact from a segment changed from DOCTOR to PATIENT would keep CLINICIAN_STATED, which violates §6 rule 12 (the provenance must match the source segment's confirmed role).
- §3.2 rule 5 says the clinician may "reattribute an individual fact to PATIENT_REPORTED, recorded as an edit". But rule 4 says every edit produces CLINICIAN_CONFIRMED / CONFIRMED, and rule 12 requires the source segment role to be PATIENT.
- safety raised the same conflict independently (see Messages). It also cited CLINICAL-SAFETY §15, CS-15 ("correcting a role updates the provenance of affected PROVISIONAL facts") and TESTING S13 ("downstream facts re-flagged"), none of which have a field or transition in DATA_MODEL.
- Proposed fix (agreed with safety):
  - When the clinician corrects a role or segment text after extraction, deterministic code re-derives each affected PROVISIONAL fact as a new fact version. The new version gets originProvenance from the corrected role (derivation DETERMINISTIC_RULE, never upgraded) and status PROVISIONAL. The old version is kept and `supersededByFactId` is set. An AuditEvent ROLE_MAPPING_CHANGED (or UPDATED, for text edits) is written. originProvenance is never mutated in place.
  - Affected CONFIRMED facts are never changed silently. They get `needsClarification` with a new ClarificationReason SOURCE_CHANGED and return to re-review.
  - Remove "to PATIENT_REPORTED" from rule 5. Per-fact reattribution is either a segment role correction (as above) or a clinician edit (CLINICIAN_CONFIRMED).
  - CLINICAL-SAFETY §15 / CS-15 wording becomes "re-derives affected PROVISIONAL facts as new versions" (clinical-safety's decision).
  - Addition (raised by safety): under §3.2 rule 4, an edited fact's new version has origin CLINICIAN_CONFIRMED, so the original source (e.g. patient-reported, AI inference) is no longer shown on the current version. That conflicts with FR-23.3 and CLINICAL-SAFETY §4. Fix: the UI resolves the supersedes chain and shows "Edited by clinician · originally <root origin>", or DATA_MODEL adds an immutable `rootOriginProvenance` that is copied forward on every version.
- Owners: data-engineer, clinical-safety-engineer, speech-diarization-engineer (SPEECH §11), product (FR-22.3 wording).

**P-05: The allergy status view shows "Not discussed" for allergy topics that were discussed.**
- DATA_MODEL §10.3 shows "Not discussed" in every case that is not a POSITIVE allergy or a CONFIRMED NEGATIVE `ANY`. That catches a PROVISIONAL patient statement "No allergies" (NEGATIVE, PATIENT_REPORTED, PROVISIONAL) and an UNKNOWN statement "not sure if I'm allergic to anything".
- This conflicts with PRODUCT_SPEC §5.1 (NOT_DISCUSSED means the topic was not raised), FR-9.3 ("NOT DISCUSSED when no allergy information exists") and FR-12.3.
- The safety direction is correct: it never shows NKDA wrongly. The semantics are wrong: it records that a topic was not raised when it was.
- Proposed fix: §10.3 gets four display states:
  - POSITIVE list
  - "No known allergies" (CONFIRMED NEGATIVE ANY, no POSITIVE)
  - "No allergies reported — needs review" (PROVISIONAL NEGATIVE ANY, no POSITIVE)
  - "Allergy status unclear — needs clarification" (UNKNOWN)
  - "Not discussed" only when no allergy fact exists. Never render the PROVISIONAL state as NKDA in a note.
- Owners: data-engineer (§10.3), product (FR-9.3), ux-accessibility-engineer (Screen 4), clinical-safety-engineer (review).

**P-06: Clinician sign-in (ADR-032) has no functional requirement.**
- UI-UX Screen 18 has "clinician account sign-in/out", and ADR-032 says cloud stages need sign-in. PRODUCT_SPEC Features 27–28 have no FR for sign-in, the signed-out state, or disclosure of the clinician email.
- FR-28.2 implies evidence search is also off when the toggle is OFF ("no audio or text leaves the device"), but the toggle label "Cloud AI and transcription" does not mention evidence search (FR-17.2).
- Proposed fix (product, in a new spec revision):
  - FR-28.4: cloud stages require a signed-in clinician account. When signed out, local features work and cloud stages show "Sign in to use cloud processing".
  - FR-28.5: the account holds clinician email only, and no patient data is linked to it.
  - FR-27.3: the disclosure names the account data.
  - The toggle label or description names evidence search.
- Owners: product, ux-accessibility-engineer, security-privacy-engineer.

**P-07: The input set for return-visit comparison is undefined.**
- ARCHITECTURE §6.6 diffs "previous visit facts + current visit facts". It does not say whether the previous baseline includes PROVISIONAL, REJECTED or superseded versions.
- PRODUCT_SPEC FR-25.2 ("only explicitly documented information") and UI-UX Screen 16 ("WHAT CHANGED") rely on that set. An unreviewed AI_EXTRACTED fact from the last visit could appear as documented history.
- Proposed fix:
  - The diff excludes REJECTED and superseded versions.
  - PROVISIONAL baseline items are included but labeled "Provisional — not reviewed".
  - OPEN conflicts are shown as conflicting (DATA_MODEL §9 rule 5). The diff is deterministic, and job 14 only words it.
- Owners: product (FR-25.4 new), data-engineer, ai-clinical-engineer (job 14 input).

### LOW

**P-08:** PRODUCT_SPEC §6 (core workflow) and §12 success criterion 6 present "Possibilities to review" as an unconditional step. Fix: annotate both "(R2 — only when possibilitiesEnabled; default OFF, ADR-025)". Owner: product.

**P-09:** BUILD_PLAN Phase 14 task 1 lists the sections as "FACTS / POSSIBILITIES TO REVIEW / EVIDENCE / NOTE". UI-UX Screen 11 says "FACTS · EVIDENCE · POSSIBILITIES TO REVIEW · NOTE, in pipeline order (ADR-023)". Fix: change BUILD_PLAN to the UI-UX order. Owner: chief-architect.

**P-10:** Label inconsistencies:
- UI-UX §2 uses the provenance tag "AI", but PRODUCT_SPEC §5.2 and DATA_MODEL §3.2/§8.5 require "AI inference — verify".
- FR-9.4, DATA_MODEL §10.1 and Screen 4 say "Proposed — needs review", but DATA_MODEL §10.2 item 5 says "Mentioned this visit — needs review".
- Fix: one canonical string list, owned by product and implemented by ux. Owners: ux-accessibility-engineer, data-engineer.

**P-11:** DATA_MODEL wording around superseded versions:
- §3.2 rule 4 says the old version is kept "with status SUPERSEDED_BY_EDIT". But §3.3 ReviewStatus has no such value, and it says the row keeps its last status and the AuditEvent records the supersession.
- §5.7 says facts are "marked superseded by resolution" but names no field.
- Fix: rule 4 should refer to AuditEvent action SUPERSEDED_BY_EDIT plus `supersededByFactId`. §5.7 should name the marker. Owner: data-engineer.

**P-12:** PROJECT-STATUS "Open Findings" still lists F-01 to F-14 as OPEN, and lists four minor items, even though:
- ADR-021–ADR-029 and ADR-033 record the findings as resolved
- UI-UX Screen 21, PRODUCT_SPEC §11 (Appointment), FR-26.5 and ADR-027 resolve the minor items
- Fix: the status table records the Stage A resolution once the owner has reviewed it. Owner: chief-architect.

### Checked with no conflict found

- The canonical evidence → possibility order is consistent across PRODUCT_SPEC §6/FR-17.1/FR-18.5, ARCHITECTURE §6.4, AI.md §3, EVIDENCE-SOURCES §17, DATA_MODEL §4.14/§4.15/§5.2 and BUILD_PLAN Phases 12–13.
- The provenance summary (PRODUCT_SPEC §5.2, §5.4) matches DATA_MODEL §3.2 and §8.3.
- The contradiction model (FR-8.7) matches DATA_MODEL §9 and §5.7.
- Current medications and active problems (FR-9.4) match DATA_MODEL §10.1–§10.2.
- Live stage is transcript-only (Screen 8, ARCHITECTURE §7, AI.md §16, ADR-027).
- Absence never means discontinuation (FR-11.3, FR-25.3, DATA_MODEL §4.7/§10.2, CLINICAL-SAFETY).
- Finalize ≠ confirm (FR-23.2, DATA_MODEL §5.5, Screen 14, CS-25).

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team-product.md (this file, new). No other file was edited.

## Interfaces Changed

None. Several proposed fixes would touch IC-019 (feature flags, P-02) and would need an Integration Contract change by its owners.

## Dependencies

- Relied on: CLAUDE.md; docs/PROJECT-STATUS.md; docs/DECISIONS.md (ADR-021 to ADR-033); docs/PRODUCT_SPEC.md; docs/UI-UX.md; docs/DATA_MODEL.md (§3, §4, §5, §8–§10); docs/AI.md §2–§7, §15–§16; docs/ARCHITECTURE.md §6.3–§7; docs/EVIDENCE-SOURCES.md §14–§17; docs/BUILD_PLAN.md Phases 12–15; docs/CLINICAL-SAFETY.md (by grep); docs/SPEECH.md §10–§11.
- Depends on this: Task #4 (Task D, chief-architect synthesis).

## Tests

none — documentation review task (0 tests)

## Evidence

- P-01: DATA_MODEL §5.2 (line 396); AI.md §3 execution order (line 43) and job 15 row (line 61); PRODUCT_SPEC FR-14.2, FR-21.2, FR-23.2, FR-26.1; CLINICAL-SAFETY CS-18, CS-25.
- P-02: BUILD_PLAN Phase 13 task 1 (line 449), Phase 14 task 6 (line 482); UI-UX Screen 11; PRODUCT_SPEC FR-18.6; DECISIONS ADR-025 R2 row; DATA_MODEL §5.2 (lines 396–405).
- P-03: PRODUCT_SPEC §6, FR-17.1, FR-17.4, FR-18.5; ARCHITECTURE §6.4 (lines 184, 203), §7; AI.md §3 job 11; EVIDENCE-SOURCES §17; DATA_MODEL §4.14, §5.2, §6 rule 8; UI-UX Screens 10–11.
- P-04: PRODUCT_SPEC FR-22.3, FR-23.3, §5.2; SPEECH §11; DATA_MODEL §3.2 rules 1, 4, 5; §3.10; §5.3; §6 rule 12; CLINICAL-SAFETY §4, §15, CS-15; TESTING S13; BUILD_PLAN Phase 9 (the last four were cited by safety).
- P-05: DATA_MODEL §10.3; PRODUCT_SPEC §5.1, FR-9.3, FR-12.2, FR-12.3; UI-UX Screen 4.
- P-06: DECISIONS ADR-032; UI-UX Screen 18; PRODUCT_SPEC FR-17.2, FR-27.x, FR-28.x (no sign-in FR; full read of PRODUCT_SPEC).
- P-07: ARCHITECTURE §6.6; PRODUCT_SPEC FR-25.2; UI-UX Screen 16; AI.md §3 job 14.
- P-08: PRODUCT_SPEC §6, §12 item 6.
- P-09: BUILD_PLAN Phase 14 task 1 (line 477); UI-UX Screen 11.
- P-10: UI-UX §2, Screen 4, Screen 10; PRODUCT_SPEC §5.2, FR-9.4; DATA_MODEL §3.2, §8.5, §10.1, §10.2.
- P-11: DATA_MODEL §3.2 rule 4, §3.3, §5.7.
- P-12: PROJECT-STATUS "Open Findings" table and "Minor items"; DECISIONS ADR-021 to ADR-029, ADR-033.
- Grep evidence: `possibilitiesEnabled|candidateState` matches only in ARCHITECTURE:195, DECISIONS:237/280/418, INTEGRATION-CONTRACTS:46, BUILD_PLAN:19/39/449/482, UI-UX:159, DATA_MODEL:183/396. No document defines job-execution behavior when the flag is OFF.

## Known Limitations

- I read CLINICAL-SAFETY.md, TESTING.md and API_CATALOG.md by targeted grep only. The safety and evidence teammates own the full review of those files.
- I could not capture UTC timestamps for messages because this teammate has no shell tool. Message times are recorded as the session date only.
- The severity ratings are my product judgement. The safety-owner review of P-01, P-02, P-04 and P-05 may change them.

## Risks

- If P-01 and P-02 stay unresolved, R2 output could reach real users' notes even with the flag OFF. That is a regulatory-gate risk (ADR-025) and a clinical-safety risk (CLAUDE.md §5).
- If P-03 stays unresolved, stale possibilities could cite facts the clinician has rejected.
- If P-04 stays unresolved, a provenance label could be wrong after a role correction. A patient statement could then display as clinician-stated.

## Required Follow-up

- P-01: data-engineer, ai-clinical-engineer, clinical-safety-engineer + qa-test-engineer (new CS test), product.
- P-02: product, data-engineer, ai-clinical-engineer, chief-architect, qa-test-engineer (IC-019 owners: backend-api-engineer, mobile-android-engineer).
- P-03: evidence-research-engineer, ai-clinical-engineer, data-engineer, product.
- P-04: data-engineer, clinical-safety-engineer, speech-diarization-engineer, product.
- P-05: data-engineer, product, ux-accessibility-engineer.
- P-06: product, ux-accessibility-engineer, security-privacy-engineer.
- P-07: product, data-engineer, ai-clinical-engineer.
- P-08: product. P-09 and P-12: chief-architect. P-10: ux-accessibility-engineer, data-engineer. P-11: data-engineer.

## Messages

| Direction | Counterpart | First line | Time (UTC) |
|---|---|---|---|
| sent | evidence | [STAGE-A-MSG] Product workflow concern: evidence and possibilities are built from facts the clinician has not reviewed yet, and nothing defines what happens when that review changes the facts. | 2026-10-08 (exact time not captured; no shell tool) |
| received | safety | [STAGE-A-MSG] Provenance concern: PRODUCT_SPEC FR-22.3 lets the clinician correct speaker roles after extraction, but DATA_MODEL makes originProvenance immutable, so the original source can stay wrong for good. | 2026-10-08 (exact time not captured; no shell tool) |
| sent | safety (reply) | [STAGE-A-MSG] RE: Provenance concern: role correction after extraction. I agree that FR-22.3 should state this, and I've merged your proposal into my finding P-04. | 2026-10-08 (exact time not captured; no shell tool) |
| received | evidence (reply) | not yet received | — |

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes. chief-architect consolidates the findings in Task D. clinical-safety-engineer reviews P-01, P-02, P-04 and P-05. The project owner reviews the final reconciliation.

## Next Action

chief-architect adds P-01 to P-12 to the Task D synthesis and routes P-01 and P-02 (HIGH) to their owners first. Each fix goes through its owning agent under the documentation-first rule, with an ADR where it is architectural.
