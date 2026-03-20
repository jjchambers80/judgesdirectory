# API Contracts: Discovery Run Management

**Feature**: 016-admin-state-discovery  
**Date**: 2026-03-17  
**Base path**: `/api/admin/discovery`

All endpoints are protected by Basic Auth via middleware (existing).

---

## GET /api/admin/discovery/runs

List discovery runs with optional state filter and pagination.

### Request

| Parameter | In    | Type    | Default | Description                               |
| --------- | ----- | ------- | ------- | ----------------------------------------- |
| state     | query | string? | —       | Filter by state abbreviation (e.g., "FL") |
| page      | query | int     | 1       | Page number (1-indexed)                   |
| limit     | query | int     | 20      | Items per page (max 100)                  |

### Response 200

```json
{
  "runs": [
    {
      "id": "uuid",
      "state": "Florida",
      "stateAbbr": "FL",
      "status": "COMPLETED",
      "queriesRun": 12,
      "candidatesFound": 8,
      "candidatesNew": 5,
      "startedAt": "2026-03-17T10:00:00.000Z",
      "completedAt": "2026-03-17T10:05:30.000Z",
      "errorMessage": null
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 42,
    "totalPages": 3
  },
  "hasActiveRun": false
}
```

**Notes**:

- `hasActiveRun` is a top-level boolean — true if any run across all states has status `RUNNING`. Used by the client to disable the "Run Discovery" button and start auto-polling. (Under FR-005's single-concurrent-run constraint, this is functionally equivalent to a state-scoped check.)
- Runs are ordered by `startedAt DESC`.

---

## POST /api/admin/discovery/runs

Trigger a new discovery run for a state.

### Request

```json
{
  "stateAbbr": "FL"
}
```

| Field     | Type   | Required | Description                      |
| --------- | ------ | -------- | -------------------------------- |
| stateAbbr | string | yes      | Two-letter US state abbreviation |

### Response 201

```json
{
  "id": "uuid",
  "state": "Florida",
  "stateAbbr": "FL",
  "status": "RUNNING",
  "startedAt": "2026-03-17T10:00:00.000Z"
}
```

### Response 400 — Invalid input

```json
{
  "error": "Invalid state abbreviation"
}
```

### Response 409 — Active run exists

```json
{
  "error": "A discovery run is already in progress",
  "activeRunId": "uuid",
  "activeRunState": "Georgia"
}
```

### Response 503 — Search API unavailable

```json
{
  "error": "External search service is not configured. Check GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX environment variables."
}
```

**Notes**:

- Validates `stateAbbr` against known US states.
- Checks for existing `RUNNING` or `CANCELLED` (in-progress cancellation) runs.
- Creates a `DiscoveryRun` record with `RUNNING` status.
- Spawns `scripts/discovery/discover.ts --state {abbr} --run-id {id}` as a detached background process.
- Returns immediately with the new run's ID.
- Validates that `GOOGLE_CSE_API_KEY` and `GOOGLE_CSE_CX` are set before spawning.

---

## PATCH /api/admin/discovery/runs/[id]

Cancel a running discovery run.

### Request

```json
{
  "action": "cancel"
}
```

| Field  | Type   | Required | Description      |
| ------ | ------ | -------- | ---------------- |
| action | string | yes      | Must be "cancel" |

### Response 200

```json
{
  "id": "uuid",
  "status": "CANCELLED",
  "message": "Run cancellation requested. The process will stop at the next query checkpoint."
}
```

### Response 400 — Invalid action

```json
{
  "error": "Invalid action. Must be 'cancel'."
}
```

### Response 404 — Run not found

```json
{
  "error": "Discovery run not found"
}
```

### Response 409 — Run not cancellable

```json
{
  "error": "Run is not in RUNNING state",
  "currentStatus": "COMPLETED"
}
```

**Notes**:

- Only runs with `status = RUNNING` can be cancelled.
- Sets `status = CANCELLED` in the DB. The background process detects this at the next loop iteration and exits gracefully.
- The background process updates the final status to `FAILED` with `errorMessage = "Cancelled by user"` and preserves partial metrics.

---

## GET /api/admin/discovery/summary

Get candidate counts and last run info for a state.

### Request

| Parameter | In    | Type   | Required | Description                   |
| --------- | ----- | ------ | -------- | ----------------------------- |
| state     | query | string | yes      | Two-letter state abbreviation |

### Response 200

```json
{
  "stateAbbr": "FL",
  "stateName": "Florida",
  "candidateCounts": {
    "approved": 12,
    "discovered": 3,
    "rejected": 1,
    "total": 16
  },
  "lastRun": {
    "id": "uuid",
    "status": "COMPLETED",
    "startedAt": "2026-03-15T10:00:00.000Z",
    "completedAt": "2026-03-15T10:05:30.000Z",
    "candidatesFound": 8,
    "candidatesNew": 5
  },
  "hasActiveRun": false
}
```

### Response 200 — No data for state

```json
{
  "stateAbbr": "WY",
  "stateName": "Wyoming",
  "candidateCounts": {
    "approved": 0,
    "discovered": 0,
    "rejected": 0,
    "total": 0
  },
  "lastRun": null,
  "hasActiveRun": false
}
```

### Response 400 — Invalid state

```json
{
  "error": "Invalid state abbreviation"
}
```

**Notes**:

- Uses `UrlCandidate.groupBy` for candidate counts.
- Uses `DiscoveryRun.findFirst` ordered by `startedAt DESC` for last run.
- `hasActiveRun` checks for any `RUNNING` run for that specific state. (Under FR-005's single-concurrent-run constraint, this is functionally equivalent to the global check in GET /runs.)
