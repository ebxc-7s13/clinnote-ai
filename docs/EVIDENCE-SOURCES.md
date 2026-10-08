# ClinNote AI — Evidence Sources

Evidence supports clinician review. It is never presented as patient-specific advice. Integration details and verification status for each source are in `API_CATALOG.md`.

---

## 1. What FDA Is (and Is Not)

The U.S. Food and Drug Administration regulates and authorizes medical products (approves or clears drugs, biologics and devices) and publishes regulatory information about them — labeling, approvals, recalls, adverse-event reports, shortages and product listings.

FDA data sources are therefore **regulatory information sources**. They are not "FDA-approved knowledge sites", they do not certify clinical content, and their presence in ClinNote does not mean ClinNote or any ClinNote output is FDA approved. FDA information reflects U.S. regulatory status only.

## 2. Source Hierarchy

| Tier | Category | Sources |
|---|---|---|
| 1 | Regulatory / government primary sources | FDA (openFDA, Drugs@FDA, NDC, Orange Book), NLM (DailyMed, RxNorm, Clinical Tables, PubChem via NCBI), NIH, NCI, WHO, ClinicalTrials.gov |
| 2 | Recognized guidelines | Official guideline organizations and government-supported clinical guidance |
| 3 | Peer-reviewed literature | PubMed, PubMed Central, Europe PMC |
| 4 | Government patient education | MedlinePlus, NCI patient resources |
| 5 | Trusted secondary sources | Only after an ADR names the source |
| 6 | General web | Supplementary discovery only (e.g. Google Search grounding); not enabled in V1 |

The tier is stored on every EvidenceSource and shown on each evidence card. Tier indicates source type authority, not the quality of an individual study.

Tier 2: no guideline API is integrated in V1. A guideline found via literature search is labeled GUIDELINE only when the record's publication type indicates a guideline.

## 3. When to Use Each Source

| Need | Use | Do not use |
|---|---|---|
| Normalize a medication name | RxNorm | PubChem, LLM guessing |
| What does the label say (indications, warnings, contraindications, interactions, adverse reactions, dosage section) | DailyMed; openFDA label as fallback | Literature, LLM memory |
| Approval history / application | Drugs@FDA | DailyMed |
| Product identification / packaging | NDC Directory | — |
| Therapeutic equivalence | Orange Book | Clinical advice |
| Recalls / enforcement / shortages | openFDA enforcement, shortages | — |
| Post-marketing adverse-event reports | openFDA adverse events, with "reports do not establish causation" | Incidence claims |
| Research evidence on a condition/treatment | PubMed (primary), Europe PMC (secondary) | General web |
| Patient-friendly explanation | MedlinePlus; NCI for cancer | Literature abstracts |
| Clinical trials | ClinicalTrials.gov; NCI for cancer | Enrollment recommendations |
| Condition / term lookup | NLM Clinical Tables | Automatic diagnosis or billing codes |
| Chemical identity | PubChem | Labeling decisions |
| Population / epidemiological context | WHO | Patient-specific risk statements |
| Nothing found in authoritative sources | Show "no evidence found" | Unsourced AI text; Tier 6 unless ADR enables it |

## 4. Source Rules

Source-specific rules that apply in addition to the general rules in this document.

### 4.1 FDA / openFDA

- Use relevant datasets: drug label, adverse events, NDC, Drugs@FDA, shortages, enforcement, Orange Book data.
- Display dataset name, record identifier and openFDA's own disclaimer that data is not validated for clinical use (exact wording verified from documentation).
- Never present FDA data as patient-specific advice.
- Outside the US, the card states "U.S. regulatory information".

### 4.2 Drugs@FDA

Regulatory approval and application information. Not clinical guidance.

### 4.3 DailyMed

Current submitted labeling (SPL). Label sections are displayed with attribution, set ID and version date. The dosage section is shown as label content; ClinNote never computes or suggests a patient dose.

### 4.4 RxNorm

Normalization only. Ambiguous matches show all candidates. Not a substitute for labeling.

### 4.5 PubMed

Literature: studies, systematic reviews, meta-analyses. Every PMID shown must come from an E-utilities response in the stored evidence bundle. Never invent PMIDs.

### 4.6 Europe PMC

Secondary literature source, open-access discovery, cross-checking PubMed results.

### 4.7 MedlinePlus

Patient education and plain-language explanations used in AI job 16.

### 4.8 ClinicalTrials.gov

Trial discovery, status, eligibility text. Clinician-initiated. Never recommends enrollment.

### 4.9 NLM Clinical Tables

Terminology lookup and coding assistance. Never silently converts a phrase into a diagnosis or billing code.

### 4.10 PubChem

Compound identity and chemistry. Never replaces labeling.

### 4.11 WHO

Global health and epidemiology. Population data is context, not patient-specific guidance.

### 4.12 NCI

Cancer information, patient education, cancer trials. General cancer information never implies the patient has cancer.

### 4.13 Google Search Grounding

Tier 6. Not enabled in V1. If later enabled by ADR: used only when Tiers 1–4 return nothing; each result must be resolved to an authoritative underlying source before display; otherwise it is not shown.

## 5. Source Provenance

Each EvidenceSource stores provider, source type, tier, title, identifier and identifier type, URL, excerpt, limitations, and the EvidenceQuery that produced it. Evidence items carry provenance EXTERNAL_SOURCE wherever they are reused.

## 6. Retrieval Timestamp and Publication Date

Store `retrievedAt` always; `publishedAt` and `updatedAt` when the source provides them. Cards show both "Published/updated" and "Retrieved".

## 7. Stale Data

- Regulatory/labeling content retrieved more than 30 days ago is marked "may be outdated — refresh".
- Literature is not "stale" by retrieval age, but publication date is always displayed.
- Cached data is never represented as current.

## 8. Source Disagreement

If sources disagree (e.g. two labels, conflicting studies), show both with their sources and dates. Evidence synthesis must state the disagreement. Never silently pick one.

## 9. Citation Verification

1. Adapters extract identifiers only from provider responses.
2. EvidenceSources are stored before synthesis runs.
3. The LLM receives evidence with internal evidence IDs and may reference only those IDs.
4. The app renders citations from stored metadata.
5. A validator rejects any synthesis output containing a PMID/DOI/NCT/set ID/RxCUI not in the bundle.
6. Optional re-check: before display, a PMID may be re-resolved via ESummary to confirm it exists (on by default for literature).

## 10. Fake Citation Prevention

- No free-text citation fields filled by AI.
- Tests: synthesis output containing a fabricated PMID → rejected; a fake FDA response (malformed or unexpected schema) → rejected by adapter validation and shown as provider error.

## 11. Evidence Bundle

Per candidate or query: source, source type, tier, title, identifier, publication/update date, retrieval timestamp, relevance (retrieval relevance, not clinical likelihood), URL, relevant excerpt, limitations.

## 12. Licensing and Attribution

Terms of use and attribution are verified per source before integration. Full text is displayed only where permitted; otherwise metadata and link-out.

## 13. Reference Images

Reference images are illustrative only and come from a source selected under OD-008. Not implemented until resolved.
