# Data Model: Autonomous Harvest Pipeline

**Date**: 2026-03-17  
**Spec**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md)

---

## Schema Changes Overview

| Action | Entity | Description |
|--------|--------|-------------|
| MODIFY | `UrlCandidate` | Add `scrapeWorthy`, `autoClassifiedAt`, `fetchMethod`, `extractionHints` |
| CREATE | `HarvestJob` | New model tracking harvest executions |
| CREATE | `HarvestJobStatus` | New enum for job lifecycle |
| CREATE | `HarvestTrigger` | New enum for trigger source |
| MODIFY | `Judge` | Replace `importBatchId` → `harvestJobId` FK |
| DROP | `ImportBatch` | Remove model entirely |
| DROP | `ImportBatchStatus` | Remove enum entirely |

---

## New & Modified Models

### UrlCandidate (MODIFIED)

New fields added to existing model. Existing fields unchanged.

```prisma
model UrlCandidate {
  // --- EXISTING (unchanged) ---
  id              String          @id @default(uuid())
  url             String          @unique
  domain          String
  state           String
  stateAbbr       String          @db.VarChar(2)
  suggestedType   String?
  suggestedLevel  String?
  confidenceScore Float?
  searchQuery     String
  snippetText     String?         @db.Text
  pageTitle       String?
  status          CandidateStatus @default(DISCOVERED)
  rejectionReason String?         @db.Text
  reviewedAt      DateTime?
  promotedAt      DateTime?
  discoveryRunId  String
  discoveryRun    DiscoveryRun    @relation(fields: [discoveryRunId], references: [id])
  discoveredAt    DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  // --- NEW FIELDS ---
  scrapeWorthy      Boolean?        // null=unclassified, true=worthy, false=not worthy
  autoClassifiedAt  DateTime?       // when auto-classification was applied
  fetchMethod       String          @default("http")   // "http" | "browser"
  extractionHints   Json?           // optional hints for deterministic extraction patterns
  lastYieldCount    Int?            // judges found in most recent harvest (null=never harvested)
  harvestAttempts   Int             @default(0)  // total times this URL has been harvested

  // --- EXISTING INDEXES (unchanged) ---
  @@index([state])
  @@index([status])
  @@index([discoveredAt])
  @@index([stateAbbr, status])
  // --- NEW INDEX ---
  @@index([scrapeWorthy])
  @@map("url_candidates")
}
```

**Field Details**:
- `scrapeWorthy`: tri-state — `null` means unclassified (needs manual review), `true` means auto or manually confirmed for scraping, `false` means classified as non-judicial or zero-yield.
- `autoClassifiedAt`: timestamp of when auto-classification ran (distinguishes from manual override).
- `fetchMethod`: How to fetch the URL. Default `"http"` for standard fetch. `"browser"` for Cloudflare-protected sites (e.g., New York courts).
- `extractionHints`: JSON blob for deterministic extraction patterns, e.g., `{"pattern": "flcourts-next-data"}` or `{"selector": ".judge-roster td.name"}`. Nullable — null means use LLM extraction.

**Query for harvest URL loading**:
```sql
SELECT * FROM url_candidates
WHERE state_abbr = $1
  AND status = 'APPROVED'
  AND (scrape_worthy IS NULL OR scrape_worthy = true)
ORDER BY url;
```

---

### HarvestJob (NEW)

```prisma
model HarvestJob {
  id              String           @id @default(uuid())
  stateAbbr       String           @db.VarChar(2)
  state           String
  status          HarvestJobStatus @default(QUEUED)
  triggeredBy     HarvestTrigger   @default(ADMIN)

  // Metrics (updated during execution)
  urlsTotal       Int              @default(0)
  urlsProcessed   Int              @default(0)
  urlsFailed      Int              @default(0)
  judgesFound     Int              @default(0)
  judgesNew       Int              @default(0)
  judgesUpdated   Int              @default(0)

  // Timing
  startedAt       DateTime?
  completedAt     DateTime?

  // Output
  reportMarkdown  String?          @db.Text
  errorMessage    String?          @db.Text

  // Relations
  judges          Judge[]

  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  @@index([stateAbbr])
  @@index([status])
  @@index([createdAt])
  @@index([stateAbbr, status])
  @@map("harvest_jobs")
}

enum HarvestJobStatus {
  QUEUED
  RUNNING
  COMPLETED
  FAILED
}

enum HarvestTrigger {
  ADMIN
  CRON
  CLI
}
```

**Lifecycle**:
1. Created as `QUEUED` when admin clicks "Start Harvest" or cron fires
2. Transitions to `RUNNING` when the runner starts processing
3. Runner updates `urlsProcessed`, `judgesFound`, `judgesNew`, `judgesUpdated` as it progresses
4. Transitions to `COMPLETED` or `FAILED` on finish
5. `reportMarkdown` written on completion
6. `errorMessage` written on failure

**Concurrency check** (FR-010): Before creating a new job, query:
```sql
SELECT id FROM harvest_jobs
WHERE state_abbr = $1
  AND status IN ('QUEUED', 'RUNNING')
LIMIT 1;
```
If result exists, reject the new job request.

---

### Judge (MODIFIED)

Replace `importBatchId` with `harvestJobId`. All other fields unchanged.

```prisma
model Judge {
  // ... all existing fields unchanged ...

  // REMOVED:
  // importBatchId   String?
  // importBatch     ImportBatch?  @relation(fields: [importBatchId], references: [id], onDelete: SetNull)

  // ADDED:
  harvestJobId    String?
  harvestJob      HarvestJob?   @relation(fields: [harvestJobId], references: [id], onDelete: SetNull)

  // INDEX CHANGED:
  // @@index([importBatchId])  → removed
  @@index([harvestJobId])      // new

  // All other indexes and constraints unchanged:
  // @@unique([courtId, slug])
  // @@index([courtId])
  // @@index([fullName])
  // @@index([status])
}
```

