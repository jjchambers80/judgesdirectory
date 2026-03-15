# Quickstart: URL Discovery & Scrape Failure Tracking

## Prerequisites

- Node.js 20+
- PostgreSQL running locally (`judgesdirectory` database)
- Google Custom Search API key and CX ID configured
- Existing harvest pipeline functional

## Environment Variables

Add to `.env`:

```bash
# Google Custom Search (URL Discovery)
GOOGLE_CSE_API_KEY=your_google_api_key
GOOGLE_CSE_CX=your_custom_search_engine_id
```

Existing variables remain unchanged:

- `DATABASE_URL` — PostgreSQL connection
- `OPENAI_API_KEY` — Used for LLM classification of search results
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — Admin panel auth

## Database Migration

```bash
# Generate and apply the new migration
npx prisma migrate dev --name url_discovery_scrape_tracking
```

This adds three new tables:

- `url_candidates` — Discovered court roster URL candidates
- `scrape_failures` — Harvest failure records
- `discovery_runs` — Discovery run tracking / advisory lock

## Running URL Discovery

```bash
# Discover court roster URLs for a specific state
npx tsx scripts/discovery/discover.ts --state FL

# Preview results without saving (dry run)
npx tsx scripts/discovery/discover.ts --state FL --dry-run
```

## Reviewing Candidates

1. Start the dev server: `npm run dev`
2. Navigate to `http://localhost:3000/admin/discovery/`
3. Filter by state and review candidates
4. Approve or reject candidates individually or in bulk
5. Click "Promote to Config" to generate the state's court configuration file

## Viewing Scrape Failures

1. Navigate to `http://localhost:3000/admin/failures/`
2. Filter by state, failure type, or date range
3. Click "Mark Resolved" on investigated failures

## Failure Tracking in Harvests

Failure tracking is automatic — no additional flags needed. Run harvests as usual:

```bash
npx tsx scripts/harvest/index.ts --state FL
```

Failures are recorded in the `scrape_failures` table. Successful subsequent fetches auto-resolve previous failures for the same URL.

## Maintenance

```bash
# Purge resolved failure records older than 90 days
npx tsx scripts/maintenance/purge-failures.ts

# Preview what would be purged
npx tsx scripts/maintenance/purge-failures.ts --dry-run
```

## Verification Checklist

### 1. Database Migration

```bash
npx prisma migrate dev
```

**Expected**: Migration `20260315051901_url_discovery_scrape_tracking` applies. Three new tables created: `url_candidates`, `scrape_failures`, `discovery_runs`. Prisma Client regenerated.

### 2. Discovery CLI — Dry Run

```bash
npx tsx scripts/discovery/discover.ts --state FL --dry-run
```

**Expected**: Queries Google CSE for Florida court rosters (3 queries: supreme, appellate, trial). Displays classified candidates in terminal with confidence scores. No database writes. Requires `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX` in `.env`.

### 3. Discovery CLI — Live Run

```bash
npx tsx scripts/discovery/discover.ts --state FL
```

**Expected**: Same as dry run but upserts candidates into `url_candidates` table. Creates a `discovery_runs` record tracking queries run, candidates found, and new candidates. Verify with `npx prisma studio` → url_candidates table.

### 4. Admin Discovery Page

```bash
npm run dev
# Navigate to http://localhost:3000/admin/discovery/
```

**Expected**: Table showing discovered candidates with columns: URL, State, Type, Level, Confidence (color-coded badge), Status, Date. Filter dropdowns for state and status. Approve/Reject buttons per row. Bulk selection checkboxes. "Promote to Config" button when state is filtered.

### 5. Approve/Reject Workflow

**Expected**: Click Approve → status changes to APPROVED, row updates. Click Reject → prompts for rejection reason → status changes to REJECTED. Bulk select multiple → Bulk Approve/Reject applies to all selected.

### 6. Promote to Config

**Expected**: With state filter set and approved candidates present, click "Promote to Config". Creates/updates `scripts/harvest/{state}-courts.json` with new court entries. Shows summary: entries added, existing, total.

### 7. Failure Tracking in Harvests

```bash
npx tsx scripts/harvest/index.ts --state FL
```

**Expected**: Harvest runs as normal. Any fetch/extraction errors automatically recorded in `scrape_failures` table with classified failure type (HTTP_ERROR, TIMEOUT, CAPTCHA, BLOCKED, EMPTY_PAGE, PARSE_ERROR, UNKNOWN). Successful re-fetches auto-resolve previous failures for the same URL.

### 8. Admin Failures Page

```bash
# Navigate to http://localhost:3000/admin/failures/
```

**Expected**: Summary cards showing total unresolved failures and breakdown by type. Table with columns: URL, State, Failure Type (colored badge), HTTP Code, Error (truncated), Retries, Date, Status. Filters for state, failure type, resolved/unresolved, date range.

### 9. Mark Resolved

**Expected**: Click "Mark Resolved" on unresolved row → prompts for optional resolution notes → failure marked as resolved with green indicator. Already-resolved rows show resolved status without action button.

### 10. Dashboard Navigation

```bash
# Navigate to http://localhost:3000/admin/
```

**Expected**: Admin dashboard shows "URL Discovery" and "Scrape Failures" cards linking to respective pages. Nav bar on all admin pages shows "Discovery" and "Failures" links after "Courts".

### 11. Purge Maintenance

```bash
# Preview resolved failures older than 90 days
npx tsx scripts/maintenance/purge-failures.ts --dry-run

# Actually purge
npx tsx scripts/maintenance/purge-failures.ts
```

**Expected**: Dry run reports count of resolved failures older than 90 days without deleting. Live run deletes them and reports count.
