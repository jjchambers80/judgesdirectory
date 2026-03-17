# Research: Autonomous Harvest Pipeline

**Date**: 2026-03-17  
**Purpose**: Resolve all NEEDS CLARIFICATION items from Technical Context before design.

---

## R-001: Vercel Background Job Execution

**Unknown**: Can the harvest pipeline (which takes 10–30 minutes per state) run as a background process on Vercel?

**Finding**: Vercel serverless functions have hard timeouts (hobby: 60s, pro: 300s). A full state harvest exceeds this. Two viable patterns:

1. **`child_process.spawn()` from API route** — Not viable on Vercel serverless (no persistent processes, functions are ephemeral).
2. **Vercel Background Functions (beta)** — Available on Pro plan via `export const maxDuration = 300` in route config. Still capped at 5 min.
3. **External runner triggered by API** — The API route creates the `HarvestJob` record (QUEUED), then delegates execution to a long-running process outside the serverless boundary.

**Decision**: Use a **hybrid approach**:
- The `POST /api/admin/harvest` route creates the `HarvestJob` record and spawns the harvest script via `child_process.spawn()` in detached mode. In local dev, this works natively. On Vercel, this route will use `maxDuration` and chain state processing across multiple invocations if needed, OR the harvest can be run via the CLI (`npx tsx scripts/harvest/index.ts --state SC --job-id <id>`) triggered by a GitHub Actions workflow or external scheduler for production.
- The runner updates the `HarvestJob` record in the DB as it progresses (via Prisma), so polling works regardless of where the runner executes.
- For the MVP, local dev + CLI execution with `--job-id` is sufficient. Vercel-native background execution can be added later.

**Rationale**: This avoids coupling the architecture to Vercel's limitations while maintaining the admin UI polling pattern. The DB is the coordination point, not the process boundary.

