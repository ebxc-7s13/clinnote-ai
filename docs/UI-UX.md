# ClinNote AI — UI/UX Specification

Screen-by-screen specification for the ClinNote Android app.

## 1. Design Objective

A serious, calm clinical productivity tool. Priorities: speed, clarity, readability, accessibility, trust, low cognitive load.

Avoid: excessive gradients, neon, 3D graphics, distracting animation, gamification, robot/"AI magic" imagery, sparkle icons, heavy glassmorphism. AI content is labeled plainly ("AI draft", "Provisional"), not celebrated.

## 2. Global Conventions

- **Navigation:** bottom tabs Home · Patients · Visits · Settings; other screens push onto stacks.
- **Status labels** always combine text + icon; never color alone (e.g. "● RECORDING", "Provisional", "Confirmed", "Not discussed").
- **Information state** shown in words: "Fever — denied", "Allergies — not discussed", "Fever — unclear".
- **Canonical labels** (owned by product-clinical-architect, implemented once as constants; `DATA_MODEL.md` §3.2, §10):

  | Concept | Label |
  |---|---|
  | PATIENT_REPORTED | "Patient-reported" |
  | CLINICIAN_STATED | "Clinician-stated" |
  | MEASURED | "Measured" |
  | TRANSCRIPTION | "Transcript" |
  | AI_EXTRACTED | "AI inference — verify" |
  | EXTERNAL_SOURCE | "Source" |
  | CLINICIAN_CONFIRMED (confirmed) | "Confirmed by clinician · originally <root origin>" |
  | CLINICIAN_CONFIRMED (edited) | "Edited by clinician · originally <root origin>" |
  | CLINICIAN_CONFIRMED (manual entry) | "Entered by clinician" |
  | provisional profile items | "Proposed — needs review" |
  | earlier-visit unconfirmed items | "From earlier visits — not reviewed" |
  | open conflict | "Conflict — review" |
  | needsClarification | "Needs clarification — <reason>" |
  | source changed after correction | "Needs clarification — source changed" |
  | outdated possibility | "Outdated — facts changed since generation" |
  | possibilities not generated | "Possibilities not generated: <reason>" |
  | possibility order | "Order has no meaning" |
  | evidence retrieved for | "Retrieved for: <concept> (<state>)" / "Clinician search" |
  | evidence on changed facts | "Based on facts that changed since retrieval" |
  | evidence disagreement | "Sources differ — compare" |
  | stale regulatory record | "May be outdated — refresh" |
  | RxNorm normalization | "U.S. drug terminology (RxNorm)" |
  | FDA / DailyMed records | "U.S. regulatory information" |
  | AI note draft | "AI draft — review before finalizing" |
  | provisional comparison item | "Provisional — not reviewed" |
  | absent at a later visit | "Not discussed this visit" / "not discussed since <date>" |
  | allergy status lines | the six lines in `DATA_MODEL.md` §10.3 |
  | draft export | "DRAFT — not finalized by clinician" |
  | signed out | "Sign in to use cloud processing" |
  | context unclear (CONTEXT_UNCLEAR) | "Needs clarification — context (conditional or about another person)" |
  | validation-discarded items | "Not extracted — check transcript" |
  | topic with only flagged or discarded items | "<topic>: see transcript — needs review" |
  | fact not searched (UNMAPPED, FR-17.8) | "Not searched automatically: <value as stated> (not in ClinNote's concept list). This does not mean the finding is absent or unimportant. You can run a manual search." + action "Run a manual search" (editable pre-fill, nothing sent before submit) |
  | regenerate with stale evidence | "Re-run evidence search first" |

  These strings are the only source for UI labels. Specification documents may write a label in capitals for emphasis, e.g. "AI INFERENCE — VERIFY"; the UI string is the one in this table.
- **Touch targets** ≥ 48dp; font scaling up to 200% without clipping; contrast WCAG AA.
- **Screen reader:** every interactive element labeled; headings marked; logical focus order.
- **Loading:** skeletons or inline progress with the stage name; never block local data while cloud work runs.
- **Errors:** plain language, what happened, what is preserved, what to do next.
- **Empty states:** explain the screen and offer the primary action.
- **Synthetic data only** in screenshots and store assets.

