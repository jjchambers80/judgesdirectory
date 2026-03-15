# Data Model: URL Discovery & Scrape Failure Tracking

**Date**: 2026-03-15  
**Status**: Complete

## New Enums

### CandidateStatus

```prisma
enum CandidateStatus {
  DISCOVERED
  APPROVED
  REJECTED
}
```

**Note**: "Stale" is computed at query time (`status = DISCOVERED AND discoveredAt < NOW() - 30 days`), not a persisted enum value.

### FailureType

```prisma
enum FailureType {
  HTTP_403
  HTTP_429
  TIMEOUT
  CAPTCHA_DETECTED
  SSL_ERROR
  DNS_FAILURE
  EMPTY_PAGE
  PARSE_ERROR
  UNKNOWN
}
```

### DiscoveryRunStatus

```prisma
enum DiscoveryRunStatus {
  RUNNING
  COMPLETED
  FAILED
}
```

## New Models

### UrlCandidate

A potential court roster URL discovered via Google Custom Search, pending human review.

```prisma
model UrlCandidate {
  id               String           @id @default(uuid())
  url              String           @unique
  domain           String           // e.g., "courts.ca.gov"
  state            String           // State name (e.g., "California")
  stateAbbr        String           @db.VarChar(2) // "CA"
  suggestedType    String?          // e.g., "Circuit Court"
  suggestedLevel   String?          // "supreme" | "appellate" | "trial" | "specialized"
  confidenceScore  Float?           // 0.0–1.0 from LLM classification
  searchQuery      String           // The query that found this URL
  snippetText      String?          @db.Text // Search result snippet
  pageTitle        String?          // Search result title
  status           CandidateStatus  @default(DISCOVERED)
  rejectionReason  String?          @db.Text
  reviewedAt       DateTime?        // When approved/rejected
  promotedAt       DateTime?        // When added to state config
  discoveryRunId   String
  discoveryRun     DiscoveryRun     @relation(fields: [discoveryRunId], references: [id])
  discoveredAt     DateTime         @default(now())
  updatedAt        DateTime         @updatedAt

  @@index([state])
  @@index([status])
  @@index([discoveredAt])
  @@index([stateAbbr, status])
  @@map("url_candidates")
}
```

**Relationships**: Belongs to a DiscoveryRun.  
**Validation**: URL must be unique (enforced at DB level). State abbreviation is 2 uppercase chars.  
**Staleness**: Computed — `status = DISCOVERED AND discoveredAt < NOW() - INTERVAL '30 days'`.

### ScrapeFailure

A record of a failed fetch or extraction attempt during a harvest run.

```prisma
model ScrapeFailure {
  id              String       @id @default(uuid())
  url             String       // The URL that failed
  state           String       // State name
  stateAbbr       String       @db.VarChar(2)
  failureType     FailureType
  httpStatusCode  Int?         // e.g., 403, 429, 200 (for empty page)
  errorMessage    String?      @db.Text
  retryCount      Int          @default(0)
  attemptedAt     DateTime     @default(now())
  resolvedAt      DateTime?    // Set when URL later succeeds, or admin marks resolved
  resolvedBy      String?      // "auto" (harvest success) or "manual" (admin action)
  resolutionNotes String?      @db.Text
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt

  @@index([url])
  @@index([state])
  @@index([failureType])
  @@index([resolvedAt])
  @@index([stateAbbr, failureType])
  @@index([attemptedAt])
  @@map("scrape_failures")
}
```

**Relationships**: None (standalone — URLs may not exist in any other table).  
**Note**: Multiple failure records can exist per URL (one per harvest run). No unique constraint on `url` — this is intentional for historical tracking.  
**Retention**: Resolved records older than 90 days are eligible for purge.

### DiscoveryRun

Tracks a single execution of the URL discovery CLI command. Serves as an advisory lock (only one RUNNING at a time).

```prisma
model DiscoveryRun {
  id             String              @id @default(uuid())
  state          String              // Target state
  stateAbbr      String              @db.VarChar(2)
  status         DiscoveryRunStatus  @default(RUNNING)
  queriesRun     Int                 @default(0)
  candidatesFound Int                @default(0)
  candidatesNew  Int                 @default(0) // Excluding duplicates
  startedAt      DateTime            @default(now())
  completedAt    DateTime?
  errorMessage   String?             @db.Text
  candidates     UrlCandidate[]
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt

  @@index([status])
  @@index([state])
  @@index([startedAt])
  @@map("discovery_runs")
}
```

**Advisory lock**: Before starting, check `WHERE status = 'RUNNING' AND startedAt > NOW() - INTERVAL '1 hour'`. If found, abort. Records older than 1 hour with RUNNING status are stale locks — mark as FAILED on startup.

## Existing Model Changes

### StateConfigSchema (Zod — `scripts/harvest/state-config-schema.ts`)

Update `fetchDelayMs` default from `1500` to `2000`:

```typescript
// Before
fetchDelayMs: z.number().min(500).default(1500),

// After
fetchDelayMs: z.number().min(500).default(2000),
```

No other existing model changes required.

## Entity Relationship Summary

```text
DiscoveryRun  1───*  UrlCandidate
ScrapeFailure        (standalone — no FK relationships)

Existing models (State, County, Court, Judge) are NOT modified.
```

## Indexes Rationale

| Index                              | Purpose                                     |
| ---------------------------------- | ------------------------------------------- |
| `url_candidates.url`               | Unique constraint for deduplication         |
| `url_candidates.state`             | Filter by state in admin UI                 |
| `url_candidates.status`            | Filter by status in admin UI                |
| `url_candidates.stateAbbr, status` | Compound filter for state+status queries    |
| `scrape_failures.url`              | Lookup by URL for auto-resolution           |
| `scrape_failures.state`            | Filter by state in admin UI                 |
| `scrape_failures.failureType`      | Filter by failure type in admin UI          |
| `scrape_failures.resolvedAt`       | Purge query (resolved + older than 90 days) |
| `scrape_failures.attemptedAt`      | Date range filtering in admin UI            |
| `discovery_runs.status`            | Advisory lock check (RUNNING status)        |