**Migration safety**: Existing judges have `importBatchId` values. The migration must:
1. Add `harvestJobId` column (nullable)
2. Drop `importBatchId` column (existing values are lost — this is acceptable per spec FR-026)
3. Drop `ImportBatch` table
4. Drop `ImportBatchStatus` enum

---

### ImportBatch (DROPPED)

```prisma
// REMOVED ENTIRELY
// model ImportBatch { ... }
// enum ImportBatchStatus { ... }
```

---

## Migration Plan

### Step 1: Add new fields to UrlCandidate
```sql
ALTER TABLE url_candidates ADD COLUMN scrape_worthy BOOLEAN;
ALTER TABLE url_candidates ADD COLUMN auto_classified_at TIMESTAMPTZ;
ALTER TABLE url_candidates ADD COLUMN fetch_method TEXT NOT NULL DEFAULT 'http';
ALTER TABLE url_candidates ADD COLUMN extraction_hints JSONB;
CREATE INDEX idx_url_candidates_scrape_worthy ON url_candidates (scrape_worthy);
```

### Step 2: Create HarvestJob table + enums
```sql
CREATE TYPE "HarvestJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');
CREATE TYPE "HarvestTrigger" AS ENUM ('ADMIN', 'CRON', 'CLI');

CREATE TABLE harvest_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_abbr VARCHAR(2) NOT NULL,
  state TEXT NOT NULL,
  status "HarvestJobStatus" NOT NULL DEFAULT 'QUEUED',
  triggered_by "HarvestTrigger" NOT NULL DEFAULT 'ADMIN',
  urls_total INT NOT NULL DEFAULT 0,
  urls_processed INT NOT NULL DEFAULT 0,
  urls_failed INT NOT NULL DEFAULT 0,
  judges_found INT NOT NULL DEFAULT 0,
  judges_new INT NOT NULL DEFAULT 0,
  judges_updated INT NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  report_markdown TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_harvest_jobs_state_abbr ON harvest_jobs (state_abbr);
CREATE INDEX idx_harvest_jobs_status ON harvest_jobs (status);
CREATE INDEX idx_harvest_jobs_created_at ON harvest_jobs (created_at);
CREATE INDEX idx_harvest_jobs_state_status ON harvest_jobs (state_abbr, status);
```

### Step 3: Swap Judge FK
```sql
-- Add new column
ALTER TABLE judges ADD COLUMN harvest_job_id UUID REFERENCES harvest_jobs(id) ON DELETE SET NULL;
CREATE INDEX idx_judges_harvest_job_id ON judges (harvest_job_id);

-- Drop old column and relation
ALTER TABLE judges DROP CONSTRAINT IF EXISTS judges_import_batch_id_fkey;
DROP INDEX IF EXISTS idx_judges_import_batch_id;
ALTER TABLE judges DROP COLUMN import_batch_id;
```

### Step 4: Drop ImportBatch
```sql
DROP TABLE IF EXISTS import_batches;
DROP TYPE IF EXISTS "ImportBatchStatus";
```

---

## Entity Relationship Diagram

```
DiscoveryRun ──1:N──→ UrlCandidate
                          │
                          │ (scrapeWorthy, status=APPROVED)
                          ▼
                     [Harvest reads]
                          │
                          ▼
HarvestJob ────1:N──→ Judge ──N:1──→ Court ──N:1──→ County ──N:1──→ State
     │
     │ (HarvestJob tracks execution)
     │
     └── status: QUEUED → RUNNING → COMPLETED/FAILED
         metrics: urlsProcessed, judgesNew, judgesUpdated
         output: reportMarkdown

UrlHealth ────1:N──→ ScrapeLog
     │
     │ (delta logic reads lastSuccessAt)
     └── used by scheduled harvests to skip fresh URLs
```

---

## Key Queries

### Load URLs for harvest (db-config-loader)
```typescript
const urls = await prisma.urlCandidate.findMany({
  where: {
    stateAbbr: stateAbbr,
    status: 'APPROVED',
    OR: [
      { scrapeWorthy: null },  // unclassified — include
      { scrapeWorthy: true },  // confirmed worthy
    ],
  },
  orderBy: { url: 'asc' },
});
```

### List harvestable states
```typescript
const states = await prisma.urlCandidate.findMany({
  where: {
    status: 'APPROVED',
    OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
  },
  select: { stateAbbr: true, state: true },
  distinct: ['stateAbbr'],
  orderBy: { state: 'asc' },
});
```

### Check for active job (concurrency guard)
```typescript
const activeJob = await prisma.harvestJob.findFirst({
  where: {
    stateAbbr: stateAbbr,
    status: { in: ['QUEUED', 'RUNNING'] },
  },
});
```

### Judge upsert (db-writer)
```typescript
await prisma.judge.upsert({
  where: { courtId_slug: { courtId, slug } },
  create: {
    courtId,
    slug,
    fullName,
    harvestJobId: jobId,
    status: 'UNVERIFIED',
    // ... all harvest fields
  },
  update: {
    fullName,
    harvestJobId: jobId,
    lastHarvestAt: new Date(),
    // ... updatable fields
    // PRESERVE: status, autoVerified, verifiedAt (not included in update)
  },
});
```

### Delta check for scheduled harvests
```typescript
const staleUrls = await prisma.urlHealth.findMany({
  where: {
    stateAbbr: stateAbbr,
    active: true,
    OR: [
      { lastSuccessAt: null },  // never scraped
      { lastSuccessAt: { lt: freshnessThreshold } },  // stale
    ],
  },
});
```
