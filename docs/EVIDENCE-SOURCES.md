# ClinNote AI — Evidence Sources

Evidence supports clinician review. It is never presented as patient-specific advice. Integration details and verification status for each source are in `API_CATALOG.md`.

---

## 1. What FDA Is (and Is Not)

The U.S. Food and Drug Administration regulates and authorizes medical products (approves or clears drugs, biologics and devices) and publishes regulatory information about them — labeling, approvals, recalls, adverse-event reports, shortages and product listings.

FDA data sources are therefore **regulatory information sources**. They are not "FDA-approved knowledge sites", they do not certify clinical content, and their presence in ClinNote does not mean ClinNote or any ClinNote output is FDA approved. FDA information reflects U.S. regulatory status only.

## 2. Source Hierarchy

| Tier | Category | Sources |
|---|---|---|
| 1 | Regulatory / government primary sources | FDA (openFDA, Drugs@FDA, NDC), NLM (DailyMed, RxNorm, Clinical Tables, PubChem via NCBI), NIH, NCI trial records, WHO, ClinicalTrials.gov registry |
| 2 | Recognized guidelines | Official guideline organizations and government-supported clinical guidance |
| 3 | Peer-reviewed literature | PubMed, PubMed Central, Europe PMC |
| 4 | Government patient education | MedlinePlus, NCI patient resources |
| 5 | Trusted secondary sources | Only after an ADR names the source |
| 6 | General web | Supplementary discovery only (e.g. Google Search grounding); not enabled in V1 |

The tier is stored on every EvidenceSource and shown on each evidence card. It describes the authority of the source type, not the quality or strength of an individual study.

**Tier is assigned per record, by content type, not per provider (F-13):**
- NCI trial records are Tier 1 (CLINICAL_TRIAL; clinician request only). NCI patient-information pages are Tier 4. NCI health-professional summaries are not integrated in V1 (link-out only).
- MedlinePlus is always Tier 4.
- A ClinicalTrials.gov record is Tier 1 because it is a government registry record. The card states "Registry record — not evidence of efficacy".
- PubChem and WHO records are Tier 1 as government or intergovernmental reference data. The card states "Reference data — not patient-specific guidance".
- Literature records are Tier 3, or Tier 2 when the publication type is a practice guideline. A guideline record belongs to the GUIDELINE group and source type only, never to LITERATURE (ADR-036).

Tier 2: no guideline API is integrated in V1. A guideline found via literature search is labeled GUIDELINE only when the record's publication type indicates a guideline.

## 3. When to Use Each Source

| Need | Use | Do not use |
|---|---|---|
| Normalize a medication name | RxNorm | PubChem, LLM guessing |
| What does the label say (indications, warnings, contraindications, interactions, adverse reactions, dosage section) | DailyMed; openFDA label as fallback | Literature, LLM memory |
| Approval history / application | Drugs@FDA | DailyMed |
| Product identification / packaging | NDC Directory | — |
| Therapeutic equivalence | Orange Book — **not integrated in V1**; link-out to the FDA Orange Book page only | Clinical advice; substitution suggestions |
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

- Use relevant datasets: drug label, adverse events, NDC, Drugs@FDA, shortages, enforcement. All are integrated in BUILD_PLAN Phases 11–12. Orange Book data is not integrated in V1 (link-out only).
- Display dataset name, record identifier and openFDA's own disclaimer that data is not validated for clinical use (exact wording verified from documentation).
- Never present FDA data as patient-specific advice.
- Every FDA and DailyMed card states "U.S. regulatory information", and RxNorm normalizations state "U.S. drug terminology (RxNorm)". The app collects no location, so the labels are unconditional (ADR-036).

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

Patient education (PATIENT_EDUCATION cards, R1). Its records, like NCI patient-information pages, are PATIENT_EDUCATION records that AI job 16 may use; job 16 is R2 behind `patientExplanationEnabled`, default OFF (ADR-041).

### 4.8 ClinicalTrials.gov

Trial discovery, status, eligibility text. Clinician-initiated only; never retrieved automatically (ADR-036). Never recommends enrollment.

### 4.9 NLM Clinical Tables

Terminology lookup and coding assistance. Never silently converts a phrase into a diagnosis or billing code.

### 4.10 PubChem

Compound identity and chemistry. Never replaces labeling.

### 4.11 WHO

Global health and epidemiology. Population data is context, not patient-specific guidance.

### 4.12 NCI

Cancer information, patient education, cancer trials. Automatic CANCER_INFO retrieval returns information pages only; NCI trial records are retrieved only on clinician request (ADR-036). General cancer information never implies the patient has cancer.

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
- Freshness is computed from `retrievedAt`, which is the time of the original provider fetch. Reading a cached record never updates it. A refresh creates a new EvidenceSource record (§16).

## 8. Source Disagreement

If sources disagree, show both with their sources and dates. Never silently pick one. Code shows a "Sources differ — compare" marker only under the closed rules in §14 step 6 (ADR-039). Conflicting literature is shown side by side without a marker, because code cannot judge study conclusions. Evidence synthesis (R2) must state any disagreement.