**Alternatives Rejected**:
- BullMQ/Redis queue: Adds infrastructure dependency (violates Principle V simplicity).
- Vercel Edge Functions: No Node.js API access (can't run Prisma or child processes).

---

## R-002: Vercel Cron Configuration

**Unknown**: How to configure annual scheduled harvests on Vercel with secret-based auth?

**Finding**: Vercel Cron Jobs are configured in `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/harvest",
      "schedule": "0 6 1 1 *"
    }
  ]
}
```

- Schedule `0 6 1 1 *` = January 1st at 6:00 AM UTC (annually).
- Vercel automatically sends `Authorization: Bearer <CRON_SECRET>` header.
- The route handler validates: `request.headers.get('authorization') === \`Bearer \${process.env.CRON_SECRET}\``
- Hobby plan: 2 cron jobs max, daily minimum frequency. Pro: 40 crons, per-minute.
- The cron endpoint itself must complete within the function timeout. It should create `HarvestJob` records and dispatch execution (not run harvests inline).

**Decision**: Configure cron in `vercel.json` with annual schedule. The cron route creates HarvestJob records for stale states and triggers execution (CLI or chained invocations). `CRON_SECRET` env var secures the endpoint.

**Rationale**: Zero-infrastructure scheduling. Vercel manages the trigger; the route is stateless.

---

## R-003: Judge Upsert Strategy (Identity Resolution → DB)

**Unknown**: How to reconcile the 5-tier in-memory identity hierarchy with Prisma's `[courtId, slug]` unique constraint?

**Finding**: The existing system works in two phases:
1. **In-pipeline dedup** (before DB write): `deduplicator.ts` uses identity-based grouping to merge duplicates within a single harvest run.
2. **DB upsert** (on write): Uses `courtId + slug` as the unique key for Prisma upsert.

This means identity resolution handles cross-page dedup (same judge on multiple URLs), while `courtId + slug` handles persistence-level uniqueness. They complement each other.

**Decision**: Retain both layers in the direct-to-DB pipeline:
1. Harvest runs → deduplicator (identity-based) → merged records
2. Merged records → `db-writer.ts` → Prisma `judge.upsert({ where: { courtId_slug: { courtId, slug } } })`
3. On upsert update: preserve `status`, `autoVerified`, `verifiedAt` (same pattern as existing import)
4. Link new/updated judges to `harvestJobId` instead of `importBatchId`

Court resolution logic from `scripts/import/court-resolver.ts` is absorbed into `db-writer.ts` (same cache-based lookup pattern: state → county → court).

**Rationale**: The existing architecture already separates these concerns well. Direct-to-DB merely removes the CSV intermediary without changing the dedup or upsert logic.

---

## R-004: JSON Config → UrlCandidate Migration

**Unknown**: How to migrate the ~200 URLs from 4 JSON configs into the UrlCandidate table?

**Finding**: Each JSON config file has entries like:
```json
{
  "url": "https://1dca.flcourts.gov/Judges",
  "courtType": "District Court of Appeal",
  "level": "appellate",
  "label": "1st District Court of Appeal",
  "fetchMethod": "http",
  "deterministic": "flcourts-next-data"
}
```

The `UrlCandidate` table has: `url`, `domain`, `state`, `stateAbbr`, `suggestedType`, `suggestedLevel`, `confidenceScore`, `status`.

**Decision**: Write a one-time migration script (`scripts/harvest/migrate-json-to-db.ts`) that:
1. Reads each `*-courts.json` file
2. For each entry, upserts a `UrlCandidate` record with:
   - `url`, `domain` (extracted), `state`, `stateAbbr` (from filename)
   - `suggestedType` = `courtType`, `suggestedLevel` = `level`
   - `confidenceScore` = 1.0 (known-good URLs)
   - `status` = `APPROVED` (skip discovery/review — these are production URLs)
   - `scrapeWorthy` = true
   - `fetchMethod` = entry's fetchMethod or "http"
   - `extractionHints` = JSON with deterministic pattern if present
3. Also creates/updates `UrlHealth` records for existing URLs
4. Archives JSON files to `scripts/harvest/legacy/`

**Rationale**: One-time script avoids manual data entry. Setting `status=APPROVED` and `scrapeWorthy=true` ensures zero regression — these URLs are immediately harvestable via the new DB-driven pipeline.

---

## R-005: Background Job Polling Pattern (Next.js App Router)

**Unknown**: Best practice for admin UI polling of background job status?

**Finding**: Standard pattern for Next.js:
- Frontend: `useEffect` with `setInterval` (5s) calling `GET /api/admin/harvest/[jobId]`
- Backend: Simple DB read returning current `HarvestJob` record
- Optimization: Stop polling when status is terminal (COMPLETED or FAILED)
- Alternative (SSE/WebSockets): Over-engineered for admin UI with 1-2 concurrent users

**Decision**: Simple polling via `setInterval` at 5-second intervals:
- Admin triggers harvest → receives `jobId`
- UI polls `GET /api/admin/harvest/[jobId]` every 5s
- Response includes: `status`, `urlsProcessed`, `judgesFound`, `judgesNew`
- Polling stops on terminal status
- Job list page also polls for any RUNNING jobs on mount

**Rationale**: Simplest possible implementation. No WebSocket infrastructure needed. 5s interval is sufficient for a process that takes minutes. Matches Principle V simplicity.

---

## R-006: Enrichment Pipeline in Direct-to-DB Mode

**Unknown**: The existing harvest runs bio enrichment, Ballotpedia enrichment, and Exa enrichment after extraction. Do these still work when writing directly to DB instead of CSV?

**Finding**: The enrichment stages operate on in-memory `EnrichedJudgeRecord[]` arrays. They don't depend on CSV at all — CSV is only the final output. The pipeline flow is:
```
fetch → extract → [bio-enrich] → [ballotpedia-enrich] → [exa-enrich] → normalize → dedup → OUTPUT
```
Currently OUTPUT = CSV. Changing OUTPUT to DB write has zero impact on enrichment stages.

**Decision**: Enrichment pipeline is unchanged. The `db-writer.ts` module receives the same `EnrichedJudgeRecord[]` that currently feeds `Papa.unparse()`. It maps each record to a Prisma upsert call.

**Rationale**: The enrichment pipeline is already decoupled from the output format. This is a clean swap.

---

## R-007: Harvest CSV Output Removal — What About Logs and Reports?

**Unknown**: The harvest currently writes CSV, log files, and markdown reports to `scripts/harvest/output/`. Should all filesystem output be removed?

**Finding**: Three types of output currently written:
1. **CSV** (`{state}-harvest-{timestamp}.csv`): Primary data output → being replaced by DB writes
2. **Log** (`{state}-harvest-{timestamp}.log`): Execution logs → useful for debugging
3. **Report** (`{state}-harvest-{timestamp}.md`): Quality report → being moved to `HarvestJob.reportMarkdown`

**Decision**:
- **CSV output**: Remove entirely (replaced by DB writes)
- **Log files**: Keep writing to filesystem for debugging (no DB storage needed for raw logs)
- **Report markdown**: Write to both `HarvestJob.reportMarkdown` (for admin UI) AND filesystem (for historical archive). Quality report generation in `reporter.ts` will return structured data + markdown string.

**Rationale**: Logs are operational artifacts that don't need DB storage. Reports serve dual purposes (admin viewing + historical record). CSV is fully replaced.
