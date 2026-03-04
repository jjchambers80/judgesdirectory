# Data Model: State Expansion — TX/CA/NY Harvest Execution

**Feature**: 008-state-expansion
**Date**: 2026-03-03

## Overview

This feature does NOT add new database entities or Prisma schema changes. The existing State → County → Court → Judge hierarchy already supports any US state, and the `Judge.division` field already exists as a nullable string.

The data model changes are **additions to the harvester configuration and runtime layer** — extending schemas and introducing new runtime artifacts defined in 007-state-expansion.

All entities from [007-state-expansion/data-model.md](../007-state-expansion/data-model.md) carry forward unchanged. This document covers only the additions.

---

## Entity Changes: StateConfig (extended)

The StateConfig schema (defined in `state-config-schema.ts`) gains one new field.

### New Field

| Field           | Type                     | Required | Default | Description                                                                                                       |
| --------------- | ------------------------ | -------- | ------- | ----------------------------------------------------------------------------------------------------------------- |
| `countyAliases` | `Record<string, string>` | No       | `{}`    | Maps variant county names to canonical DB names. Key = variant (case-insensitive lookup), Value = canonical name. |

### Validation Rules (new)

- `countyAliases` keys must be non-empty strings
- `countyAliases` values must be non-empty strings
- Values should correspond to county names in the database seed data (validated at runtime with warnings, not at schema parse time)

### Zod Schema Change

```typescript
// In StateConfigSchema, add to the object:
countyAliases: z.record(z.string().min(1), z.string().min(1)).optional().default({}),
```

### Example Usage

```json
{
  "state": "New York",
  "abbreviation": "NY",
  "countyAliases": {
    "Manhattan": "New York",
    "Brooklyn": "Kings",
    "Staten Island": "Richmond",
    "Saint Lawrence": "St. Lawrence"
  },
  "courts": [...]
}
```

---

## New Entity: HarvestManifest (runtime JSON file)

A per-state file tracking the last completed harvest run. Written to `output/{state-slug}/harvest-manifest.json` after a successful harvest completes.

### Fields

| Field             | Type            | Required | Description                                     |
| ----------------- | --------------- | -------- | ----------------------------------------------- |
| `lastCompletedAt` | ISO 8601 string | Yes      | Timestamp of the last successful run completion |
| `judgeCount`      | number          | Yes      | Total judges in the final output CSV            |
| `reportFile`      | string          | Yes      | Filename of the quality report generated        |
| `pagesTargeted`   | number          | Yes      | Total roster pages in the state config          |
| `pagesFailed`     | number          | Yes      | Pages that failed to fetch or extract           |
| `qualityVerdict`  | enum            | Yes      | `"PASS"` \| `"WARNING"` \| `"CRITICAL"`         |

### Validation Rules

- `lastCompletedAt` must be a valid ISO 8601 timestamp
- `judgeCount` must be ≥ 0
- `pagesTargeted` must be ≥ 1
- `pagesFailed` must be ≥ 0 and ≤ `pagesTargeted`
- File is written atomically (tmp + rename) to prevent partial writes
- File is NOT deleted by `--reset` (freshness tracking persists across checkpoint resets)

### Zod Schema

```typescript
export const HarvestManifestSchema = z.object({
  lastCompletedAt: z.string().datetime(),
  judgeCount: z.number().int().min(0),
  reportFile: z.string().min(1),
  pagesTargeted: z.number().int().min(1),
  pagesFailed: z.number().int().min(0),
  qualityVerdict: z.enum(["PASS", "WARNING", "CRITICAL"]),
});

export type HarvestManifest = z.infer<typeof HarvestManifestSchema>;
```

### Relationship

```
output/{state-slug}/
├── harvest-manifest.json    # This entity — written once per completed run
├── checkpoints/             # Existing — per-URL progress (independent lifecycle)
├── {state}-judges-*.csv     # Existing — harvest output
└── {state}-*-report-*.md    # Existing — quality report
```

---

## New Entity: StateRunResult (runtime interface)

Return type from `runSingleState()` for multi-state orchestration. Replaces the current `number` return type. Used by `writeCombinedSummary()` to produce the combined report.

### Fields