## 9. Citation Verification

1. Adapters extract identifiers only from provider responses.
2. EvidenceSources are stored before synthesis runs.
3. The LLM receives evidence with internal evidence IDs and may reference only those IDs.
4. The app renders citations from stored metadata.
5. A validator rejects any output of jobs 12, 13 or 16 that contains a PMID/DOI/NCT/set ID/RxCUI not in the bundle, or that names a source not in the bundle (CS-16).
6. Optional re-check: before display, a PMID may be re-resolved via ESummary to confirm it exists (on by default for literature).

## 10. Fake Citation Prevention

- No free-text citation fields filled by AI.
- Tests: output of jobs 12, 13 or 16 containing a fabricated PMID → rejected (CS-16); a fake FDA response (malformed or unexpected schema) → rejected by adapter validation and shown as provider error.

## 11. Evidence Bundle

Per candidate or query: source, source type, tier, title, identifier, publication/update date, retrieval timestamp, relevance (retrieval relevance, not clinical likelihood), URL, relevant excerpt, limitations.

## 12. Licensing and Attribution

Terms of use and attribution are verified per source before integration. Full text is displayed only where permitted; otherwise metadata and link-out.

## 13. Reference Images

**V1 displays no reference images** (OD-008 resolved by descoping, ADR-029). Evidence cards may link to an authoritative source page that itself contains images; ClinNote does not download, rehost or display them.

If a later ADR enables images, each image must have:
- source, source URL, license/usage information and retrieval timestamp
- the label "ILLUSTRATIVE / REFERENCE IMAGE", never "PATIENT MATCH"
- no scraping of copyrighted images from search engines
- link-out instead of rehosting when licensing is uncertain

CS-30 tests that no reference-image content claims or implies a match to the patient.

## 14. Ranking (deterministic, F-13)

The LLM does not rank evidence. Processing order (ADR-036): validate → deduplicate (§15) → assign tier and group → rank → apply the per-group cap. Ranking is deterministic code:

1. **Group by source type.** Groups are shown in this order: REGULATORY · GUIDELINE · LITERATURE · CLINICAL_TRIAL · PATIENT_EDUCATION · TERMINOLOGY · CHEMICAL_INFORMATION · PUBLIC_HEALTH. Grouping is for presentation only. It never implies that one record outweighs another clinically.
2. **Order within REGULATORY:** current label first (most recent `updatedAt`), then approvals, then safety communications (recalls, shortages, adverse-event summaries).
3. **Order within GUIDELINE:** publication date, newest first. **Order within LITERATURE:** by publication type (systematic review / meta-analysis → randomized trial → other study types), then publication date, newest first. Guideline records are in the GUIDELINE group (§2).
4. **Relevance label** (HIGH/MEDIUM/LOW) comes from deterministic concept overlap between the query concepts and the record's title and indexing terms. It describes retrieval relevance only.
5. **Per-group cap:** at most 5 records per group per query (configurable), applied after deduplication. The rest are reachable through "more".
6. **Disagreement marker (closed rules, ADR-039):** "Sources differ — compare" is shown only when
   - (a) a recall, enforcement or shortage record exists for a product whose label card is shown, or
   - (b) for the same RxCUI, a Boxed Warning or Contraindications section is present in one SPL and absent in another (structural difference only; wording differences never trigger the marker). At most the 3 most recent SPLs per RxCUI are fetched (ADR-043).

   No other rule exists. This R1 display does not depend on synthesis (S17a).

## 15. Deduplication (F-13)

- Scope: deduplication applies **within one retrieval result set**, before ranking. It never deletes stored records.
- Records are the same item when any identifier matches: PMID, PMCID or DOI equivalence across PubMed and Europe PMC, the same DailyMed set ID (within a result set only the latest version is kept, and the version is recorded), or the same NCT number. Older stored versions cited by a candidate or note are kept (§16; `DATA_MODEL.md` §6 rule 8).
- One EvidenceSource is kept per item: the record from the route's primary provider wins. The other providers' identifiers are stored in `alternateIdentifiers`.
- Deduplication never merges records that have different identifiers, even if their titles are similar.

## 16. Caching (F-13, ADR-028)

- **On the device only.** Stored EvidenceSource records are the cache, keyed by (provider, sanitized query). The backend keeps no cache and no copies of queries or responses.
- **Visit-scoped (ADR-039).** A cache hit from an earlier visit is copied into the current visit as a new EvidenceSource with `cachedFromEvidenceId` and the current visit's `queryId`. A bundle never links to another visit's query or facts.
- REGULATORY_SAFETY records (recalls, enforcement, shortages) are never served from cache. Other regulatory records older than 30 days are refetched.
- `retrievedAt` is always the original provider fetch time. A cache hit is displayed with its original retrieval date.
- **Staleness after fact review.** Evidence never re-runs automatically. A record shows "Based on facts that changed since retrieval" when any of its query's source facts is edited, rejected, superseded or resolved away. It leaves the citable bundle only when all of those facts are REJECTED or resolved away. The clinician can "Re-run evidence search".
- A refresh queries the provider again and stores a new record. The old record is kept if it is cited by a candidate or a note.
- Freshness rules (§7) apply to cached and fresh records alike.

