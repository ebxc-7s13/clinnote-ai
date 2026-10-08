# Task Handoff

## Owner

evidence-research-engineer (teammate `evidence`, Stage A resume)

## TASK

[STAGE-A-RESUME] Re-check the open evidence findings E2-03, E2-09, E2-13 and E3-01 … E3-06 against the current text (after ADR-043 and ADR-044). Verify that the evidence → possibility pipeline order and the fact-participation (evidence filtering) rules are described the same way everywhere. Answer the team validation question. This is Phase 0 (Stage A), documentation review only.

## AGENT

evidence-research-engineer

## STATUS

COMPLETED. The review is done and the evidence-owned wording edits are made. The new findings below need owner action.

## FINDINGS

### 1. Re-check of the open items

| Item | Verdict | Evidence (file:line, current working tree) |
|---|---|---|
| E2-03 "patient identifiers" wording | RESOLVED | BUILD_PLAN.md:389, :406, :408, :444; API_CATALOG.md:231, :252, :279; PRIVACY.md:62; IC-018 (INTEGRATION-CONTRACTS.md:45) |
| E2-09 location over-blocking | RESOLVED | ARCHITECTURE.md:190-196 (address-like patterns and the patient's own stored values only; "Lyme disease" and "West Nile virus" allowed); BUILD_PLAN.md:389 (sanitizer tests); DECISIONS.md:647 (ADR-043 d8). Residual (cosmetic): IC-018 does not mention the exemption |
| E2-13 gate wording ("citable bundle", COMPLETED/PARTIAL) | RESOLVED in the four places named | EVIDENCE-SOURCES.md:207; AI.md:43, :58; ARCHITECTURE.md:206-207; canonical rule in DATA_MODEL.md:469. Residuals in **other** files: E4-05 |
| E3-01 conceptKey from the model | RESOLVED | AI.md:111 (rule 16); DATA_MODEL.md:249, :737; DECISIONS.md:668-672 (ADR-044 d2); CS-38 part A at CLINICAL-SAFETY.md:225. **One stale contradiction remains: DATA_MODEL.md:557 (E4-02).** A related open channel: E4-01 |
| E3-02 family history → CANCER_INFO | RESOLVED for correctly categorized facts | DATA_MODEL.md:337, :351; AI.md:57; EVIDENCE-SOURCES.md:217-221; CS-38 B. **It depends on a category the model chooses and nothing checks (E4-01)** |
| E3-03 disagreement rule (b) | RESOLVED | EVIDENCE-SOURCES.md:177; DECISIONS.md:527, :645; TESTING.md:147 (negative fixture); BUILD_PLAN.md:446 |
| E3-04 ADR-036 edited in place | RESOLVED | DECISIONS.md:448 (amendment note), :450; ADR-043 carries "Amended by ADR-044" (:653). Cosmetic: ADR-043 d1 text at :623 has no inline marker (ADR-039 d5(b) style) |
| E3-05 trial ban held in configuration | RESOLVED | API_CATALOG.md:606 (code constant, restrict-only, load-time test); IC-015 (INTEGRATION-CONTRACTS.md:42); BUILD_PLAN.md:422, :447 |
| E3-06 wording | RESOLVED | DATA_MODEL.md:335 (both `sourceFactIds` and `sourceFactVersionIds`), :475-477; ARCHITECTURE.md:221, :271 |

Totals: 9 of 9 RESOLVED (with residuals noted as new findings).

### 2. Pipeline ordering (task 2)

The core order is consistent in ARCHITECTURE §6.4 (:184-213), AI.md §3 (:43), DATA_MODEL §5.2 (:448-466) and BUILD_PLAN Phases 11–13: facts → concepts → job 11 → sanitizer → retrieval → validation → dedup → tier/group → rank/cap → storage → [R2: job 12 → supporting/contradicting/missing → citations ⊆ citable bundle → job 13] → review. These places diverge:
- EVIDENCE-SOURCES §17 left out the sanitizer step and job 13 and said "⊆ bundle". **Fixed by me** (see FILES CHANGED).
- TESTING.md:203 says "candidate evidenceIds ⊆ stored bundle". AI.md:58 and DATA_MODEL §4.14 say ⊆ **citable** bundle (CLINICAL_TRIAL and PUBLIC_HEALTH records and records that left the bundle excluded) (E4-05).
- BUILD_PLAN.md:460 (Phase 13 task 1) says "an empty bundle" instead of "no citable record". BUILD_PLAN.md:461 says "after an evidence retry" instead of "after a successful Re-run evidence search" (DATA_MODEL.md:475) (E4-05).
- PRODUCT_SPEC.md:120 says "skipped if no evidence" instead of "no citable evidence", and its §6 workflow has no synthesis step (E4-05).
- ARCHITECTURE.md:173 (§6.3) lists the semantic validators without value grounding (rule 17) or code-computed conceptKey (rule 16) (E4-05).

### 3. Evidence filtering (task 3)

The DATA_MODEL §4.15 table (:339-353), AI.md job 11 (:57), job 12 (:58), EVIDENCE-SOURCES §17 (:217), ARCHITECTURE §6.4 (:185-186) and BUILD_PLAN.md:422 agree on these exclusions: ACTIVE POSITIVE/UNKNOWN only; NEGATIVE and NOT_DISCUSSED never; REJECTED, SUPERSEDED, RESOLVED_AWAY, SOURCE_CHANGED and OPEN-conflict facts excluded; UNMAPPED, family and social history, and unconfirmed AI_EXTRACTED facts excluded. Three gaps remain:
- **E4-03:** the rule for evidence **already retrieved** does not follow the participation table (see below).
- **E4-04:** CS-33 part A (CLINICAL-SAFETY.md:220) lists NEGATIVE, NOT_DISCUSSED, REJECTED, superseded and OPEN-conflict facts. It does not list SOURCE_CHANGED or RESOLVED_AWAY. CS-38 B (:225) has no UNMAPPED case and no SOURCE_CHANGED case. So three table rows have no test.
- **E4-06:** EVIDENCE-SOURCES §17 maps "symptoms and conditions" to routes, but it does not map FactCategory values. VITAL_SIGN, INVESTIGATION, EXAMINATION_FINDING, ALLERGY, PLAN, FOLLOW_UP, HISTORY_SURGICAL and OTHER have no defined route.

### 4. New findings

**E4-01 — HIGH (confirmed by clinical-safety-engineer as S4-01) — The family-history and CANCER_INFO restrictions depend on `category` (and on who the finding is about), which the model sets and no validator checks.**
- Files: AI.md:48 (job 2 outputs `category`), :94-117 (no rule validates category against experiencer cues or question form); DATA_MODEL.md:337, :343; CLINICAL-SAFETY.md:225 (CS-38 B uses only a correctly categorized HISTORY_FAMILY fact).
- Synthetic case: a PATIENT segment says "My mother had breast cancer." Job 2 returns `{category: HISTORY_MEDICAL, value: "breast cancer", VERBATIM_EXTRACTION, POSITIVE}`. Every check passes:
  - rule 17a passes, because the value is a contiguous span of the segment
  - rule 16 gives the key "breast cancer"
  - rule 3 passes, because the segment has no negation cue
  - provenance is PATIENT_REPORTED, so the fact is eligible
- The result is automatic CANCER_INFO, shown as "Retrieved for: breast cancer (POSITIVE)" with the R2 flags OFF.
- The same happens with a DOCTOR question ("Any history of TB?"). It becomes a CLINICIAN_STATED POSITIVE fact, because rules 3 and 9 cover only negation and hedging, not questions.
- Proposed fix:
  - (a) A code rule list of experiencer cues (mother, father, sibling, family, "runs in", …). If a cited segment contains one, the item must be HISTORY_FAMILY or it is rejected.
  - (b) An interrogative segment alone cannot ground a POSITIVE item.
  - (c) Add CS-38 B variants for the miscategorized fact and for the question.
- Owners: chief-architect (ADR refining ADR-044), ai-clinical-engineer (validator), clinical-safety-engineer (CS-38).

**E4-02 — MEDIUM — DATA_MODEL §6 rule 19 (DATA_MODEL.md:557) still states the superseded ADR-043 d1 rule** ("or appear (or a table synonym of it) in a cited segment's text").
- This contradicts DATA_MODEL.md:249, AI.md:111 and ADR-044 d2, and it brings the S2-14 "lung cancer" path back.
- Fix: replace it with the rule-16 wording ("computed from the fact's own value; model key kept only if equal; segment text never validates a key; no entry → UNMAPPED (ADR-044)").
- Owner: data-engineer or chief-architect.

**E4-03 — MEDIUM — Retrieved evidence is not marked when its source fact is flagged SOURCE_CHANGED or enters an OPEN conflict.**
- Files: ADR-039 d6 (DECISIONS.md:532), DATA_MODEL.md:361 (`factsChangedSinceRetrieval`, `citable`), EVIDENCE-SOURCES.md:194 and PRODUCT_SPEC FR-17.6 cover only "edited, rejected, superseded or resolved away".
- By contrast, candidate `outdated` (DATA_MODEL.md:329, FR-18.8) includes "newly in conflict".
- Effect: a label retrieved for "I take warfarin" stays unmarked and citable after "I stopped warfarin" opens a conflict, even though the §4.15 table would no longer query that fact.
- Fix: also set `factsChangedSinceRetrieval` when a source fact is flagged SOURCE_CHANGED or becomes part of an OPEN conflict. Leave the citability rule unchanged.
- Owners: chief-architect (ADR-039 d6 amendment), data-engineer (§4.16), evidence-research-engineer (§16, after the ADR).

**E4-04 — LOW — Three rows of the participation table have no safety test (see section 3).** Proposed fix: add SOURCE_CHANGED and RESOLVED_AWAY to CS-33 A, and UNMAPPED and SOURCE_CHANGED cases to CS-38 B. Owner: clinical-safety-engineer.

**E4-05 — LOW — Pipeline wording divergences (see section 2).** Owners:
- qa-test-engineer: TESTING.md:203
- chief-architect: BUILD_PLAN.md:460-461 and ARCHITECTURE.md:173
- product-clinical-architect: PRODUCT_SPEC.md:120

**E4-06 — LOW — FIXED by evidence-research-engineer (EVIDENCE-SOURCES §17 FactCategory table) — The route table was not keyed by FactCategory**, so implementers must guess. For example, a PLAN "start metformin" might run a literature query, and a VITAL_SIGN might be searched.
- Proposed fix: an explicit FactCategory → route table in EVIDENCE-SOURCES §17. Any category not listed gets no automatic route.
- Owner: evidence-research-engineer. Mandatory safety review; I did not edit this because it is a behavior decision.

**E4-07 — LOW — DATA_MODEL.md:249 lists "RxCUI" as a conceptKey form from the code normalization table.**
- An RxCUI exists only after a RxNorm call (Phase 11), and only for an exact or clinician-selected match (CS-11). A table cannot produce it at promotion time (Phase 10).
- Fix: the key is the normalized drug name. The RxCUI lives on Medication (§4.7).
- Owner: data-engineer.

### 5. Team validation answer

**E4-01** is the most important remaining contradiction or safety ambiguity. ADR-043 and ADR-044 made the conceptKey and the value grounded, but the eligibility gate that stops family history from becoming patient-directed cancer information still depends on `category`, which the model sets and nothing checks. A verbatim, correctly negation-free span such as "breast cancer" from "My mother had breast cancer" passes every rule (3, 16, 17) and produces automatic CANCER_INFO on the R1 screen with the R2 flags OFF. That is the same harm class as E2-01, E3-01 and E3-02, and CS-38 still passes.

## DOCUMENTS REVIEWED

CLAUDE.md; docs/DECISIONS.md (ADR-036, ADR-039–ADR-044, Future Decisions); DATA_MODEL.md §3 (layered table), §3.3, §3.3a, §4.5, §4.14–§4.16, §5.2, §6, §8.2–§8.3, §9; AI.md §3, §5.1; ARCHITECTURE.md §6.3, §6.4, §8; EVIDENCE-SOURCES.md (all); API_CATALOG.md §12–§26, §29, §31; PRODUCT_SPEC.md §6, FR-17, FR-18; CLINICAL-SAFETY.md §12, §18 (CS-33, CS-36, CS-38), §18a; BUILD_PLAN.md Phases 11–14; TESTING.md §13, §13a; INTEGRATION-CONTRACTS.md (IC-015, IC-018); PRIVACY.md:51, :62; my previous handoff `2026-10-08-stage-a-team2-evidence-recheck.md`.

## FILES CHANGED

Evidence-owned wording only. No other spec file was edited.
- `docs/EVIDENCE-SOURCES.md`
  - §17 pipeline: added the participation reference, code-computed conceptKeys, a separate on-device sanitizer step, "⊆ **citable** bundle" and the job 13 synthesis step. This aligns it with ARCHITECTURE §6.4 and AI.md §3.
  - §10 Tests: "synthesis output" became "output of jobs 12, 13 or 16 … (CS-16)", closing the E2-07 residual.
  - §4.7 MedlinePlus: now marked as R1 PATIENT_EDUCATION cards, with job 16 noted as R2 behind `patientExplanationEnabled` (ADR-041).
- `docs/API_CATALOG.md`
  - The "Privacy considerations" rows for §15 Drugs@FDA, §16 NDC, §18 DailyMed and §19 RxNorm read "None". They now say: no patient identifiers; sanitized drug names and typed public identifiers only (ADR-036, IC-018); provider logging and retention terms VBI.
  - The rows for §20 MedlinePlus, §22 Clinical Tables, §23 PubChem, §24 WHO and §25 NCI read "None" or "Terms only". They now say: sanitized clinical terms only, sent from the backend; health-related, so logging and retention terms are reviewed (VBI).
  - Reason: "None" understated that health-related terms leave the backend (PRIVACY.md:51, :62).
- `docs/EVIDENCE-SOURCES.md` §17 (E4-06, at the lead's request): the staged route selection is now a FactCategory → automatic-route table.
  - MEDICATION, SYMPTOM, HISTORY_MEDICAL and ASSESSMENT have routes. CANCER_INFO comes only from HISTORY_MEDICAL or ASSESSMENT.
  - HISTORY_SURGICAL, HISTORY_FAMILY, HISTORY_SOCIAL, ALLERGY, VITAL_SIGN, EXAMINATION_FINDING, INVESTIGATION, PLAN, FOLLOW_UP and OTHER have no automatic route.
  - Any category not listed gets no route. A new route needs an ADR and a clinical-safety review.
  - Needs clinical-safety-engineer review.
- `docs/agent-handoffs/2026-10-08-stage-a-resume-evidence.md` (new, this file).

## Interfaces Changed

None. Proposed: IC-018 should mention the location exemption (cosmetic). The job-2 output contract should get the category/experiencer validator (E4-01).

## TESTS / CHECKS

Documentation review. The checks were `grep` and `sed`/`diff` inspections of the working tree, plus `diff` of my two edited files against pre-edit copies (only the intended lines changed).

## Tests

Documentation review: 0 tests.

## Evidence

Commands run (working tree on `main`, head `63e1a19`, 2026-10-08 UTC):
- `grep -n "ADR-04[34]" docs/DECISIONS.md`: ADR-043 at :607, ADR-044 at :655, amendment note at :653
- `grep -rn -i "synonym of it\|appear.*in a cited segment" docs/*.md`: the only stale hit was DATA_MODEL.md:557 (E4-02)
- `grep -n "conceptKey" docs/DATA_MODEL.md`: :249 (code-computed key), :337/:343/:351 (participation table), :557 (stale rule 19)
- `sed -n 94,117p docs/AI.md`: rules 1–18; none validated `category` or experiencer cues (E4-01, before the lead added rule 19)
- `grep -n "skipped if no evidence" PRODUCT_SPEC.md`: :120. `grep -n "empty bundle\|after an evidence retry" BUILD_PLAN.md`: :460, :461. `grep -n "⊆ stored bundle" TESTING.md`: :203 (E4-05)
- `grep -n "outdated\|factsChangedSinceRetrieval" DATA_MODEL.md`: :329 vs :361 (E4-03)
- `grep -n "^## \|Privacy considerations" docs/API_CATALOG.md`: rows :300, :321, :363, :384, :411, :453, :474, :495, :516 were "None" or "Terms only" before the edit
- `diff` of pre-edit copies against the edited EVIDENCE-SOURCES.md and API_CATALOG.md: only the intended lines changed
- FactCategory coverage of the new §17 table: all 14 values in DATA_MODEL.md:153 appear exactly once

## Messages

| Direction | Counterpart | Content | Time (UTC) |
|---|---|---|---|
| sent | safety (clinical-safety-engineer) | `[STAGE-A-RESUME-MSG]`: does ADR-044 (rules 16+17) still let a family-history or interrogative mention reach automatic evidence through a model-chosen category? Gave the "My mother had breast cancer" → HISTORY_MEDICAL case and the DOCTOR-question case. Asked (1) whether this is a live leak, (2) whether the experiencer-cue and interrogative rule plus a CS-38 B variant is acceptable, and (3) whether UNMAPPED fail-closed needs a "Not searched automatically" line on Screen 12 | 2026-10-08 |
| received | safety | Reply: the leak is live and is safety finding S4-01 (HIGH); Gate 6 stays FAIL until it is fixed. (1) Agreed. (2a) Fix accepted with a refinement: cues apply to the clause that contains the finding, not the whole segment ("My mother had breast cancer and I have had a cough for 3 weeks" must keep the cough). An interrogative never grounds a POSITIVE fact on its own; question + answer is at most AI_INFERENCE. The lead is drafting the context rule (negation, hedge, hypothetical, experiencer, interrogative) as an ADR-044 amendment with ai-clinical-engineer. (2b) Done by safety: CS-38 B gets the mis-categorized variant; CS-46 gets both interrogative cases plus a clause-scope control. UNMAPPED notice ("Not searched automatically: <value> (no mapped concept) — run a manual search") supported; not a Gate 6 blocker; wording owned by product-clinical-architect | 2026-10-08 |
| received | product (product-clinical-architect) | `[STAGE-A-RESUME-MSG]`: should an UNMAPPED fact show "Not searched automatically: <value> (no mapped concept)…" on Screen 12 with an FR? Asked about wording and about pre-filling manual search with the value | 2026-10-08 |
| sent | product | Reply: yes, on Screen 12 as a new FR next to FR-17.6. Scope is limited to facts that are otherwise query-eligible and in a category with an automatic route (EVIDENCE-SOURCES §17), to avoid alert fatigue; excluded-by-design facts get no per-fact notice. Wording: "(not in ClinNote's concept list)" rather than "no standard term found" or "no mapped concept", because no external terminology was checked. Prefill only as an editable draft: never auto-submitted, sent through the normal sanitizer as CLINICIAN_MANUAL, nothing sent or logged before the clinician submits. Add sanitizer tests (a date → rejected with a reason; "Lyme disease" → accepted) | 2026-10-08 |

## RISKS

- E4-01: family history or doctor questions can produce patient-directed cancer or condition evidence with the R2 flags OFF, and CS-38 still passes.
- E4-02: an implementer following DATA_MODEL §6 rule 19 would bring back the S2-14 leak.
- E4-03: evidence about a contested medication or condition stays unmarked and citable by job 12.

## REMAINING ISSUES

E4-01 (HIGH), E4-02 and E4-03 (MEDIUM), E4-04 to E4-07 (LOW), and the cosmetic IC-018 and ADR-043 d1 inline-marker items. API_CATALOG §31 is still empty: no provider is verified, which is expected in Phase 0.

## RECEIVING AGENT

chief-architect. REVIEW REQUIRED: yes. clinical-safety-engineer must review E4-01, E4-03, E4-04 and E4-06 (mandatory safety review of evidence changes). data-engineer must review E4-02 and E4-07.

## NEXT ACTION

chief-architect decides E4-01 with an ADR refining ADR-044 (category and experiencer grounding, and a rule against grounding a POSITIVE item on a question alone), and has data-engineer fix DATA_MODEL.md:557 (E4-02), before Stage A closes.
