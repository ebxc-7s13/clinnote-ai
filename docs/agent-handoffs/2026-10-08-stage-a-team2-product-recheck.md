# Task Handoff

## Owner

product (product-clinical-architect)

## Task

Stage A run 2, recheck: verify the lead's fixes for product findings P2-01 to P2-15 (ADR-038 to ADR-041 and the related spec edits), and flag anything new the fixes broke (P3-xx). Phase 0, Stage A agent-team test.

## Status

COMPLETED. This was a documentation review. No existing file was edited; this new file is the only file written.

## What Changed

13 of the 15 run-2 findings are RESOLVED. 2 are NOT RESOLVED:
- **P2-02:** the product-level text was not updated.
- **P2-15:** deferred by the lead's decision; I accept the deferral.

The fixes introduced or exposed 7 new issues (P3-01 to P3-07): 0 HIGH, 3 MEDIUM, 4 LOW. Run-1 P-12 (PROJECT-STATUS) is now also resolved: PROJECT-STATUS lines 68–70 and 390–394 now record F-01 to F-14 as RESOLVED and list the open decisions correctly.

### Verification of P2-01 to P2-15

| Finding | Verdict | Evidence (file, section) |
|---|---|---|
| P2-01 "current fact" undefined | RESOLVED (residual text drift: P3-06) | DATA_MODEL §3.3a; DECISIONS ADR-038 decision 1; AI.md §3 preamble ("Every job uses current facts only"), jobs 11, 12 and 15; DATA_MODEL §9 Detection, §10.3, §10.4. The SOURCE_CHANGED gap is P3-01 |
| P2-02 correction handling | **NOT RESOLVED (product text)** | Fixed in DATA_MODEL §3.2 rule 8, §3.9, §5.3; CLINICAL-SAFETY §15, CS-39; TESTING S13 and the CS-39 row; BUILD_PLAN Phase 10 task 6a. Still stale: **PRODUCT_SPEC FR-22.3** (line 298) and **SPEECH §11** (line 95). Both still state the superseded ADR-035 rule: "re-derives affected provisional facts as new versions with provenance matching the corrected role", applied to text corrections too. ADR-038 Consequences says FR-22.3 is aligned; it is not. PRODUCT_SPEC outranks DATA_MODEL (ADR-018), so the stale FR is an authority conflict. The safety restriction principle (CLINICAL-SAFETY §15) decides it today, but the text must be fixed. Proposed wording below |
| P2-03 outdated possibility confirmable | RESOLVED (UI drift: P3-03) | DATA_MODEL §4.14, §5.4 guard; PRODUCT_SPEC FR-18.8; CLINICAL-SAFETY CS-43; ADR-038 decision 4 |
| P2-04 evidence staleness and SKIPPED re-entry | RESOLVED (residuals: P3-03, P3-07) | DECISIONS ADR-039 decision 6; DATA_MODEL §5.2 clinician-only transitions, §4.14, §4.15, §4.16 (`factsChangedSinceRetrieval`, `citable`, `retrievedFor`); PRODUCT_SPEC FR-17.6; UI-UX Screen 12. Matches the agreed product/evidence text, including the ANY/ALL wording |
| P2-05 OPEN-conflict facts as support | RESOLVED | DATA_MODEL §4.14 (`conflictFactIds`); AI.md job 12; ADR-038 decision 4; PRODUCT_SPEC FR-18.8; CLINICAL-SAFETY CS-33 part B |
| P2-06 allergy view gaps | RESOLVED (UI drift: P3-03; text gap: P3-05) | DATA_MODEL §10.3 (positive list plus status line; UNKNOWN wins over older NKDA; specific negatives; conflict marker on any row; current facts only); CLINICAL-SAFETY CS-41 |
| P2-07 job 16 untiered | RESOLVED (no screen yet: P3-03) | DECISIONS ADR-041, ADR-042 decision 2 (server-side refusal); PRODUCT_SPEC FR-21.6; AI.md §3 execution order and job 16, §5.1 item 15; BUILD_PLAN Phase 13 task 4; CLINICAL-SAFETY CS-16 part B, CS-44 |
| P2-08 validation against current provenance | RESOLVED | DATA_MODEL §6 rules 4, 11, 12; §4.10; ADR-038 decision 3 |
| P2-09 detector compares versions and resolved pairs | RESOLVED (Definition line drift: P3-06) | DATA_MODEL §9 Detection; ADR-038 decision 5 |
| P2-10 note regeneration transition | RESOLVED | DATA_MODEL §5.5; ADR-040 decision 5; PRODUCT_SPEC FR-21.5; UI-UX Screen 14 |
| P2-11 sign-in preconditions | RESOLVED (evidence-stage re-entry edge: P3-07) | DATA_MODEL §5.1, §5.2 evidence row, §6 rule 3; UI-UX Screen 6 |
| P2-12 evidence in manual visits | RESOLVED as the product position | DATA_MODEL §5.2 evidence row and the "fully manual visit" line. PRODUCT_SPEC FR-3.4 and FR-17.2 are silent but do not conflict |
| P2-13 label drift | RESOLVED (table defects: P3-04) | UI-UX §2 (edited and manual-entry rows; capitals-for-emphasis note); DATA_MODEL §3.2 rule 1 now points to the canonical labels |
| P2-14 CS-33 permissive wording | RESOLVED | CLINICAL-SAFETY CS-33 part A ("NEGATIVE (and NOT_DISCUSSED) facts produce no concept"); BUILD_PLAN Phase 12 tests (CS-33 A) |
| P2-15 ADR-033 past-tense claim | NOT RESOLVED — deferred by the lead (accepted) | DECISIONS ADR-033 is unchanged. Glob `docs/agent-handoffs/*team2*` still shows no `…-team2-synthesis.md`. PROJECT-STATUS line 16 also cites that file as evidence. Both become accurate once the synthesis is written |

