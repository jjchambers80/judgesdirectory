# Data Model: URL Health Scoring & Delta-Run Prioritization

**Feature**: 012-url-health  
**Date**: 2026-03-15

## Entity Relationship

```
UrlHealth (1) ──── (N) ScrapeLog
   │
   └── url (unique, canonical harvest URL)
```

## Entities

### UrlHealth

Tracks the cumulative health profile of a single harvest URL. One record per unique URL, regardless of origin (discovered via search or manually configured).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto | Primary key |
| url | String | UNIQUE, NOT NULL | Canonical harvest URL |
| domain | String | NOT NULL | URL domain (e.g., `flcourts.gov`) |
| state | String | NOT NULL | Full state name |
| stateAbbr | String(2) | NOT NULL | Two-letter abbreviation |
| healthScore | Float | NOT NULL, DEFAULT 0.5 | Composite score 0.0–1.0 |
| totalScrapes | Int | NOT NULL, DEFAULT 0 | Total harvest attempts |
| successfulScrapes | Int | NOT NULL, DEFAULT 0 | Successful extractions |
| lastYield | Int | NULL | Judges found on most recent successful scrape |
| avgYield | Float | NULL | Rolling average yield over last 10 successful scrapes |
| yieldTrend | Enum | NOT NULL, DEFAULT STABLE | IMPROVING, STABLE, DECLINING |
| anomalyDetected | Boolean | NOT NULL, DEFAULT false | True when yield drops >50% vs rolling avg |
| anomalyMessage | String | NULL | Human-readable anomaly description |
| lastScrapedAt | DateTime | NULL | Timestamp of most recent scrape attempt |
| lastSuccessAt | DateTime | NULL | Timestamp of most recent successful scrape |
| source | Enum | NOT NULL, DEFAULT MANUAL | DISCOVERED or MANUAL |
| active | Boolean | NOT NULL, DEFAULT true | False when URL removed from config |
| createdAt | DateTime | NOT NULL, auto | Record creation |
| updatedAt | DateTime | NOT NULL, auto | Last update |

**Indexes**:
- `url` (UNIQUE)
- `stateAbbr, healthScore`
- `healthScore`
- `lastSuccessAt`
- `anomalyDetected`
- `active`

**Relationships**:
- Has many ScrapeLog entries (via `urlHealthId` FK)

---

### ScrapeLog

Records every harvest attempt against a URL — both successes and failures. Replaces the ScrapeFailure table (Feature 011).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | UUID | PK, auto | Primary key |
| urlHealthId | UUID | FK → UrlHealth, NOT NULL | Parent health record |
| url | String | NOT NULL | Harvest URL (denormalized for query convenience) |
| state | String | NOT NULL | Full state name |
| stateAbbr | String(2) | NOT NULL | Two-letter abbreviation |
| success | Boolean | NOT NULL | Whether extraction succeeded |
| judgesFound | Int | NOT NULL, DEFAULT 0 | Judge count from this scrape |
| failureType | Enum | NULL | FailureType enum (HTTP_403, TIMEOUT, etc.) — null when success=true |
| httpStatusCode | Int | NULL | HTTP response code |
| errorMessage | String | NULL | Error details |
| retryCount | Int | NOT NULL, DEFAULT 0 | Number of retries attempted |
| scrapeDurationMs | Int | NULL | Wall-clock time for fetch+extract |
| resolvedAt | DateTime | NULL | When failure was resolved |
| resolvedBy | String | NULL | "auto" or admin username |
| resolutionNotes | String | NULL | Resolution context |
| scrapedAt | DateTime | NOT NULL, auto | When this attempt occurred |
| createdAt | DateTime | NOT NULL, auto | Record creation |
| updatedAt | DateTime | NOT NULL, auto | Last update |

**Indexes**:
- `urlHealthId` (FK lookup)
- `url`
- `stateAbbr, success`
- `failureType`
- `scrapedAt`
- `resolvedAt`

**Relationships**:
- Belongs to one UrlHealth (via `urlHealthId`)

---

### Enum: YieldTrend

| Value | Description |
|-------|-------------|
| IMPROVING | Recent 3-scrape avg > previous 3-scrape avg × 1.2 |
| STABLE | Within ±20% of previous window |
| DECLINING | Recent 3-scrape avg < previous 3-scrape avg × 0.8 |

### Enum: HealthSource

| Value | Description |
|-------|-------------|
| DISCOVERED | URL originated from the discovery pipeline (UrlCandidate) |
| MANUAL | URL was manually added to state config JSON |

### Reused Enum: FailureType (from Feature 011)

HTTP_403, HTTP_429, TIMEOUT, CAPTCHA_DETECTED, SSL_ERROR, DNS_FAILURE, EMPTY_PAGE, PARSE_ERROR, UNKNOWN

---

## Migration Notes

### ScrapeFailure → ScrapeLog Migration

1. Create UrlHealth and ScrapeLog tables
2. For each unique `url` in ScrapeFailure: create a UrlHealth record with `healthScore=0.0`, `totalScrapes=count`, `successfulScrapes=0`, `source=MANUAL`
3. For each ScrapeFailure record: create a ScrapeLog row with `success=false`, `judgesFound=0`, matching all failure fields
4. Update all code referencing ScrapeFailure → ScrapeLog
5. Verify code migration is complete and ScrapeFailure is no longer written to
6. In a **separate, subsequent migration**: drop ScrapeFailure table and remove the model from Prisma schema

### Validation Rules

- `healthScore` must be between 0.0 and 1.0 inclusive
- `judgesFound` must be >= 0
- `failureType` must be null when `success=true`
- `failureType` must be non-null when `success=false`
- `lastYield` must be null when `totalScrapes=0`

### State Transitions

**UrlHealth lifecycle**:
```
Created (neutral 0.5) → Active (score computed) → Archived (active=false)
                                    ↑                    ↓
                                    └── Reactivated ─────┘
```

**Anomaly detection**:
```
Normal (anomalyDetected=false) → Anomaly detected (yield drop >50%)
                                         ↓
                                 Resolved (next scrape yields ≥50% of avg)
```
