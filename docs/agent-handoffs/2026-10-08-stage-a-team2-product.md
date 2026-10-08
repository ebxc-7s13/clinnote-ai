# Task Handoff

## Owner

product (product-clinical-architect)

## Task

Task #1 (Task A, run 2): product specification review. Question: "Review the reconciled ClinNote specifications and identify any remaining conflicts between product workflow, evidence retrieval, and clinical safety." Phase 0, Stage A agent-team test, run 2.

## Status

COMPLETED. This was a documentation review. No spec was edited. This handoff file is the only file written.

## What Changed

I checked the 12 run-1 findings (P-01 to P-12) against the current files. 11 are resolved and 1 is not (P-12, PROJECT-STATUS). I then looked for new conflicts, mainly ones introduced by the ADR-034, ADR-035 and ADR-036 edits. I found 15 (P2-01 to P2-15): 2 HIGH, 7 MEDIUM, 6 LOW. Every proposed fix is equally or more restrictive than the current text. None weakens a CLINICAL-SAFETY requirement.

### Run-1 verification

| Run-1 | Verdict | Evidence (file, section) |
|---|---|---|
| P-01 note drafts could include possibilities | RESOLVED | DATA_MODEL §5.2 ("note: depends on clinicalExtraction only … renders no candidates"), §4.14 last bullet; AI.md §3 execution order + job 15 ("Never ClinicalCandidates"), §5.1 item 12; ARCHITECTURE §6.5; PRODUCT_SPEC FR-21.2, FR-18.9; CLINICAL-SAFETY CS-32; DECISIONS ADR-034 item 3 |
| P-02 flag OFF only hid possibilities | RESOLVED | PRODUCT_SPEC FR-18.6; DECISIONS ADR-025 R2 row, ADR-034 item 2; DATA_MODEL §5.2 candidate precondition, §6 rule 18; AI.md §3 jobs 12–13; BUILD_PLAN Phase 13 task 1, Phase 14 task 6; CLINICAL-SAFETY CS-37; TESTING (flag-OFF rows, release E2E) |
| P-03 grounding on unreviewed facts; staleness, regeneration, empty bundle undefined | RESOLVED (residual: P2-04) | DECISIONS ADR-034 items 1, 4, 5; DATA_MODEL §4.14 (`outdated`, `supersededByRunId`), §4.15, §5.2; PRODUCT_SPEC FR-18.7, FR-18.8; ARCHITECTURE §6.4, §8; UI-UX Screen 11. Evidence staleness and SKIPPED re-entry are still undefined (P2-04) |
| P-04 role correction vs immutable origin | RESOLVED (residual: P2-02) | DECISIONS ADR-035; DATA_MODEL §3.2 rules 5 and 8, §3.10 SOURCE_CHANGED, §4.5 `rootOriginProvenance`, §5.3, §6 rule 16; PRODUCT_SPEC FR-22.3, FR-23.3; SPEECH §11; CLINICAL-SAFETY §4, §15, CS-15; TESTING S13; BUILD_PLAN Phase 10 task 6a. Re-derivation is unsafe for text corrections and for AI inferences (P2-02) |
| P-05 allergy view showed "Not discussed" for discussed topics | RESOLVED (residual: P2-06) | DATA_MODEL §10.3 (five display states); PRODUCT_SPEC FR-9.3; UI-UX Screen 4; AI.md job 15 validator (PROVISIONAL NEGATIVE `ANY` never NKDA) |
| P-06 no sign-in FR | RESOLVED (residual: P2-11) | PRODUCT_SPEC FR-27.3, FR-28.1 (label names evidence search), FR-28.4, FR-28.5; UI-UX Screen 18 |
| P-07 comparison input set undefined | RESOLVED (residual: P2-01) | PRODUCT_SPEC FR-25.4; ARCHITECTURE §6.6; UI-UX Screen 16; AI.md job 14; BUILD_PLAN Phase 16 tests. Resolved-away facts are not excluded (P2-01) |
| P-08 possibilities shown as an unconditional workflow step | RESOLVED | PRODUCT_SPEC §6 ("[R2 only — possibilitiesEnabled ON, default OFF, ADR-025]"), §12 item 6 |
| P-09 BUILD_PLAN section order | RESOLVED | BUILD_PLAN Phase 14 task 1 ("FACTS · EVIDENCE · POSSIBILITIES TO REVIEW · NOTE … (UI-UX Screen 11)") |
| P-10 label inconsistencies | RESOLVED (residual: P2-13) | UI-UX §2 canonical label table ("AI inference — verify", "Proposed — needs review"); DATA_MODEL §10.2 item 5 now "Proposed — needs review" |
| P-11 superseded-version wording | RESOLVED | DATA_MODEL §3.2 rule 4 (AuditEvent SUPERSEDED_BY_EDIT + `supersededByFactId`), §3.3 ("'Superseded' is never a ReviewStatus value"), §4.5 and §5.7 (`resolvedAwayByConflictId`) |
| P-12 PROJECT-STATUS still lists F-01…F-14 as OPEN | NOT RESOLVED | PROJECT-STATUS "Open Findings" still shows F-01 to F-14 as OPEN, says "None has been adopted into the specs", and lists the four minor items. "Current Blockers" is also stale: OD-003, OD-004, OD-005 and OD-009 are now resolved for planning (ADR-025, ADR-029–ADR-032), and OD-004 is needed at Phase 7, not Phase 8 (ADR-026). Owner: chief-architect, after the owner review |

