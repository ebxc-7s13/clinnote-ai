# Task Handoff

## TASK

Task A2 (Stage A resume, Phase 0): product re-check of P2-02, P2-15 and P3-01 to P3-07 against the current text; product semantics audit (workflow, terminology, information states, medications, longitudinal memory, the effect of ADR-044 rules 17–19 on the workflow); team validation question; UNMAPPED evidence notice.

## AGENT

product (product-clinical-architect)

## STATUS

COMPLETED. This was a documentation review plus product-owned edits to `docs/PRODUCT_SPEC.md`. No other spec file was edited.

## FINDINGS

### 1. Re-check of earlier findings

| Finding | Verdict | Evidence |
|---|---|---|
| P2-02 FR-22.3 / SPEECH §11 stale correction rule | RESOLVED | PRODUCT_SPEC:300–303 (role-only versus text/category-invalid, "until every segment … is re-extracted (ADR-043)"); SPEECH:97; DECISIONS:497 records the alignment |
| P2-15 ADR-033 past-tense claim about the team2 synthesis | NOT RESOLVED, pending Task D (lead) | DECISIONS:383 still says run-2 findings "were triaged in …team2-synthesis.md"; Glob `docs/agent-handoffs/*` shows no `*-team2-synthesis.md`. Becomes accurate when the lead writes the synthesis in Task D |
| P3-01 SOURCE_CHANGED facts still "current" | RESOLVED | DATA_MODEL:141 (§3.3a "eligible for automatic input"); :127 (rule 8 matching, unmatched stays flagged); :349 (§4.15 row); :490 (§5.3); CLINICAL-SAFETY:226 (CS-39 covers note, comparison, views, detector, evidence); DECISIONS:633–637. Residual: P4-04 |
| P3-02 root origin after a source correction | RESOLVED | DATA_MODEL:100, :126–127, :554 (§6 rule 16 "since the last source correction"); CLINICAL-SAFETY:201 (CS-15 "never 'originally clinician-stated' for a patient statement"); DECISIONS:639 |
| P3-03 UI-UX Screens 4/11 and job 16 location | RESOLVED (LOW residual) | UI-UX:101 (Screen 4: positive list + §10.3 status line, groupings, conflict marker); :193 (Screen 11: conflict group, evidence state at generation, Confirm disabled per CS-43, SKIPPED re-entry); :230 (job 16 action on Screen 14). Residual: no "Re-run evidence search first" offer on Regenerate when the bundle is stale (ux, LOW) |
| P3-04 UI-UX §2 label table | RESOLVED | UI-UX:18–48 is one table; adds §10.3 status lines, "Possibilities not generated", "Order has no meaning", "Sign in to use cloud processing", "not discussed since <date>". Action labels ("Re-run evidence search", "Draft patient explanation") are not in the table; acceptable as action names (LOW) |
| P3-05 §10.3 row-4 text; §10.4 assessments | RESOLVED | DATA_MODEL:832 ("No other known allergies (confirmed <date>)"); :840 (assessments named) |
| P3-06 stale cross-references | RESOLVED (LOW residual P4-06) | DECISIONS:479 (§3.3a); :401 (ADR-034 decision 4 annotated); DATA_MODEL:768 (§9 Definition uses eligible facts); :177 (§3.10 covers PROVISIONAL); PRODUCT_SPEC FR-25.4 (:321); ARCHITECTURE:243 |
| P3-07 gating wording "citable" | RESOLVED | DATA_MODEL:469 (canonical), :473 (SKIPPED → IN_PROGRESS by clinician re-run), :475; AI.md:43, :58 ("citable … non-empty"); ARCHITECTURE:207, :215; PRODUCT_SPEC FR-18.7 (:269, includes re-run) |

### 2. Product semantics audit

