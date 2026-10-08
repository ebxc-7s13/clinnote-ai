# ClinNote AI — UI/UX Specification

## Design Objective

Create a serious clinical productivity tool.

The interface must prioritize:

- speed
- clarity
- readability
- accessibility
- trust
- low cognitive load

## Avoid

Do not use:

- excessive gradients
- flashy neon
- unnecessary 3D graphics
- distracting animations
- gamification
- giant AI robot imagery
- excessive glassmorphism

## Primary Navigation

Home

Patients

Visits

Settings

## Home

Display:

Start New Visit

Search Patient

Recent Patients

Recent Visits

Pending Follow-ups

## Patient

Display:

patient reference

age

sex

active problems

medications

allergies (showing NOT DISCUSSED explicitly when no allergy information exists)

recent visit

timeline

follow-up

Start New Visit

Optional name and date of birth are shown only if entered.

## Consent

Before recording, a consent step shows a short checklist and requires the clinician to confirm that appropriate consent was obtained. Declining consent continues the visit in manual mode.

## Live Visit

Display:

patient reference

recording state

timer

speaker transcript

clinical facts

important findings

pause

resume

stop

The recording state must always be visually obvious.

Recording state is communicated with text and icon, not color alone (e.g. "● RECORDING 04:12", "❚❚ PAUSED").

"Important findings" during the live stage are lightweight extractions only (ADR-008) and are labeled provisional. No evidence or possibilities are shown during recording.

A network-loss banner appears if live transcription stops, with the option to continue manually.

## Speaker Mapping

After recording stops, the clinician sees the proposed speaker-to-role mapping (DOCTOR / PATIENT / OTHER) and can correct it before extraction runs.

## Clinical Review

Use sections:

FACTS

POSSIBILITIES TO REVIEW

EVIDENCE

NOTE

Each generated clinical possibility should expose:

Why surfaced

Supporting facts

Contradicting facts

Missing information

Sources

Every AI-generated item shows a visible provisional marker and offers the transparency actions in `AI.md` (Why did this appear? / Source / View transcript / View evidence / Dismiss / Confirm).

Information state is shown in words (e.g. "Fever — denied", "Allergies — not discussed"), never only by icon or color.

Conflicts are shown inline with both values and their sources.

## Evidence Card

Show:

source

source type and tier

title

date (published/updated)

relevance

identifier

link

retrieval date

limitations (e.g. "Adverse-event reports do not establish causation", "US regulatory information")

Cards with possibly outdated data show a visible notice (`EVIDENCE-SOURCES.md`, Evidence Freshness).

## Note Editor

- note type selector (SOAP / General / Progress)
- draft clearly labeled "AI draft — review before confirming" or "Manual draft"
- free editing
- explicit "Confirm and finalize" action
- version history

## Patient Timeline

Display:

visit dates

symptoms

medication changes

investigation events

follow-up events

clinician-confirmed assessments

Provisional (unconfirmed) items are visually distinguished from confirmed ones.

## Returning Patient

Show:

LAST VISIT

WHAT CHANGED

CURRENT MEDICATIONS

PENDING ITEMS

FOLLOW-UP

START NEW VISIT

## Settings

- cloud AI features on/off
- speech/AI processing disclosure
- app lock
- temporary audio retention information
- export and delete data
- about / regulatory disclaimer (no approval claims)

## Export

Before exporting, show a warning that the file will leave the app's protected environment.

## Accessibility

Implement:

- screen-reader labels
- logical navigation
- sufficient contrast
- accessible touch targets
- text scaling
- no color-only meaning
- clear errors

## Mobile Priority

The most frequently used actions must be reachable quickly.

During recording the screen must remain simple.
