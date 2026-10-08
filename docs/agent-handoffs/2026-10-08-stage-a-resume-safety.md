# Task Handoff

## Owner

clinical-safety-engineer (Stage A resume, after the previous session hit its usage limit)

## AGENT

clinical-safety-engineer

## Task

Re-check HIGH S2-02 and S2-14 against ADR-043 and the current specs, re-check S2-09 and S3-01…S3-08, complete the safety-corpus coverage map, evaluate Gate 6, and answer the team validation question. BUILD_PLAN Phase 0 (Stage A). Documentation review only.

## TASK

Same as Task above (task #1, "Task C2").

## Status

COMPLETED. Two HIGH findings remain open, so the Gate 6 documentation verdict is **FAIL**.

## STATUS

COMPLETED. Gate 6 documentation verdict: FAIL.

## What Changed

See FINDINGS. I edited `CLINICAL-SAFETY.md` (my document) and the Gate 6 range in `QUALITY-GATES.md`, as the lead authorized.

## FINDINGS

### 1. HIGH findings re-check

**S2-02 (free model text in the note): NOT RESOLVED. The channel moved upstream into job-2 `value`.**

Fixed:
- job 15 now returns statement selection only, and any text field is rejected (`AI.md:61`, `AI.md:108` rule 13)
- code renders the statements (`DATA_MODEL.md:369` §4.18, `ARCHITECTURE.md:230-231`, ADR-043 decision 5)
- the CS-18 B and CS-19 B mocks exist (`CLINICAL-SAFETY.md:205-206`)

Still open: code renders the note from the facts' `value`, and `value` is free model text from job 2. Nothing grounds its words:
- Rule 2 checks numbers only.
- Rule 3 checks negation only.
- Rule 8 (`AI.md:103`) does not define "supported by exactly one segment". When support fails, rule 8 only re-labels the item AI_INFERENCE; it does not reject it.
- Neither §5.1 nor DATA_MODEL §6 limits what an AI_INFERENCE value may contain.

Adversarial example (synthetic):
- PATIENT segment T-0043: "I've had a cough for 3 weeks."
- job-2 mock: `{category: SYMPTOM, value: "cough for 3 weeks, likely bronchitis", sourceSegmentIds: [T-0043], derivationMethod: VERBATIM_EXTRACTION}`
- Rule 2 passes ("3" is in the source), and rule 3 passes. Rule 8 either accepts it (an implementation-defined support test) or re-labels it AI_INFERENCE.
- Job 15 selects it under SUBJECTIVE, and rule 13 passes (SYMPTOM matches SUBJECTIVE).
- Code renders "Cough for 3 weeks, likely bronchitis", either with an "AI inference — verify" label or, in the VERBATIM case, as patient-reported.

So the claim at `AI.md:61` ("inferential or treatment wording can come only verbatim from a referenced CLINICIAN_STATED or CONFIRMED assessment or plan fact") is not enforced by any defined validator. Plan wording works the same way: a SYMPTOM value of "cough — start antibiotics".

**S2-14 (model-assigned conceptKey): NOT RESOLVED. The grounding check is against the segment, not the fact.**

Fixed:
- code computes the key from the value (`AI.md:41`, `AI.md:48`)
- the family-history, social-history, AI-inference and UNMAPPED exclusions exist (`DATA_MODEL.md:337`, `DATA_MODEL.md:339-351`)
- CS-38 A and B (`CLINICAL-SAFETY.md:225`)

Still open: rule 16 (`AI.md:111`) and DATA_MODEL §6 rule 19 (`DATA_MODEL.md:557`, "computable … from the value, **or** appear … in a cited segment's text") keep a model key whenever that key appears anywhere in a cited segment. Two synthetic examples:
- **Negation laundering.** PATIENT: "No, I don't have lung cancer, but I've had night sweats." The mock `{SYMPTOM, value: "night sweats", POSITIVE, conceptKey: "lung cancer"}` passes because "lung cancer" is in the segment. The fact is eligible (POSITIVE, PATIENT_REPORTED, SYMPTOM), so an AUTOMATIC literature query runs with the flags OFF, and the card reads "Retrieved for: lung cancer (POSITIVE)". That is a denied condition presented as positive. It also bypasses the HISTORY_FAMILY exclusion for "My father had lung cancer…".
- **Conflict hiding.** Visit 1: "metformin 500 twice a day". Visit 2: "I take metformin 1000 daily, not glipizide", with the mock key "glipizide". The keys differ, so the VALUE_MISMATCH conflict (CS-27, §9) is never created.

CS-38 A uses a segment that does not contain "lung cancer", so it passes while this hole stays open.

Required fixes (proposed owners: ai-clinical-engineer and data-engineer; chief-architect for the ADR):
- **S2-14:**
  - `conceptKey` = normalization-table output of the fact's own `value` or `normalizedValue`
  - a model key is accepted only if it, or a table synonym, appears in that fact's **value** (or its exact single-segment source span), never just anywhere in the segment
  - align `AI.md:111`, `DATA_MODEL.md:249`, `DATA_MODEL.md:557` and ADR-043 decision 1
  - CS-38 part A gains a variant (P10): segment "No, I don't have lung cancer, but I've had night sweats", mock key "lung cancer" → "night sweats" or UNMAPPED
- **S2-02:**
  - define rule 8's support test deterministically: a VERBATIM value is a contiguous span of the segment text after code-defined whitespace and case normalization
  - for AI_INFERENCE values, every clinical term must appear in a cited segment or the code synonym table
  - a code rule list of inferential, diagnostic and treatment wording ("likely", "consistent with", "suggestive of", "probable", "rule out", "diagnosis of", "start", "prescribe") is rejected in any job-2 value unless it appears verbatim in a cited DOCTOR segment
  - CS-18 gains part C (P10): the job-2 mock above → rejected
  - CS-19 gains part C (P10): a SYMPTOM value with appended plan wording → rejected

I did not add these CS parts. The validator rule has to be specified first (documentation-first), and the lead limited my CLINICAL-SAFETY edits to the coverage table and new rows.

### 2. Residual re-check

| ID | Result | Evidence |
|---|---|---|
| S2-09 | RESOLVED | `PRODUCT_SPEC.md:125` "Clinician confirmation of individual facts, then note finalization (finalizing confirms no fact)" |
| S3-01 | RESOLVED | `DATA_MODEL.md:141` §3.3a eligibility covers jobs 11/12/14/15, views and the detector; `DATA_MODEL.md:349`; CS-39 |
| S3-02 | RESOLVED | `PRODUCT_SPEC.md:298-301` FR-22.3; `SPEECH.md` §11; `TESTING.md:68` |
| S3-03 | RESOLVED | `DATA_MODEL.md:127` (every cited segment; match by category + conceptKey; no automatic exit), `DATA_MODEL.md:490-492`. Caveat: matching inherits the S2-14 key weakness |
| S3-04 | RESOLVED | `DATA_MODEL.md:261` (sourceSpeakerRole recomputed), `DATA_MODEL.md:177` (§3.10 covers PROVISIONAL facts) |
| S3-05 | RESOLVED | `CLINICAL-SAFETY.md` §18a: "letters … authoritative", CS-23 A (P10) and B (P17), CS-37 D (P13) |
| S3-06 | RESOLVED | `DATA_MODEL.md:831`; CS-41 third case |
| S3-07 | RESOLVED | `DATA_MODEL.md:335` has `sourceFactVersionIds`; `TESTING.md:213` names both flags |
| S3-08 | NOT RESOLVED | `PROJECT-STATUS.md:19` says residuals "have been fixed through ADR-043" and points to `docs/agent-handoffs/2026-10-08-stage-a-team2-synthesis.md`, which **does not exist** (`ls docs/agent-handoffs/`). This re-check finds S2-02 and S2-14 still open. Owner: chief-architect |

### 3. Safety corpus coverage (edited)

`CLINICAL-SAFETY.md` §18 "Minimum safety corpus coverage" now maps all 18 requested areas:
- New rows mapped to existing tests: not discussed, uncertain speech, patient reported, clinician stated, clinician confirmed, corrected statement, superseded statement, evidence filtering.
- CS-36 is added to AI inference.
- The reference-image row is renamed to "reference-image misuse (interpretation or "patient match")".
- No row was deleted or weakened.

Unclear-audio speech (`[unclear]`, LOW ASR confidence → UNCERTAIN_SPEECH) had no CS test. It appeared only in `SPEECH.md` §17 "mumbled dose" and `CLINICAL-SAFETY.md` §9. I added **CS-45** (`CLINICAL-SAFETY.md:232`) and scheduled it in §18a: A in P10, B in P15. Gate 6 now reads CS-01…CS-45 (`QUALITY-GATES.md:44`).

Follow-up for the range text I may not edit:
- `TESTING.md:74`, `:161`, `:209` (qa-test-engineer)
- `BUILD_PLAN.md:233` (chief-architect)
- `.claude/agents/ai-clinical-engineer.md:52` and `.claude/agents/clinical-safety-engineer.md:19-20` (chief-architect)
- `AI.md` §5.1 needs a rule that a fact citing an `[unclear]` or LOW-confidence span gets UNCERTAIN_SPEECH (ai-clinical-engineer)

### 4. Gate 6 evaluation (`QUALITY-GATES.md:41-45`)

Current phase: 0 (Stage A). The earliest §18a schedule row is Phase 4, so the applicable CS set is empty. No `tests/` directory and no application code exist.

| Criterion | Status | Evidence | Owner | Required correction |
|---|---|---|---|---|
| All applicable CS-01…CS-45 (incl. CS-16a) pass; pending ≠ passing | NOT YET APPLICABLE (empty applicable set at Phase 0; nothing counted as passing) | §18a definition of "applicable"; `ls tests` → no such directory | clinical-safety-engineer, qa-test-engineer | none now; the Phase 4 parts must pass at Phase 4 |
| The phase's safety corpus cases exist (`TESTING.md` §13a) | NOT YET APPLICABLE (corpus is built in Phase 6) | `TESTING.md:156-158`; `BUILD_PLAN.md:233` | clinical-safety-engineer + qa-test-engineer | build in Phase 6 |
| With `possibilitiesEnabled` OFF no R2 job runs (CS-37) | NOT YET APPLICABLE (behavior); spec consistent | CS-37 A is at P13; ADR-042 | ai-clinical-engineer, backend-api-engineer | none |
| No diagnosis/prescribing/dose/probability output | NOT YET APPLICABLE (behavior); **spec FAIL** | S2-02: diagnostic or plan wording can enter the note through job-2 `value` | ai-clinical-engineer, data-engineer | the S2-02 fix above |
| NOT_DISCUSSED never rendered as negative/normal | NOT YET APPLICABLE (behavior); spec consistent | `AI.md:102` rule 7; CS-04, CS-20, CS-41 | ai-clinical-engineer | none |
| Citations only from provider responses | NOT YET APPLICABLE (behavior); spec consistent | `AI.md` rules 5, 10, 11; `DATA_MODEL.md:359`; CS-16, CS-16a | evidence-research-engineer | none |
| Review of AI/evidence/data changes completed | **FAIL** (review completed, findings open) | this handoff; S2-02, S2-14, S3-08 | chief-architect → ai-clinical-engineer, data-engineer | the S2-02 and S2-14 fixes, then re-review by clinical-safety-engineer |

**Gate 6 documentation verdict (spec consistency for safety): FAIL.** No criterion is marked PASS for a pending test, and Gate 6 itself was not changed except for the range CS-44 → CS-45.

### 5. Team validation question

The most important remaining safety ambiguity: **job-2 model outputs (`value` and `conceptKey`) are still grounded only by numbers, negation and the segment as a whole, not term by term.**

ADR-043 moved note rendering and concept keys into code, but code renders from, and keys off, a model-written `value`. The model key is accepted if it appears anywhere in the segment (`AI.md:103`, `AI.md:111`, `DATA_MODEL.md:557`). So "likely bronchitis" can still reach a note, and a denied "lung cancer" can still drive automatic evidence labeled POSITIVE with the flags OFF.

One fix closes both: a deterministic span or term-grounding rule for `value`, with the key derived only from the fact's own value.

## DOCUMENTS REVIEWED

- `CLAUDE.md` and `.claude/rules/*`
- `docs/DECISIONS.md` ADR-038…ADR-043
- `docs/AI.md` (all)
- `docs/DATA_MODEL.md` §3–§10
- `docs/CLINICAL-SAFETY.md` (all)
- `docs/TESTING.md` §6, §7, §13a, §15
- `docs/QUALITY-GATES.md` Gate 6
- `docs/PRODUCT_SPEC.md` §6, FR-21, FR-22.3
- `docs/SPEECH.md` §11, §12, §17
- `docs/ARCHITECTURE.md` (grep: §6.4, §6.5)
- `docs/EVIDENCE-SOURCES.md` §17 (grep)
- `docs/BUILD_PLAN.md` (grep: Phases 6, 10, 12, 15)
- `docs/PROJECT-STATUS.md` "Status" and Stage A sections
- my previous handoff `2026-10-08-stage-a-team2-safety-recheck.md`

## Files Changed

See FILES CHANGED below.

## FILES CHANGED

- `docs/CLINICAL-SAFETY.md`: CS-45 row, coverage table (8 new area rows, CS-36 added to AI inference, reference-image row renamed), §18a P10/P15 schedule for CS-45
- `docs/QUALITY-GATES.md`: Gate 6 range CS-01…CS-44 → CS-01…CS-45
- `docs/agent-handoffs/2026-10-08-stage-a-resume-safety.md` (new)

## Interfaces Changed

none

## Dependencies

- **Relies on:** ADR-043 and the specs listed above.
- **Depends on this:** the lead's Stage A integration conclusion (task #4) and the Gate 6 status.

## Tests

none — documentation review task (0 tests). No application code or test suite exists (`ls /workspaces/clinnote-ai` → CLAUDE.md, README.md, docs, terminal_report.txt).

## TESTS / CHECKS

- **Read and grep of the files listed above.** Commands used:
  - `grep -n -i "conceptKey" docs/*.md`
  - `grep -n -i "substring\|supported by\|grounding validator" …`, which found no definition of the rule-8 support test
  - `grep -n -i "unclear\|UNCERTAIN_SPEECH" …`, which found no CS row before CS-45
  - `grep -rn "CS-44"` for range references
  - `ls docs/agent-handoffs/`, which shows the synthesis file is missing
- 0 automated tests.

## Evidence

File:line references are in FINDINGS. Review of the uncommitted working tree at about 2026-10-08T13:40Z. No commit hash.

## Known Limitations

- API_CATALOG, SECURITY, PRIVACY, DEPLOYMENT and UI-UX were not re-reviewed.
- ARCHITECTURE, EVIDENCE-SOURCES and BUILD_PLAN were checked by grep only.

## RISKS

See Risks below.

## Risks

- **S2-02:** AI-invented diagnostic or plan wording can reach finalized or exported notes through job-2 `value`. In the VERBATIM case it carries no AI label.
- **S2-14:** a denied, family-history or third-party condition can drive automatic evidence labeled POSITIVE in release builds. A wrong key can also hide a cross-visit dose conflict.
- **CS range drift:** TESTING, BUILD_PLAN and agent files still say CS-44 until their owners update them.

## REMAINING ISSUES

S2-02, S2-14 and S3-08 are open; the CS range text still needs updating. Owners are listed in Required Follow-up below.

## Required Follow-up

- **ai-clinical-engineer + data-engineer** (chief-architect to record the ADR-043 amendment):
  - S2-02: rule-8 span definition, term grounding and the inferential-wording rule list for job-2 values
  - S2-14: key derived from the fact's own value; align `AI.md:111`, `DATA_MODEL.md:249` and `DATA_MODEL.md:557`
  - AI.md §5.1 rule for UNCERTAIN_SPEECH (CS-45)
- **clinical-safety-engineer:** once those rules are documented, add CS-18 C, CS-19 C and the CS-38 A negated-segment variant.
- **qa-test-engineer:** CS range in `TESTING.md:74`, `:161`, `:209`.
- **chief-architect:**
  - CS range in `BUILD_PLAN.md:233` and the agent files
  - S3-08: correct `PROJECT-STATUS.md:19` and create or remove the reference to the missing team-2 synthesis

## Messages

| Direction | Counterpart | First line | UTC time |
|---|---|---|---|
| received | team-lead | You are clinical-safety-engineer for ClinNote AI, resuming Stage A (specification reconciliation)… | ~2026-10-08T13:20Z |
| sent | team-lead | Safety resume result: Gate 6 documentation verdict FAIL; S2-02 and S2-14 not resolved | ~2026-10-08T13:42Z |
| received | team-lead | Re-verify request from chief-architect: I accepted both HIGH findings and wrote ADR-044, please re-check it and reissue Gate 6. | ~2026-10-08T13:46Z |
| sent | team-lead | ADR-044 re-check: S2-02 RESOLVED; S2-14 resolved except DATA_MODEL:557; new HIGH S4-01; Gate 6 doc FAIL | 2026-10-08T13:46Z |
| received | evidence | [STAGE-A-RESUME-MSG] evidence-research-engineer question: does ADR-044 (rules 16+17) still let a family-history or interrogative mention drive automatic evidence through a model-chosen category? | ~2026-10-08T13:47Z |
| sent | evidence | Yes, live leak = S4-01 (HIGH); fix accepted with clause scoping; CS-46 and CS-38 B extended; UNMAPPED notice supported, not blocking | 2026-10-08T13:47Z |
| received | team-lead | Final re-check request from chief-architect: S4-01 and S4-02 are now fixed in the text; please re-check and issue the final Gate 6 documentation verdict. | ~2026-10-08T13:48Z |
| sent | team-lead | Final: S2-02, S2-14, S4-02 RESOLVED; S4-01 open only for interrogatives (HIGH); Gate 6 doc FAIL with a one-bullet fix | 2026-10-08T13:48Z |
| received | team-lead | Addendum from chief-architect: your context-rule requirements are now written into the spec; please run the final pass from my previous message against this text. | ~2026-10-08T13:49Z |
| sent | team-lead | Final verdict: S2-02, S2-14, S4-01, S4-02 RESOLVED; Gate 6 documentation verdict PASS (LOW residuals; S5-01 MEDIUM tracked) | 2026-10-08T13:49Z |
| received | team-lead | Request from chief-architect: please give a one-line safety verdict (PASS/FAIL) on evidence's new EVIDENCE-SOURCES §17 route table. | ~2026-10-08T13:50Z |
| sent | team-lead | §17 route table PASS; all three residuals closed | 2026-10-08T13:50Z |
| received | team-lead | shutdown_request (Stage A safety review complete) | 2026-10-08T13:50Z |
| sent | team-lead | shutdown_response approve=true | 2026-10-08T13:50Z |
| received | team-lead | Review request from chief-architect: product's re-check found P4-01 (HIGH) and P4-02…P4-05, and I wrote ADR-045 to fix them. | ~2026-10-08T13:58Z |
| sent | team-lead | ADR-045: S4-01 not reopened; new HIGH S6-01 (flagged conditional allergy hidden); Gate 6 doc FAIL | 2026-10-08T13:58Z |
| received | team-lead | From chief-architect: I've applied S6-01 through S6-04 using your Addendum 6 text. Please give your final Gate 6 verdict. | ~2026-10-08T13:59Z |
| sent | team-lead | Final: S6-01…S6-04 RESOLVED; Gate 6 documentation verdict PASS (one LOW wording residual) | 2026-10-08T13:59Z |

## Receiving Agent

chief-architect — REVIEW REQUIRED: yes, by chief-architect.

## RECEIVING AGENT

chief-architect — REVIEW REQUIRED: yes, by chief-architect. After the S2-02 and S2-14 fixes, clinical-safety-engineer must re-review them before the Gate 6 documentation verdict can change.

## Next Action

chief-architect amends ADR-043 (job-2 value grounding; key derived only from the fact's own value). Details are below.

## NEXT ACTION

chief-architect amends ADR-043 decision 1 and job-2 validation (span and term grounding for `value`; key only from the fact's own value), with ai-clinical-engineer and data-engineer. Then clinical-safety-engineer adds CS-18 C, CS-19 C and the CS-38 A variant and re-issues the Gate 6 documentation verdict.


---

## Addendum — ADR-044 re-check (2026-10-08T13:46Z)

**Scope:** ADR-044 (`DECISIONS.md`), `AI.md` §3 job 2 and §5.1 rules 8, 16, 17, `DATA_MODEL.md` §3.9, §4.5, §6, §8.3, `BUILD_PLAN.md` Phase 10, and the CS range text. Documentation review only; 0 tests.

### CLINICAL-SAFETY.md edits (requested)
- **CS-18 part C (P10):**
  - the "likely bronchitis" job-2 mock (VERBATIM and AI_INFERENCE variants) → rejected by rule 17
  - DOCTOR "It's unlikely to be pneumonia." with the mocks "likely to be pneumonia" / "pneumonia" POSITIVE → never a POSITIVE assessment
  - over-blocking control: DOCTOR "This is likely bronchitis." → accepted
- **CS-19 part C (P10):**
  - symptom value with appended "start antibiotics" → rejected
  - PATIENT "Should I start antibiotics?" mocked as a PLAN → rejected (17c requires a DOCTOR segment)
  - over-blocking control: DOCTOR plan with 500 mg → accepted, numbers preserved
- **CS-29:** aligned with ADR-044 decision 1(d). A grounded VERBATIM claim is re-labeled AI_INFERENCE; an ungrounded one is rejected; code never trims a value.
- **CS-36:** adds an over-blocking assertion (the inferred value passes 17b/17c).
- **CS-38 part A:** adds the variant "No, I don't have lung cancer, but I've had night sweats." → key "night sweats" or UNMAPPED, and segment text never validates a key.
- **§18a P10:** CS-18 C, CS-19 C and the CS-38 A variant.

### CLINICAL-SAFETY.md edits (from the new finding S4-01)
- **CS-46** "Context: hypothetical and other-person statements": part A in P10, part B in P15.
- New coverage row: "context (hypothetical, other person)" → CS-40, CS-46.
- `QUALITY-GATES.md` Gate 6 range is now CS-01…CS-46.

### Over-blocking check (rule 17b/c vs CS-36)
- **No over-blocking for CS-36.** DOCTOR "Still on amlodipine?" / PATIENT "No, I stopped it." gives the value "amlodipine stopped":
  - every content token appears in a cited segment (17b)
  - "stopped" is verbatim in a cited segment, and MEDICATION is not ASSESSMENT/PLAN, so no DOCTOR-only restriction applies (17c)
  - `takingStatus` DISCONTINUED is an enum, not a text field, so rule 17 does not touch it
- **Fail-safe residual.** A value worded "amlodipine discontinued" fails 17b unless the synonym table maps "stopped" to "discontinued". The item is then discarded and the stage becomes PARTIAL; this fails safe. The same applies to lay-to-clinical wording ("can't breathe at night" vs "nocturnal dyspnea"). ADR-044's future-review clause (extend the tables, never relax the rule) is the right control.
- **Hedged statements are not blocked.** For example "Patient may have asthma." and "maybe metformin?" pass, because the hedge words are verbatim in the segment.

### Verdicts

| ID | Result | Evidence |
|---|---|---|
| S2-02 | **RESOLVED** | `AI.md:103` (rule 8 rejects instead of only re-labeling), `AI.md:112-116` (rule 17a–c; all text fields of jobs 2–9), `DATA_MODEL.md:167` (§3.9), §8.3 item 2, ADR-044 decision 1. The "likely bronchitis" mock now fails 17a, 17b and 17c, and code renders notes only from grounded values plus templates (ADR-044 decision 3) |
| S2-14 | **RESOLVED in AI.md, §4.5 and ADR-044; one stale line remains** | `AI.md:111` and `DATA_MODEL.md:249` say the key comes only from the fact's own value. **`DATA_MODEL.md:557` (§6 validation rule 19) still says the key may "appear (or a table synonym of it) in a cited segment's text"**, which is the rule ADR-044 decision 2 replaced. The restrictive text prevails (ADR-018), but the validation-rule list is what implementers code against. Fix: replace rule 19 with the §4.5 wording. Owner: data-engineer or the lead. With that one line fixed, S2-14 is RESOLVED |

### New findings

- **S4-01 — HIGH — Context: hypothetical and other-person statements pass every validator.** The validators check negation (rule 3), hedging (rule 9) and wording grounding (rule 17). They do not check whether a finding is hypothetical or conditional, or who experiences it. The model chooses both the span and the category, so a contiguous span taken out of its clause passes. Three examples, all synthetic:
  - **Hypothetical.** DOCTOR: "If you develop chest pain, come back straight away." The mock `{SYMPTOM, "chest pain", POSITIVE, VERBATIM}` passes rules 3, 9 and 17a–c. The result is a CLINICIAN_STATED POSITIVE chest-pain fact, an automatic evidence query, and "Chest pain (clinician-stated)" in the note.
  - **Other person.** PATIENT: "My father had lung cancer." The mock `{HISTORY_MEDICAL, "lung cancer", POSITIVE, VERBATIM}` passes. Because the category is HISTORY_MEDICAL, job 11 picks the CANCER_INFO route with the R2 flags OFF. That is the same outcome S2-14 tried to prevent, now reached through the category instead of the key; the HISTORY_FAMILY exclusion only works if the category is right.
  - "My wife has diabetes." gets the same treatment.

  **Proposed fix.** Extend `AI.md` §5.1 rule 3 into a deterministic context rule with code cue lists, applied to the cue's scope in the cited segment (not to the value span alone):
  - negation → NEGATIVE
  - hedge → UNKNOWN / HEDGED_STATEMENT
  - hypothetical or conditional ("if", "in case", "should you", "watch for", "come back if") → no POSITIVE patient finding
  - other-person experiencer ("my father/mother/wife/brother…", "he/she has") → never a patient category; HISTORY_FAMILY only for a family member

  Record it as an ADR-044 amendment or a new ADR. Owners: ai-clinical-engineer and data-engineer; chief-architect records the ADR. Test: CS-46 (added).

- **S4-02 — MEDIUM — Polarity and hedge checks are one-directional and their scope is undefined.**
  - Rule 9 says "in the source **span**". A truncated verbatim span can therefore drop the hedge: "I think I had a fever, not sure" → span "I had a fever" POSITIVE passes 17a and rule 9. CS-06's expected UNKNOWN still catches it at test time, but the rule text permits it.
  - The cue lists (`AI.md:98`, `AI.md` §9, `CLINICAL-SAFETY.md` §7) lack "unlikely", "doubt" and "less likely".
  - Rule 17a does not say spans match on token boundaries, so "likely" is found inside "unlikely".
  - Rule 17b does not say that negation and hedge words are never stopwords.
  - Nothing requires a NEGATIVE value to have an in-scope negation cue. An AI_INFERENCE "no chest pain" built from "No cough. Chest pain yes." passes 17b, because the check treats all cited segments as one bag of words.

  **Proposed fix.** Scope rules 3 and 9 to the clause containing the finding in the cited segment, add the cues, require token boundaries, exclude cue words from the stopword list, and require a NEGATIVE value to have an in-scope negation cue. CS-18 C now covers "unlikely". Owner: ai-clinical-engineer.

### Gate 6 (reissued)
- The behavior criteria are unchanged: NOT YET APPLICABLE at Phase 0 (§18a's applicable set is empty; no tests exist; nothing is counted as passing).
- **Gate 6 documentation verdict: FAIL**, because of S4-01 (HIGH). It changes to PASS once S4-01 has a documented validator rule, `DATA_MODEL.md:557` is aligned, and S4-02 is either fixed or accepted by chief-architect as a tracked Phase 10 item.

### Files changed in this addendum
- `docs/CLINICAL-SAFETY.md`: CS-18, CS-19, CS-29, CS-36 and CS-38 rows; new CS-46 row; coverage table; §18a P10/P15
- `docs/QUALITY-GATES.md`: Gate 6 range now CS-01…CS-46
- this handoff

### Range follow-up
CS-46 is not yet reflected in the range text of:
- `TESTING.md:74`, `:161`, `:217`
- `BUILD_PLAN.md:233`
- `.claude/agents/ai-clinical-engineer.md:52`
- `.claude/agents/clinical-safety-engineer.md:19-20`

Owners: qa-test-engineer and chief-architect.

### Next action
chief-architect documents the S4-01 context rule (and S4-02) with ai-clinical-engineer, and aligns `DATA_MODEL.md:557` and the CS-46 range text. clinical-safety-engineer then re-checks and reissues Gate 6.

### Addendum 2: evidence-research-engineer question (2026-10-08T13:47Z)
- **(1) Live leak: confirmed.** It is the same class as S4-01 (HIGH). I had covered other-person statements and hypotheticals; evidence adds **interrogatives**: DOCTOR "Any lung cancer in the family?" or "Have you ever had TB?" → CLINICIAN_STATED POSITIVE. No rule checks the model-chosen `category` or the experiencer.
- **(2a) Fix accepted, with clause scoping.** Experiencer cues force HISTORY_FAMILY or rejection only within the finding's clause, not the whole segment. Otherwise "My mother had breast cancer and I have had a cough for 3 weeks" would over-block the patient's cough. An interrogative segment never grounds a POSITIVE fact on its own. A question plus an answer is at most AI_INFERENCE, which §4.15 already excludes from automatic evidence until confirmed.
- **(2b) Done.**
  - CS-38 part B now includes the mis-categorized HISTORY_MEDICAL "breast cancer" variant.
  - CS-46 now includes both interrogative cases and the clause-scope control.
- **UNMAPPED notice.** From a safety view, I support a line on Screen 12 such as "Not searched automatically: <value> (no mapped concept) — run a manual search". It discloses the gap honestly, in the same spirit as "No evidence found" (CLINICAL-SAFETY §12). It must not imply clinical absence. This is not a Gate 6 blocker; UI-UX/FR wording owner: product-clinical-architect. The manual-search affordance alone is acceptable but less transparent.

## Addendum 3: final re-check of ADR-044 decision 5 and AI.md rules 17–19 (2026-10-08T13:48Z)

**Checked:**
- `AI.md` §5.1 rules 3, 9, 16, 17, 18, 19
- `DATA_MODEL.md:557-558`
- ADR-044 decision 5
- the CS range text: `grep` finds CS-01…CS-46 in 8 places and no stale CS-44 or CS-45 range

0 tests (documentation review).

| ID | Final result | Evidence |
|---|---|---|
| S2-02 | **RESOLVED** | rules 8 and 17a–c, ADR-044 decisions 1 and 3 |
| S2-14 | **RESOLVED** | `AI.md` rule 16, `DATA_MODEL.md:249`, `DATA_MODEL.md:557` (now the §4.5 wording) |
| S4-02 | **RESOLVED** | rule 9 checks the whole clause and adds "unlikely" and "doubt"; rule 19 covers word-boundary tokenization, cue words that are never stopwords, and the requirement that a NEGATIVE item has an in-scope negation cue |
| S4-01 | **NOT RESOLVED (HIGH, narrowed to interrogatives)** | Hypothetical and experiencer statements are fixed (rule 19, `DATA_MODEL.md:558`). Questions are not covered. Rule 19 lists negation, hedge, hypothetical and experiencer cues only. Synthetic break: DOCTOR "Have you ever had TB?" / PATIENT "No." The mock `{HISTORY_MEDICAL, value: "TB", POSITIVE, VERBATIM_EXTRACTION}` citing only the DOCTOR segment passes rules 3, 9, 17 and 19. The result is a CLINICIAN_STATED POSITIVE TB history (a denial inverted), rendered in the note and used as an automatic evidence concept. CS-46 tests this, but no documented rule requires it |

**Exact fix text** (add as a fifth bullet to `AI.md` §5.1 rule 19, and a matching line in ADR-044 decision 5 and `DATA_MODEL.md` §6 rule 20):
> - **interrogative** cue (the clause is a question: ends in "?" or starts with a code-listed question cue such as "have you", "do you", "did you", "are you", "any", "is there", …; the list is code-maintained because ASR punctuation is unreliable) → the clause never grounds a POSITIVE or NEGATIVE fact on its own. A fact needs a non-interrogative cited clause (the answer). A question plus an answer across segments is AI_INFERENCE (rule 8), which is excluded from automatic evidence until confirmed (`DATA_MODEL.md` §4.15). Anything else is rejected.

**Adversarial pass, other results:**
- **MEDIUM (new, S5-01): a conditional plan can be extracted without its condition.** DOCTOR "If the cough persists, we'll start antibiotics." The PLAN value "start antibiotics" is a contiguous span, and rule 19 allows hypothetical clauses as DOCTOR PLAN text. The note then renders an unconditional plan.
  - Fix: for a hypothetical clause, the value span must include the conditional cue and its condition (e.g. "if the cough persists, we'll start antibiotics").
  - Owner: ai-clinical-engineer.
  - Not blocking: the plan is clinician-stated and PROVISIONAL.
- **No issue (fails safe):** elliptical self-reference ("My father had lung cancer, and so did I"). The patient's own fact can only be AI_INFERENCE, which is excluded from automatic evidence.
- **No issue (fails safe):** "I don't know if I had a fever" is caught by both the hedge and hypothetical cues and ends up UNKNOWN or rejected.
- **No issue:** rule 18 (unclear audio) matches CS-45.

**Final Gate 6 documentation verdict: FAIL**, solely on S4-01 (interrogatives). Adding the bullet above makes it PASS with no further safety review needed for that change: the wording is fixed here, and CS-46 already tests it. S5-01 stays tracked as MEDIUM for Phase 10. The behavior criteria remain NOT YET APPLICABLE at Phase 0; nothing is counted as passing.

## Addendum 4: final verdict (2026-10-08T13:49Z)

**Checked:**
- `AI.md` §5.1 rule 19: the question bullet, clause-only scope and the breast-cancer/cough control
- ADR-044 decision 5 (question form)
- `DATA_MODEL.md:557-558`

0 tests (documentation review).

| ID | Final result | Evidence |
|---|---|---|
| S2-02 | **RESOLVED** | `AI.md` rules 8 and 17; ADR-044 decisions 1 and 3 |
| S2-14 | **RESOLVED** | `AI.md` rule 16; `DATA_MODEL.md:249`, `:557` |
| S4-01 | **RESOLVED** | Rule 19 covers hypothetical, experiencer and question bullets, with clause-only scope. The "Have you ever had TB?" / "No." break now fails: a question alone never yields a fact, and question plus answer is AI_INFERENCE, which is excluded from automatic evidence (§4.15). Tested by CS-38 B and CS-46 |
| S4-02 | **RESOLVED** | rule 9 (whole clause, "unlikely", "doubt"); rule 19 (word boundaries, cue words never stopwords, NEGATIVE needs an in-scope cue) |

**Gate 6 documentation verdict: PASS.** This is the safety specification consistency verdict at Stage A. It is not an implementation verdict.
- The behavior criteria remain NOT YET APPLICABLE at Phase 0, and no test is counted as passing.
- Every applicable CS part must pass with test evidence from Phase 4 onward (§18a).

**Non-blocking residuals:**
- **LOW, owner data-engineer:** `DATA_MODEL.md:558` (§6 rule 20) summarizes only the hypothetical and experiencer cues. Add the question form for completeness.
- **LOW, owner ai-clinical-engineer at Phase 10:** the question bullet should state that detection does not rely on "?" alone (ASR punctuation is unreliable) and uses the code-maintained question-cue list ("have you", "do you", "any", "is there", …). The rule's general "cue lists are code-maintained and tested" sentence already covers this in substance.
- **MEDIUM S5-01, owner ai-clinical-engineer, Phase 10:** a conditional plan ("If the cough persists, we'll start antibiotics") must keep its condition in the extracted span.

## Addendum 5: EVIDENCE-SOURCES §17 route table and closing of residuals (2026-10-08T13:50Z)

- **§17 route table: PASS.**
  - The default is fail-closed: an unlisted category gets no route, and adding one needs an ADR and a safety review.
  - HISTORY_FAMILY, HISTORY_SOCIAL, PLAN, FOLLOW_UP and the other non-finding categories get no automatic route.
  - CANCER_INFO is limited to HISTORY_MEDICAL/ASSESSMENT facts in the cancer concept list.
  - The ban on automatic TRIALS, CHEMICAL and PUBLIC_HEALTH routes is a code constant.
  - Medication label routes sit behind the CS-11 lookup gate.
  - The table is consistent with `DATA_MODEL.md` §4.15, CS-33 and CS-38. Adverse-event records still carry the "do not establish causation" label (CLINICAL-SAFETY §12).
- **Residuals: all three CLOSED.**
  - LOW: `DATA_MODEL.md:558` rule 20 now covers questions and conditions.
  - LOW: `AI.md` rule 19 detects questions by cue list, independent of "?".
  - MEDIUM S5-01: a conditional PLAN/FOLLOW_UP value must include its condition (`AI.md` rule 19, ADR-044 decision 5).
- **Gate 6 documentation verdict remains PASS**, with no open safety residuals from this review. 0 tests (documentation review).

## Addendum 6: ADR-045 review (2026-10-08T13:58Z)

**Checked:**
- ADR-045
- `AI.md` §3 jobs 9, 14 and 15, and §5.1 rules 13, 19 and 20
- `DATA_MODEL.md` §3.3a, §3.10, §4.15 (line 349), §5.3, §6 rule 20 and §10.3
- `UI-UX.md:49`
- OD-012 interim rule

0 tests (documentation review).

### (a) Adversarial review
- **S4-01 is not reopened on the automatic path.** CONTEXT_UNCLEAR makes a fact ineligible (`DATA_MODEL.md:141`), and §4.15 (line 349) excludes it from evidence. A flagged "if I climb stairs I get chest pain" or "my father had lung cancer" (filed as HISTORY_MEDICAL) therefore never reaches note text, evidence, CANCER_INFO, views, the detector or candidates.
- **S6-01 — HIGH — a flagged positive allergy is hidden.**
  - Example: PATIENT "If I take penicillin I get a rash." The hypothetical cue "if" does not fit ALLERGY, so the item is kept flagged CONTEXT_UNCLEAR and becomes ineligible.
  - §10.3 computes allergy status over eligible facts only, and §9 compares eligible facts only. So:
    - the penicillin allergy is missing from the positive list
    - no BLANKET_VS_SPECIFIC conflict forms with "No allergies"
    - with an earlier CONFIRMED NKDA, the view and the note show "No known allergies"
  - This violates `DATA_MODEL.md` §9 rule 6 ("a POSITIVE allergy … is never hidden"), CS-28 and CLAUDE.md. Conditional wording is common in allergy histories.
  - **Fix text** (add to ADR-045 decision 3, `AI.md` rule 20, and `DATA_MODEL.md` §3.3a and §10.3):
    > Allergy safety exception: an ALLERGY item flagged CONTEXT_UNCLEAR, other than one whose experiencer is another person, is still shown in the positive allergy list with "Needs clarification — context". The allergy status line is then "Allergy status unclear — needs clarification", and "No known allergies"/NKDA is never shown in a view or note while it exists. It remains ineligible for evidence and note statements.
  - CS-46 now tests this.
- **MEDIUM S6-02 — the confirm transition for CONTEXT_UNCLEAR is undefined** (`DATA_MODEL.md` §5.3 has no transition for it).
  - If confirming does not clear the flag, a CONFIRMED fact stays ineligible forever.
  - If one-tap confirm clears it, "my father had lung cancer" filed as HISTORY_MEDICAL becomes eligible patient history and drives CANCER_INFO.
  - Fix: confirming a CONTEXT_UNCLEAR fact requires the clinician to confirm or change its category (with a "File as family history" option for experiencer items) and clears the flag. Add this as a §5.3 transition.
- **MEDIUM S6-03 — finalized notes can silently omit discussed findings.**
  - Flagged facts produce no note text. The marker check (decision 1) applies only where the model chose a `notDiscussed` marker, so exertional chest pain can simply be absent from a finalized note.
  - Fix:
    - code renders a fixed placeholder "<category>: item needs review — see transcript" for each flagged item (no value text)
    - `unreviewedFactCountAtFinalize` includes flagged items
  - CS-46 part B asserts the indicator and the count.
- **LOW S6-04.** State explicitly that an item whose value omits its cue clause is rejected; code never extends a value. Decision 1 should also count clinician-REJECTED facts as "discussed".
- **No issue:**
  - visible discards show a reason code with no model wording, and logs carry counts only
  - job 14 is selection-only with code templates
  - re-extraction matching for UNMAPPED keys
  - conditional advice is PLAN text, never a FollowUp
  - the OD-012 interim rule (caregiver role OTHER → TRANSCRIPTION, flagged)

### (b) CLINICAL-SAFETY.md edits
- **CS-04 part D (P15):** the marker is refused when a positive, flagged or discarded allergy item exists → "see transcript — needs review".
- **CS-24 part B (P16):** a text-field mock is rejected; both values and visit dates are shown; no trend word unless it is verbatim in a referenced CLINICIAN_STATED/CONFIRMED fact; code never derives a trend word from numbers.
- **CS-46 rewritten for keep-and-flag:**
  - cue-less values are rejected and listed as discarded
  - grounded cue-clause items are kept, flagged and ineligible everywhere
  - questions are rejected and listed
  - the scope control is kept
  - allergy safety-bias case (S6-01)
  - part B covers the indicator and `unreviewedFactCountAtFinalize`
- **§18a:** P15 adds CS-04 D; P16 now describes CS-24 B.
- **Coverage table:** the context row is now "hypothetical, other person, question; keep-and-flag" → CS-04 D, CS-40, CS-46.
- No CS row was added, so the range stays CS-01…CS-46.

### (c) Gate 6 documentation verdict: FAIL, on S6-01 (HIGH) only
- It becomes PASS when the allergy safety exception text above is added.
- S6-02 and S6-03 (MEDIUM) should be fixed in the same pass, or tracked for Phase 10/15.
- The behavior criteria remain NOT YET APPLICABLE at Phase 0; nothing is counted as passing.

## Addendum 7: final verdict on S6-01…S6-04 (2026-10-08T13:59Z)

0 tests (documentation review).

| ID | Result | Evidence |
|---|---|---|
| S6-01 | **RESOLVED** | the allergy exception is verbatim in `AI.md:127`, `DECISIONS.md:713`, `DATA_MODEL.md:826` (positive list) and `:831` (status row "unclear") |
| S6-02 | **RESOLVED** | `DATA_MODEL.md:493-494`: confirming requires confirming or changing the category ("File as family history") and clears the flag |
| S6-03 | **RESOLVED** | placeholder in `AI.md:127` and `DECISIONS.md:715`; `unreviewedFactCountAtFinalize` counts flagged facts (`DATA_MODEL.md:365`) |
| S6-04 | **RESOLVED** | a cue-less value is rejected and code never extends a value (`AI.md:127`, `DECISIONS.md:712`); clinician-REJECTED facts count as discussed (`AI.md:129`, `DECISIONS.md:704`) |

**Gate 6 documentation verdict: PASS.** This is the Stage A specification-consistency verdict only.
- The behavior criteria remain NOT YET APPLICABLE at Phase 0, and no test is counted as passing.
- Every scheduled CS part must pass with test evidence from Phase 4 onward (§18a).

**Non-blocking LOW residual (owner: data-engineer).** The opening sentence of `DATA_MODEL.md` §10.3 still says "Computed over allergy facts eligible for automatic input". Item 1 now adds flagged patient ALLERGY items, and the explicit restrictive exception prevails (ADR-018). Reword it to "eligible allergy facts plus the ADR-045 allergy exception".