## 3. Screens

Each of the 21 screens is specified with the same nine attributes. Screen 21 (Visits) was added in Stage A; the Visits tab previously had no specification.

### Screen 1 — Onboarding

- **Purpose:** First-run explanation of what ClinNote does and does not do, privacy model, cloud processing disclosure.
- **Primary elements:** 3–4 short pages: "Documentation assistant, not a doctor"; "Records only after you confirm consent"; "Patient data stays on this device; audio and text are processed by cloud services you can turn off"; "AI output is provisional until you confirm it". Acknowledgement checkbox (stored in AppSettings with the onboarding version, FR-27.2). The cloud-processing choice is offered after acknowledgement (FR-28.1).
- **Actions:** Continue, Acknowledge, Skip to manual mode (cloud AI off).
- **Navigation:** → Home. Re-openable from About.
- **Loading state:** none.
- **Empty state:** n/a.
- **Error state:** n/a.
- **Accessibility:** each page a single heading + text; swipe and button navigation.
- **Mobile behavior:** portrait; one action per page.

### Screen 2 — Home

- **Purpose:** Fast entry to the most common actions.
- **Primary elements:** Start New Visit (primary), Search Patient, Recent Patients, Recent Visits (with stage status), Pending Follow-ups.
- **Actions:** start visit, open patient, open visit, open follow-up.
- **Navigation:** tab root.
- **Loading state:** list skeletons.
- **Empty state:** "No patients yet — create your first patient" with button.
- **Error state:** local DB error banner with retry.
- **Accessibility:** primary action first in focus order.
- **Mobile behavior:** Start New Visit reachable with thumb (bottom area).

### Screen 3 — Patients

- **Purpose:** List and find patients.
- **Primary elements:** search field, list (reference, optional name, age, sex, last visit), New Patient button.
- **Actions:** search, open, create.
- **Navigation:** tab root → Patient Overview; → create form.
- **Loading state:** list skeleton.
- **Empty state:** "No patients" + Create.
- **Error state:** banner with retry.
- **Accessibility:** list items announce reference, age, sex, last visit.
- **Mobile behavior:** sticky search; virtualized list.

### Screen 4 — Patient Overview

- **Purpose:** Single view of a patient.
- **Primary elements:** reference, optional name, age, sex; active problems (clinician-curated problem list only, `DATA_MODEL.md` §10.1); current medications (CONFIRMED records only, with "not discussed since <date>" where applicable, §10.2); a separate collapsible "Proposed — needs review" list for provisional items from all visits, grouped "This visit" / "From earlier visits — not reviewed" and dated (`DATA_MODEL.md` §10.4); allergies (the positive list plus one status line from `DATA_MODEL.md` §10.3; a POSITIVE allergy always prominent, even while a conflict is open; "Conflict — review" on any row in an open conflict); recent visit; pending follow-ups; Timeline link; Start New Visit; Edit; Delete.
- **Actions:** start visit, edit, delete (confirm dialog), open timeline, open visit.
- **Navigation:** → Timeline, → Start Visit, → Returning Patient view if prior visits exist.
- **Loading state:** section skeletons.
- **Empty state:** sections show "Nothing recorded yet".
- **Error state:** per-section error with retry.
- **Accessibility:** sections as headings.
- **Mobile behavior:** collapsible sections; Start New Visit fixed at bottom.

### Screen 5 — Timeline

- **Purpose:** Longitudinal history.
- **Primary elements:** chronological list grouped by visit: symptoms, medication events, investigations, confirmed assessments, follow-ups; filter by category; provisional items visually distinct ("Provisional" label).
- **Actions:** filter, open visit, open item source.
- **Navigation:** from Patient Overview.
- **Loading state:** skeleton.
- **Empty state:** "No visits yet".
- **Error state:** banner.
- **Accessibility:** each event announces date, category, state, provenance.
- **Mobile behavior:** vertical list; filters as chips.

### Screen 6 — Start Visit