**Proposed FR-22.3 text (product-owned, for P2-02):**

> FR-22.3 The clinician can correct the transcript and speaker roles; edits are audited. After extraction:
> - A role-only correction that keeps the fact category valid re-derives the affected provisional facts as new versions. Their provenance follows the corrected role, and their derivation is kept.
> - A text correction, or a role change that makes the category invalid, marks the affected provisional facts "Needs clarification — source changed". They are excluded from automatic use until the changed segments are re-extracted.
> - Confirmed facts are flagged and never changed silently (ADR-038).

SPEECH §11 should use the same wording.

### New findings — MEDIUM

**P3-01 (MEDIUM): PROVISIONAL facts flagged SOURCE_CHANGED still count as "current", so notes and other inputs can use them before re-extraction.**
- Files and sections: DATA_MODEL §3.3a, §3.2 rule 8, §4.15, §5.3, §10; AI.md jobs 11, 12, 15; CLINICAL-SAFETY CS-39; ADR-038 decision 2.
- Conflict:
  - Rule 8, ADR-038 and CS-39 say these facts are "excluded from automatic inputs" until re-extraction supersedes them.
  - §3.3a defines "current" without that exclusion, and only job 11 (AI.md job 11, §4.15) restates it.
  - Job 15 ("current facts"), job 12, the comparison, the §10 views and the conflict detector would therefore all still use them.
  - In the CS-39 case ("No fever" corrected to "Low fever"), the note draft could still say "No fever" while the source says otherwise. That is the negation inversion ADR-038 was meant to prevent.
- Also undefined: how re-extracted facts are linked to the flagged facts. Rule 8 says only "the re-extracted facts supersede them", which does not cover 0, 1 or N results. The case where re-extraction cannot run (cloud off, signed out) is also not addressed.
- Proposed fix:
  1. §3.3a gains one term, "eligible for automatic input": current, and not PROVISIONAL with `needsClarification` SOURCE_CHANGED. Every automatic input set uses it.
  2. Linking rule: a re-extracted item from the same segment with the same category and conceptKey supersedes the flagged fact (`supersedesFactId`). A flagged fact with no match stays flagged and shows "Not found after correction — reject or edit". An unmatched new item starts a new chain.
  3. CS-39 asserts exclusion from the note draft and the comparison as well.