## 17. Canonical Retrieval Pipeline (ADR-023)

```text
STRUCTURED CLINICAL FACTS (participation per `DATA_MODEL.md` §4.15 table)
→ CLINICAL CONCEPTS (the facts' code-computed conceptKeys)
→ EVIDENCE SEARCH QUERIES (job 11, deterministic code)
→ on-device query sanitizer (ADR-036)
→ AUTHORITATIVE EVIDENCE RETRIEVAL (routing table; staged: only the source types needed)
→ response validation → deduplication (§15) → tier/group → ranking and cap (§14) → storage (§16)
→ [R2, only when the `DATA_MODEL.md` §5.2 candidate precondition holds: flag ON, evidence COMPLETED/PARTIAL, citable bundle non-empty — ADR-034]
   CANDIDATE / POSSIBILITY GENERATION (job 12, grounded in the stored bundle)
→ SUPPORTING FINDINGS · CONTRADICTING FINDINGS · MISSING INFORMATION
→ SOURCE CITATIONS (evidence IDs ⊆ citable bundle; §9)
→ EVIDENCE SYNTHESIS per candidate (job 13)
→ CLINICIAN REVIEW
```

The same order is used in `PRODUCT_SPEC.md` §6, `ARCHITECTURE.md` §6.4, `AI.md` §3, `BUILD_PLAN.md` Phases 11–13 and `TESTING.md` §13a.

**Staged route selection (deterministic, ADR-039, ADR-043).** Job 11 is code. It selects **routes** (`API_CATALOG.md` §29) by the fact's **FactCategory** (`DATA_MODEL.md` §3.6) through this code-owned table, using the code-computed conceptKeys of eligible facts as defined in `DATA_MODEL.md` §4.15. These exclude UNMAPPED keys, OPEN-conflict facts, HISTORY_FAMILY and HISTORY_SOCIAL facts, and unconfirmed AI inferences. It never introduces a concept that is not a stated fact (CS-38).

| FactCategory | Automatic routes |
|---|---|
| MEDICATION | MEDICATION_STANDARD, then (after the label-lookup gate, CS-11) MEDICATION_LABEL, REGULATORY_SOURCE, PRODUCT_IDENTIFICATION and REGULATORY_SAFETY |
| SYMPTOM | LITERATURE_PRIMARY (LITERATURE_SECONDARY as fallback) and PATIENT_EDUCATION |
| HISTORY_MEDICAL, ASSESSMENT | LITERATURE_PRIMARY (LITERATURE_SECONDARY as fallback) and PATIENT_EDUCATION; plus CANCER_INFO (information pages only) when the conceptKey is in the code-maintained cancer concept list |
| HISTORY_SURGICAL, HISTORY_FAMILY, HISTORY_SOCIAL, ALLERGY, VITAL_SIGN, EXAMINATION_FINDING, INVESTIGATION, PLAN, FOLLOW_UP, OTHER | **none** (no automatic route in V1; the clinician may run a manual search) |

- A category that is not in this table gets no automatic route. Adding a route for a category requires an ADR and a clinical-safety review.
- CANCER_INFO is never chosen for any other category.
- TRIALS, CHEMICAL and PUBLIC_HEALTH run only on clinician request (a code constant, never configuration) for every category. TERMINOLOGY serves clinician autocomplete and normalization support only.

No route is called for every case.

A fact excluded **only** because its conceptKey is UNMAPPED, in a category that has an automatic route, gets the "Not searched automatically" notice and a pre-filled, editable manual search (PRODUCT_SPEC FR-17.8). Nothing is sent before the clinician submits; the query takes the sanitizer path as CLINICIAN_MANUAL.

**Route → EvidenceSourceType mapping (ADR-036).** The type is assigned per record by content (§2); this table gives the default:

| Route | Provider(s) | EvidenceSourceType |
|---|---|---|
| MEDICATION_STANDARD | RxNorm | TERMINOLOGY (normalization; not shown as evidence) |
| MEDICATION_LABEL | DailyMed, openFDA label | REGULATORY |
| REGULATORY_SOURCE | openFDA, Drugs@FDA | REGULATORY |
| PRODUCT_IDENTIFICATION | NDC Directory | REGULATORY |
| REGULATORY_SAFETY | openFDA adverse events, enforcement, shortages | REGULATORY |
| LITERATURE_PRIMARY / LITERATURE_SECONDARY | PubMed / Europe PMC | LITERATURE, or GUIDELINE by publication type |
| PATIENT_EDUCATION | MedlinePlus | PATIENT_EDUCATION |
| CANCER_INFO | NCI patient-information pages | PATIENT_EDUCATION (Tier 4) |
| TRIALS | ClinicalTrials.gov, NCI trials (clinician request) | CLINICAL_TRIAL |
| TERMINOLOGY | NLM Clinical Tables | TERMINOLOGY |
| CHEMICAL | PubChem | CHEMICAL_INFORMATION |
| PUBLIC_HEALTH | WHO | PUBLIC_HEALTH |