- **Purpose:** Begin a visit.
- **Primary elements:** patient selector (or current patient), note type (SOAP / General / Progress), mode: Record conversation / Manual only. "Record conversation" is disabled, with the reason shown, when cloud processing is off or the clinician is signed out (FR-28.2, FR-28.4).
- **Actions:** Continue.
- **Navigation:** → Consent (record) or → Note Editor/manual entry (manual).
- **Loading state:** none.
- **Empty state:** if no patient → create patient inline.
- **Error state:** validation messages.
- **Accessibility:** radio groups labeled.
- **Mobile behavior:** single screen.

### Screen 7 — Consent

- **Purpose:** Clinician attests consent before recording.
- **Primary elements:** short statement of what will be recorded and where it is processed; method (verbal/written); "I confirm appropriate consent was obtained"; Decline option.
- **Actions:** Confirm → record; Decline → manual mode.
- **Navigation:** → Live Recording or → manual.
- **Loading state:** none.
- **Empty state:** n/a.
- **Error state:** cannot proceed without explicit confirm.
- **Accessibility:** confirmation is an explicit control, not pre-checked.
- **Mobile behavior:** buttons at bottom; no accidental double-tap through.

### Screen 8 — Live Recording

- **Purpose:** Record with minimal distraction.
- **Primary elements:** patient reference, large "● RECORDING mm:ss" / "❚❚ PAUSED" indicator, live transcript (speaker labels if available, low-confidence marking), Pause/Resume, Stop. **No AI output during recording**: no salient phrases, facts, evidence or possibilities (ADR-027).
- **Actions:** pause, resume, stop, withdraw consent.
- **Navigation:** Stop → Transcript (speaker mapping).
- **Loading state:** "Connecting to transcription…".
- **Empty state:** "Listening…".
- **Error state:** network-loss banner "Live transcription paused — audio is kept on this device for up to 24 hours; you can continue manually".
- **Accessibility:** state changes announced; controls large.
- **Mobile behavior:** keep screen awake; no evidence or possibilities during recording (ADR-010).

### Screen 9 — Transcript

- **Purpose:** Review final transcript and confirm speaker roles.
- **Primary elements:** speaker mapping panel (Speaker A → Clinician/Patient/Other/Unknown), segments with time and role, `[unclear]` markers, edit. **Continue to extraction is disabled until the mapping is confirmed** (ADR-021). Speakers left Unknown or Other produce "Transcript" provenance.
- **Actions:** set roles, edit segment, Continue to extraction.
- **Navigation:** → Clinical Facts.
- **Loading state:** "Finalizing transcript…" with stage status.
- **Empty state:** "No speech captured" → manual entry.
- **Error state:** final pass failed → keep live transcript, Retry.
- **Accessibility:** segments read with role and time.
- **Mobile behavior:** role mapping first, transcript scrolls below.

### Screen 10 — Clinical Facts

- **Purpose:** Review extracted facts.
- **Primary elements:** facts grouped by category. Each fact shows:
  - value
  - information state in words
  - provenance tag with root origin (e.g. "Patient-reported", "Clinician-stated", "AI inference — verify", "Confirmed by clinician · originally patient-reported", "Edited by clinician · originally AI inference")
  - review status, confidence
  - speaker and timestamp, with a source segment link
  - a "Needs clarification" badge with its reason

  Open conflicts appear as a "Conflict — review" group, showing each statement side by side with its source and time, plus a Resolve action (choose current / not a conflict). Edited and re-derived facts show their version history. Facts flagged "Needs clarification — source changed" after a transcript or role correction are grouped at the top.
- **Actions:** confirm, reject, edit, add manual fact, view source.
- **Navigation:** → Clinical Review.
- **Loading state:** "Extracting facts…".
- **Empty state:** "No facts extracted — add manually".
- **Error state:** extraction failed → Retry / Continue manually.
- **Accessibility:** each fact announces state and status in words.
- **Mobile behavior:** swipe or buttons for confirm/reject (both available as buttons).

### Screen 11 — Clinical Review