- Workflow (PRODUCT_SPEC §6, :107–129): PASS. The order is consent, recording, transcript, speaker confirmation, extraction, evidence (R1), [R2 possibilities, flag-gated, citable bundle], review, note (never from possibilities), confirmation, then finalize. Finalizing confirms no fact (:125, FR-23.2).
- Terminology: PASS. Grep `(?i)differential|final diagnosis|likely diagnos|…` over docs (handoffs excluded) finds only prohibitions and negations (CLINICAL-SAFETY:69, DECISIONS:284, GOOGLE-PLAY:62, API_CATALOG:454). CLINICIAN_CONFIRMED is set only by a clinician action (DATA_MODEL:72, :113, §6 rule 9 :547).
- NOT_DISCUSSED / NEGATIVE / UNKNOWN: PASS in the definitions (DATA_MODEL:86–91, :297; FR-9.3; §10.3). FR-12.2 was permissive ("NKA when explicitly stated") and is now tightened (edit E2). **Finding P4-01 (HIGH):** a model-chosen `notDiscussed` marker is never checked against the facts.
- Medications: PASS after edits E1/E3. DATA_MODEL:283–290 (§4.7) has rawName, normalizedName, rxcui, dose, route, frequency, duration and takingStatus, kept separate from informationState. Absence ≠ discontinued (FR-11.3, CS-12, §10.2:815). "I stopped it" gives only a PROVISIONAL DISCONTINUED, and the medication stays current until confirmed (§10.2:816, CS-13, CS-36, §6 rule 9).
- Longitudinal memory: PASS for facts. Earlier visits are never modified (DATA_MODEL:77), and the diff is deterministic (ARCHITECTURE:246). **Finding P4-03 (MEDIUM):** job 14 wording is unchecked model prose. FR-25.5 is added (edit E4).
- Rules 17–19 versus the workflow: safety-net advice is documentable. AI.md:121 allows DOCTOR PLAN/FOLLOW_UP with the condition span kept, and a patient "I stopped …" passes rule 17c (CS-36). Findings:
  - **P4-02 (MEDIUM):** rule 19 rejects real patient findings, and the rejected items disappear silently.
  - **P4-05 (LOW):** conditional follow-ups become PENDING items on Home.
  - **P4-08 (LOW):** question-and-answer history becomes AI_EXTRACTED.

### 3. New findings

**P4-01 (HIGH): "not discussed" can be asserted by the model about a topic that was discussed.**
- Files and lines: AI.md:108 (rule 13 accepts any statement that "references … a NOT_DISCUSSED marker"); DECISIONS:641; DATA_MODEL:369; BUILD_PLAN:515. No rule checks the marker against the visit's facts. Rule 7 (AI.md:102) checks only the reverse direction (no "normal" text for NOT_DISCUSSED).
- Failure case: job 15 selects `notDiscussed` for allergies while a POSITIVE penicillin-allergy fact is eligible. Code then renders "Allergies: not discussed" into the AI draft. The same happens when a discussed finding was discarded by rules 17 or 19 (P4-02). This inverts the project's core semantic (NOT_DISCUSSED means "not raised").
- Proposed fix:
  - Code, not the model, decides NOT_DISCUSSED. A marker is valid only for a code-listed topic with no fact of that category or topic in the visit (any state, including flagged facts), and with no extraction item for it discarded by validation in that visit. Any other marker is rejected.
  - Add a CS row: allergy POSITIVE plus a mock `notDiscussed: allergies` → rejected.
  - The same check applies to job 12 `missingInformation` (R2).
- Owners: ai-clinical-engineer (rule), clinical-safety-engineer (CS row), chief-architect (ADR).

**P4-02 (MEDIUM): the rule-19 context check rejects true patient findings, and validation discards are invisible to the clinician.**
- Files and lines: AI.md:121–122; DECISIONS:682–683; AI.md:116 and DATA_MODEL:749 ("discarded … stage PARTIAL").
- Failure cases:
  - PATIENT "If I climb stairs I get chest pain" contains a hypothetical cue, so this exertional symptom is rejected. FR-10.1 requires triggers to be captured.
  - A parent speaking for the patient (role OTHER): "My son has had a fever for two days" contains an experiencer cue, so the fever can only be HISTORY_FAMILY or is rejected.
- Because notes render only from facts (ADR-043), the finding is missing from the draft, and with P4-01 it can be rendered as "not discussed".
- Proposed fix:
  - (a) Items rejected only by rule 19 in PATIENT/OTHER segments are kept as PROVISIONAL, informationState UNKNOWN, `needsClarification` (new reason CONTEXT_REVIEW, "Needs clarification — check context"). They are ineligible for automatic input until the clinician confirms them, and never POSITIVE without a clinician action.
  - (b) Discarded items are listed on Screen 10 as "Not structured automatically — review transcript (n)", with segment links.
  - (c) The owner decides whether caregiver or proxy-history consultations (paediatrics, interpreters) are in V1 scope. PRODUCT_SPEC §2 does not exclude them. This needs an owner/product decision; I have not decided it.
- Owners: clinical-safety-engineer (must approve; restrictive rule), ai-clinical-engineer, data-engineer (reason enum), ux; chief-architect (ADR).

**P4-03 (MEDIUM): job 14 comparison wording is the remaining free model prose shown to the clinician.**
- Files and lines: AI.md:60 (validation "no facts beyond the diff", no defined rule); ARCHITECTURE:247. CLINICAL-SAFETY:211 (CS-24) tests only the display.
- Conflict: this does not meet ADR-043's reason (DECISIONS:648, "no model output may reach the clinician … as unchecked prose"). "BP improved", "diabetes controlled" or "cough resolved" would pass.
- Proposed fix: either V1 renders the diff with code templates only (job 14 deferred), or job 14 becomes selection-only, like job 15. FR-25.5 (edit E4) states the product requirement. Add a CS-24 part: mock job-14 text with "resolved" or a number not in the diff → rejected.
- Owners: ai-clinical-engineer, clinical-safety-engineer, chief-architect.