- Proposed owners: data-engineer, ai-clinical-engineer, clinical-safety-engineer.

**P3-02 (MEDIUM): after a source correction, `rootOriginProvenance` keeps the wrong original source.**
- Files and sections: DATA_MODEL §3.2 rule 8 ("with the chain's rootOriginProvenance"), §6 rule 16, §3.2 rule 1; UI-UX §2 ("Confirmed by clinician · originally <root origin>"); ADR-035 decision 3; CLINICAL-SAFETY §4.
- Conflict:
  - Synthetic example: a segment is wrongly mapped DOCTOR, so v1 is CLINICIAN_STATED. The clinician corrects the role to PATIENT, and v2 becomes PATIENT_REPORTED with root CLINICIAN_STATED. The clinician then confirms v2, and the UI shows "Confirmed by clinician · originally clinician-stated".
  - That presents a patient statement as clinician-stated: the risk run-1 P-04 was raised for.
  - The same applies to re-extracted facts if they inherit the old root.
  - Root origin is meant to show the true source after a *clinician edit*. A *source correction* is the opposite case: the earlier origin was wrong.
- Proposed fix:
  - A source correction (role or text) starts a new root: the corrected version's `rootOriginProvenance` equals its own `originProvenance`.
  - History stays reachable through `supersedesFactId` and the AuditEvent.
  - Rule 16 reads "the first version since the last source correction".
  - Add the confirmed-after-role-correction label case to CS-15.
- Proposed owners: data-engineer, clinical-safety-engineer, ux-accessibility-engineer.

**P3-03 (MEDIUM): UI-UX screens are not aligned with ADR-038, ADR-039 and ADR-041.**
- Screen 4 (line 94):
  - It still reads "one of the five display states" with the old list. §10.3 now has a positive list plus a six-row status line ("Other allergies: not established", "No allergy to <substance> reported", "General allergy status not discussed") and a conflict marker on any row.
  - The "Proposed — needs review" list lacks the "This visit" and "From earlier visits — not reviewed" grouping and the dates (§10.4, CS-42 part B in Phase 5).
- Screen 11 (line 186):
  - "Confirm as assessment" is still listed with no condition, although §5.4 and CS-43 refuse it for outdated or superseded candidates. CS-43 part B tests this refusal on Screen 11 in Phase 14.
  - There is no display of `conflictFactIds` ("Conflict — review").
  - There is no "Re-run evidence search first" offer on Regenerate.
  - There is no clinician action for SKIPPED → IN_PROGRESS after a successful evidence retry.
  - There is no display of `evidenceStateAtGeneration` or `failedRoutes`, which ADR-039 decision 6 says "are displayed".
- FR-21.6 (job 16): no screen hosts the request action or the "draft for clinician review" output.
- Proposed fix: ux-accessibility-engineer updates Screens 4 and 11 and assigns job 16 a location (e.g. a flag-gated action on Screen 12 or 14). Product reviews the strings.
- Proposed owners: ux-accessibility-engineer; product reviews.

### New findings — LOW

- **P3-04: the UI-UX §2 canonical label table is broken and incomplete.**
  - Formatting: the rows from "evidence retrieved for" onward (lines 33–39) lose the list indentation. The paragraph on line 41 splits the table, so the "provisional comparison item" and "draft export" rows (lines 42–43) are orphaned.
  - The table says it is "the only source for UI labels", but it lacks labels defined elsewhere: the §10.3 status lines, "Possibilities not generated: …", "Order has no meaning", "Sign in to use cloud processing", "not discussed since <date>", "Re-run evidence search", and "Re-run evidence search first".
  - Fix: repair the table and add the rows, or limit the "only source" sentence to provenance and status labels.
  - Owners: ux-accessibility-engineer; product (strings).
