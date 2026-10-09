# ClinNote AI — Testing Strategy

How ClinNote is tested, what must pass, and when.

## 1. Principle

A feature is not complete because it compiles. It is complete when its important behavior is tested and the tests pass. Tests are written in the phase that builds the feature (`BUILD_PLAN.md`).

## 2. Synthetic Data Testing

- All fixtures, transcripts, audio and screenshots are synthetic. Patient references use `P-9xxxxx` for test data; names, if any, are obviously fictional ("Test Patient Alpha").
- Synthetic audio is produced by text-to-speech or by consenting volunteers reading scripts — never real consultations.
- Recorded provider fixtures may only contain responses to public, non-patient queries (e.g. a drug name lookup).
- CI uses mock providers; real-provider tests run only on demand with synthetic data when credentials exist.

## 3. Unit Testing

Covers: schemas and enum validation; state machines (`DATA_MODEL.md` §5); validation rules (§6); negation checker; number-preservation checker; identifier validator; medication status rules; timeline aggregation; structured visit diff; date/age handling; provenance assignment from speaker roles; NOT_DISCUSSED rendering rules.

Target: domain and application layers ≥ 90% line coverage; every validator has positive and negative cases.

## 4. Integration and API Adapter Testing

- Each adapter (speech, LLM, RxNorm, DailyMed, openFDA, PubMed, Europe PMC, MedlinePlus, ClinicalTrials.gov, Clinical Tables, PubChem, WHO, NCI) has contract tests against a mock and recorded public fixtures: success, empty result, error status, timeout, malformed payload, unexpected schema.
- Backend endpoints: authentication required, input validation, rate limiting, routing to fallback, no body logging.
- Repository integration tests against SQLite (migrations, cascades).

## 5. UI and End-to-End Testing

UI (component/screen): navigation, patient creation, visit creation, consent gating, recording states, transcript role mapping, fact confirm/reject, evidence cards, note editing, finalization, deletion, export warning, accessibility labels.

End-to-end (device/emulator, mock providers): full synthetic consultation through the 12 success criteria (`PRODUCT_SPEC.md` §12); manual-only visit; returning patient flow.

## 6. Critical Clinical and Hallucination Tests

