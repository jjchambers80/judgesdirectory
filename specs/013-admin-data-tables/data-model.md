# Data Model: Admin Data Tables

**Feature**: 013-admin-data-tables  
**Date**: 2026-03-15

> No Prisma schema changes. This document defines the column definitions for each DataTable migration — the TypeScript-level "data model" that drives the table component.

## Column Definition Schema

Each table migration defines an array of `ColumnDef<TData>` objects (from `@tanstack/react-table`). The schema below describes the metadata convention used across all 6 tables.

```
ColumnDef {
  id: string                    — unique column identifier
  accessorKey | accessorFn      — data accessor (field name or function)
  header: string | Component    — display text or sortable header component
  cell: Component               — custom cell renderer (badges, links, actions)
  enableSorting: boolean        — whether column header is clickable for sorting
  enableColumnFilter: boolean   — whether column appears in toolbar filter bar
  meta.filterVariant: "text" | "select" | "none"
                                — which filter UI to render for this column
  meta.serverSortField: string? — API sort param value (for server-side tables)
}
```

## Table 1: URL Discovery

**Data source**: `GET /api/admin/discovery` (server-side sort/filter/page)  
**Row type**: `UrlCandidate` (enriched with `isStale: boolean`)  
**Row selection**: Yes (bulk approve/reject)

| Column ID       | Accessor             | Header     | Sortable | Filter                                         | Server Sort Field |
| --------------- | -------------------- | ---------- | -------- | ---------------------------------------------- | ----------------- |
| select          | —                    | Checkbox   | No       | None                                           | —                 |
| url             | `url`                | URL        | Yes      | text                                           | `url`             |
| stateAbbr       | `stateAbbr`          | State      | Yes      | select (2-char values)                         | `stateAbbr`       |
| suggestedType   | `suggestedType`      | Type       | No       | select                                         | —                 |
| suggestedLevel  | `suggestedLevel`     | Level      | No       | select                                         | —                 |
| confidenceScore | `confidenceScore`    | Confidence | Yes      | None                                           | `confidenceScore` |
| status          | `status` + `isStale` | Status     | Yes      | select (DISCOVERED, APPROVED, REJECTED, STALE) | `status`          |
| discoveredAt    | `discoveredAt`       | Discovered | Yes      | None                                           | `discoveredAt`    |
| actions         | —                    | Actions    | No       | None                                           | —                 |

**Custom cell renderers**:

- `url` → truncated link + domain subtitle
- `confidenceScore` → color-coded badge (green ≥0.8, yellow ≥0.5, red <0.5)
- `status` → color-coded badge (stale=orange, discovered=blue, approved=green, rejected=red)
- `actions` → Approve/Reject buttons (only when status=DISCOVERED)

## Table 2: URL Health

**Data source**: `GET /api/admin/health` (server-side sort/filter/page)  
**Row type**: `UrlHealth`  
**Row selection**: No  
**Special**: Expandable rows (click to show scrape history)

| Column ID     | Accessor        | Header       | Sortable | Filter                                                   | Server Sort Field |
| ------------- | --------------- | ------------ | -------- | -------------------------------------------------------- | ----------------- |
| url           | `url`           | URL          | Yes      | text                                                     | `url`             |
| healthScore   | `healthScore`   | Score        | Yes      | None                                                     | `healthScore`     |
| yieldTrend    | `yieldTrend`    | Trend        | No       | select (IMPROVING, STABLE, DECLINING)                    | —                 |
| totalScrapes  | `totalScrapes`  | Scrapes      | Yes      | None                                                     | `totalScrapes`    |
| lastYield     | `lastYield`     | Yield        | Yes      | None                                                     | `lastYield`       |
| lastScrapedAt | `lastScrapedAt` | Last Scraped | Yes      | None                                                     | `lastScrapedAt`   |
| stateAbbr     | `stateAbbr`     | State        | Yes      | select                                                   | `stateAbbr`       |
| status        | computed        | Status       | No       | select (healthy, moderate, unhealthy, anomaly, inactive) | `status`          |
| actions       | —               | Actions      | No       | None                                                     | —                 |

**Custom cell renderers**:

- `healthScore` → color-coded numeric (green ≥0.7, yellow ≥0.3, red <0.3)
- `yieldTrend` → arrow icon (↑ improving, → stable, ↓ declining)
- `status` → derived from healthScore + anomalyDetected + active flag
- `actions` → dismiss anomaly / deactivate / reactivate buttons

**Expandable row**: Clicking a row toggles an expanded panel below showing scrape history log.

## Table 3: Verification Queue

