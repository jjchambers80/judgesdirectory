# Data Model: State Expansion — Multi-State Harvesting Infrastructure

**Feature**: 007-state-expansion  
**Date**: 2026-03-01

## Overview

This feature does NOT add new database entities. The existing Prisma schema (State → County → Court → Judge) already supports any US state. The data model changes are in the **harvester configuration layer** — JSON config files and TypeScript interfaces.

## Entity: StateConfig (JSON file)

Replaces the Florida-specific `FloridaCourtsConfig`. One JSON file per state.

### Fields

| Field                  | Type            | Required | Description                              |
| ---------------------- | --------------- | -------- | ---------------------------------------- |
| `state`                | string          | Yes      | Official state name (e.g., "Texas")      |
| `abbreviation`         | string(2)       | Yes      | USPS 2-letter code (e.g., "TX")          |
| `rateLimit`            | RateLimitConfig | No       | Per-state rate limiting (defaults apply) |
| `extractionPromptFile` | string          | No       | Relative path to extraction prompt file  |
| `courts`               | CourtEntry[]    | Yes      | Array of court entries (non-empty)       |

### Validation Rules

- `state` must be non-empty
- `abbreviation` must be exactly 2 uppercase letters
- `courts` must contain at least one entry
- `courts` should have at least one entry with `level: "supreme"`
- No duplicate URLs within the same config (warning, not rejection)

## Entity: CourtEntry (within StateConfig)

A single court in the state's hierarchy.

### Fields

| Field              | Type           | Required | Description                                                                   |
| ------------------ | -------------- | -------- | ----------------------------------------------------------------------------- |
| `url`              | string         | Yes      | Roster page URL                                                               |
| `courtType`        | string         | Yes      | Free-form court type name (per-state naming)                                  |
| `level`            | enum           | Yes      | Structural tier: `"supreme"` \| `"appellate"` \| `"trial"` \| `"specialized"` |
| `label`            | string         | Yes      | Human-readable label for logging and reports                                  |
| `counties`         | string[]       | Yes      | Counties served (empty array = statewide)                                     |
| `district`         | number \| null | No       | District number (appellate courts)                                            |
| `circuit`          | number \| null | No       | Circuit number (circuit courts)                                               |
| `department`       | number \| null | No       | Department number (NY Appellate Division)                                     |
| `division`         | string \| null | No       | Division identifier                                                           |
| `judicialDistrict` | number \| null | No       | Judicial district number                                                      |
| `parentCourt`      | string \| null | No       | Label of parent court for sub-units                                           |
| `fetchMethod`      | enum           | No       | `"http"` (default) \| `"browser"` \| `"manual"`                               |
| `deterministic`    | boolean        | No       | If true, use Cheerio extraction (no LLM)                                      |
| `selectorHint`     | string \| null | No       | CSS selector to narrow HTML before extraction                                 |
| `notes`            | string \| null | No       | Free-form notes (ignored by pipeline)                                         |

### Level Enum Semantics

| Value         | Meaning                                  | Examples                                                                              |
| ------------- | ---------------------------------------- | ------------------------------------------------------------------------------------- |
| `supreme`     | Highest court(s) of the state            | FL Supreme Court, TX Supreme Court, TX Court of Criminal Appeals, NY Court of Appeals |
| `appellate`   | Intermediate appellate courts            | FL DCA, TX Courts of Appeals, CA Courts of Appeal, NY Appellate Division              |
| `trial`       | General jurisdiction trial courts        | FL Circuit Court, TX District Court, CA Superior Court, NY Supreme Court (!)          |
| `specialized` | Limited jurisdiction or specialty courts | NY Family Court, NY Surrogate's Court                                                 |

## Entity: RateLimitConfig (within StateConfig)

Per-state fetch rate limiting.

### Fields

| Field              | Type   | Default | Description                      |
| ------------------ | ------ | ------- | -------------------------------- |
| `fetchDelayMs`     | number | 1500    | Minimum ms between requests      |
| `maxConcurrent`    | number | 1       | Maximum parallel fetches         |
| `requestTimeoutMs` | number | 15000   | Per-request timeout              |
| `maxRetries`       | number | 3       | Retry count on transient failure |

### Validation Rules

- `fetchDelayMs` ≥ 500 (enforce polite scraping)
- `maxConcurrent` ≥ 1
- `requestTimeoutMs` ≥ 5000
- `maxRetries` ≥ 0

## Entity: Checkpoint (per-state)

Existing interface, unchanged. Path changes to per-state:

- Current: `output/checkpoints/harvest-checkpoint.json`
- New: `output/{state-slug}/checkpoints/harvest-checkpoint.json`

## Relationships

```
StateConfig (JSON file, 1 per state)
  └── CourtEntry[] (1:many, flat array)
        └── maps to → Court (Prisma model via court seeder)
              └── Judge[] (1:many, via extraction + import pipeline)

Checkpoint (JSON file, 1 per state)
  └── tracks progress for one StateConfig
```

## Migration from Florida Config

The existing `florida-courts.json` will be migrated from the nested format to the flat `courts[]` format. This is a one-time, mechanical transformation:

| Old Field          | New Mapping                                                        |
| ------------------ | ------------------------------------------------------------------ |
| `supremeCourt`     | Single entry in `courts[]` with `level: "supreme"`                 |
| `districtCourts[]` | Entries in `courts[]` with `level: "appellate"` + `district` field |
| `circuitCourts[]`  | Entries in `courts[]` with `level: "trial"` + `circuit` field      |

The old `FloridaCourtsConfig`, `SupremeCourtConfig`, `DistrictCourtConfig`, `CircuitCourtConfig` interfaces are removed. Replaced by the generic `StateConfig` and `CourtEntry` interfaces.