- **P3-05: two text gaps in the derived views.**
  - DATA_MODEL §10.3 row 4 has an exception (a CONFIRMED NEGATIVE `ANY` that post-dates every POSITIVE allergy, with no OPEN conflict) but no display text for it. Product proposes "No other known allergies".
  - §10.4 lists "medications, history, problems from ProfileUpdateProposals", while §10.1 says unconfirmed assessments also appear there. §10.4 should name PROVISIONAL Assessment facts explicitly.
  - Owners: data-engineer, product.
- **P3-06: stale cross-references and wording.**
  - DECISIONS ADR-038 decision 1 and Consequences cite "DATA_MODEL §3.11", but the section is §3.3a.
  - ADR-038 Consequences claims FR-22.3 is aligned (see P2-02).
  - ADR-034 decision 4 (job-11 input wording) is not annotated as refined by ADR-038 and ADR-039. ADR-035 decision 1 did get such an annotation.
  - DATA_MODEL §9 Definition still says "non-rejected facts", while Detection says current facts.
  - DATA_MODEL §3.10 still defines SOURCE_CHANGED as "after this fact was confirmed", but it now also applies to PROVISIONAL facts after text corrections.
  - PRODUCT_SPEC FR-25.4 and ARCHITECTURE §6.6 list "superseded and rejected excluded" without resolved-away facts. They should reference §3.3a.
  - Owners: chief-architect (ADRs), data-engineer, product (FR-25.4).
- **P3-07: the gating wording differs between documents.**
  - DATA_MODEL §5.2 requires the **citable** bundle to be non-empty. AI.md §3 (execution order and job 12) and ARCHITECTURE §6.4 (line 204) and §7 (line 250) say "stored bundle non-empty". FR-18.7 says "at least one source".
  - A bundle holding only non-citable records (manual trial or public-health results, or records whose source facts were all rejected) passes the AI.md, ARCHITECTURE and FR wording but fails DATA_MODEL.
  - FR-18.7 does not mention the SKIPPED re-entry (ADR-039 decision 6).
  - In an ambient visit, an evidence stage SKIPPED because cloud processing was off or the clinician was signed out at that moment has no re-entry: §5.2 allows "Re-run evidence search" only from COMPLETED, PARTIAL or FAILED.
  - Fix: use "citable bundle" everywhere; add the re-entry sentence to FR-18.7; allow `SKIPPED (cloud off / signed out, ambient visit) --clinician "Re-run evidence search"--> IN_PROGRESS`.
  - Owners: product (FR-18.7), ai-clinical-engineer, data-engineer, chief-architect.

### Checked with no new conflict found

- Flag gating, including the new server-side refusal: ADR-042 decision 2, AI.md §3, DATA_MODEL §6 rule 18, CS-37.
- Notes never consume candidates; structured job-15 statements: ADR-040, AI.md job 15, DATA_MODEL §4.18.
- Earlier-visit PROVISIONAL visibility with the conflict caveat: DATA_MODEL §10.2 point 5, §10.4; FR-9.4; CS-42; ADR-038 decision 6.
- Candidate-derived Assessment fields: DATA_MODEL §4.10, §5.4, §6 rules 4/11/12.
- Note regeneration: never on a FINALIZED note without an amend (ADR-040 decision 5, DATA_MODEL §5.5).

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team2-product-recheck.md (this file, new). No other file was edited.

## Interfaces Changed

None. P3-01 and P3-02 would change the fact repository contract owned by data-engineer (input-eligibility term, re-extraction linking, root reset). P3-07 may touch the stage-state contract.

## Dependencies

- Relied on:
  - DECISIONS ADR-033 to ADR-042
  - DATA_MODEL §3.2 to §3.10, §4.2 to §4.24, §5, §6, §9, §10 (full read of lines 79–523 and 729–804)
  - PRODUCT_SPEC FR-9.3/9.4, FR-17.1–17.7, FR-18.7–18.9, FR-21.2–21.6, FR-22.3, FR-25.4, FR-28.4
  - UI-UX §2 and Screens 4–16
  - AI.md §3
  - targeted greps of CLINICAL-SAFETY, TESTING, BUILD_PLAN, ARCHITECTURE, SPEECH and PROJECT-STATUS
  - my run-2 handoff, docs/agent-handoffs/2026-10-08-stage-a-team2-product.md