- **Purpose:** Review workspace.
- **Primary elements:** sections FACTS · EVIDENCE · POSSIBILITIES TO REVIEW · NOTE, in pipeline order (ADR-023). POSSIBILITIES TO REVIEW is visible only when `possibilitiesEnabled` is ON (R2, default OFF, ADR-025); when the stage was SKIPPED it states why (e.g. "Possibilities not generated: no evidence retrieved"). Possibilities are listed alphabetically with the note "Order has no meaning" (ADR-034). Each possibility: Why surfaced, Supporting facts, Contradicting facts, facts in an open conflict ("Conflict — review"), Missing information, Sources, the evidence state at generation (e.g. "Evidence incomplete: <failed routes>"), and the "Outdated — facts changed since generation" marker when applicable. Transparency actions: Why did this appear? / Source / View transcript / View evidence / Dismiss / Confirm as assessment. **Confirm as assessment is disabled, with its reason shown, for outdated possibilities and those from a superseded run** (CS-43). Section actions (clinician only): Regenerate (offering "Re-run evidence search first" when evidence is marked "Based on facts that changed since retrieval"); when the stage was SKIPPED, "Re-run evidence search" and then generate.
- **Actions:** dismiss/confirm possibility, open evidence, go to note.
- **Navigation:** → Evidence, → Note Editor.
- **Loading state:** per section.
- **Empty state:** "No possibilities surfaced" (flag ON) — the section is absent when the flag is OFF.
- **Error state:** per-section errors; other sections usable.
- **Accessibility:** no probability or ranking visuals.
- **Mobile behavior:** segmented control between sections.

### Screen 12 — Evidence

- **Purpose:** Show source-linked evidence.
- **Primary elements:** evidence cards grouped by source type in deterministic order (EVIDENCE-SOURCES §14), with: source, source type + tier (per record), title, published/updated date, retrieved date, relevance (retrieval), identifier, link, limitations, "may be outdated" marker, "U.S. regulatory information" on FDA/DailyMed records and "U.S. drug terminology (RxNorm)" on normalizations, "Retrieved for: <concept> (<state>)" or "Clinician search", "Based on facts that changed since retrieval" marker, "Sources differ — compare" marker (closed rules, S17a); manual search (sanitized on device; a rejected query shows its reason); "Re-run evidence search" (clinician); trial and public-health search only as an explicit clinician action.
- **Actions:** open source link, refresh, search.
- **Navigation:** from Clinical Review or candidate.
- **Loading state:** card skeletons with provider names.
- **Empty state:** "No evidence found in the searched sources" (no AI filler).
- **Error state:** per-provider failure shown; other results remain.
- **Accessibility:** card content read in a fixed order.
- **Mobile behavior:** cards stack; links open in browser.

### Screen 13 — Medication Information

- **Purpose:** Medication normalization and label/regulatory info.
- **Primary elements:** raw wording, normalized candidates (select), RxCUI, dose/route/frequency as stated, status, label sections (DailyMed) with source and date, regulatory info; "Label information — not a dosing recommendation".
- **Actions:** select candidate, confirm, edit, view label source.
- **Navigation:** from fact or patient medication list.
- **Loading state:** "Looking up…".
- **Empty state:** "No match found — kept as entered".
- **Error state:** provider failure; raw medication retained.
- **Accessibility:** candidates as radio list.
- **Mobile behavior:** label sections collapsible.

### Screen 14 — Note Editor

- **Purpose:** Draft, edit and finalize notes.
- **Primary elements:** note type, draft label ("AI draft — review before finalizing" / "Manual draft"), editor, unreviewed-facts indicator ("N facts not yet reviewed — finalizing does not confirm them", CS-25), open-conflict indicator, version history, **Finalize note** (never labeled "confirm"; finalizing confirms no fact, CS-25), Export (draft exports watermarked "DRAFT — not finalized by clinician", FR-26.5).
- **Actions:** edit, regenerate draft (keeps earlier versions, FR-21.5), finalize, view versions, export. With `patientExplanationEnabled` ON (R2, development builds only): "Draft patient explanation" (FR-21.6).
- **Navigation:** → Export flow.
- **Loading state:** "Generating draft…" (editor still usable).
- **Empty state:** blank manual editor.
- **Error state:** generation failed → manual draft.
- **Accessibility:** editor labeled; version list navigable.
- **Mobile behavior:** keyboard-safe layout; autosave.

### Screen 15 — Follow-Up

