# API Contracts: Pragmatic Auto-Verification

**Feature**: 014-auto-verification
**Date**: 2026-03-16

## New Endpoints

### GET /api/admin/judges/sources

Aggregates judges by source URL, returning counts per status. Powers the batch verify "Sources" view (FR-019).

**Query Parameters:**

| Parameter | Type   | Required | Default | Description |
|-----------|--------|----------|---------|-------------|
| stateId   | string | No       | —       | Filter to judges in courts within this state |
| countyId  | string | No       | —       | Filter to judges in courts within this county |
| page      | number | No       | 1       | Pagination page (1-indexed) |
| limit     | number | No       | 50      | Results per page (max 100) |

**Response 200:**

```json
{
  "sources": [
    {
      "sourceUrl": "https://www.flcourts.gov/courts/circuit-courts",
      "sourceAuthority": "OFFICIAL_GOV",
      "total": 45,
      "verified": 38,
      "unverified": 5,
      "needsReview": 2
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 12,
    "totalPages": 1
  }
}
```

**Implementation:**
- Prisma `groupBy` on `sourceUrl` field
- Count by status using conditional aggregation
- Join to court → county → state for state/county filtering
- Sort by total descending (most judges first)

---

### POST /api/admin/judges/batch-verify

Batch-verifies all UNVERIFIED judges from a specific source URL (FR-020, FR-021, FR-022).

**Request Body:**

```json
{
  "sourceUrl": "https://www.flcourts.gov/courts/circuit-courts"
}
```

| Field     | Type   | Required | Description |
|-----------|--------|----------|-------------|
| sourceUrl | string | Yes      | The exact source URL to batch-verify |

**Response 200:**

```json
{
  "promoted": 5,
  "sourceUrl": "https://www.flcourts.gov/courts/circuit-courts"
}
```

**Error Responses:**

| Status | Body | Condition |
|--------|------|-----------|
| 400    | `{ "error": "Invalid JSON body" }` | Malformed request |
| 422    | `{ "error": "sourceUrl is required" }` | Missing sourceUrl |
| 422    | `{ "error": "No unverified judges found for this source" }` | Zero matching records |

**Implementation:**
- Validate sourceUrl is a non-empty string
- Query: `status = 'UNVERIFIED' AND sourceUrl = ?`
- Update all matching: `status → 'VERIFIED', verifiedAt → now()`
- NEEDS_REVIEW and REJECTED records are excluded (FR-022)
- Returns count of promoted records

---

## Modified Endpoints

### GET /api/admin/verification — No changes

Existing endpoint already supports status filtering and pagination. The new "Sources" view uses the new `/sources` endpoint instead of modifying this one.

### PATCH /api/admin/verification/batch — No changes

Existing batch verify endpoint operates on explicit judge IDs. The new batch-verify-by-source endpoint is separate because it operates on a source URL filter, not an ID list.

---

## Harvest CSV Output Changes

### New Columns

| Column Name        | Position | Values | Default (if absent) |
|--------------------|----------|--------|---------------------|
| Source Authority    | After existing columns | OFFICIAL_GOV, COURT_WEBSITE, ELECTION_RECORDS, SECONDARY | COURT_WEBSITE |
| Extraction Method  | After Source Authority | deterministic, llm | null |

### Backward Compatibility

Existing CSVs without these columns import successfully. The CSV importer defaults missing columns:
- "Source Authority" absent → `COURT_WEBSITE`
- "Extraction Method" absent → `null`

### Updated CSV Header Row

```
Full Name,Suffix,Court Type,County,Division,Roster URL,Bio Page URL,Term Start,Term End,Selection Method,Appointing Authority,Education,Prior Experience,Political Affiliation,Practice Areas,Bar Admissions,Professional Associations,Contact Email,Contact Phone,Confidence Score,Anomaly Flags,Source Authority,Extraction Method
```

---

## Re-Scoring CLI Contract

### Command

```bash
npx tsx scripts/maintenance/rescore-judges.ts [options]
```

### Options

| Flag         | Type    | Default | Description |
|--------------|---------|---------|-------------|
| `--dry-run`  | boolean | true    | Preview impact without database changes |
| `--apply`    | boolean | false   | Apply changes to database |
| `--batch-size`| number | 100     | Records per transaction batch |
| `--state`    | string  | —       | Limit to judges in a specific state (by state abbreviation) |

`--dry-run` and `--apply` are mutually exclusive. If neither is specified, defaults to dry-run.

### Dry-Run Output

```
Re-Scoring Preview (DRY RUN)
=============================
State: FL
Total candidates: 4,823
  UNVERIFIED: 4,712
  NEEDS_REVIEW (flags cleared): 111

Would promote by source authority:
  OFFICIAL_GOV:  312 of  450 (69.3%)
  COURT_WEBSITE: 2,841 of 4,100 (69.3%)
  SECONDARY:     89 of  273 (32.6%)

Total would promote: 3,242 of 4,823 (67.2%)
No database changes made.
```

### Apply Output

```
Re-Scoring (APPLY MODE)
========================
Processing batch 1/49 (100 records)...
  Promoted: 67 | Skipped: 33
Processing batch 2/49 (100 records)...
  Promoted: 71 | Skipped: 29
...
Processing batch 49/49 (23 records)...
  Promoted: 15 | Skipped: 8

Summary:
  Total processed: 4,823
  Promoted to VERIFIED: 3,242
  Remained UNVERIFIED: 1,492
  Remained NEEDS_REVIEW: 89
  Duration: 12.4s
```

### Exit Codes

| Code | Meaning |
|------|---------|
| 0    | Success |
| 1    | Error (database connection, invalid args) |

### Processing Rules

1. Query candidates: `status IN ('UNVERIFIED', 'NEEDS_REVIEW') AND (status != 'NEEDS_REVIEW' OR anomalyFlags = '{}')`
2. For each candidate:
   - Classify `sourceAuthority` from `sourceUrl` domain
   - Recalculate `confidenceScore` using new formula (no extraction bonus for existing records with null extractionMethod)
   - Apply auto-verify threshold check
3. Process in batches of `--batch-size` within transactions
4. Never modify VERIFIED or REJECTED records
5. Idempotent — safe to re-run