- Depends on this: Task D synthesis (chief-architect).

## Tests

none — documentation review task (0 tests)

## Evidence

- P2-02 stale text: PRODUCT_SPEC line 298 (FR-22.3); SPEECH line 95. Grep `re-derives affected` over docs matches both. DECISIONS ADR-038 Consequences ("PRODUCT_SPEC FR-9.4/FR-18/FR-22.3 are aligned").
- P2-15: DECISIONS line 383; Glob `docs/agent-handoffs/*team2*` → brief, backend, product, evidence, safety (no synthesis); PROJECT-STATUS line 16.
- P3-01: DATA_MODEL §3.3a (line 125), §3.2 rule 8 (line 113), §4.15 (line 320), §5.3 (line 457); AI.md jobs 11, 12, 15 (lines 57, 58, 61); CLINICAL-SAFETY CS-39 (line 226).
- P3-02: DATA_MODEL §3.2 rules 1 and 8 (lines 104, 112), §6 rule 16 (line 519); UI-UX §2 (line 26).
- P3-03: UI-UX Screen 4 (line 94), Screen 11 (line 186); DATA_MODEL §10.3, §10.4, §5.4, §5.2 (line 442); DECISIONS ADR-039 decision 6 (line 536); CLINICAL-SAFETY §18a Phase 14 row (CS-43 B), Phase 5 row (CS-42 B); PRODUCT_SPEC FR-21.6.
- P3-04: UI-UX lines 16–43.
- P3-05: DATA_MODEL §10.3 (line 795), §10.1 (line 770), §10.4 (line 803).
- P3-06: DECISIONS lines 402, 479, 493; DATA_MODEL line 123 (§3.3a), §9 Definition (line 731), §3.10 (line 161); PRODUCT_SPEC FR-25.4 (line 316); ARCHITECTURE line 239.
- P3-07: DATA_MODEL §5.2 (lines 436, 440); AI.md line 43 and job 12; ARCHITECTURE lines 204, 250; PRODUCT_SPEC FR-18.7 (line 267).
- P-12: PROJECT-STATUS lines 68–70, 351–357, 390–394.

## Known Limitations

- I read CLINICAL-SAFETY, TESTING, BUILD_PLAN, ARCHITECTURE and SPEECH by targeted grep only, not in full.
- This teammate has no shell tool and no Task tools, so there are no timestamps and no task updates.
- Severities are my product judgement; clinical-safety-engineer may raise P3-01 or P3-02.

## Risks

- If P3-01 stays unresolved, a fact whose source text was corrected can still appear in a note draft before re-extraction.
- If P3-02 stays unresolved, a confirmed patient statement can be labeled "originally clinician-stated" after a role correction.
- If P2-02's stale FR-22.3 stays, an implementer following the product authority would build the superseded ADR-035 behavior.
- If P3-03 stays unresolved, the Phase 14 UI could offer Confirm on outdated possibilities, contrary to CS-43.

## Required Follow-up

- P2-02: product (FR-22.3), speech-diarization-engineer (SPEECH §11), chief-architect (ADR-038 Consequences).
- P2-15: chief-architect, when the synthesis file is written.
- P3-01: data-engineer, ai-clinical-engineer, clinical-safety-engineer.
- P3-02: data-engineer, clinical-safety-engineer, ux-accessibility-engineer.
- P3-03 and P3-04: ux-accessibility-engineer; product for strings.
- P3-05: data-engineer, product.
- P3-06: chief-architect, data-engineer, product.
- P3-07: product, ai-clinical-engineer, data-engineer, chief-architect.

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes. chief-architect triages P2-02, P2-15 and P3-01 to P3-07 into the synthesis. clinical-safety-engineer reviews P3-01 and P3-02.

## Next Action

chief-architect applies the FR-22.3 and SPEECH §11 wording (P2-02), then routes P3-01 and P3-02 to data-engineer and clinical-safety-engineer.