**P4-04 (LOW–MEDIUM): re-extraction matching is undefined for UNMAPPED keys.**
- Files and lines: DATA_MODEL:127; DECISIONS:636 (match by category + conceptKey).
- Problem: two different UNMAPPED facts in the same category would "match", so the wrong fact could be superseded.
- Proposed fix: UNMAPPED facts match only on an identical normalized value (as §9 does at DATA_MODEL:768). Otherwise they stay flagged.
- Owner: data-engineer.

**P4-05 (LOW): conditional safety-net follow-ups become PENDING follow-ups.**
- Files and lines: AI.md:121 allows a DOCTOR FOLLOW_UP "come back if chest pain". FR-16.1 extracts follow-ups as PENDING, and FR-16.3 lists them on Home until the clinician completes them.
- Problem: open-ended return advice would show as a pending task.
- Proposed FR-16.4 (not applied; it needs a data field): "Conditional return advice is kept with its condition and shown in the note's plan; it is listed under pending follow-ups only if it has a date or the clinician makes it a task."
- Owners: data-engineer (FollowUp `conditional` flag), product.

**P4-06 (LOW): ADR-038 decision 2 still has superseded text.**
- Files and lines: DECISIONS:482 says flagged facts are "superseded with reason SOURCE_CHANGED". Under ADR-043 decision 4 (:634–637) and DATA_MODEL:127, they are flagged, not superseded, until a match exists.
- Problem: ADR-038 has no inline "amended by ADR-043 decision 4" note, whereas ADR-043 has one for ADR-044 (:653).
- Owner: chief-architect.

**P4-07 (proposal): UI-UX §2 label row for FR-17.8 (revised after the evidence reply).**
- Row: `| fact not searched (UNMAPPED) | 'Not searched automatically: "<value as stated>" (not in ClinNote's concept list). This does not mean the finding is absent or unimportant. You can run a manual search.' + action "Run a manual search" |`
- Screen 12 primary elements should gain this list.
- Owner: ux-accessibility-engineer (via lead).

**P4-08 (LOW, observation): question-and-answer history becomes AI_EXTRACTED.**
- Under rule 19 (AI.md:123), most history taken by question and answer ("Do you smoke?" / "No.") becomes AI_EXTRACTED "AI inference — verify". It is then excluded from automatic evidence until confirmed (DATA_MODEL:351).
- This is safe, but the label may cause fatigue. Measure it in the Phase 10 evaluation; do not relax the rule.
- Owner: ai-clinical-engineer.

### 4. Team validation answer

The most important remaining safety ambiguity is P4-01 combined with P4-02. The value that says "not discussed" in an AI note draft is still chosen by the model and never checked against the visit's facts. Rules 17 and 19 also silently discard true findings: patient-side conditional symptoms, and caregiver-reported symptoms. As a result, a discussed (even POSITIVE) finding can be rendered by code as "<topic>: not discussed". That inverts the NOT_DISCUSSED semantic which CLAUDE.md §6 makes non-negotiable. Fix: code-decided NOT_DISCUSSED, visible discards, and keep-and-flag instead of reject for patient/other-side context failures.

## DOCUMENTS REVIEWED

- CLAUDE.md
- docs/agent-handoffs/2026-10-08-stage-a-team2-product-recheck.md
- PRODUCT_SPEC (full)
- DECISIONS ADR-033 to ADR-044 (:379–691)
- DATA_MODEL §3 to §3.10 (:60–177), §4.15 (:333–353), §10 (:797–840)
- AI.md §5.1 (:95–125) and the job table (by grep)
- UI-UX §2 and Screens 1–12 (:10–209)
- ARCHITECTURE §6.6 (:239–249)
- targeted greps of CLINICAL-SAFETY, TESTING, BUILD_PLAN, SPEECH, EVIDENCE-SOURCES

## FILES CHANGED

`docs/PRODUCT_SPEC.md` (product-owned):

- E1, FR-11.1 (:214): uses the DATA_MODEL field names (`rawName`, `takingStatus`) and adds information state and review status, with the "maybe metformin?" example.
- E2, FR-12.2 (:223): "No known allergies" only when confirmed and while no allergy is POSITIVE; otherwise "No allergies reported — needs review". Aligns with FR-9.3 and §10.3.
- E3, new FR-11.5 (:218): a "stopped" statement gives only a PROVISIONAL DISCONTINUED; the medication stays current until confirmed; an unnamed medication changes nothing.
- E4, new FR-25.5 (:322): the comparison is deterministic; AI wording adds no fact, number, trend or judgement; earlier visits are never modified.
- E5, new FR-17.8 (:257): the UNMAPPED "Not searched automatically" notice. Revised after the evidence reply:
  - limited to the §17 routed categories
  - quoted value, "not in ClinNote's concept list"
  - pre-fill is an editable draft only, submitted by the clinician through the sanitizer, stored as CLINICIAN_MANUAL