**Data source**: `GET /api/admin/verification` (server-side sort/filter/page)  
**Row type**: `Judge` (subset fields)  
**Row selection**: Yes (bulk verify/reject)

| Column ID | Accessor    | Header   | Sortable | Filter                                  | Server Sort Field |
| --------- | ----------- | -------- | -------- | --------------------------------------- | ----------------- |
| select    | —           | Checkbox | No       | None                                    | —                 |
| fullName  | `fullName`  | Name     | Yes      | text                                    | `fullName`        |
| court     | `court`     | Court    | No       | None                                    | —                 |
| county    | `county`    | County   | No       | None                                    | —                 |
| state     | `state`     | State    | No       | select (via stateId param)              | —                 |
| sourceUrl | `sourceUrl` | Source   | No       | None                                    | —                 |
| status    | `status`    | Status   | No       | select (UNVERIFIED, VERIFIED, REJECTED) | `status`          |
| actions   | —           | Actions  | No       | None                                    | —                 |

**Custom cell renderers**:

- `sourceUrl` → "View Source" link or "—"
- `status` → color-coded badge
- `actions` → Verify/Reject (if UNVERIFIED), Unverify (if VERIFIED/REJECTED)

**Additional filters** (toolbar-level, not per-column):

- Batch filter (dropdown, populated from `batchId` param)

## Table 4: Judge Records

**Data source**: `GET /api/admin/judges` (server-side sort/filter/page)  
**Row type**: `Judge` (with nested court/county/state relations)  
**Row selection**: No

| Column ID | Accessor                                        | Header   | Sortable | Filter                                  | Server Sort Field |
| --------- | ----------------------------------------------- | -------- | -------- | --------------------------------------- | ----------------- |
| fullName  | `fullName`                                      | Name     | Yes      | text (via `search` param)               | `fullName`        |
| courtType | `court.type`                                    | Court    | No       | None                                    | —                 |
| location  | `court.county.name` + `court.county.state.name` | Location | No       | None                                    | —                 |
| status    | `status`                                        | Status   | Yes      | select (VERIFIED, UNVERIFIED, REJECTED) | `status`          |
| actions   | —                                               | Actions  | No       | None                                    | —                 |

**Custom cell renderers**:

- `fullName` → bold text
- `location` → "{county}, {state}" in muted text
- `status` → color-coded badge
- `actions` → Verify/Unverify + Delete buttons

## Table 5: Import Batch History

**Data source**: `GET /api/admin/import` (server-side sort/filter/page)  
**Row type**: `ImportBatch`  
**Row selection**: No

| Column ID | Accessor    | Header  | Sortable | Filter                                              | Server Sort Field |
| --------- | ----------- | ------- | -------- | --------------------------------------------------- | ----------------- |
| fileName  | `fileName`  | File    | No       | text                                                | —                 |
| totalRows | `totalRows` | Rows    | Yes      | None                                                | `totalRows`       |
| result    | computed    | Result  | No       | None                                                | —                 |
| status    | `status`    | Status  | Yes      | select (COMPLETE, ROLLED_BACK, PENDING, PROCESSING) | `status`          |
| createdAt | `createdAt` | Date    | Yes      | None                                                | `createdAt`       |
| actions   | —           | Actions | No       | None                                                | —                 |

**Custom cell renderers**:

- `result` → "{successCount} ok / {skipCount} skip / {errorCount} err"
- `status` → color-coded badge
- `actions` → Rollback button (conditional)

## Table 6: Dashboard State Breakdown

**Data source**: `GET /api/admin/dashboard` → `data.byState[]` (client-side sort/filter)  
**Row type**: `StateSummary`  
**Row selection**: No

| Column ID       | Accessor          | Header      | Sortable | Filter | Notes            |
| --------------- | ----------------- | ----------- | -------- | ------ | ---------------- |
| stateName       | `stateName`       | State       | Yes      | text   | Client-side sort |
| imported        | `imported`        | Imported    | Yes      | None   | Client-side sort |
| verified        | `verified`        | Verified    | Yes      | None   | Client-side sort |
| unverified      | `unverified`      | Unverified  | Yes      | None   | Client-side sort |
| rejected        | `rejected`        | Rejected    | Yes      | None   | Client-side sort |
| percentOfTarget | `percentOfTarget` | % of Target | Yes      | None   | Client-side sort |

**Custom cell renderers**:

- `stateName` → bold font-medium
- All number columns → `.toLocaleString()` formatting
- `percentOfTarget` → "{value}%"

## Entity Relationships (no changes)

No Prisma schema changes are required. The DataTable renders existing data from existing API endpoints. The column definitions above map directly to existing model fields.
