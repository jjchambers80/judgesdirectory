# API Contracts: Autonomous Harvest Pipeline

**Date**: 2026-03-17  
**Spec**: [spec.md](spec.md)

---

## Endpoints Summary

| Method | Path | Auth | Description | FRs |
|--------|------|------|-------------|-----|
| POST | `/api/admin/harvest` | Basic Auth | Trigger harvest for a state | FR-007, FR-010, FR-011 |
| GET | `/api/admin/harvest` | Basic Auth | List harvest jobs | FR-009, FR-015, FR-022 |
| GET | `/api/admin/harvest/[jobId]` | Basic Auth | Get job details + report | FR-009, FR-022 |
| GET | `/api/admin/harvest/states` | Basic Auth | List harvestable states | FR-001, FR-011 |
| POST | `/api/cron/harvest` | CRON_SECRET | Trigger annual delta harvest | FR-016, FR-017, FR-018 |
| PATCH | `/api/admin/discovery/[id]` | Basic Auth | Override scrape-worthiness | FR-004 |

---

## POST `/api/admin/harvest`

Triggers a new harvest job for a given state. The job runs in the background.

**File**: `src/app/api/admin/harvest/route.ts`

### Request

```typescript
// Body
{
  stateAbbr: string  // two-letter state abbreviation, e.g. "SC"
}
```

### Response

**201 Created** — Job created and queued

```typescript
{
  id: string           // UUID
  stateAbbr: string
  state: string
  status: "QUEUED"
  triggeredBy: "ADMIN"
  createdAt: string    // ISO 8601
}
```

**409 Conflict** — Active job already exists for this state (FR-010)

```typescript
{
  error: "HARVEST_ALREADY_ACTIVE"
  message: "A harvest job is already running for {state}"
  activeJobId: string
  activeJobStatus: "QUEUED" | "RUNNING"
}
```

**422 Unprocessable Entity** — No approved URLs for this state (FR-011)

```typescript
{
  error: "NO_APPROVED_URLS"
  message: "No approved URLs found for {stateAbbr}. Run discovery first."
}
```

**401 Unauthorized** — Missing or invalid Basic Auth

### Behavior

1. Validate `stateAbbr` is a valid two-letter US state code
2. Check for active jobs (QUEUED or RUNNING) for this state
3. Check that at least one APPROVED URL exists for this state (with scrapeWorthy != false)
4. Create `HarvestJob` record with status QUEUED
5. Spawn background harvest runner (child_process.spawn in dev, CLI invocation in prod)
6. Return the created job

---

## GET `/api/admin/harvest`

Lists harvest jobs with optional filtering. Used for the harvest history table and real-time polling.

**File**: `src/app/api/admin/harvest/route.ts`

### Query Parameters

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `stateAbbr` | string | — | Filter by state |
| `status` | string | — | Filter by status (comma-separated: `RUNNING,QUEUED`) |
| `limit` | number | 20 | Max results |
| `offset` | number | 0 | Pagination offset |

### Response

**200 OK**

```typescript
{
  jobs: Array<{
    id: string
    stateAbbr: string
    state: string
    status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"
    triggeredBy: "ADMIN" | "CRON" | "CLI"
    urlsTotal: number
    urlsProcessed: number
    urlsFailed: number
    judgesFound: number
    judgesNew: number
    judgesUpdated: number
    startedAt: string | null
    completedAt: string | null
    createdAt: string
  }>
  total: number
}
```

### Polling

The admin UI polls this endpoint every 5 seconds when any job has status `QUEUED` or `RUNNING` (FR-009).

```typescript
// Client-side polling
const { data } = useSWR(
  `/api/admin/harvest?stateAbbr=${stateAbbr}&status=QUEUED,RUNNING`,
  { refreshInterval: activeJobs.length > 0 ? 5000 : 0 }
);
```

---

## GET `/api/admin/harvest/[jobId]`

Returns full job details including the report markdown.

**File**: `src/app/api/admin/harvest/[jobId]/route.ts`

### Response

**200 OK**

```typescript
{
  id: string
  stateAbbr: string
  state: string
  status: "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED"
  triggeredBy: "ADMIN" | "CRON" | "CLI"
  urlsTotal: number
  urlsProcessed: number
  urlsFailed: number
  judgesFound: number
  judgesNew: number
  judgesUpdated: number
  startedAt: string | null
  completedAt: string | null
  errorMessage: string | null
  reportMarkdown: string | null   // full report content (FR-021, FR-022)
  createdAt: string
  updatedAt: string
}
```

**404 Not Found**

```typescript
{
  error: "JOB_NOT_FOUND"
  message: "Harvest job {jobId} not found"
}
```

---

## GET `/api/admin/harvest/states`

Returns states that are eligible for harvesting (have approved, scrape-worthy URLs).

**File**: `src/app/api/admin/harvest/states/route.ts`

### Response

**200 OK**

```typescript
{
  states: Array<{
    stateAbbr: string
    state: string
    approvedUrlCount: number
    lastHarvestAt: string | null      // most recent completed job
    lastHarvestStatus: string | null  // COMPLETED or FAILED
    hasActiveJob: boolean
    activeJobId: string | null
  }>
}
```