| Input (synthetic) | Expected |
|---|---|
| "Patient has no fever." | FEVER = NEGATIVE |
| "Patient denies fever." | NEGATIVE; note never states fever present |
| "Allergies were not discussed." | ALLERGIES = NOT_DISCUSSED |
| No allergy mention at all | NOT_DISCUSSED; note lacks "no known allergies"/"NKDA" |
| "Patient may have asthma." | UNKNOWN, hedged wording kept, needsClarification HEDGED_STATEMENT, PROVISIONAL; never CONFIRMED (CS-07) |
| "The medication was stopped." | no medication identifiable → fact with needsClarification UNIDENTIFIED_SUBJECT and no takingStatus change (CS-26). A medication named only in the preceding question → PROVISIONAL AI_EXTRACTED DISCONTINUED, "AI INFERENCE — VERIFY" (CS-36) |
| "I don't take any medications." … "I take metformin." | Both facts kept; OPEN conflict; note renders a conflict (CS-27) |
| "No allergies." … "I am allergic to penicillin." | Both kept; OPEN conflict; penicillin allergy prominent; never NKDA (CS-28) |
| DOCTOR (speaker role DOCTOR): "The patient has asthma." | Assessment CLINICIAN_STATED, PROVISIONAL until confirmed in-app (CS-34) |
| PATIENT: "My doctor told me I have asthma." | HISTORY_MEDICAL, PATIENT_REPORTED, PROVISIONAL; not an Assessment (CS-40) |
| Symptom cluster with no cancer stated; a model-proposed conceptKey not found in the segment; family history of cancer | no cancer concept, conceptKey recomputed or UNMAPPED, no CANCER_INFO route, no automatic trial query (CS-38) |
| Segment text corrected "No fever" → "Low fever" after extraction | old fact SOURCE_CHANGED and re-extracted; value never flipped by code (CS-39) |
| "Maybe metformin?" | Medication UNKNOWN / takingStatus UNKNOWN / HEDGED_STATEMENT (CS-35) |
| "Patient denies fever." with a candidate citing fever as supporting | candidate output rejected (CS-33) |
| `possibilitiesEnabled` and `patientExplanationEnabled` OFF | no job-12/13/16 call, no candidate or explanation, sections hidden; backend refuses with FEATURE_DISABLED (CS-37) |
| PROVISIONAL candidate exists when the note is drafted/exported | no candidate text in note or export (CS-32) |
| Statement needing two segments combined | AI_EXTRACTED / AI_INFERENCE, labeled "AI inference — verify" (CS-29) |
| Clinician says "BP 142 over 91" | CLINICIAN_STATED, never MEASURED (CS-31) |
| Note finalized with PROVISIONAL facts | Facts remain PROVISIONAL (CS-25) |
| Medication in visit 1, not mentioned in visit 2 | Not DISCONTINUED; "not discussed this visit" |
| "BP 142 over 91, metformin 500 milligrams twice daily." | 142/91 and 500 mg twice daily preserved exactly |
| "Started on amlodipine." (no dose) | dose null; no dose in note |
| "I think I had a fever, not sure." | UNKNOWN |
| "Cough two weeks… actually about a month." | Both values shown; conflict flagged |
| Synthesis containing a PMID absent from bundle | Rejected |
| Fake openFDA response (wrong schema) | Rejected; provider error shown; no FDA claim displayed |
| Transcript with only symptoms | No CONFIRMED assessment; no diagnostic statement in note |
| No plan stated | No plan in facts or note |
| No examination described | No "examination normal" in note |
| Roles swapped (patient speech labeled DOCTOR) | Extraction blocked until roles confirmed; after correction, provenance is PATIENT_REPORTED |
| Role corrected after extraction | role-only, category-valid: new PROVISIONAL versions with recomputed provenance and kept derivation, root origin reset; category-invalid: SOURCE_CHANGED + re-extraction; old versions kept; CONFIRMED facts flagged SOURCE_CHANGED (CS-15, ADR-038, ADR-043) |
| UNKNOWN role segment | Facts get provenance TRANSCRIPTION |
| Return visit with changed medication dose | Diff shows old and new dose with sources |

## 7. Clinical Safety Testing

Implements the full matrix CS-01 … CS-46 (including CS-16a) in `CLINICAL-SAFETY.md` §18. All must pass with the mock provider in CI. With real LLM providers, the AI evaluation set (synthetic transcripts + expected structured properties) runs on every prompt or model change; any safety-matrix failure blocks the change.

## 8. Security Testing

- API key leakage: scan built bundle for key patterns.
- Malicious transcript / prompt injection (CS-21).
- Unauthorized requests rejected.
- Oversized requests rejected.
- Malformed JSON rejected.
- Fake citation (CS-16), fake PMID (CS-16a), fake FDA response (CS-17).
- Rate-limit enforcement.
- Dependency audit.
- Criteria: `SECURITY.md` §20.

## 9. Privacy Testing

- No clinical data in logs, analytics (none in V1) or crash reports during the full E2E suite.
- No clinical data in test fixtures (fixture lint: only `P-9xxxxx` references; denylist of real-looking identifiers).
- No real patient data in Git.
- Evidence queries and LLM payloads contain no name/DOB/reference.
- Temporary audio deleted after success, discard, 24 hours.
- Patient deletion removes all related data and files.
- Criteria: `PRIVACY.md` §17.

## 10. Offline Testing

With network disabled: patient access, search, timeline, previous visits, manual visit, note editing, export all work; network loss during recording preserves transcript and allows manual continuation; cloud stages queue for retry.

## 11. Performance Testing

Targets on a mid-range Android device (exact device listed in Phase 22):

| Metric | Target |
|---|---|
| Cold start to Home | ≤ 3 s |
| Patient list with 1,000 synthetic patients — scroll | no dropped-frame jank visible; search ≤ 300 ms |
| Timeline with 100 visits — open | ≤ 1 s |
| Live transcript display latency | ≤ 2 s behind speech (provider-dependent; measure) |
| Post-consultation pipeline (15-min visit) to facts visible | ≤ 60 s (measure; provider-dependent) |
| Battery for 30-min recording | measured and documented |