`docs/agent-handoffs/2026-10-08-stage-a-resume-product.md` (this file, new).

## TESTS / CHECKS

Documentation review: grep and read cross-checks only. See Evidence.

## Tests

none — documentation review task (0 tests run).

## Evidence

- Grep `re-derives affected|FR-22\.3|source changed|SOURCE_CHANGED` over docs (excluding handoffs): the old ADR-035 wording now survives only inside the ADR-035 text (DECISIONS:419, marked superseded). PRODUCT_SPEC:300–303 and SPEECH:97 carry the ADR-043 rule.
- Glob `docs/agent-handoffs/*`: no team2 synthesis file (P2-15).
- Grep `bundle non-empty|citable|Re-run evidence search`: AI.md:43, :58; ARCHITECTURE:207, :215; DATA_MODEL:469, :473, :475 (P3-07).
- Grep `experiencer|hypothetical|UNMAPPED`: AI.md:121–123; DECISIONS:682–683; DATA_MODEL:351, :557–558, :768 (P4-02, P4-04).
- Grep `discarded|notDiscussed`: AI.md:116; DATA_MODEL:369, :749; DECISIONS:641; BUILD_PLAN:515. No validator for the marker (P4-01).
- Grep `comparison|job 14` in CLINICAL-SAFETY: only CS-12 and CS-24 (display) (P4-03).
- Grep for diagnosis terminology slips: prohibitions only (see the audit).
- Grep `^- FR-(11\.[15]|12\.2|17\.8|25\.5)` on PRODUCT_SPEC confirms the edits at :214, :218, :223, :257, :322.

## Messages

| Direction | Peer | Content | Reply |
|---|---|---|---|
| sent | evidence (evidence-research-engineer) | `[STAGE-A-RESUME-MSG]` Asked whether an UNMAPPED fact should show a notice on Screen 12. Proposed wording: "Not searched automatically: <fact value as stated> (no mapped concept). This does not mean the finding is absent or unimportant. Run a manual search." Asked: (1) Screen 12 + FR? (2) "no mapped concept" vs "no standard term found"? (3) May the manual search be pre-filled with the value, given that queries carry clinical concepts only? | no reply received before the first version of this handoff; the reply is the next row |
| received (after the first version of this handoff) | evidence | `[STAGE-A-RESUME-MSG]` Agrees: Screen 12, as FR-17.8. Conditions: (1) the notice covers only facts that would otherwise produce an automatic query, i.e. categories with an automatic route in EVIDENCE-SOURCES §17 (MEDICATION, SYMPTOM, HISTORY_MEDICAL, ASSESSMENT); no per-fact notice for facts excluded by design. (2) Avoid "no standard term found", because no external terminology was checked. Proposed: 'Not searched automatically: "<value as stated>" (not in ClinNote's concept list). This does not mean the finding is absent or unimportant. You can run a manual search.' (3) Pre-fill is acceptable only as an editable draft, never auto-submitted, through the manual sanitizer path; the query is stored as CLINICIAN_MANUAL; nothing is sent, logged or cached before submit. Proposed sanitizer tests: a pre-fill containing a date (rejected with a reason) and "Lyme disease" (accepted). Evidence will add the §17 cross-reference. | applied to FR-17.8 (E5 revised) |

## RISKS

- P4-01 and P4-02 unresolved: an AI note draft can state "not discussed" for a discussed or POSITIVE finding.
- P4-03 unresolved: a comparison can show "resolved" or "improved" that no one stated.
- FR-17.8 is agreed with evidence. Two follow-ups are still needed:
  - the sanitizer test for a pre-filled value (a date → rejected with a reason; "Lyme disease" → accepted), owned by evidence/qa
  - the UI-UX label row (ux)

## REMAINING ISSUES

- P2-15 (lead, Task D)
- P4-01 to P4-06 and P4-08 (owners above)
- P4-07 label row (ux, via lead)
- the P3-03 LOW residual (ux)
- the caregiver/proxy-consultation scope question in P4-02(c) (owner/product decision; not decided here)

## RECEIVING AGENT

chief-architect — REVIEW REQUIRED: yes. clinical-safety-engineer reviews P4-01, P4-02 and P4-03.

## NEXT ACTION

chief-architect routes P4-01 and P4-02 to clinical-safety-engineer and ai-clinical-engineer (code-decided NOT_DISCUSSED; keep-and-flag for context failures), and writes the team2 synthesis (P2-15) in Task D.
