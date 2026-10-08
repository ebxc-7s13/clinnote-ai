# ClinNote AI — Evidence Sources

This document defines the evidence hierarchy and how each source may be used. Provider integration details and verification status live in `API_CATALOG.md`.

## Evidence Philosophy

ClinNote should prefer authoritative sources over unrestricted web content.

Evidence supports clinician review. It is never presented as a patient-specific recommendation.

Source hierarchy:

### Tier 1 — Regulatory / Government Primary Sources

FDA (openFDA, Drugs@FDA, Orange Book, DailyMed labeling)

NLM (RxNorm, Clinical Tables)

NIH

NCI

WHO

### Tier 2 — Recognized Guidelines

Official guideline organizations and government-supported clinical guidance.

No guideline API is integrated in V1. Guideline content surfaced via literature search (e.g. a guideline indexed in PubMed) is labeled with sourceType GUIDELINE only when the publication type indicates a guideline.

### Tier 3 — Peer-Reviewed Literature

PubMed

PubMed Central

Europe PMC

### Tier 4 — Government Patient Education

MedlinePlus

NCI patient resources

### Tier 5 — Other Trusted Sources

Only where appropriate, and only after an ADR names the source.

### Tier 6 — General Web

Use only as supplementary discovery. Not integrated in V1 (`API_CATALOG.md` Section 13).

The tier is stored on each `EvidenceSource` (`DATA_MODEL.md`) and shown on evidence cards.

## Source-Type Mapping

| Source | sourceType | Tier |
|---|---|---|
| openFDA / Drugs@FDA / Orange Book | REGULATORY | 1 |
| DailyMed | REGULATORY | 1 |
| RxNorm | TERMINOLOGY | 1 |
| NLM Clinical Tables | TERMINOLOGY | 1 |
| PubChem | CHEMICAL_INFORMATION | 1 |
| WHO | PUBLIC_HEALTH | 1 |
| NCI (professional content) | REGULATORY or PUBLIC_HEALTH as applicable | 1 |
| ClinicalTrials.gov | CLINICAL_TRIAL | 1 |
| PubMed / PMC / Europe PMC | LITERATURE (or GUIDELINE, see Tier 2) | 3 |
| MedlinePlus / NCI patient resources | PATIENT_EDUCATION | 4 |

## FDA

Use FDA resources for:

- regulatory drug information
- labeling
- approved drug products
- recalls
- adverse-event reporting information
- shortages
- NDC
- Orange Book

Important:

FDA data must not be represented as patient-specific clinical advice.

FDA resources reflect US regulatory status. If the clinician practices outside the US (OD-005), the card must make clear that the information is US regulatory information.

## openFDA

Use relevant datasets.

Potential datasets:

- drug labeling
- adverse events
- NDC
- Drugs@FDA
- shortages
- enforcement
- Orange Book

Important:

Not all openFDA data should be treated as validated clinical decision-support data.

Adverse-event reports do not establish causation; cards showing adverse-event data must state this.

## DailyMed

Use for current labeling information.

Potential information:

- indications
- dosage sections
- contraindications
- warnings
- adverse reactions
- interactions

Use source attribution.

Label dosage sections are displayed as label content with attribution. ClinNote does not compute or suggest a dose for the patient.

## RxNorm

Use for medication normalization.

Do not use RxNorm as a substitute for current medication labeling.

## PubMed

Use for:

- biomedical literature
- clinical studies
- systematic reviews
- meta-analyses
- medical research

Citations must be real.

Never invent PMIDs.

Every PMID displayed must come from an E-utilities response in the current evidence bundle.

## Europe PMC

Use as a secondary literature source.

Potential role:

- literature discovery
- open-access discovery
- cross-checking

## MedlinePlus

Use for:

- patient education
- simple health explanations
- disease information
- medication education

## ClinicalTrials.gov

Use for:

- clinical-trial discovery
- trial status
- eligibility information

Do not automatically recommend trial enrollment.

## NLM Clinical Tables

Use for:

- terminology lookup
- condition search
- coding assistance

Do not silently create diagnoses from terminology matches.

## PubChem

Use for:

- compound identity
- chemistry information

Do not substitute PubChem for FDA labeling.

## WHO

Use for:

- global health
- epidemiological context
- public health

Do not present population data as patient-specific clinical guidance.

## NCI

Use for:

- cancer information
- cancer patient education
- cancer clinical-trial information

Do not interpret general cancer information as proof of malignancy.

## Evidence Bundle

Each evidence bundle should contain:

- source
- source type
- tier
- title
- identifier
- publication/update date
- retrieval timestamp
- relevance
- source URL
- extracted relevant content
- limitations

These map to `EvidenceSource` fields in `DATA_MODEL.md`.

`relevance` is a qualitative label (e.g. HIGH / MEDIUM / LOW) explaining why the source was retrieved for this query. It is not a measure of clinical likelihood.

## Evidence Disagreement

If sources disagree:

show the disagreement.

Never silently choose one source.

## Evidence Freshness

Store:

retrievedAt

publishedAt

updatedAt

where available.

Do not represent stale data as current.

Cached evidence displays its retrieval date. Regulatory and labeling content older than a configured age (default 30 days since retrieval) is visibly marked as possibly outdated and offered for refresh.

## No Results

"No evidence found" is shown as such. The system never fills the gap with unsourced AI text.

## Licensing and Attribution

Each source's terms of use and attribution requirements are verified before integration (`API_CATALOG.md`, Per-Provider Verification Checklist). Full-text content is displayed only where the source's terms permit; otherwise ClinNote shows metadata and links out.