### Query

```typescript
// Aggregate approved URLs per state + latest harvest job
const states = await prisma.urlCandidate.groupBy({
  by: ['stateAbbr', 'state'],
  where: {
    status: 'APPROVED',
    OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
  },
  _count: { id: true },
});
// Then join with latest HarvestJob per state
```

---

## POST `/api/cron/harvest`

Vercel Cron endpoint for annual delta harvests. Authenticated via `CRON_SECRET` header.

**File**: `src/app/api/cron/harvest/route.ts`

### Request

```typescript
// Headers
{
  "Authorization": "Bearer ${CRON_SECRET}"
}
// No body required
```

### Vercel Config

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/harvest",
      "schedule": "0 3 1 * *"
    }
  ]
}
```

Schedule: 3:00 AM UTC on the 1st of every month. The endpoint itself determines which states are stale (>11 months since last harvest) per FR-018.

### Response

**200 OK**

```typescript
{
  statesChecked: number
  statesStale: number
  jobsCreated: Array<{
    id: string
    stateAbbr: string
    state: string
  }>
  statesSkipped: Array<{
    stateAbbr: string
    reason: "fresh" | "active_job"
    lastHarvestAt: string | null
  }>
}
```

**401 Unauthorized** — Missing or invalid CRON_SECRET (FR-017)

```typescript
{
  error: "UNAUTHORIZED"
  message: "Invalid or missing cron secret"
}
```

### Behavior

1. Validate `Authorization: Bearer ${CRON_SECRET}` header
2. Query all states with approved URLs
3. For each state, check most recent COMPLETED harvest job date
4. If last harvest > 11 months ago (or never harvested): create a QUEUED job
5. If an active job exists for that state: skip
6. Spawn runners for all queued jobs sequentially (FR-020)
7. Return summary

### Staleness Check

```typescript
const FRESHNESS_MONTHS = 11;
const threshold = new Date();
threshold.setMonth(threshold.getMonth() - FRESHNESS_MONTHS);

const lastJob = await prisma.harvestJob.findFirst({
  where: {
    stateAbbr: state.stateAbbr,
    status: 'COMPLETED',
  },
  orderBy: { completedAt: 'desc' },
});

const isStale = !lastJob || !lastJob.completedAt || lastJob.completedAt < threshold;
```

---

## PATCH `/api/admin/discovery/[id]`

Updates scrape-worthiness classification for a URL candidate (admin override).

**File**: `src/app/api/admin/discovery/[id]/route.ts`

### Request

```typescript
// Body
{
  scrapeWorthy: boolean | null  // true, false, or null to reset to unclassified
}
```

### Response

**200 OK**

```typescript
{
  id: string
  url: string
  scrapeWorthy: boolean | null
  autoClassifiedAt: string | null  // cleared if admin overrides
  updatedAt: string
}
```

**404 Not Found**

```typescript
{
  error: "CANDIDATE_NOT_FOUND"
}
```

### Behavior

1. Find candidate by ID
2. Update `scrapeWorthy` field
3. If admin is overriding (not restoring auto value), set `autoClassifiedAt` to null (indicates manual override)
4. Return updated candidate

---

## Internal: Harvest Runner Protocol

Not an HTTP endpoint — this is the internal protocol between the API route and the background harvest runner.

### Invocation

```typescript
// Development (child_process.spawn)
const proc = spawn('npx', ['tsx', 'scripts/harvest/runner.ts', '--job-id', jobId], {
  detached: true,
  stdio: 'ignore',
  env: { ...process.env },
});
proc.unref();

// Production CLI
// npx tsx scripts/harvest/runner.ts --job-id <uuid>
```

### Runner Lifecycle

1. Read `HarvestJob` by ID, set status → RUNNING, set startedAt
2. Load URLs from `UrlCandidate` for the job's state
3. For each URL: fetch → extract → normalize → deduplicate
4. Write judges to DB via upsert (courtId_slug key)
5. Update job metrics periodically (urlsProcessed, judgesFound, etc.)
6. On completion: generate report markdown, set status → COMPLETED, set completedAt
7. On failure: set status → FAILED, set errorMessage

### Progress Updates

The runner updates the HarvestJob record in the database as it progresses, enabling the API's polling endpoint to reflect real-time status:

```typescript
// After each URL batch (e.g., every 5 URLs)
await prisma.harvestJob.update({
  where: { id: jobId },
  data: {
    urlsProcessed: processedCount,
    judgesFound: foundCount,
    judgesNew: newCount,
    judgesUpdated: updatedCount,
  },
});
```

---

## Removed Endpoints

The following endpoints are removed as part of FR-024/FR-025:

| Method | Path | Reason |
|--------|------|--------|
| POST | `/api/admin/import/upload` | CSV import removed |
| POST | `/api/admin/import/process` | CSV import removed |
| GET | `/api/admin/import/batches` | Import batch management removed |
| GET | `/api/admin/import/batches/[id]` | Import batch details removed |
| POST | `/api/admin/import/batches/[id]/rollback` | Batch rollback removed |
