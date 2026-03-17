# Research: Pragmatic Auto-Verification

**Feature**: 014-auto-verification
**Date**: 2026-03-16

## R1: Source Authority Classification — URL Domain Patterns

**Decision**: Classify source authority using a two-tier approach: TLD-based for `.gov`, config-based for known court URLs.

**Rationale**: Only ~11 of ~40 court roster URLs across all states are `.gov` domains. Most Florida circuit courts self-host on `.org` (e.g., `firstjudicialcircuit.org`, `ninthcircuit.org`). One uses `.com` (`15thcircuit.com`), one uses `.net` (`keyscourts.net`). A strict `.gov`-only classifier would miss the majority of court URLs.

**Classification logic**:
1. **OFFICIAL_GOV**: URL contains `.gov` TLD (covers supreme courts, appellate courts, some circuits)
2. **COURT_WEBSITE**: URL domain appears in any state's court configuration JSON (covers all `.org`, `.com`, `.net` circuit court sites)
3. **SECONDARY**: All other URLs (Ballotpedia, bar associations, news)

**Alternatives considered**:
- `.gov`-only for all trust tiers → rejected because most circuit courts aren't on `.gov` domains
- Manual allowlist of trusted domains → rejected because state court config JSONs already serve as a curated allowlist; using them avoids maintaining a separate list
- URL registration lookup → rejected as over-engineered; court config files are already human-curated

**Impact on thresholds**: With this classification, most Florida judges will fall into COURT_WEBSITE (0.75 threshold) rather than OFFICIAL_GOV (0.70). Supreme Court and DCA judges on `flcourts.gov` get the 0.70 threshold. This is appropriate — `.gov` domains have stronger government identity guarantees.

## R2: Roster URL vs. Source URL — Database Field Gap

**Decision**: Add a `rosterUrl` field to the Judge model alongside the existing `sourceUrl`.

**Rationale**: The spec requires grouping by roster URL in the batch verify UI (clarification Q1). However, the current Judge model has only one `sourceUrl` field, which prioritizes bio page URL over roster URL during import (`csv-importer.ts` line 146: `row['Bio Page URL'] || row['Roster URL']`). This means the roster page — the canonical source for the judge's existence — is often overwritten by the bio page URL.

The harvest CSV already outputs both columns (`Roster URL` and `Bio Page URL`). Adding `rosterUrl` to the database:
- Enables batch verify grouping by the court page (FR-019)
- Preserves the original source of discovery for provenance
- Allows source authority classification from the roster URL (which is always the court page) rather than the bio page URL (which may differ)

**Alternatives considered**:
- Redefine `sourceUrl` to always be the roster URL → rejected because existing records already have bio page URLs stored, and bio URLs are useful for source attribution on judge profile pages
- Parse domain from `sourceUrl` for grouping → rejected because bio page URLs may be on different domains than the roster (rare but possible), and grouping by URL path is more meaningful than grouping by domain
- No schema change, group by import batch instead → rejected per clarification Q1 (user chose roster URL grouping)

## R3: Extraction Method Persistence — Schema Addition

**Decision**: Add `extractionMethod` as a nullable String field on the Judge model (values: "deterministic", "llm", or null).

**Rationale**: Per clarification Q4, extraction method should be persisted on the Judge record for future analytics and re-scoring without CSV dependency. A simple nullable String is preferred over an enum because:
- Only two values currently ("deterministic", "llm")
- Future values may emerge (e.g., "hybrid", "manual") without requiring a migration
- Null represents records imported before this feature (backward compatibility)

**Alternatives considered**:
- Prisma enum → rejected because adding enum values requires a migration; a string is more flexible for a metadata field
- Boolean `isDeterministic` → rejected because it doesn't extend well to future extraction methods

## R4: Confidence Formula — Numerical Analysis

**Decision**: Use the formula defined in the spec with source-authority-aware base scores.

**Analysis of expected outcomes for Florida data**:

| Source Type | Extraction | Base | Bonus | Bio Fields | Final Score | Auto-Verify? |
|-------------|-----------|------|-------|------------|-------------|--------------|
| `.gov` (Supreme/DCA) | deterministic | 0.65 | +0.10 | 0 | 0.75 | ✅ Yes (≥0.70) |
| `.gov` (Supreme/DCA) | deterministic | 0.65 | +0.10 | 3 | 0.90 | ✅ Yes |
| `.gov` (Supreme/DCA) | LLM | 0.65 | 0 | 0 | 0.65 | ❌ No (<0.70) |
| `.gov` (Supreme/DCA) | LLM | 0.65 | 0 | 1 | 0.70 | ✅ Yes (=0.70) |
| Court `.org` (circuits) | deterministic | 0.55 | +0.10 | 0 | 0.65 | ❌ No (<0.75) |
| Court `.org` (circuits) | deterministic | 0.55 | +0.10 | 2 | 0.75 | ✅ Yes (=0.75) |
| Court `.org` (circuits) | LLM | 0.55 | 0 | 0 | 0.55 | ❌ No |
| Court `.org` (circuits) | LLM | 0.55 | 0 | 4 | 0.75 | ✅ Yes (=0.75) |
| Secondary (Ballotpedia) | any | 0.45 | 0-0.10 | 0 | 0.45-0.55 | ❌ No |

**Key insight**: `.gov` + deterministic records auto-verify with zero bio enrichment. Court `.org` + deterministic records need just 2 bio fields. Court `.org` + LLM records need 4 bio fields. This is appropriate given the trust hierarchy.

**Estimated impact on existing data**: The Florida harvest produces ~900 judges. Approximately 200 are from `.flcourts.gov` (Supreme + 6 DCAs), and ~700 from circuit court `.org` sites. With the 19/27 deterministic extraction rate, we expect:
- ~200 `.gov` deterministic records → auto-verified immediately
- ~500 `.org` deterministic records → auto-verified if they have 2+ bio fields
- ~200 LLM-extracted records → auto-verified if from `.gov` with 1+ bio field, or from `.org` with 4+ bio fields

## R5: Batch Processing for Re-Scoring

**Decision**: Process re-scoring in batches of 100 records per transaction with progress logging.

**Rationale**: Per clarification Q3, the script must be safe to interrupt. Batch processing with per-batch transactions ensures:
- Partial progress is preserved if interrupted
- Database connection isn't held open for the entire run
- Progress can be logged periodically for operator visibility
- Prisma's `$transaction` API supports this pattern natively

**Batch size**: 100 records. At ~5,000 total records, this means ~50 batches. Each batch is a single transaction (read + evaluate + update). Expected runtime: under 30 seconds.

## R6: Backward Compatibility — CSV Column Handling

**Decision**: Make new CSV columns optional in the import pipeline with safe defaults.

**Rationale**: Existing harvest CSVs (from before this feature) lack `Source Authority` and `Extraction Method` columns. The import pipeline must handle both old and new formats:
- Missing `Source Authority` column → default to `COURT_WEBSITE` (current hardcoded behavior)
- Missing `Extraction Method` column → default to `null` (unknown)
- The quality gate uses the standard 0.80 threshold when source authority is `COURT_WEBSITE` and extraction method is unknown — preserving existing behavior for old CSVs

**No CSV format versioning needed** — the import pipeline already maps columns by header name, not position.
