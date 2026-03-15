# API Contracts: URL Discovery & Scrape Failure Tracking

**Date**: 2026-03-15  
**Auth**: All endpoints require Basic Auth (existing admin middleware)  
**Base**: `/api/admin`

---

## Discovery Endpoints

### GET /api/admin/discovery

List URL candidates with filtering and pagination.

**Query Parameters**:

| Param    | Type   | Default        | Description                                                     |
| -------- | ------ | -------------- | --------------------------------------------------------------- |
| `state`  | string | —              | Filter by state abbreviation (e.g., "FL")                       |
| `status` | string | —              | Filter by status: `DISCOVERED`, `APPROVED`, `REJECTED`, `STALE` |
| `sort`   | string | `discoveredAt` | Sort field: `discoveredAt`, `confidenceScore`                   |
| `order`  | string | `desc`         | Sort order: `asc`, `desc`                                       |
| `page`   | number | 1              | Page number                                                     |
| `limit`  | number | 50             | Results per page (max 100)                                      |

**Response 200**:

```json
{
  "candidates": [
    {
      "id": "uuid",
      "url": "https://courts.ca.gov/judges",
      "domain": "courts.ca.gov",
      "state": "California",
      "stateAbbr": "CA",
      "suggestedType": "Superior Court",
      "suggestedLevel": "trial",
      "confidenceScore": 0.92,
      "searchQuery": "California superior court judges roster",
      "snippetText": "List of judges serving in...",
      "pageTitle": "California Courts - Judges",
      "status": "DISCOVERED",
      "isStale": false,
      "rejectionReason": null,
      "reviewedAt": null,
      "promotedAt": null,
      "discoveredAt": "2026-03-15T10:00:00Z",
      "discoveryRunId": "uuid"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 128,
    "totalPages": 3
  }
}
```

**Note**: The `isStale` boolean is computed: `true` when `status === "DISCOVERED"` and `discoveredAt` is older than 30 days. When `status` query param is `STALE`, the server filters for `status = DISCOVERED AND discoveredAt < NOW() - 30 days`.

---

### PATCH /api/admin/discovery/:id

Approve or reject a single candidate.

**Request Body**:

```json
{
  "action": "approve" | "reject",
  "rejectionReason": "Not a judicial roster page"  // Required when action = "reject"
}
```

**Response 200** (approve):

```json
{
  "id": "uuid",
  "status": "APPROVED",
  "reviewedAt": "2026-03-15T12:00:00Z"
}
```

**Response 200** (reject):

```json
{
  "id": "uuid",
  "status": "REJECTED",
  "rejectionReason": "Not a judicial roster page",
  "reviewedAt": "2026-03-15T12:00:00Z"
}
```

**Response 400**: `{ "error": "Rejection reason is required" }` (when action=reject without reason)  
**Response 404**: `{ "error": "Candidate not found" }`

---

### PATCH /api/admin/discovery/bulk

Bulk approve or reject multiple candidates.

**Request Body**:

```json
{
  "ids": ["uuid1", "uuid2", "uuid3"],
  "action": "approve" | "reject",
  "rejectionReason": "Duplicate entries"  // Required when action = "reject"
}
```

**Response 200**:

```json
{
  "updated": 3,
  "action": "approve"
}
```

**Response 400**: `{ "error": "No candidate IDs provided" }`

---

### POST /api/admin/discovery/promote

Promote approved candidates for a state into a court configuration JSON file.

**Request Body**:

```json
{
  "stateAbbr": "CA"
}
```

**Response 200**:

```json
{
  "state": "California",
  "configPath": "scripts/harvest/california-courts.json",
  "entriesAdded": 5,
  "entriesExisting": 12,
  "entriesTotal": 17,
  "candidatesPromoted": 5
}
```

**Response 400**: `{ "error": "No approved candidates for state CA" }`  
**Response 409**: `{ "error": "Some candidates require manual enrichment (missing county data)" }`

---

## Scrape Failures Endpoints

