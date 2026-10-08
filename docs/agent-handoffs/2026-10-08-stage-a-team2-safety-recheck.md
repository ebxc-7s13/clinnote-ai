# Task Handoff

## Owner

clinical-safety-engineer (teammate `safety`, Stage A agent-team test, run 2: re-check)

## Task

Re-check of the lead's fixes for the run-2 safety findings S2-01…S2-15 (`2026-10-08-stage-a-team2-safety.md`) against ADR-038…ADR-042 and the amended specs, and a fresh Gate 6 documentation verdict. BUILD_PLAN Phase 0 (Stage A).

## Status

COMPLETED. Documentation review only. I edited no existing file; this new handoff is the only file I wrote.

## What Changed

**Gate 6 documentation verdict: FAIL.** This is a spec-consistency verdict only; no implementation exists.

Reason: two HIGH findings are only partly closed.
- **S2-02:** structured note statements are an improvement, but each statement's `text` is still free model text. A statement that cites a valid fact can carry invented diagnostic wording and pass every validator.
- **S2-14:** job 11 is now deterministic, but it uses `conceptKey`, and `conceptKey` is assigned by the model in job 2 with no grounding check. The "unstated condition" channel has moved one step upstream; it is not closed.

Everything else is resolved or reduced to MEDIUM/LOW. The fixes are substantial:
- §18a phase schedule
- current-fact definition
- correction handling
- validation on originProvenance
- the job-16 R2 gate
- server-side flag enforcement

### Re-check of S2-01…S2-15