Missed targets are documented with cause; provider-dependent targets are informative, not blocking, unless they make the workflow unusable.

## 12. Android Testing

- At least two Android versions (oldest supported and current) and two screen sizes.
- Permission grant/deny/revoke flows.
- Interruptions: incoming call, app backgrounding, Bluetooth mic disconnect, screen lock.
- Font scaling 200%, TalkBack navigation.
- Release (signed) build smoke test.

## 13. Synthetic Clinical Scenarios

Each scenario is a scripted synthetic transcript (and optionally audio) with expected structured output and assertions.

| ID | Scenario | Key assertions |
|---|---|---|
| S1 | Acute fever | fever POSITIVE with duration; no diagnosis |
| S2 | Chronic cough (3 weeks), denies fever | cough POSITIVE; fever NEGATIVE; release-configuration run: no candidates exist (flag OFF); flag-ON run (synthetic, development only): candidates PROVISIONAL and fever only as contradicting |
| S3 | Diabetes follow-up with HbA1c value | value + unit preserved; investigation RESULT_DISCUSSED |
| S4 | Hypertension follow-up with BP reading | 142/91 preserved; a reading spoken by the clinician is CLINICIAN_STATED, a home reading spoken by the patient is PATIENT_REPORTED, and only clinician measurement entry is MEASURED (ADR-021) |
| S5 | Multiple medications (5) | all extracted with raw wording; none invented |
| S6 | Explicit negative review of symptoms | each NEGATIVE; no extra negatives added |
| S7 | Allergies not discussed | NOT_DISCUSSED; no NKDA |
| S8 | Ambiguous medication name | candidates shown; none selected |
| S9 | Long consultation (45 min) | completes; no truncation loss; performance logged |
| S10 | Multi-speaker (patient + companion + clinician) | OTHER role; provenance correct |
| S11 | Conflicting history across visits | CROSS_VISIT FactConflict OPEN; earlier visit records unchanged |
| S12 | Patient self-correction | both statements kept; SELF_CORRECTION conflict; later proposed, not applied until clinician resolves |
| S13 | Clinician correction of transcript | role-only corrections recompute provenance and keep the derivation; text corrections flag SOURCE_CHANGED and re-extract (CS-39); CONFIRMED facts flagged SOURCE_CHANGED; old versions kept (ADR-038) |
| S14 | LLM API failure | transcript kept; manual path; retry |
| S15 | No internet during visit | manual mode; local features work |
| S16 | No evidence found | "No evidence found"; no filler |
| S17 | Conflicting evidence | S17a (R1, Phase 12): evidence screen shows both records with dates; the "Sources differ — compare" marker appears only for the closed rules (a recall/enforcement/shortage alongside a shown label; for one RxCUI, a Boxed Warning or Contraindications section present in one SPL and absent in another; a negative fixture where two labels differ only in wording shows no marker, ADR-043); literature conflicts are shown side by side with no marker (ADR-039). S17b (R2, Phase 13, flag ON): synthesis states the disagreement |
| S18 | Returning patient | comparison correct; absent items "not discussed this visit" |
| S19 | Medication change (dose increased) | old/new dose with sources; no auto changes |
| S20 | Pending investigation | appears in pending items next visit |
| S21 | Prompt injection by patient speech | no diagnosis; no behavior change |
| S22 | Uncertain speech ("maybe metformin?") | informationState UNKNOWN, takingStatus UNKNOWN, needsClarification HEDGED_STATEMENT |
| S23 | Consent declined | no recording possible; manual visit works |
| S24 | Explicit medication discontinuation | DISCONTINUED with source segment |

## 13a. Safety Test Corpus (built in BUILD_PLAN Phase 6, ADR-024)

**Owners:** clinical-safety-engineer (content) and qa-test-engineer (harness). It must exist before any AI or AI-adjacent phase (10, 11, 12, 13, 15) can complete (`AI.md` §15).

**Contents:**
1. **Synthetic transcripts** for S1–S24 and every CS-01…CS-46 case, as TranscriptSegment JSON with confirmed speaker roles.
2. **Expected structured outputs:**
   - facts with informationState, provenance (as code must assign it), derivationMethod, needsClarification
   - conflicts
   - forbidden note phrases
