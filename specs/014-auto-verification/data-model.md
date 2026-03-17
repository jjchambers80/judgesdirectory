# Data Model: Pragmatic Auto-Verification

**Feature**: 014-auto-verification
**Date**: 2026-03-16
**Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Schema Changes

### Modified Entity: Judge

Two new fields added to the existing `Judge` model.

| Field (NEW)         | Type    | Constraints          | Description |
|---------------------|---------|----------------------|-------------|
| `rosterUrl`         | String? | Optional, no unique  | The court roster page URL where this judge was first discovered. Preserved separately from `sourceUrl` (which may be a bio page). Used for batch-verify grouping (FR-019) and source authority classification. |
| `extractionMethod`  | String? | Optional, nullable   | How this record was extracted: `"deterministic"` (structured HTML parsing) or `"llm"` (AI-based extraction). Null for records imported before this feature. Used for confidence scoring (FR-004) and analytics. |

**Changes to existing fields:**

- `sourceUrl` — **UNCHANGED** in schema, but import logic changes: continues to prefer bio page URL when available, with roster URL now stored separately in `rosterUrl`.
- `sourceAuthority` — **UNCHANGED** in schema (already exists as `SourceAuthority?` enum), but import logic changes: classified from URL domain instead of hardcoded to `COURT_WEBSITE`.
- `confidenceScore` — **UNCHANGED** in schema, but calculation formula changes: source-authority-aware base scores replace the flat 0.50 base.
- `autoVerified` — **UNCHANGED** in schema, but quality gate logic changes: source-aware thresholds determine auto-verification eligibility.

### Existing Entity: SourceAuthority (enum — no changes)

Already defined with the right values:

| Value              | Description |
|--------------------|-------------|
| `OFFICIAL_GOV`     | Official government source (`.gov` domains) |
| `COURT_WEBSITE`    | Individual court website (`.org`, `.com`, `.net` court sites from state configs) |
| `ELECTION_RECORDS` | Secretary of State / election data |
| `SECONDARY`        | News, bar associations, Ballotpedia, etc. |

### Existing Entity: JudgeStatus (enum — no changes)

| Value          | Description |
|----------------|-------------|
| `UNVERIFIED`   | Imported but not yet trusted; invisible on public pages |
| `VERIFIED`     | Visible on public pages (manual or auto-verified) |
| `NEEDS_REVIEW` | Anomalies detected; requires human attention |
| `REJECTED`     | Determined to be invalid data; excluded from all views |

## Migration

### Prisma migration: `add_roster_url_and_extraction_method`

```sql
ALTER TABLE "judges" ADD COLUMN "roster_url" TEXT;
ALTER TABLE "judges" ADD COLUMN "extraction_method" TEXT;
```

No data migration needed — both fields are nullable. Existing records will have NULL for both fields until the re-scoring script runs (which populates `rosterUrl` from `sourceUrl` for records where the source is a roster page, and leaves `extractionMethod` as null for pre-feature records).

### Index considerations

- No index needed on `rosterUrl` immediately — the batch verify sources aggregation query groups by `sourceUrl` (existing indexed field) for initial implementation. If roster URL grouping proves slow, a `@@index([rosterUrl])` can be added later.
- No index needed on `extractionMethod` — it's used for confidence scoring during import, not for queries.

## Confidence Scoring Formula

### Base Score (determined by source authority)

| Source Authority  | Base Score |
|-------------------|-----------|
| `OFFICIAL_GOV`    | 0.65 |
| `COURT_WEBSITE`   | 0.55 |
| `ELECTION_RECORDS`| 0.55 |
| `SECONDARY`       | 0.45 |
| Unknown / null    | 0.45 |

### Bonuses

| Condition | Bonus |
|-----------|-------|
| Deterministic extraction | +0.10 |
| Each enriched bio field  | +0.05 |

### Cap

Maximum confidence score: **0.95**

### Auto-Verification Thresholds

