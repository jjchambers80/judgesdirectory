# Data Model: Admin State Discovery

**Feature**: 016-admin-state-discovery  
**Date**: 2026-03-17

## Schema Change

### DiscoveryRunStatus Enum (MODIFY)

Add `CANCELLED` value to the existing enum.

```prisma
enum DiscoveryRunStatus {
  RUNNING
  COMPLETED
  FAILED
  CANCELLED    // NEW — cooperative cancellation from admin UI
}
```

**Migration**: `ALTER TYPE "DiscoveryRunStatus" ADD VALUE 'CANCELLED';`

## Existing Entities (No Changes)

### DiscoveryRun

Already has all fields needed for the feature:

| Field           | Type               | Notes                                          |
| --------------- | ------------------ | ---------------------------------------------- |
| id              | UUID               | Primary key                                    |
| state           | String             | Full state name (e.g., "Florida")              |
| stateAbbr       | String(2)          | Two-letter abbreviation (e.g., "FL")           |
| status          | DiscoveryRunStatus | RUNNING → COMPLETED / FAILED / CANCELLED       |
| queriesRun      | Int                | Number of search queries executed              |
| candidatesFound | Int                | Total candidates found (new + existing)        |
| candidatesNew   | Int                | Newly discovered candidates                    |
| startedAt       | DateTime           | Run start time                                 |
| completedAt     | DateTime?          | Run end time (null while RUNNING)              |
| errorMessage    | String?            | Error details if FAILED or "Cancelled by user" |
| candidates      | UrlCandidate[]     | Related discovered URLs                        |

**Indexes** (existing): `status`, `state`, `startedAt`

### UrlCandidate

Read-only for this feature (used by summary endpoint to count candidates by status per state).

| Field     | Type            | Used by                                              |
| --------- | --------------- | ---------------------------------------------------- |
| stateAbbr | String(2)       | Summary query: GROUP BY stateAbbr                    |
| status    | CandidateStatus | Summary query: COUNT by DISCOVERED/APPROVED/REJECTED |

**Indexes** (existing): `stateAbbr + status` (composite)

## Derived Data

### State Summary (computed, not stored)

Computed on-demand by the `GET /api/admin/discovery/summary` endpoint:

```typescript
interface StateSummary {
  stateAbbr: string;
  stateName: string;
  candidateCounts: {
    approved: number;
    discovered: number;
    rejected: number;
    total: number;
  };
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    candidatesFound: number;
    candidatesNew: number;
  } | null;
  hasActiveRun: boolean;
}
```

This is derived from two queries:

1. `UrlCandidate.groupBy({ stateAbbr, status })` → candidate counts
2. `DiscoveryRun.findFirst({ stateAbbr, orderBy: startedAt desc })` → last run info