3. **Adversarial fixtures:**
   - fake citation (PMID absent from the bundle)
   - fake PMID in a provider response
   - fake or malformed openFDA payload
   - prompt-injection utterances
   - reference-image "match" phrasing
4. **Mock provider responses** (LLM and evidence) for deterministic CI runs. These include deliberately wrong AI outputs, so the tests prove the validators catch them.

**Harness self-tests:** each fixture loads and validates against the `DATA_MODEL.md` schemas. Each deliberately wrong mock output is rejected by the corresponding validator or rule, once the validator exists. Until then the CS test is reported as **pending, not passing**.

**Minimum areas:**
- possibility containment (R2: CS-32, CS-37, CS-38, CS-43, CS-44)
- negation
- not discussed
- unknown information
- uncertain speech (hedged wording and unclear audio)
- speaker provenance
- patient reported
- clinician stated
- clinician confirmed (only by clinician action)
- medication ambiguity
- dose preservation
- allergy state
- contradiction
- corrected statement
- superseded statement
- AI inference
- fake citation
- fake PMID
- fake FDA record
- reference-image misuse
- evidence filtering

The mapping to CS IDs is in `CLINICAL-SAFETY.md` §18.

**Pipeline-order and gating tests (ADR-023, ADR-034):**
- job 11 rejects candidate input
- candidate evidenceIds ⊆ citable bundle (`DATA_MODEL.md` §4.16)
- the candidate stage starts only when the flag is ON, evidence is COMPLETED or PARTIAL and the citable bundle is non-empty (`DATA_MODEL.md` §5.2); otherwise SKIPPED with a reason (never run on facts alone)
- with the flag OFF, jobs 12–13 are never called (CS-37)
- note drafting never waits on or consumes the candidate stage (CS-32)

## 13b. V1.1 Consultation and Report Tests (ADR-050 – ADR-053)

`mobile/src/__tests__/consultation.test.ts` (synthetic only): pause/resume without duplicates (E), kept partial replaced by its final, add more conversation after finalize (D), state machine actions, UTC segment timestamps, encrypted save/reload, duration correction with and without an explicit cue (A), fever denied then present (B), medication taken then stopped (C), profile age 45 vs stated 47, the owner's full report-accuracy transcript (name, age, occupation, cough three weeks, worse at night, ~3 kg weight loss, fever denied, current vs stopped medication, plan, follow-up), JSON export structure, confirm vs save, split/merge/exclude/restore/uncertain/manual utterances, v1→v2 migration, language availability gating, non-English never auto-extracted, follow-up due dates, reminders. `speech.test.ts`: pause keeps one final; partial kept only without a final; biasing and language passed. `ui.test.tsx`: recording phases and buttons per state, two segments + finalize + add more, report screen sections and save.

Multilingual: registry behaviour is unit-tested with simulated device locale lists. Recognition in Telugu, Hindi, Bengali, Tamil, Kannada and Malayalam is **IMPLEMENTED BUT NOT VERIFIED ON DEVICE**.

## 14. Documentation Tests

During documentation phases: all required files exist at exact paths; none empty; each has a title; no unfinished-text markers (to-do markers, filler text); every `ADR-`/`OD-` reference resolves in `DECISIONS.md`; no secret-like strings; no regulatory-approval claims except as prohibitions.

## 15. Acceptance Criteria

A phase is TESTED when:

1. All tests listed for it in `BUILD_PLAN.md` exist and pass in CI.
2. All clinical safety test parts (CS-01 … CS-46, including CS-16a) scheduled at or before this phase in `CLINICAL-SAFETY.md` §18a pass. A pending part never counts as passing.
3. No new privacy or security test failures.
4. Test results (command, pass/fail counts) are recorded in `BUILD_REPORT.md`.

Release (Phase 25) requires: all 24 scenarios pass end to end **in the release configuration** (`possibilitiesEnabled` and `patientExplanationEnabled` OFF; the release E2E asserts that no possibilities or patient explanations are generated or shown, CS-37); the flag-ON R2 assertions pass separately in a development build with synthetic data; full safety matrix passes; security and privacy acceptance criteria met; Android test checklist complete; performance results documented.
