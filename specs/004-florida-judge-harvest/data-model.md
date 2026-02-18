# Data Model: Florida Judge Data Harvest

**Date**: 2026-02-18 | **Feature**: 004-florida-judge-harvest

## Existing Entities (No Schema Changes)

This feature introduces **no database schema changes**. The harvest tool produces CSV files that feed into the existing import pipeline, which uses the established data model.

### State → County → Court → Judge Hierarchy

```
State (Florida)
  └── County (67 counties)
        └── Court (type: "Supreme Court" | "District Court of Appeal" | "Circuit Court" | "County Court")
              └── Judge (status: UNVERIFIED → VERIFIED/REJECTED)
```

### Relevant Existing Fields

**Court.type** — free-text string. Canonical values for Florida:
- `"Supreme Court"`
- `"District Court of Appeal"`
- `"Circuit Court"`
- `"County Court"`

**Judge** — fields populated by the harvest CSV:
| Field | Source | Required |
|-------|--------|----------|
| `fullName` | LLM extraction (normalized "First Last") | Yes |
| `slug` | Auto-generated from fullName | Yes (auto) |
| `sourceUrl` | URL of the page the judge was found on | Yes (FR-004) |
| `selectionMethod` | LLM extraction if available | Optional |
| `status` | Always `UNVERIFIED` on import | Yes (auto) |
| `courtId` | Matched via Court Type + County | Yes (auto) |
| `importBatchId` | Set by import pipeline | Yes (auto) |

## New Entities (File-Based, Not in Database)

### ExtractionConfig (`florida-courts.json`)

Static configuration file defining the curated URL list and Florida's court structure.

```typescript
interface FloridaCourtsConfig {
  supremeCourt: {
    url: string;             // "https://supremecourt.flcourts.gov/Justices"
    courtType: "Supreme Court";
  };
  districtCourts: Array<{
    district: number;        // 1-6
    name: string;            // "1st District Court of Appeal"
    url: string;             // "https://1dca.flcourts.gov/Judges"
    courtType: "District Court of Appeal";
    circuits: number[];      // [1, 2, 3, 8, 14]
    counties: string[];      // resolved from circuits
  }>;
  circuitCourts: Array<{
    circuit: number;         // 1-20
    url: string;             // circuit-specific judge roster URL
    courtType: "Circuit Court";
    counties: string[];      // ["Escambia", "Okaloosa", "Santa Rosa", "Walton"]
  }>;
}
```

### Checkpoint (`harvest-checkpoint.json`)

Runtime state for resumable execution.

```typescript
interface Checkpoint {
  startedAt: string;         // ISO timestamp
  lastUpdated: string;       // ISO timestamp
  completedUrls: string[];   // URLs successfully processed
  results: Record<string, {
    url: string;
    judgesFound: number;
    errors: string[];
  }>;
  totalJudges: number;
}
```

### Extraction Output (CSV)

One CSV file per run, directly compatible with the existing import pipeline.

| CSV Column | Maps to Judge Field | Example |
|-----------|-------------------|---------|
| `Judge Name` | `fullName` | "Jane Smith" |
| `Court Type` | Court.type (for lookup/creation) | "Circuit Court" |
| `County` | County.name (for lookup) | "Miami-Dade" |
| `State` | State.abbreviation (for validation) | "FL" |
| `Source URL` | `sourceUrl` | "https://jud11.flcourts.org/..." |
| `Selection Method` | `selectionMethod` | "Elected" |

### Quality Report (Markdown)

Summary output after extraction.

```typescript
interface QualityReport {
  runTimestamp: string;
  totalPagesFetched: number;
  totalPagesSuccessful: number;
  totalPagesFailed: number;
  totalJudgesExtracted: number;
  duplicatesRemoved: number;
  countiesWithZeroJudges: string[];
  failedUrls: Array<{ url: string; error: string }>;
  courtTypeSummary: Record<string, number>; // { "Circuit Court": 630, ... }
}
```

## State Transitions

### Extraction Pipeline States

```
IDLE → FETCHING → EXTRACTING → DEDUPLICATING → WRITING → COMPLETE
                                                          ↓
                                                     (CSV + Report)
```

Each URL progresses through: `fetch HTML → clean HTML → send to Claude → parse response → normalize → checkpoint`

### Judge Lifecycle (Existing, Unchanged)

```
CSV Import → UNVERIFIED → (admin review) → VERIFIED
                                         → REJECTED
```

## Validation Rules

1. **Judge name**: Must contain at least first + last name (minimum 2 words after normalization)
2. **Court type**: Must be one of the 4 canonical types
3. **County**: Must match a county in Florida's 67 counties (using existing `normalizeCountyName()`)
4. **Source URL**: Must be a valid URL starting with `http://` or `https://`
5. **Deduplication key**: `lowercase(fullName) + courtType + normalizeCountyName(county)`