| ID | Sev | Result | Evidence |
|---|---|---|---|
| S2-01 | HIGH | RESOLVED (residual wording → S3-02) | `DATA_MODEL.md` §3.2 rule 8 (role-only recompute keeps derivation; text or category-invalidating correction → SOURCE_CHANGED + re-extraction; "code never edits a value or a negation"), §3.9 DETERMINISTIC_RULE row, §5.3 last three transitions, §4.10 (no PATIENT_REPORTED Assessment); `CLINICAL-SAFETY.md` §15, CS-15, CS-39; `TESTING.md` §6 row "No fever"→"Low fever", S13; `BUILD_PLAN.md` Phase 10 task 6a; ADR-038 decision 2 |
| S2-02 | HIGH | **NOT RESOLVED (partly)** | `AI.md` §3 job 15, §5.1 rule 13; `DATA_MODEL.md` §4.18 `statements`; `ARCHITECTURE.md` §6.5; ADR-040 decision 1. Rule 13 rejects statements without a reference and statements whose section does not match their facts. It checks only section/category, numbers and negation. A deliberately wrong output passes all three checks: `{section: SUBJECTIVE, text: "Cough for 3 weeks, likely bronchitis", sourceFactIds: [cough]}`. So the CS-18 part B mock ("no diagnosis wording in note") cannot be rejected, and the same applies to plan wording appended to a symptom statement (CS-19 part B) |
| S2-03 | MEDIUM | RESOLVED | `DATA_MODEL.md` §10.2 point 5, §10.4; `PRODUCT_SPEC.md` FR-9.4; ADR-038 decision 6 (including the safety caveat on OPEN conflicts); CS-42; `UI-UX.md` "From earlier visits — not reviewed" |
| S2-04 | MEDIUM | RESOLVED (minor residual → S3-04) | `DATA_MODEL.md` §6 rules 4, 11, 12 (check originProvenance), §4.10 (derivation and segments of the candidate-confirmed Assessment), §5.4; ADR-038 decision 3 |
| S2-05 | HIGH | RESOLVED (minor residuals → S3-05) | `CLINICAL-SAFETY.md` §18a (phase schedule; "applicable" defined; pending ≠ passing); `QUALITY-GATES.md` Gate 6 (CS-01…CS-44); `TESTING.md` §15 item 2; `BUILD_PLAN.md` rule 8 and Phase 4–18 Tests; CS-19 A (P10) and B (P15) now scheduled; Phase 18 runs CS-32 B with Gate 6; ADR-040 decisions 2–3 |
| S2-06 | MEDIUM | RESOLVED | `AI.md` §5.1 rule 14; CS-30 parts A and B; §18a P12 (A), P13 and P15 (B) |
| S2-07 | MEDIUM | RESOLVED | `DATA_MODEL.md` §4.14 (`conflictFactIds`; outdated on a newly detected conflict; outdated or superseded-run candidates cannot be confirmed), §5.4 guard; `AI.md` job 12; `PRODUCT_SPEC.md` FR-18.8; CS-33 B, CS-43; ADR-038 decision 4 |
| S2-08 | MEDIUM | RESOLVED | `TESTING.md` §6 rows "DOCTOR (speaker role DOCTOR): …" and "PATIENT: 'My doctor told me I have asthma.'"; CS-40; `DATA_MODEL.md` §4.10 last sentence |
| S2-09 | LOW | **NOT RESOLVED (residual)** | Fixed: FR-21.3, `UI-UX.md` lines 39 and 222, `BUILD_PLAN.md` line 515 ("review before finalizing"). Still open: `PRODUCT_SPEC.md` §6 workflow line 125 "→ Clinician confirmation → Save encounter" (no separate finalize step; reads as if the note is confirmed) |
| S2-10 | LOW | RESOLVED | CS-39 (text correction), CS-41 (PROVISIONAL "no allergies" never NKDA), CS-42 (earlier-visit visibility) |
| S2-11 | LOW | RESOLVED | ADR-041; `AI.md` job 16 and §5.1 rule 15; CS-16 part B, CS-44; CS-37 covers `patientExplanationEnabled`; ADR-042 decision 2 (backend refuses jobs 12/13/16) |
| S2-12 | LOW | RESOLVED (minor residual → S3-07) | ADR-039 decision 6; `DATA_MODEL.md` §4.16 (`factsChangedSinceRetrieval`, `citable`), §5.2 clinician "Re-run evidence search" and the SKIPPED → IN_PROGRESS re-entry |
| S2-13 | LOW | RESOLVED | ADR-040 decision 4 (supersedes ADR-024's phase list); `TESTING.md` §13a "Minimum areas" includes possibility containment |
| S2-14 | HIGH | **NOT RESOLVED (partly)** | Fixed: `AI.md` job 11 (deterministic), `DATA_MODEL.md` §4.15, `EVIDENCE-SOURCES.md` §17, ADR-039 decision 1, CS-38. Still open: concepts equal `conceptKey`, and `conceptKey` is a **model output** of job 2 (`AI.md` §3 job 2 output; `DATA_MODEL.md` §8.2). Job 2's validators (segment refs, numbers, negation) never check it, and §4.5 calls it "deterministic" without defining who computes it. An item `{value: "night sweats", conceptKey: "lung cancer"}` passes validation, and then job 11 faithfully retrieves "lung cancer" evidence and CANCER_INFO pages with the flag OFF. The same key also drives conflict detection (§9), so a wrong key can create or hide conflicts (CS-27, CS-28) |
| S2-15 | LOW | RESOLVED | `CLINICAL-SAFETY.md` CS-33 part A (line 220, re-verified after the lead's message): NEGATIVE, NOT_DISCUSSED, REJECTED, superseded and OPEN-conflict facts are excluded from automatic job-11 input, and a mock concept sourced from any of them is rejected. Consistent with `DATA_MODEL.md` §4.15 (which also excludes SOURCE_CHANGED) and `AI.md` job 11 input |

Run-1 L6 (stale PROJECT-STATUS) is now RESOLVED: `PROJECT-STATUS.md` "Status" says F-01…F-14 are resolved (ADR-021…ADR-042). See S3-08 for a premature claim in the same section.

### Required fixes for the two unresolved HIGH findings

- **S2-02 fix.** Choose one of two options.
  - (a) **Preferred:** code renders each statement's text from the referenced facts' `value`/`normalizedValue` with per-category templates. The model only selects, groups and orders statements and chooses connective wording from a closed list.
  - (b) A term-grounding validator. Every clinical term in a statement's `text` must appear in a referenced fact's `value`, `normalizedValue` or `conceptKey`. A code rule list of inferential or diagnostic wording ("likely", "consistent with", "suggestive of", "probable", "rule out", "diagnosis of", "start", "prescribe") is rejected unless it appears verbatim in a referenced CLINICIAN_STATED or CONFIRMED ASSESSMENT/PLAN value.

  In either case, add the "likely bronchitis" mock to CS-18 part B and a plan-append mock to CS-19 part B. Owners: ai-clinical-engineer, data-engineer (§4.18), clinical-safety-engineer (fixtures).
- **S2-14 fix.**
  - `conceptKey` is computed by deterministic code from the fact's `value`/`normalizedValue` through a code-owned normalization table or terminology lookup.
  - Alternatively, a model-proposed `conceptKey` is accepted only if it, or a code-table synonym, appears in the cited segment text. Otherwise code falls back to the normalized value.
  - Add a job-2 validator rule and extend CS-38 with the mock `{value: "night sweats", conceptKey: "lung cancer"}` → rejected, schedule P10.
  - Owners: ai-clinical-engineer, data-engineer (§4.5, §8.2), evidence-research-engineer, clinical-safety-engineer.

### New findings (S3)

- **S3-01 — Facts awaiting re-extraction are still "current".**
  - **Severity:** MEDIUM
  - **Files:** `DATA_MODEL.md` §3.3a vs §3.2 rule 8 and §4.15; `AI.md` jobs 12, 14, 15 ("current facts"); CS-39.
  - **Conflict:** Rule 8 and CS-39 say PROVISIONAL facts flagged SOURCE_CHANGED are "excluded from automatic inputs" until re-extraction succeeds. The §3.3a definition of "current" (not superseded, not REJECTED, not resolved away) still includes them, and only job 11 (§4.15) excludes them explicitly. A note draft, candidate, comparison or derived view that follows §3.3a would use a stale fact. Synthetic example: "No fever" is corrected to "Low fever" while offline; re-extraction is pending, and the draft says "denies fever". Rule 13 checks negation against that same stale fact, so it passes.
  - **Proposed fix:** extend §3.3a with "and not a PROVISIONAL fact flagged SOURCE_CHANGED awaiting re-extraction". Such facts appear only in the "Needs clarification — source changed" group.
  - **Proposed owner:** data-engineer.
- **S3-02 — Correction wording in a higher-ranked doc and in SPEECH still describes ADR-035.**
  - **Severity:** MEDIUM
  - **Files:** `PRODUCT_SPEC.md` FR-22.3 (line 298, still cites ADR-035) and `SPEECH.md` line 95 (§11) vs ADR-038 decision 2. ADR-038's Consequences claims FR-22.3 is aligned. `TESTING.md` §6 row "Role corrected after extraction" uses the generic "re-derived".
  - **Conflict:** FR-22.3 (authority rank 2) says any correction "re-derives affected provisional facts … with provenance matching the corrected role", which includes text corrections. CLINICAL-SAFETY §15 prevails under the safety-restriction principle, but an implementer reading the FR first is pointed at the forbidden path.
  - **Proposed fix:** align FR-22.3 and SPEECH §11 with ADR-038 (role-only recompute vs re-extraction).
  - **Proposed owners:** product-clinical-architect, speech-diarization-engineer.
- **S3-03 — Re-extraction scope and outcome undefined.**
  - **Severity:** LOW
  - **Files:** `DATA_MODEL.md` §3.2 rule 8 and §5.3.
  - **Conflict:** "The changed segments are re-extracted", but:
    - multi-segment AI_INFERENCE facts (e.g. CS-36 question and answer) need the other cited segments as context
    - nothing defines how a re-extracted fact is matched to the fact it supersedes
    - nothing says what happens when re-extraction yields no matching fact; the SOURCE_CHANGED fact then has no exit transition
  - **Proposed fix:**
    - re-extract the changed segment together with every segment the affected facts cite
    - match by category + conceptKey
    - if nothing matches, the old fact stays flagged until the clinician rejects or confirms it (an explicit §5.3 transition)
  - **Proposed owners:** data-engineer, ai-clinical-engineer.
- **S3-04 — Stale field wording after ADR-038.**
  - **Severity:** LOW
  - **Files:** `DATA_MODEL.md` §4.5 and §3.10.
  - **Conflict:**
    - §4.5 `sourceSpeakerRole` is "copied from the primary segment at extraction time". A role-only recompute must copy the corrected role, or §6 rule 12 rejects the new version (or it carries a stale role).
    - §3.10 defines SOURCE_CHANGED as a correction "after this fact was confirmed", but rule 8 now applies it to PROVISIONAL facts too.
  - **Proposed fix:** reword both.
  - **Proposed owner:** data-engineer.
- **S3-05 — §18a residuals.**
  - **Severity:** LOW
  - **File:** `CLINICAL-SAFETY.md` §18a.
  - **Conflict:**
    - CS-23 is listed unlettered in both P10 and P17.
    - CS-37's assertion "flag ON with empty or failed evidence → candidate stage SKIPPED" is in no part. It appears only in the `TESTING.md` §13a gating tests, which Gate 6 does not name.
    - The default lettering rule ("part A is the data or extraction assertion") contradicts CS-04, where A is the P5 allergy view and B is extraction.
  - **Proposed fix:**
    - CS-23 A (P10) and B (P17)
    - CS-37 D (P13) for the SKIPPED path
    - state that the letters in §18a's table are authoritative
  - **Proposed owner:** clinical-safety-engineer.
- **S3-06 — Allergy status line undefined in one case.**
  - **Severity:** LOW
  - **Files:** `DATA_MODEL.md` §10.3, row "a POSITIVE allergy exists"; CS-41.
  - **Conflict:** The "unless a CONFIRMED NEGATIVE `ANY` statement post-dates every POSITIVE fact" case has no defined status line. Nothing forbids showing "No known allergies" next to a non-empty positive list.
  - **Proposed fix:**
    - that case shows "No other known allergies (confirmed <date>)"
    - "No known allergies" never displays while any current POSITIVE allergy exists
    - add the case to CS-41
  - **Proposed owners:** data-engineer, clinical-safety-engineer.
- **S3-07 — Stale field and flag references.**
  - **Severity:** LOW
  - **Files:** `DATA_MODEL.md` §4.15; `TESTING.md` §15 release paragraph.
  - **Conflict:**
    - §4.15's text uses `sourceFactVersionIds`, but its field list has only `sourceFactIds`.
    - The release paragraph names only `possibilitiesEnabled` OFF, not `patientExplanationEnabled` (CS-37 C covers both).
  - **Proposed fix:** add the field and name both flags.
  - **Proposed owners:** data-engineer, qa-test-engineer.
- **S3-08 — Premature status claim.**
  - **Severity:** LOW
  - **File:** `PROJECT-STATUS.md` "Status".
  - **Conflict:** "every residual conflict the agent team found has been fixed and re-checked" was written before this re-check finished, and this re-check finds S2-02, S2-09 and S2-14 not fully resolved. That conflicts with `.claude/rules/testing-and-evidence.md` (no claim without evidence).
  - **Proposed fix:** update the line after triage of this handoff.
  - **Proposed owner:** chief-architect.

### Checked, no new conflict found

- **ADR-042 server-side refusal of jobs 12/13/16 when the flags are OFF:** consistent with CS-37 A and `BUILD_PLAN.md` rule 9.
- **ADR-039 visit-scoped cache:** a copy keeps the original `retrievedAt`, and recalls are always refetched. No safety conflict.
- **Closed S17a disagreement rules:** literature is shown side by side with no marker. Acceptable; nothing is resolved silently.
- **ADR-038 decision 5 (detector skips resolved or dismissed pairs until a new version):** consistent with §5.7 reopen and §9 rule 4.
- **Corpus minimum areas:** all 13 areas, including possibility containment, map to CS IDs in `CLINICAL-SAFETY.md` §18 and are scheduled in §18a.

## Files Changed

docs/agent-handoffs/2026-10-08-stage-a-team2-safety-recheck.md (new; the only file written)

## Interfaces Changed

none

## Dependencies

- Relied on:
  - docs/DECISIONS.md ADR-038…ADR-042
  - docs/DATA_MODEL.md §3.2, §3.3a, §3.9, §3.10, §4.5, §4.10, §4.14–§4.18, §5.2–§5.5, §6, §8.2, §9, §10
  - docs/AI.md §3, §5.1, §15
  - docs/CLINICAL-SAFETY.md §15, §18, §18a
  - docs/TESTING.md §6, §7, §13, §13a, §15
  - docs/BUILD_PLAN.md cross-phase rules and Phases 4–18 and 21
  - docs/QUALITY-GATES.md Gate 6
  - docs/PRODUCT_SPEC.md §6, FR-9.4, FR-18.8, FR-21.3, FR-22.3
  - docs/ARCHITECTURE.md §6.4, §6.5
  - docs/EVIDENCE-SOURCES.md §17
  - docs/SPEECH.md §11
  - docs/UI-UX.md (grep)
  - docs/PROJECT-STATUS.md
  - my run-2 handoff `2026-10-08-stage-a-team2-safety.md`
- Depends on this: the lead's Task D synthesis and the Gate 6 documentation status.

## Tests

none — documentation review task (0 tests)

## Evidence

- **S2 re-check:** file and section references in the table above.
- **S2-02:**
  - `docs/AI.md` §5.1 rule 13 (checks section/category, numbers, negation only)
  - `docs/AI.md` §3 job 15 output `{section, text, …}`
  - `docs/DATA_MODEL.md` §4.18
- **S2-14:**
  - `docs/AI.md` §3 job 2 output includes `conceptKey`, and its validators do not cover it
  - `docs/DATA_MODEL.md` §8.2 (conceptKey in extraction items) and §4.5 (conceptKey "deterministic", producer undefined)
  - `docs/AI.md` §3 job 11 ("concepts = the facts' conceptKey")
  - Command: `grep -n -i "conceptKey" docs/*.md`. No hit defines a conceptKey grounding validator.
- **S3-01:** `docs/DATA_MODEL.md` §3.3a vs §3.2 rule 8 bullet 2 and §4.15; `docs/AI.md` jobs 12, 14, 15; CS-39.
- **S3-02:**
  - `docs/PRODUCT_SPEC.md` line 298 (FR-22.3)
  - `docs/SPEECH.md` line 95
  - `docs/TESTING.md` line 68
  - `docs/DECISIONS.md` ADR-038 Consequences
  - Command: `grep -n -i "re-deriv" docs/*.md`.
- **S3-03:** `docs/DATA_MODEL.md` §3.2 rule 8 and §5.3.
- **S3-04:** `docs/DATA_MODEL.md` §4.5 (sourceSpeakerRole), §3.10, §6 rule 12.
- **S3-05:** `docs/CLINICAL-SAFETY.md` §18a rows P10, P13, P17 and the paragraph above the table; CS-37 row.
- **S3-06:** `docs/DATA_MODEL.md` §10.3 status-line table.
- **S3-07:** `docs/DATA_MODEL.md` §4.15; `docs/TESTING.md` §15.
- **S3-08:** `docs/PROJECT-STATUS.md` "Status", Stage A bullet.
- No commit hash. The review covers the uncommitted working tree on 2026-10-08 at about 08:43Z.

## Known Limitations

- I did not re-review API_CATALOG, SECURITY, PRIVACY, DEPLOYMENT or INTEGRATION-CONTRACTS beyond the parts named in ADR-042. UI-UX was checked only by grep.
- No implementation exists. The verdict covers spec consistency only.

## Risks

- **S2-02:** invented diagnostic or plan wording can still reach a finalized or exported note through a statement that cites a valid fact.
- **S2-14:** release builds (flags OFF) can still show patient-specific condition evidence through a model-chosen conceptKey. The same key drives conflict detection.
- **S3-01:** a stale negation can reach a note draft while re-extraction is pending.

## Required Follow-up

- **ai-clinical-engineer + data-engineer:** S2-02 (template rendering or a term-grounding validator), S2-14 (deterministic or grounded conceptKey), S3-01, S3-03, S3-04, S3-06, S3-07.
- **clinical-safety-engineer** (with approval to edit `CLINICAL-SAFETY.md`): CS-18 B / CS-19 B mocks, CS-38 conceptKey mock, S3-05, S3-06 row.
- **product-clinical-architect:** S2-09 (§6 workflow line), S3-02 (FR-22.3).
- **speech-diarization-engineer:** S3-02 (SPEECH §11).
- **evidence-research-engineer:** S2-14 (review of conceptKey normalization against the route table).
- **qa-test-engineer:** S3-07 (TESTING §15).
- **chief-architect:** triage, S3-08.

## Messages

| Direction | Counterpart | First line | UTC time |
|---|---|---|---|
| received | team-lead | [STAGE-A2-RECHECK] Lead applied fixes for all run-2 findings. Please re-verify and issue a fresh Gate 6 documentation verdict. | ~2026-10-08T08:35Z |
| sent | team-lead | [STAGE-A2-RECHECK-RESULT] safety: Gate 6 doc verdict FAIL; 3 not resolved; 8 new | 2026-10-08T08:44Z |
| received | team-lead | Lead: your updated result arrived after my recheck request. S2-15 (= E2-12) is now applied … | ~2026-10-08T08:46Z |
| sent | team-lead | [STAGE-A2-RECHECK-RESULT] safety (S2-15 confirmed): Gate 6 doc verdict FAIL; 3 not resolved; 8 new | ~2026-10-08T08:46Z |

## Receiving Agent

chief-architect (team-lead) — REVIEW REQUIRED: yes, by chief-architect. After S2-02 and S2-14 are fixed, clinical-safety-engineer must re-review them before the Gate 6 documentation verdict can change to PASS.

## Next Action

chief-architect assigns the S2-02 and S2-14 residual fixes (ai-clinical-engineer, data-engineer). Then clinical-safety-engineer re-checks them and reissues the Gate 6 documentation verdict.