- **Purpose:** Manage follow-up tasks.
- **Primary elements:** pending list (due date, patient reference, task, source visit), completed/cancelled.
- **Actions:** mark completed/cancelled (clinician), edit, open patient.
- **Navigation:** from Home or patient.
- **Loading state:** skeleton.
- **Empty state:** "No pending follow-ups".
- **Error state:** banner.
- **Accessibility:** overdue status in text.
- **Mobile behavior:** sorted by due date.

### Screen 16 — Returning Patient

- **Purpose:** Prepare for a follow-up visit.
- **Primary elements:** LAST VISIT, WHAT CHANGED (from structured diff over current versions; "not discussed this visit" for absent items; provisional items labeled "Provisional — not reviewed"; open conflicts shown as conflicting; FR-25.4), CURRENT MEDICATIONS, PENDING ITEMS, FOLLOW-UP, START NEW VISIT.
- **Actions:** start visit, open last visit.
- **Navigation:** from Patient Overview.
- **Loading state:** skeleton.
- **Empty state:** first visit → Patient Overview instead.
- **Error state:** banner.
- **Accessibility:** sections as headings.
- **Mobile behavior:** Start New Visit fixed at bottom.

### Screen 17 — Search

- **Purpose:** Local search across patients and visits.
- **Primary elements:** search field, scope (patients/visits/notes), results.
- **Actions:** open result.
- **Navigation:** from Home.
- **Loading state:** inline spinner.
- **Empty state:** "No results".
- **Error state:** banner.
- **Accessibility:** result count announced.
- **Mobile behavior:** works offline; queries never logged.

### Screen 18 — Settings

- **Purpose:** Configuration.
- **Primary elements:** "Cloud processing (transcription, AI and evidence search)" toggle (FR-28; off = manual mode, no data leaves the device), clinician account sign-in/out with the signed-out message "Sign in to use cloud processing" (FR-28.4; account holds email only, FR-28.5), app lock, note type default, temporary audio information, data export/delete, links to Privacy and About.
- **Actions:** toggle, navigate.
- **Navigation:** tab root.
- **Loading state:** none.
- **Empty state:** n/a.
- **Error state:** inline.
- **Accessibility:** toggles labeled with current state.
- **Mobile behavior:** standard list.

### Screen 19 — Privacy

- **Purpose:** Explain data handling in-app.
- **Primary elements:** what stays on device, what goes to which provider category, audio retention, no analytics, deletion controls, link to public privacy policy (when available).
- **Actions:** delete data, open policy.
- **Navigation:** from Settings / Onboarding.
- **Loading state:** none.
- **Empty state:** n/a.
- **Error state:** n/a.
- **Accessibility:** plain-language headings.
- **Mobile behavior:** scrollable text.

### Screen 20 — About

- **Purpose:** Version, disclaimers.
- **Primary elements:** app version, "ClinNote is a documentation and evidence-review assistant. It does not diagnose or prescribe. It is not clinically validated and has no regulatory approval.", open-source notices, support contact, re-open onboarding.
- **Actions:** view notices, contact support.
- **Navigation:** from Settings.
- **Loading state:** none.
- **Empty state:** n/a.
- **Error state:** n/a.
- **Accessibility:** standard.
- **Mobile behavior:** standard.

### Screen 21 — Visits

- **Purpose:** List visits across patients (Visits tab root).
- **Primary elements:** list of visits (date, patient reference, mode AMBIENT/MANUAL, pipeline stage status in words, note state DRAFT/FINALIZED, open-conflict and unreviewed counts); filters by date, state and "needs review".
- **Actions:** open visit, resume a failed stage, start new visit.
- **Navigation:** tab root → visit detail (Transcript, Clinical Facts, Clinical Review, Note Editor).
- **Loading state:** list skeleton.
- **Empty state:** "No visits yet — start a visit".
- **Error state:** banner with retry.
- **Accessibility:** each row announces date, patient reference, note state and review counts.
- **Mobile behavior:** virtualized list; works offline.

## 4. Export Flow

Warning dialog: "This file will leave ClinNote's protected storage. ClinNote cannot delete copies shared with other apps." → choose format/content → share sheet → AuditEvent.

## 5. Mobile Priority

The most frequent actions (Start New Visit, Stop recording, Confirm) are reachable with one thumb. During recording the screen stays simple.