### GET /api/admin/failures

List scrape failure records with filtering and pagination.

**Query Parameters**:

| Param         | Type   | Default | Description                                       |
| ------------- | ------ | ------- | ------------------------------------------------- |
| `state`       | string | —       | Filter by state abbreviation                      |
| `failureType` | string | —       | Filter by FailureType enum value                  |
| `resolved`    | string | —       | `true` = only resolved, `false` = only unresolved |
| `dateFrom`    | string | —       | ISO date, filter `attemptedAt >= dateFrom`        |
| `dateTo`      | string | —       | ISO date, filter `attemptedAt <= dateTo`          |
| `page`        | number | 1       | Page number                                       |
| `limit`       | number | 50      | Results per page (max 100)                        |

**Response 200**:

```json
{
  "failures": [
    {
      "id": "uuid",
      "url": "https://www.flcourts.gov/judges",
      "state": "Florida",
      "stateAbbr": "FL",
      "failureType": "CAPTCHA_DETECTED",
      "httpStatusCode": 403,
      "errorMessage": "Cloudflare challenge detected in response body",
      "retryCount": 3,
      "attemptedAt": "2026-03-15T08:00:00Z",
      "resolvedAt": null,
      "resolvedBy": null,
      "resolutionNotes": null,
      "occurrenceCount": 3
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 42,
    "totalPages": 1
  },
  "summary": {
    "totalUnresolved": 42,
    "byType": {
      "HTTP_403": 12,
      "CAPTCHA_DETECTED": 8,
      "TIMEOUT": 15,
      "EMPTY_PAGE": 5,
      "DNS_FAILURE": 2
    }
  }
}
```

**Note**: `occurrenceCount` is the total number of failure records for that URL, providing trend visibility. The response returns the most recent failure per URL by default when no date filter is specified.

---

### PATCH /api/admin/failures/:id

Mark a failure record as manually resolved.

**Request Body**:

```json
{
  "resolutionNotes": "Switched to headless browser fetch for this domain"
}
```

**Response 200**:

```json
{
  "id": "uuid",
  "resolvedAt": "2026-03-15T14:00:00Z",
  "resolvedBy": "manual",
  "resolutionNotes": "Switched to headless browser fetch for this domain"
}
```

**Response 404**: `{ "error": "Failure record not found" }`  
**Response 409**: `{ "error": "Already resolved" }`

---

## CLI Commands (not HTTP endpoints)

### Discovery Command

```bash
# Discover court roster URLs for a state
npx tsx scripts/discovery/discover.ts --state FL

# Dry run (display only, no DB writes)
npx tsx scripts/discovery/discover.ts --state FL --dry-run

# Discover for all states (respects daily quota)
npx tsx scripts/discovery/discover.ts --all
```

**Output (normal)**:

```
[Discovery] Starting discovery for Florida (FL)
[Discovery] Lock acquired — run ID: abc-123
[Discovery] Query 1/3: "Florida" supreme court justices roster
  → 8 results, 6 classified as judicial roster
[Discovery] Query 2/3: "Florida" court of appeal judges roster
  → 10 results, 7 classified as judicial roster
[Discovery] Query 3/3: "Florida" circuit court judges roster
  → 10 results, 5 classified as judicial roster
[Discovery] Complete — 18 new candidates stored (10 duplicates skipped)
```

**Output (dry-run)**:

```
[Discovery] DRY RUN — results will not be saved
[Discovery] Starting discovery for Florida (FL)
...
[Discovery] Would store 18 candidates (10 duplicates)
  0.95  https://supremecourt.flcourts.gov/Justices  "Florida Supreme Court"
  0.91  https://1dca.flcourts.gov/Judges             "1st District Court of Appeal"
  ...
```

### Failure Purge Command

```bash
# Purge resolved failures older than 90 days
npx tsx scripts/maintenance/purge-failures.ts

# Dry run
npx tsx scripts/maintenance/purge-failures.ts --dry-run
```