| Field               | Type                           | Description                                        |
| ------------------- | ------------------------------ | -------------------------------------------------- |
| `state`             | string                         | State slug (e.g., "texas")                         |
| `success`           | boolean                        | Whether the harvest completed without fatal errors |
| `judgeCount`        | number                         | Total judges in final CSV                          |
| `pages`             | `{ total, succeeded, failed }` | Page-level fetch stats                             |
| `courtTypeCounts`   | `Record<string, number>`       | Judge count per court type                         |
| `duplicatesRemoved` | number                         | Records removed by dedup                           |
| `reportPath`        | string                         | Path to the per-state quality report               |
| `qualityVerdict`    | enum                           | `"PASS"` \| `"WARNING"` \| `"CRITICAL"`            |
| `error`             | string \| null                 | Error message if failed                            |

### TypeScript Interface

```typescript
export interface StateRunResult {
  state: string;
  success: boolean;
  judgeCount: number;
  pages: { total: number; succeeded: number; failed: number };
  courtTypeCounts: Record<string, number>;
  duplicatesRemoved: number;
  reportPath: string;
  qualityVerdict: "PASS" | "WARNING" | "CRITICAL";
  error: string | null;
}
```

---

## New Entity: QualityGateResult (runtime interface)

Output of the quality gate evaluation function in `reporter.ts`.

### Fields

| Field      | Type              | Description                                  |
| ---------- | ----------------- | -------------------------------------------- |
| `verdict`  | enum              | `"PASS"` \| `"WARNING"` \| `"CRITICAL"`      |
| `metrics`  | `QualityMetric[]` | Individual metric evaluations                |
| `markdown` | string            | Pre-rendered Markdown section for the report |

### QualityMetric

| Field          | Type   | Description                                              |
| -------------- | ------ | -------------------------------------------------------- |
| `name`         | string | Metric name (e.g., "Failed page rate")                   |
| `value`        | number | Actual value (0.0–1.0)                                   |
| `displayValue` | string | Human-readable (e.g., "22.2% (6/27)")                    |
| `severity`     | enum   | `"PASS"` \| `"WARNING"` \| `"CRITICAL"`                  |
| `threshold`    | string | Threshold description (e.g., ">10% warn, >25% critical") |

### TypeScript Interfaces

```typescript
export interface QualityMetric {
  name: string;
  value: number;
  displayValue: string;
  severity: "PASS" | "WARNING" | "CRITICAL";
  threshold: string;
}

export interface QualityGateResult {
  verdict: "PASS" | "WARNING" | "CRITICAL";
  metrics: QualityMetric[];
  markdown: string;
}
```

---

## Unchanged Entities (from 007)

These entities are fully defined in [007-state-expansion/data-model.md](../007-state-expansion/data-model.md) and carry forward without modification:

- **StateConfig** (except the new `countyAliases` field above)
- **CourtEntry** — all 15 fields unchanged
- **RateLimitConfig** — all 4 fields unchanged
- **Checkpoint** — per-state path pattern unchanged

## Unchanged Database Models

No Prisma schema changes. The following models support this feature as-is:

- **State** — all 50 states already seeded
- **County** — all counties for TX, CA, NY already seeded
- **Court** — created by court seeder from state configs
- **Judge** — `division String?` already exists, populated by extraction + bio enrichment
- **ImportBatch** — used by admin import pipeline (unchanged)

---

## Relationships Diagram

```
StateConfig (JSON file, 1 per state)
  ├── countyAliases: Record<string, string>  ← NEW
  └── CourtEntry[] (1:many, flat array)
        └── maps to → Court (Prisma model via court seeder)
              └── Judge[] (via extraction + import)
                    └── division: String?  ← NOW SYSTEMATICALLY HARVESTED

HarvestManifest (JSON file, 1 per state)  ← NEW
  └── written after successful runSingleState()
  └── read at startup for data freshness check

StateRunResult (runtime, 1 per state per --all run)  ← NEW
  └── accumulated by --all orchestrator
  └── passed to writeCombinedSummary()

QualityGateResult (runtime, 1 per state report)  ← NEW
  └── computed by evaluateQualityGate()
  └── embedded in quality report markdown
  └── verdict propagated to StateRunResult + HarvestManifest
```
