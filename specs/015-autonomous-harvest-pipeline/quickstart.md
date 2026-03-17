# Quickstart: Autonomous Harvest Pipeline

**Date**: 2026-03-17  
**Feature Branch**: `015-autonomous-harvest-pipeline`

---

## Prerequisites

- Node.js 18+
- PostgreSQL running locally
- `.env` with `DATABASE_URL`, `OPENAI_API_KEY`
- Existing discovery data (URL candidates in the database)

## Getting Started

```bash
# 1. Switch to feature branch
git checkout 015-autonomous-harvest-pipeline

# 2. Install dependencies (if any new ones added)
npm install

# 3. Run migrations (adds HarvestJob model, UrlCandidate fields, drops ImportBatch)
npx prisma migrate dev

# 4. Generate Prisma client
npx prisma generate

# 5. Seed existing JSON configs into DB (one-time migration)
npx tsx scripts/harvest/migrate-configs.ts
```

## Key File Locations

### New Files

| File | Purpose |
|------|---------|
| `src/app/api/admin/harvest/route.ts` | POST: trigger harvest, GET: list jobs |
| `src/app/api/admin/harvest/[jobId]/route.ts` | GET: job details + report |
| `src/app/api/admin/harvest/states/route.ts` | GET: harvestable states list |
| `src/app/api/cron/harvest/route.ts` | POST: annual delta cron trigger |
| `src/app/admin/harvest/page.tsx` | Admin harvest UI (trigger + monitor) |
| `scripts/harvest/runner.ts` | Background harvest runner (entry point) |
| `scripts/harvest/db-config-loader.ts` | Load URLs from DB instead of JSON |
| `scripts/harvest/db-writer.ts` | Write judges directly to DB |
| `scripts/harvest/report-generator.ts` | Generate markdown harvest reports |

### Modified Files

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add HarvestJob model, modify UrlCandidate, modify Judge FK, drop ImportBatch |
| `scripts/harvest/index.ts` | Refactor to call runner.ts core logic |
| `scripts/discovery/classifier.ts` | Add scrape-worthiness scoring |
| `scripts/discovery/config-promoter.ts` | Remove JSON file write |
| `src/app/admin/layout.tsx` | Remove import nav link, add harvest nav link |

### Deleted Files

| File | Reason |
|------|--------|
| `src/app/admin/import/**` | CSV import UI removed |
| `src/app/api/admin/import/**` | CSV import API removed |
| `src/lib/csv-*` | CSV utilities removed |
| `scripts/import/**` | Import bridge scripts removed |
| `scripts/harvest/*-courts.json` | JSON configs → DB |

## Development Workflow

### Trigger a harvest locally

```bash
# Option A: Via CLI (direct)
npx tsx scripts/harvest/runner.ts --state SC

# Option B: Via API (simulates admin UI flow)
curl -X POST http://localhost:3000/api/admin/harvest \
  -u admin:password \
  -H 'Content-Type: application/json' \
  -d '{"stateAbbr": "SC"}'
```

### Check harvest status

```bash
# List active jobs
curl http://localhost:3000/api/admin/harvest?status=RUNNING,QUEUED -u admin:password

# Get specific job details + report
curl http://localhost:3000/api/admin/harvest/{jobId} -u admin:password
```

### Test cron endpoint

```bash
curl -X POST http://localhost:3000/api/cron/harvest \
  -H "Authorization: Bearer ${CRON_SECRET}"
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `OPENAI_API_KEY` | Yes | For LLM extraction + classification |
| `CRON_SECRET` | Prod | Secret for cron endpoint auth |
| `ANTHROPIC_API_KEY` | No | Alternate LLM provider |
| `BRAVE_API_KEY` | No | For discovery (not harvest) |

## Testing

```bash
# Run Prisma migrations
npx prisma migrate dev

# Verify schema changes
npx prisma studio  # browse HarvestJob, check UrlCandidate fields

# Run a small-state harvest to validate end-to-end
npx tsx scripts/harvest/runner.ts --state SC --dry-run  # if dry-run supported

# Check that import routes are gone
curl -I http://localhost:3000/api/admin/import/upload  # expect 404
```

## Implementation Order

1. **Schema migration** — Add HarvestJob, modify UrlCandidate, swap Judge FK, drop ImportBatch
2. **db-config-loader.ts** — Replace JSON loading with DB queries
3. **db-writer.ts** — Absorb court-resolver + csv-importer logic into direct DB writes
4. **runner.ts** — Refactor harvest core into job-aware runner
5. **API routes** — POST/GET harvest endpoints
6. **Admin UI** — Harvest page with state selector + job monitor
7. **Cron endpoint** — Annual delta scheduling
8. **Delete CSV import** — Remove all import files, routes, nav links
9. **Classifier update** — Add scrape-worthiness to discovery flow
10. **Report generator** — Markdown report on job completion