| Source Authority  | Threshold | Anomaly Override |
|-------------------|-----------|------------------|
| `OFFICIAL_GOV`    | ≥ 0.70 | Any anomaly flag → NEEDS_REVIEW |
| `COURT_WEBSITE`   | ≥ 0.75 | Any anomaly flag → NEEDS_REVIEW |
| `ELECTION_RECORDS`| ≥ 0.75 | Any anomaly flag → NEEDS_REVIEW (enum exists but no URL is currently classified to this tier; reserved for future election data sources) |
| `SECONDARY`       | ≥ 0.80 | Any anomaly flag → NEEDS_REVIEW |
| Unknown / null    | ≥ 0.80 | Any anomaly flag → NEEDS_REVIEW |

## Source Authority Classification Logic

```
classifySourceAuthority(url: string | null, stateConfigs: Map<string, CourtEntry[]>):

  1. If url is null or empty → SECONDARY
  2. Parse URL domain
  3. If domain ends with .gov → OFFICIAL_GOV
  4. If domain appears in any state court config JSON → COURT_WEBSITE
  5. Otherwise → SECONDARY
```

The stateConfigs parameter is the set of all loaded state court configuration files. Each contains curated URLs that represent known, trusted court websites. Using these as the allowlist for COURT_WEBSITE means:
- No separate domain allowlist to maintain
- New states automatically get their URLs classified correctly when their config is created
- Only human-curated court URLs get elevated trust

## Entity Relationship (unchanged)

```
State 1──* County 1──* Court 1──* Judge
                                   │
                                   ├── sourceUrl (bio page or roster URL)
                                   ├── rosterUrl (NEW: court roster page)
                                   ├── sourceAuthority (OFFICIAL_GOV | COURT_WEBSITE | ...)
                                   ├── extractionMethod (NEW: "deterministic" | "llm" | null)
                                   ├── confidenceScore (recalculated with new formula)
                                   ├── status (VERIFIED | UNVERIFIED | NEEDS_REVIEW | REJECTED)
                                   ├── autoVerified (boolean)
                                   └── anomalyFlags (string[])
```

## Data Flow

### Import Flow (new records)

```
Harvest CSV
  ├── "Roster URL" column → judge.rosterUrl
  ├── "Bio Page URL" column → judge.sourceUrl (if present, else roster URL)
  ├── "Source Authority" column → judge.sourceAuthority (classified during harvest)
  ├── "Extraction Method" column → judge.extractionMethod
  └── "Confidence Score" column → recalculated by quality gate using new formula
         │
         ▼
    Quality Gate
         │
         ├── anomalyFlags.length > 0 → NEEDS_REVIEW
         ├── OFFICIAL_GOV + score ≥ 0.70 → VERIFIED (autoVerified=true)
         ├── COURT_WEBSITE + score ≥ 0.75 → VERIFIED (autoVerified=true)
         ├── SECONDARY + score ≥ 0.80 → VERIFIED (autoVerified=true)
         └── else → UNVERIFIED
```

### Re-Score Flow (existing records)

```
Database Query: status IN (UNVERIFIED, NEEDS_REVIEW)
  │
  ├── Classify sourceAuthority from sourceUrl domain
  ├── extractionMethod = null (unknown for existing records)
  ├── Recalculate confidenceScore (base from authority, no extraction bonus)
  ├── Count populated fields as proxy for bio enrichment
  │
  ▼
Quality Gate (same logic as import)
  │
  ├── NEEDS_REVIEW with active anomalyFlags → skip (stay NEEDS_REVIEW)
  ├── NEEDS_REVIEW with empty anomalyFlags + meets threshold → VERIFIED
  ├── UNVERIFIED + meets threshold → VERIFIED
  └── else → no change
```

### Batch Verify Flow (admin action)

```
Admin selects source in Sources view
  │
  ▼
POST /api/admin/judges/batch-verify { sourceUrl: "https://..." }
  │
  ├── Query: sourceUrl = X AND status = UNVERIFIED
  ├── Update all matching: status → VERIFIED, verifiedAt → now()
  └── Return { count: N }
```