### New findings — HIGH

**P2-01 (HIGH): "current fact" is never defined, so rejected and resolved-away facts can reach notes, evidence queries and comparisons.**
- Files and sections:
  - ARCHITECTURE §6.5 and AI.md §3 job 15: note input is "current facts".
  - DECISIONS ADR-034 item 4, DATA_MODEL §4.15, ARCHITECTURE §6.4 and AI.md job 11: input is "current (non-superseded), non-rejected".
  - AI.md job 12: "fact IDs exist and are current".
  - PRODUCT_SPEC FR-25.4 and ARCHITECTURE §6.6: "current versions only (superseded and REJECTED excluded)".
  - DATA_MODEL §4.5, §5.7, §9 rule 4: `resolvedAwayByConflictId`.
- Conflict:
  - DATA_MODEL never defines "current". Other documents qualify it separately with "non-rejected", which means "current" on its own does not exclude REJECTED facts. As written, job 15 can draft facts the clinician rejected.
  - No input set excludes facts a clinician *resolved away* in a conflict. Example: in the SELF_CORRECTION case "cough for two weeks… actually about a month", the clinician resolves to "a month". The "two weeks" fact is not superseded, not rejected and no longer in an OPEN conflict, so it still feeds job 11, job 15 and the comparison as if current.
  - Effect: a clinician decision (reject or resolve) is silently ignored downstream. This breaks FR-8.7, DATA_MODEL §9 rule 4 and CLAUDE.md §6 (contradictions are never silently overwritten, and the clinician's resolution decides).
- Proposed fix:
  - DATA_MODEL defines **current fact** once: `supersededByFactId` is null, `status ≠ REJECTED`, and `resolvedAwayByConflictId` is null.
  - ADR-034 item 4, §4.15, ARCHITECTURE §6.4–§6.6, AI.md jobs 11, 12, 14 and 15, FR-21.2 and FR-25.4 use that term instead of their own qualifiers.
  - Add a CS test: REJECTED and resolved-away facts never appear in a note draft, an export, a job-11 concept or a comparison as current.
  - Resolved-away statements may appear only as labeled history.
- Proposed owners: data-engineer (definition), ai-clinical-engineer (AI.md), clinical-safety-engineer + qa-test-engineer (CS test), product (FR-21.2, FR-25.4 wording).

**P2-02 (HIGH): ADR-035 re-derivation is unsafe for text corrections and for AI inferences.**
- Files and sections: DECISIONS ADR-035 item 1; DATA_MODEL §3.2 rule 8, §3.9 (DETERMINISTIC_RULE), §5.3, §6 rules 6 and 11, §8.3 step 3, §8.5; CLINICAL-SAFETY §4, §7, §10, §15, CS-15, CS-29; TESTING S13; SPEECH §11; PRODUCT_SPEC FR-22.3.
- Conflicts:
  1. **Text corrections.** Rule 8 and CLINICAL-SAFETY §15 apply re-derivation when segment *text* is corrected. Deterministic code can recompute provenance, but it cannot recompute a fact's value or informationState from new text. Example: the ASR heard "no fever" and the clinician corrects it to "low fever". The re-derived PROVISIONAL version would keep "No fever" / NEGATIVE, with derivation DETERMINISTIC_RULE ("produced by tested code"), next to a source segment that now says the opposite. That inverts negation relative to the source (CLINICAL-SAFETY §7) and violates validation rule 6 for corrected numbers (§10). TESTING S13 is titled "correction of transcript", but it never states what happens to the value.
  2. **AI inferences.** "The new version's origin follows the corrected role" does not say what happens to multi-segment or AI_INFERENCE facts. Read literally, an AI_EXTRACTED fact could be re-derived as PATIENT_REPORTED, which breaks the §8.5 distinguishability guarantee (CS-29).
  3. **"Never upgraded" is undefined.** No provenance ordering exists. If TRANSCRIPTION → PATIENT_REPORTED counts as an upgrade, then correcting an UNKNOWN speaker to PATIENT can never fix provenance, which contradicts CS-15. If it does not count, the phrase has no effect.
  4. **The original derivation is lost.** Replacing VERBATIM_EXTRACTION or AI_INFERENCE with DETERMINISTIC_RULE drops the information that §8.5 and validation rule 11 depend on.
- Proposed fix:
  - **Role-only correction:** recompute the origin with the §8.3 step 3 mapping, applied to the corrected roles and the *original* derivationMethod. AI_INFERENCE or multi-segment facts stay AI_EXTRACTED. Keep the original derivationMethod, and record the re-derivation through the supersedes chain plus the AuditEvent (optionally a `rederivationReason` field). Delete "never upgraded", or replace it with "computed only by the §8.3 mapping".
  - **Text correction:** affected PROVISIONAL facts are *not* deterministically re-derived. They get `needsClarification = true` with SOURCE_CHANGED, the same as CONFIRMED facts. The clinician may trigger re-extraction of the changed segments, which creates new AI versions that are PROVISIONAL and validated. A value the corrected text does not support is never carried forward without a flag.
  - Update CS-15 and S13, and add a text-correction CS case (a negation flip and a number change).
- Proposed owners: data-engineer, clinical-safety-engineer, speech-diarization-engineer (SPEECH §11), ai-clinical-engineer (re-extraction job), product (FR-22.3 wording).

### New findings — MEDIUM

**P2-03 (MEDIUM): an outdated or superseded-run possibility can still be confirmed as an assessment.**
- Files and sections: DATA_MODEL §5.4 (no guard on `--confirm-->`), §4.14 (`outdated`, `supersededByRunId`); PRODUCT_SPEC FR-18.4, FR-18.8; UI-UX Screen 11 (Confirm as assessment is listed next to the Outdated marker); DECISIONS ADR-034 item 5.
- Conflict: a candidate whose supporting fact was rejected, or whose run was superseded by a regeneration, can still become a CONFIRMED Assessment. That Assessment then enters notes (FR-18.9) and can become an active problem (DATA_MODEL §10.1).
- Proposed fix:
  - §5.4: `PROVISIONAL --confirm [outdated = false and supersededByRunId is null]--> CONFIRMED_BY_CLINICIAN`.
  - Outdated or superseded candidates offer only Dismiss, View and Regenerate.
  - FR-18.8 adds: "An outdated possibility cannot be confirmed."
  - Add a CS test.
- Proposed owners: data-engineer, product (FR-18.8), ux-accessibility-engineer (Screen 11), clinical-safety-engineer.

**P2-04 (MEDIUM): evidence staleness and candidate-stage re-entry are undefined.** I discussed this with `evidence`; see Messages.
- Files and sections:
  - DATA_MODEL §5.2: retry only from FAILED or PARTIAL; the only candidate transition is COMPLETED → IN_PROGRESS.
  - DATA_MODEL §4.15: `sourceFactIds` exists but nothing uses it.
  - DECISIONS ADR-034 item 5: staleness covers candidates only.
  - ARCHITECTURE §6.4: manual searches join the bundle only when started from a candidate.
  - PRODUCT_SPEC FR-17.2; UI-UX Screens 11–12; EVIDENCE-SOURCES §7, §16.
- Conflicts:
  - Evidence never re-runs after fact review. A regeneration grounds new candidates in a bundle built for facts the clinician has since rejected or edited.
  - A SKIPPED candidate stage (evidence FAILED or an empty bundle) has no exit, even after an evidence retry succeeds or a manual search adds records. The clinician then sees "Possibilities not generated" permanently.
  - It is undefined whether manual searches started without a candidate can be cited.
- Proposed fix (**AGREED with `evidence`**, see Messages):
  - (a) Evidence never re-runs automatically.
  - (b) A clinician-only "Re-run evidence search" re-runs job 11 on current facts (P2-01). It is not called "refresh", which EVIDENCE-SOURCES §7 and §16 use for re-fetching one record. The new EvidenceQuery records pass the same on-device sanitizer (ADR-036) and the job-11 grounding validator from evidence finding E2-01. Earlier records are kept when cited (§16).
  - (c) If ANY fact in a query's `sourceFactIds` is edited, rejected, superseded or resolved away, code marks that query's records "Based on facts that changed since retrieval". This marker is separate from the §7 freshness marker. Records leave the citable bundle for job 12 only when ALL of their query's source facts are REJECTED or resolved away. An edited fact usually keeps its concept, so its records stay citable with the marker (evidence's wording correction). "Regenerate" offers "Re-run evidence search first" whenever a marker exists. Cards from manual searches say "Clinician search" instead of "Retrieved for" (safety's point, relayed by evidence).
  - (d) Add `candidateState SKIPPED --clinician generate--> IN_PROGRESS`, allowed only with the flag ON and the ADR-034 decision-1 preconditions re-checked. Only a successful evidence retry unlocks it; a manual search alone never does. Anything wider needs its own ADR.
  - (e) Every CLINICIAN_MANUAL result joins the visit bundle and can be cited only on clinician-triggered generation (ARCHITECTURE §6.4 line 210 is extended to every manual query). CLINICAL_TRIAL and PUBLIC_HEALTH records are never citable by jobs 12 and 13 (CLINICAL-SAFETY §3, PRODUCT_SPEC §10, EVIDENCE-SOURCES §4.11). They stay on the evidence screen.
- Proposed owners:
  - data-engineer: DATA_MODEL §5.2, §4.15, §4.16
  - chief-architect: ADR-034 refinement
  - evidence-research-engineer: EVIDENCE-SOURCES §16/§17, ARCHITECTURE §6.4 text
  - product: FR-17.2, FR-18.7, FR-18.8
  - ux-accessibility-engineer: Screens 11–12

**P2-05 (MEDIUM): job 12 may use facts in an OPEN conflict as support, although job 11 excludes them.**
- Files and sections: DECISIONS ADR-034 item 4; AI.md job 11 vs job 12; DATA_MODEL §4.14, §9 rule 5; CLINICAL-SAFETY §6, §14.
- Conflict:
  - The open-conflict exclusion applies to evidence queries only.
  - §9 rule 5 lists what an OPEN conflict blocks (notes as settled, proposals, comparisons), but not candidates.
  - So a possibility can be "supported" by "I take metformin" while "I don't take any medications" is unresolved. That is a contested fact presented as support, and it is inconsistent with the evidence input set.
- Proposed fix:
  - §4.14 and §9 rule 5: facts in an OPEN conflict never appear in `supportingFactIds`. They may be listed only as "Conflict — review" in the possibility.
  - Add the case to CS-33.
- Proposed owners: data-engineer, ai-clinical-engineer, clinical-safety-engineer.

**P2-06 (MEDIUM; safety may raise it): residual gaps in the allergy status view.**
- Files and sections: DATA_MODEL §10.3, §9 (CROSS_VISIT, rule 5), §4.8; PRODUCT_SPEC FR-9.3, FR-12.2; UI-UX Screen 4; CLINICAL-SAFETY §14.
- Conflicts:
  - (a) Because the first matching row wins, a CONFIRMED "No known allergies" from any earlier visit outranks a later UNKNOWN allergy fact for a specific substance (e.g. "I think I reacted to amoxicillin once"). §9 creates a CROSS_VISIT conflict for this case, but §10.3 shows a conflict marker only on the POSITIVE row, so the screen shows "No known allergies" while a possible allergy is open.
  - (b) §10.3 does not restrict matching to current facts, so REJECTED, superseded and resolved-away facts all match.
  - (c) A NEGATIVE fact for a specific substance ("not allergic to penicillin") with no `ANY` fact displays "Not discussed". That contradicts FR-9.3 ("NOT DISCUSSED only when no allergy information exists").
- Proposed fix:
  - Order the UNKNOWN row before the NKDA rows, or show both.
  - Show "Conflict — review" on whichever row applies whenever an allergy conflict is OPEN.
  - Match current facts only (P2-01).
  - Add a display for specific negatives ("No allergy to <substance> reported — allergy status otherwise not established").
- Proposed owners: data-engineer (§10.3), product (FR-9.3), ux-accessibility-engineer (Screen 4), clinical-safety-engineer (review and severity).

**P2-07 (MEDIUM): AI job 16 (patient-friendly explanation) has no product requirement, no screen and no regulatory tier.**
- Files and sections: AI.md §2.1, §3 job 16; BUILD_PLAN Phase 13 task 4; EVIDENCE-SOURCES §2 and the PATIENT_EDUCATION section; CLINICAL-SAFETY CS-16; DECISIONS ADR-025 tier table. A full read of PRODUCT_SPEC and UI-UX found no feature, FR or screen for it.
- Conflict:
  - The job is planned and tested, but its behavior is undocumented. That breaks the CLAUDE.md §2 documentation-first rule.
  - It produces patient-specific output from confirmed facts, it is built in the R2 phase (Phase 13), and it is not behind `possibilitiesEnabled`. ADR-025 R1 covers reference information "with no patient-specific recommendation", so the job's tier is ambiguous.
  - Under the safety restriction principle (ADR-018), an unclassified patient-specific output should be treated restrictively.
- Proposed fix:
  - Product adds an FR covering where the output appears, the "Draft for clinician review" label, and that it never enters a note or export automatically.
  - chief-architect records the tier in ADR-025.
  - Until then, job 16 sits behind a default-off flag with the R2 release restriction.
- Proposed owners: product, chief-architect, ai-clinical-engineer, clinical-safety-engineer.

**P2-08 (MEDIUM): validation rules written against current provenance would reject clinician confirmations and possibility-derived assessments.**
- Files and sections: DATA_MODEL §3.9 ("Allowed provenance" column), §6 rule 11, §6 rule 4, §3.2 rule 6, §5.3, §5.4, §4.10, §4.5 `sourceSegmentIds`.
- Conflicts:
  - Confirmation sets `provenance = CLINICIAN_CONFIRMED` while derivationMethod stays VERBATIM_EXTRACTION or AI_INFERENCE. Rule 11 ("pairs must match §3.9"; "AI_INFERENCE requires provenance AI_EXTRACTED") then rejects every confirmed extracted fact.
  - §5.4 creates an Assessment that is CONFIRMED from birth, with origin AI_EXTRACTED. Rule 4 and §3.2 rule 6 require AI-produced records to be PROVISIONAL.
  - The candidate-derived Assessment has no defined derivationMethod and no defined `sourceSegmentIds`.
  - An implementer could "fix" this by loosening validation, which a safety rule forbids.
- Proposed fix:
  - Rules 11 and 12 and the §3.9 column apply to `originProvenance`.
  - Rule 4 applies to records created by actor AI.
  - Define the candidate-derived Assessment: actor CLINICIAN, `originProvenance = rootOriginProvenance = AI_EXTRACTED`, derivation AI_INFERENCE, provenance CLINICIAN_CONFIRMED, `linkedCandidateId` set, and source segments taken from the supporting facts.
- Proposed owner: data-engineer; clinical-safety-engineer to review.

**P2-09 (MEDIUM): the conflict detector does not exclude superseded versions or already-resolved pairs.**
- Files and sections: DATA_MODEL §9 Definition and Detection ("two or more non-rejected facts"), §3.2 rules 4 and 8, §5.7.
- Conflicts:
  - A clinician edit keeps the old version and creates a new one with the same `conceptKey` and a different value. A re-derivation does the same. Either way, the detector would open a VALUE_MISMATCH conflict between two versions of one fact. That flags the freshly confirmed version `needsClarification` (CONFLICT), renders it in the note as a conflict, and removes it from job-11 input.
  - Because the detector re-runs "after every extraction and every manual entry", it could also re-create conflicts the clinician already resolved or dismissed.
- Proposed fix:
  - The detector compares current facts only (P2-01).
  - It skips pairs already covered by a RESOLVED or DISMISSED conflict unless a new fact joins.
- Proposed owners: data-engineer, clinical-safety-engineer.

### New findings — LOW

- **P2-10:** UI-UX Screen 14 offers "regenerate draft", but the DATA_MODEL §5.5 note state machine has no such transition ("any transition not listed is rejected", §5). What happens to clinician edits is also undefined. A possibility confirmed after drafting reaches the note only through regeneration. Fix: add `DRAFT|EDITED --clinician regenerate--> DRAFT` (a new AI_DRAFT version; earlier versions kept; the clinician is warned that edits are not merged) and a new FR-21.5. Owners: data-engineer, product, ux-accessibility-engineer.
- **P2-11:** Recording and evidence preconditions do not require sign-in. DATA_MODEL §5.1 and §6 rule 3 require only consent plus `cloudProcessingEnabled`, and the §5.2 evidence precondition requires only "cloud processing on". FR-28.4 requires a signed-in account for every cloud stage, and UI-UX Screens 6–7 have no signed-out state. Fix: add "clinician signed in" to those preconditions, and have Screen 6 show "Sign in to use cloud processing" before the Record option. Owners: data-engineer, product, ux-accessibility-engineer, backend-api-engineer.
- **P2-12:** Evidence in manual visits is undefined. DATA_MODEL §5.2 makes evidence and candidate SKIPPED for every manual or consent-declined visit, while FR-3.4 and FR-17.2 allow manual evidence search, and nothing says whether manually entered facts can drive retrieval. Product position (restrictive): in a manual visit with cloud ON, automatic retrieval does not run; clinician manual searches are allowed and join the visit bundle; the candidate stage stays SKIPPED ("manual visit"). Owners: product (FR-3.4, FR-17.2), data-engineer.
- **P2-13:** Residual label inconsistencies (follow-on from P-10):
  - DATA_MODEL §3.2 rule 1 and PRODUCT_SPEC §5.2 use "Patient-reported · Confirmed by clinician". UI-UX §2 and Screen 10 use "Confirmed by clinician · originally <root origin>".
  - "Edited by clinician · originally …" is missing from the canonical table.
  - No label is defined for manual entries (root origin CLINICIAN_CONFIRMED) or for re-derived versions.
  - DATA_MODEL §3.2, §4.7 and §8.5, CLINICAL-SAFETY §4, §9 and §11, CS-36 and ADR-035 use "AI INFERENCE — VERIFY". UI-UX §2, PRODUCT_SPEC §5.2 and AI.md job 15 use "AI inference — verify".
  - Fix: the UI-UX §2 table becomes the only string source, gains the missing rows, and the other documents refer to it. Owners: product (strings), ux-accessibility-engineer, data-engineer, clinical-safety-engineer.
- **P2-14:** The CS-33 expected result ("job-11 concepts carry NEGATIVE facts' state or exclude them") is more permissive than ADR-034 item 4, DATA_MODEL §4.15 and AI.md job 11, which exclude NEGATIVE facts from automatic job-11 input. Fix: CS-33 should read "NEGATIVE facts are excluded from automatic job-11 input". The same applies to BUILD_PLAN Phase 12 tests ("never become positive query concepts"). Owner: clinical-safety-engineer.
- **P2-15:** DECISIONS ADR-033 says run-2 findings "were triaged in `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md`". At the time of this review that file does not exist (Glob `docs/agent-handoffs/*team2*` returns only the brief). Fix: use future tense until the synthesis exists. Owner: chief-architect.

### Cross-team positions

- **safety S2-03 (earlier-visit PROVISIONAL medications vanish from every medication view): AGREED.**
  - DATA_MODEL §10.2 point 5 limits the "Proposed — needs review" list to the latest visit. Because finalize ≠ confirm (FR-23.2, CS-25), an unreviewed earlier-visit mention (e.g. warfarin) appears in no view, while the §9 detector (ADR-035 point 6) still uses it.
  - Product position:
    - The list holds every current PROVISIONAL mention (P2-01 definition) from any visit, labeled with its visit date, plus "not discussed since <date>" where applicable.
    - An item leaves the list only through a clinician action on that medication identity, never by age or absence.
    - **Safety caveat (accepted):** a later CONFIRMED record of the same identity removes the earlier PROVISIONAL mention only when no OPEN FactConflict involves the two. Example: visit-1 PROVISIONAL "warfarin 5 mg daily" vs visit-2 CONFIRMED "warfarin 3 mg" is a VALUE_MISMATCH/CROSS_VISIT conflict, so the earlier mention stays with "Conflict — review" until the clinician resolves it (DATA_MODEL §9 rule 5, §10.2 point 6). A confirmation never silently settles a conflict.
    - Earlier-visit items are grouped under a collapsible "From earlier visits — not reviewed" heading on Screen 4, and Screen 16 shows the count.
    - The same rule applies to unreviewed assessments and history under §10.1.
  - Owners: product (FR-9.4, FR-25.1), data-engineer (§10.1, §10.2), ux-accessibility-engineer (Screens 4, 16), clinical-safety-engineer (CS case, listed in safety S2-10).
- **P2-04 with evidence: AGREED.** We agreed on (a)–(e) as amended by evidence: the action is named "Re-run evidence search"; the marker triggers when ANY source fact changes, and records leave the citable bundle only when ALL source facts are rejected or resolved away; SKIPPED re-entry is unlocked only by an evidence retry; trial and public-health records are never citable by jobs 12 and 13. The full text is in P2-04. No open disagreement.

### Checked with no conflict found

- The flag-OFF behavior is consistent: FR-18.6, ADR-025, ADR-034 item 2, DATA_MODEL §5.2 and §6 rule 18, AI.md §3, ARCHITECTURE §6.4 and §8, CS-37, TESTING release E2E, BUILD_PLAN Phases 13–14.
- Notes never consume candidates: FR-21.2, FR-18.9, DATA_MODEL §4.14 and §5.2, ARCHITECTURE §6.5, AI.md job 15 and §5.1 item 12, CS-32.
- Evidence comes before possibilities and is required for them: PRODUCT_SPEC §6 and FR-18.7, ARCHITECTURE §6.4 and §8, DATA_MODEL §5.2, AI.md §3.
- Neutral alphabetical order and no probabilities: FR-18.3, FR-18.9, CLINICAL-SAFETY §6, UI-UX Screen 11, DATA_MODEL §4.14.
- Finalize ≠ confirm: FR-23.2, DATA_MODEL §5.5, Screen 14, CS-25.
- Absence ≠ discontinuation, including the cross-segment Q&A case: FR-11.3, FR-25.3, DATA_MODEL §4.7 and §10.2, CLINICAL-SAFETY §11, CS-36.
- Cloud toggle and sign-in disclosure: FR-27.3, FR-28.1–FR-28.5, Screen 18.

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team2-product.md (this file, new). No other file was edited.

## Interfaces Changed

None. The proposed fixes would touch:
- IC-019 (feature flags), if job 16 is gated (P2-07)
- the fact and candidate repository contracts owned by data-engineer (P2-01, P2-03, P2-08, P2-09)

Each change would go through the owner under the Integration Contract format.

## Dependencies

- Relied on:
  - CLAUDE.md
  - docs/DECISIONS.md (ADR-021 to ADR-037, Open Decisions)
  - docs/PRODUCT_SPEC.md (full)
  - docs/UI-UX.md (full)
  - docs/DATA_MODEL.md §2–§10 (full read of lines 60–778)
  - docs/ARCHITECTURE.md §6.3–§8
  - docs/AI.md §2–§6
  - docs/CLINICAL-SAFETY.md §3–§18 (lines 40–236)
  - docs/PROJECT-STATUS.md
  - docs/agent-handoffs/2026-10-08-stage-a-team-product.md
  - docs/agent-handoffs/2026-10-08-stage-a-team2-brief.md
  - targeted greps of BUILD_PLAN, TESTING, SPEECH and EVIDENCE-SOURCES
- Depends on this: Task D (chief-architect synthesis, `2026-10-08-stage-a-team2-synthesis.md`).

## Tests

none — documentation review task (0 tests)

## Evidence

- Run-1 verification: see the table under What Changed. Each row cites file and section.
- P2-01: ARCHITECTURE §6.5 (line 217 "Current facts"), §6.4 (line 184), §6.6 (line 230); DECISIONS ADR-034 item 4 (line 401); AI.md §3 jobs 11, 12 and 15 (lines 57, 58, 61); DATA_MODEL §4.5 (line 244), §4.15 (line 311), §9 rule 4; PRODUCT_SPEC FR-25.4 (line 312). Grep `(?i)current (fact|version)s?|non-superseded` over docs: no definition of "current fact" in DATA_MODEL.
- P2-02: DECISIONS ADR-035 item 1 (line 418); DATA_MODEL §3.2 rule 8 (line 111), §3.9 (line 149), §5.3 (lines 441–442), §6 rules 6 and 11, §8.3 step 3, §8.5; CLINICAL-SAFETY §7, §10, §15 (line 165), CS-15 (line 195); TESTING S13 (line 140) and line 65; SPEECH §11 (line 95).
- P2-03: DATA_MODEL §5.4 (lines 449–453), §4.14 (lines 298, 304), §10.1; UI-UX Screen 11 (line 175); PRODUCT_SPEC FR-18.4, FR-18.8, FR-18.9.
- P2-04: DATA_MODEL §5.2 (lines 410–428), §4.15 (line 309); ARCHITECTURE §6.4 (line 210); DECISIONS ADR-023 and ADR-034 item 5; EVIDENCE-SOURCES §7 (lines 121–126) and line 188; UI-UX Screens 11 and 12; PRODUCT_SPEC FR-17.2, FR-18.7.
- P2-05: DECISIONS ADR-034 item 4; AI.md jobs 11 and 12 (lines 57–58); DATA_MODEL §4.14 (line 302), §9 rule 5 (lines 735–738).
- P2-06: DATA_MODEL §10.3 (lines 767–777), §9 Detection, the CROSS_VISIT row and rule 5; PRODUCT_SPEC FR-9.3 (line 204); UI-UX Screen 4 (line 83).
- P2-07: AI.md §2.1 (line 23), §3 job 16 (line 62); BUILD_PLAN line 456; CLINICAL-SAFETY CS-16 (line 196); DECISIONS ADR-025 tier table. Grep `(?i)patient-friendly|patient explanation|job 16|plain-language` has no PRODUCT_SPEC or UI-UX match except an unrelated "plain-language headings".
- P2-08: DATA_MODEL §3.9 table (lines 141–149), §6 rules 4 and 11 (lines 491, 498), §3.2 rule 6 (line 109), §5.4 (line 451), §4.10 (line 282).
- P2-09: DATA_MODEL §9 Definition and Detection (lines 715–717), §3.2 rules 4 and 8, §5.7.
- P2-10: UI-UX Screen 14 (line 212); DATA_MODEL §5 preamble (line 388), §5.5 (lines 457–460).
- P2-11: DATA_MODEL §5.1 (line 393), §5.2 (line 424), §6 rule 3 (line 490); PRODUCT_SPEC FR-28.4 (line 333); UI-UX Screens 6–7.
- P2-12: DATA_MODEL §5.2 (lines 415, 430); PRODUCT_SPEC FR-3.4, FR-17.2.
- P2-13: DATA_MODEL §3.2 (lines 97, 104), §4.7 (line 264), §8.5 (line 708); PRODUCT_SPEC §5.2 (lines 82, 87); UI-UX §2 (lines 16–32), Screen 10 (line 158); CLINICAL-SAFETY lines 55, 103, 130.
- P2-14: CLINICAL-SAFETY CS-33 (line 214); BUILD_PLAN line 439; DECISIONS ADR-034 item 4.
- P2-15: DECISIONS ADR-033 (line 382); Glob `docs/agent-handoffs/*team2*` → only `2026-10-08-stage-a-team2-brief.md`.
- P-12: PROJECT-STATUS lines 60–97.

## Known Limitations

- I read BUILD_PLAN, TESTING, SPEECH, EVIDENCE-SOURCES and API_CATALOG by targeted grep only. The evidence and safety teammates own the full review of those files.
- This teammate has no shell tool, so I recorded message times as the session date only.
- The severity ratings are my product judgement. clinical-safety-engineer may raise P2-06 or P2-09.
- The TaskUpdate tool was not in this teammate's tool list, so I could not claim or complete task #1 myself. team-lead marked it in_progress for me and will mark it completed; the TaskCompleted hook then validates this handoff.

## Risks

- If P2-01 stays unresolved, a fact the clinician rejected or resolved away can be drafted into a note, queried for evidence or shown as current in a comparison.
- If P2-02 stays unresolved, a transcript correction can leave a fact whose negation or number contradicts its corrected source, labeled as produced by tested code.
- If P2-03 or P2-05 stays unresolved, a confirmed assessment could rest on rejected or contested facts.
- If P2-07 stays unresolved, an untiered patient-specific AI output could ship in a release build outside the R2 gate.

## Required Follow-up

- P2-01: data-engineer, ai-clinical-engineer, clinical-safety-engineer + qa-test-engineer, product.
- P2-02: data-engineer, clinical-safety-engineer, speech-diarization-engineer, ai-clinical-engineer, product.
- P2-03: data-engineer, product, ux-accessibility-engineer, clinical-safety-engineer.
- P2-04: data-engineer, evidence-research-engineer, product, ux-accessibility-engineer.
- P2-05: data-engineer, ai-clinical-engineer, clinical-safety-engineer.
- P2-06: data-engineer, product, ux-accessibility-engineer, clinical-safety-engineer.
- P2-07: product, chief-architect (ADR-025 tier), ai-clinical-engineer, clinical-safety-engineer.
- P2-08 and P2-09: data-engineer, with clinical-safety-engineer review.
- P2-10 and P2-11: data-engineer, product, ux-accessibility-engineer (P2-11 also backend-api-engineer).
- P2-12: product, data-engineer.
- P2-13: product, ux-accessibility-engineer, data-engineer, clinical-safety-engineer.
- P2-14: clinical-safety-engineer.
- P2-15 and P-12: chief-architect.

## Messages

| Direction | Counterpart | First line | Time (UTC) |
|---|---|---|---|
| sent | evidence | [STAGE-A2-MSG] Clinician-workflow question: once the clinician reviews facts, the evidence bundle can go stale, and a SKIPPED candidate stage has no way back in. | 2026-10-08 (exact time not captured; no shell tool) |
| sent | team-lead | [STAGE-A2-STATUS] product: I can't claim or complete task #1 because TaskUpdate (and the other Task tools) aren't in this teammate's tool list. | 2026-10-08 (exact time not captured) |
| received | team-lead | task_assignment for task #1, and "Lead note: teammates in this session did not receive the Task tools. I have marked task #1 as in_progress with owner product on your behalf." | 2026-10-08T08:25:46Z (assignment timestamp) |
| received | safety | [STAGE-A2-MSG] safety -> product: Earlier-visit PROVISIONAL medications disappear from the current-medications view, even though the conflict detector still uses them. | 2026-10-08 (exact time not captured) |
| sent | safety (reply) | [STAGE-A2-MSG] RE: earlier-visit PROVISIONAL medications disappearing. Product agrees: there is no product reason for the latest-visit-only scope, and FR-9.4 should state the wider rule. | 2026-10-08 (exact time not captured) |
| received | team-lead | Lead: understood. Teammates in this session have no Task tools, so I manage task #1 for you (owner product). | 2026-10-08 (exact time not captured) |
| received | evidence (reply) | [STAGE-A2-MSG] Reply on bundle staleness and SKIPPED re-entry: I agree with (a)–(d) with refinements, and with (e) in part. | 2026-10-08 (exact time not captured) |
| sent | evidence (reply) | [STAGE-A2-MSG] RE: bundle staleness and SKIPPED re-entry — product accepts your shared position in full. Record it as AGREED. | 2026-10-08 (exact time not captured) |
| sent | team-lead | [STAGE-A2-RESULT] product: 15 findings (2 HIGH) | 2026-10-08 (exact time not captured) |
| received | safety | [STAGE-A2-MSG] safety -> product: I agree with your S2-03 refinements 1–3, with one caveat on removal by a later CONFIRMED record. | 2026-10-08 (exact time not captured) |
| received | evidence | [STAGE-A2-MSG] Confirmed: E2-14 / P2-04 is recorded as AGREED, with one wording correction to (c) before the lead copies the text. | 2026-10-08 (exact time not captured) |
| sent | safety (reply) | [STAGE-A2-MSG] RE: S2-03 caveat — accepted. A later CONFIRMED record never removes an earlier PROVISIONAL mention while an OPEN conflict links them. | 2026-10-08 (exact time not captured) |
| sent | evidence (reply) | [STAGE-A2-MSG] RE: (c) wording — accepted. Citable-bundle removal only when ALL source facts are REJECTED or resolved away. | 2026-10-08 (exact time not captured) |
| received | safety | [STAGE-A2-MSG] safety -> product: Thanks. S2-03 is closed between us as AGREED (product + safety), including the caveat that a confirmation never settles a conflict as a side effect. | 2026-10-08 (exact time not captured) |
| sent | team-lead | [STAGE-A2-RESULT-ADDENDUM] product: two accepted amendments to agreed positions (S2-03 caveat, P2-04 (c) wording); finding count unchanged. | 2026-10-08 (exact time not captured) |

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes. chief-architect consolidates the findings in Task D, including the agreed position on safety S2-03. clinical-safety-engineer reviews P2-01, P2-02, P2-05, P2-06, P2-08 and P2-09. The project owner reviews the final reconciliation.

## Next Action

chief-architect adds P2-01 to P2-15 and the P-12 carry-over to the Task D synthesis, and routes the two HIGH findings (P2-01 and P2-02) to data-engineer and clinical-safety-engineer first.
