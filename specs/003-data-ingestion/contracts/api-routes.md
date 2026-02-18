# API Contracts: Phase 2 — Data Ingestion

**Feature Branch**: `003-data-ingestion`
**Date**: 2026-02-18
**Base Path**: `/api/admin`
**Auth**: HTTP Basic Auth (all endpoints)

---

## Overview

| Method | Endpoint                            | User Story  | Purpose                           |
| ------ | ----------------------------------- | ----------- | --------------------------------- |
| POST   | `/api/admin/import`                 | US1         | Upload + parse CSV                |
| POST   | `/api/admin/import/confirm`         | US1         | Confirm and execute import        |
| GET    | `/api/admin/import`                 | US1, US4    | List import batches               |
| GET    | `/api/admin/import/status`          | US1         | Check import lock status (FR-019) |
| GET    | `/api/admin/import/{batchId}`       | US1         | Get batch detail                  |
| DELETE | `/api/admin/import/{batchId}`       | US1, EC-005 | Rollback batch (FR-016)           |
| GET    | `/api/admin/verification`           | US2         | Verification queue with filters   |
| PATCH  | `/api/admin/verification/{judgeId}` | US2         | Verify or reject single record    |
| PATCH  | `/api/admin/verification/batch`     | US5         | Batch verify/reject               |
| POST   | `/api/admin/courts/bulk`            | US3         | Bulk court creation by state      |
| GET    | `/api/admin/dashboard`              | US4         | Ingestion progress stats          |

---

## 1. CSV Upload & Parse

### `POST /api/admin/import`

Upload a CSV file. Parses and validates the file, returns a preview without creating any records.

**Request**: `multipart/form-data`

| Field  | Type | Required | Description                          |
| ------ | ---- | -------- | ------------------------------------ |
| `file` | File | Yes      | CSV file (max 5 MB, max 10,000 rows) |

**Response**: `200 OK`

```json
{
  "batchId": "uuid",
  "fileName": "texas-judges.csv",
  "totalRows": 500,
  "validRows": 485,
  "invalidRows": 10,
  "duplicateRows": 5,
  "columns": ["Judge Name", "Court Type", "County", "Source URL"],
  "columnMapping": {
    "Judge Name": "fullName",
    "Court Type": "courtType",
    "County": "countyName",
    "Source URL": "sourceUrl"
  },
  "preview": [
    {
      "row": 1,
      "data": {
        "fullName": "Jane Smith",
        "courtType": "District Court",
        "countyName": "Harris",
        "sourceUrl": "https://..."
      },
      "status": "valid"
    },
    {
      "row": 6,
      "data": {
        "fullName": "",
        "courtType": "District Court",
        "countyName": "Harris",
        "sourceUrl": "https://..."
      },
      "status": "invalid",
      "errors": ["fullName is required"]
    },
    {
      "row": 12,
      "data": {
        "fullName": "John Doe",
        "courtType": "District Court",
        "countyName": "Harris",
        "sourceUrl": "https://..."
      },
      "status": "duplicate",
      "reason": "Judge already exists at this court"
    }
  ],
  "unmatchedStates": [],
  "unmatchedCounties": ["Unknown County"],
  "courtsToCreate": [
    {
      "courtType": "Family Court",
      "countyName": "Harris",
      "stateName": "Texas"
    }
  ]
}
```

**Error Responses**:

| Status | Condition                                       |
| ------ | ----------------------------------------------- |
| 400    | No file provided                                |
| 413    | File exceeds 5 MB (FR-001)                      |
| 422    | File exceeds 10,000 rows (EC-001)               |
| 422    | File is not valid CSV / encoding error (EC-002) |
| 409    | Import already in progress (FR-019)             |

---

## 2. Confirm Import

### `POST /api/admin/import/confirm`

Execute a previously parsed import batch. Creates court and judge records.

**Request**: `application/json`

```json
{
  "batchId": "uuid",
  "columnMapping": {
    "Judge Name": "fullName",
    "Court Type": "courtType",
    "County": "countyName",
    "State": "stateName",
    "Source URL": "sourceUrl"
  },
  "state": "texas"
}
```

| Field           | Type   | Required | Description                                                       |
| --------------- | ------ | -------- | ----------------------------------------------------------------- |
| `batchId`       | UUID   | Yes      | Batch ID from the upload step                                     |
| `columnMapping` | Object | Yes      | Final column mapping (admin may have adjusted from auto-detected) |
| `state`         | String | Yes      | State slug — all rows in this CSV belong to this state            |

**Response**: `200 OK`

```json
{
  "batchId": "uuid",
  "status": "COMPLETE",
  "successCount": 485,
  "skipCount": 5,
  "errorCount": 10,
  "courtsCreated": 3,
  "summary": {
    "duplicatesSkipped": [
      {
        "row": 12,
        "fullName": "John Doe",
        "court": "District Court, Harris County"
      }
    ],
    "errorsDetail": [{ "row": 6, "errors": ["fullName is required"] }]
  }
}
```

**Error Responses**:

| Status | Condition                                                    |
| ------ | ------------------------------------------------------------ |
| 404    | Batch ID not found                                           |
| 409    | Batch already confirmed or rolled back                       |
| 409    | Another import is in progress (FR-019)                       |
| 422    | Column mapping missing required fields (fullName, sourceUrl) |

---

## 3. List Import Batches

### `GET /api/admin/import`

List all import batches with pagination.

**Query Parameters**:

| Param    | Type   | Default | Description                                            |
| -------- | ------ | ------- | ------------------------------------------------------ |
| `page`   | Int    | 1       | Page number                                            |
| `limit`  | Int    | 20      | Records per page (max 50)                              |
| `status` | String | —       | Filter by status: `PENDING`, `COMPLETE`, `ROLLED_BACK` |

**Response**: `200 OK`

```json
{
  "batches": [
    {
      "id": "uuid",
      "fileName": "texas-judges.csv",
      "totalRows": 500,
      "successCount": 485,
      "skipCount": 5,
      "errorCount": 10,
      "status": "COMPLETE",
      "hasVerifiedJudges": true,
      "createdAt": "2026-02-18T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "totalPages": 1
  }
}
```

---

## 4. Import Lock Status

### `GET /api/admin/import/status`

Check whether an import is currently in progress (FR-019).

**Response**: `200 OK`

```json
{
  "importing": false,
  "currentBatchId": null
}
```

or

```json
{
  "importing": true,
  "currentBatchId": "uuid",
  "fileName": "texas-judges.csv",
  "startedAt": "2026-02-18T10:30:00Z"
}
```

---

## 5. Batch Detail

### `GET /api/admin/import/{batchId}`

Get detailed information about a specific import batch.

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "fileName": "texas-judges.csv",
  "totalRows": 500,
  "successCount": 485,
  "skipCount": 5,
  "errorCount": 10,
  "status": "COMPLETE",
  "hasVerifiedJudges": true,
  "createdAt": "2026-02-18T10:30:00Z",
  "judges": {
    "verified": 200,
    "unverified": 280,
    "rejected": 5
  }
}
```

**Error Responses**: `404` if batch not found.

---

## 6. Rollback Batch

### `DELETE /api/admin/import/{batchId}`

Rollback an entire import batch. Deletes all judge records created in this batch. (FR-016)

**Precondition**: Batch must have zero verified judges. If any judges are verified, rollback is blocked — admin must un-verify them first.

**Response**: `200 OK`

```json
{
  "batchId": "uuid",
  "status": "ROLLED_BACK",
  "recordsDeleted": 485
}
```

**Error Responses**:

| Status | Condition                                                  |
| ------ | ---------------------------------------------------------- |
| 404    | Batch not found                                            |
| 409    | Batch already rolled back                                  |
| 409    | Batch has verified judges — must un-verify before rollback |

---

## 7. Verification Queue

### `GET /api/admin/verification`

Paginated list of unverified judge records for the verification workflow. (FR-010)

**Query Parameters**:

| Param      | Type   | Default      | Description                                      |
| ---------- | ------ | ------------ | ------------------------------------------------ |
| `page`     | Int    | 1            | Page number                                      |
| `limit`    | Int    | 50           | Records per page (fixed at 50 per clarification) |
| `stateId`  | UUID   | —            | Filter by state                                  |
| `countyId` | UUID   | —            | Filter by county                                 |
| `batchId`  | UUID   | —            | Filter by import batch                           |
| `status`   | String | `UNVERIFIED` | Filter: `UNVERIFIED`, `VERIFIED`, `REJECTED`     |
| `sort`     | String | `createdAt`  | Sort field                                       |
| `order`    | String | `desc`       | Sort order: `asc` or `desc`                      |

**Response**: `200 OK`

```json
{
  "judges": [
    {
      "id": "uuid",
      "fullName": "Jane Smith",
      "court": "District Court",
      "county": "Harris County",
      "state": "Texas",
      "sourceUrl": "https://...",
      "status": "UNVERIFIED",
      "importBatchId": "uuid",
      "importBatchFileName": "texas-judges.csv",
      "createdAt": "2026-02-18T10:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 485,
    "totalPages": 10
  }
}
```

---

## 8. Single Record Verify/Reject

### `PATCH /api/admin/verification/{judgeId}`

Verify or reject a single judge record. (FR-011)

**Request**: `application/json`

```json
{
  "action": "verify"
}
```

| Field    | Type   | Required | Values                         |
| -------- | ------ | -------- | ------------------------------ |
| `action` | String | Yes      | `verify`, `reject`, `unverify` |

**Response**: `200 OK`

```json
{
  "id": "uuid",
  "fullName": "Jane Smith",
  "status": "VERIFIED"
}
```

**Error Responses**:

| Status | Condition                                                                                      |
| ------ | ---------------------------------------------------------------------------------------------- |
| 404    | Judge not found                                                                                |
| 422    | Invalid action value                                                                           |
| 409    | Invalid status transition (e.g., reject an already verified record without un-verifying first) |

**Status Transitions**:

- `UNVERIFIED` → `VERIFIED` (verify)
- `UNVERIFIED` → `REJECTED` (reject)
- `VERIFIED` → `UNVERIFIED` (unverify — needed before rollback)
- `REJECTED` → `UNVERIFIED` (recover)

**Inline Edit Note**: To edit judge fields before verifying, use the existing `PUT /api/admin/judges/[id]` endpoint first, then call this PATCH endpoint to verify the corrected record.

---

## 9. Batch Verify/Reject

### `PATCH /api/admin/verification/batch`

Verify or reject multiple judge records at once. (FR-012, US5)

**Request**: `application/json`

```json
{
  "judgeIds": ["uuid1", "uuid2", "uuid3"],
  "action": "verify"
}
```

| Field      | Type   | Required | Description                                                 |
| ---------- | ------ | -------- | ----------------------------------------------------------- |
| `judgeIds` | UUID[] | Yes      | Array of judge IDs (max 50 per request — matches page size) |
| `action`   | String | Yes      | `verify`, `reject`, `unverify`                              |

**Response**: `200 OK`

```json
{
  "total": 20,
  "succeeded": 18,
  "failed": 2,
  "results": [
    { "id": "uuid1", "status": "VERIFIED" },
    { "id": "uuid2", "status": "VERIFIED" },
    { "id": "uuid19", "error": "Judge not found" },
    { "id": "uuid20", "error": "Invalid status transition" }
  ]
}
```

**Error Responses**: `422` if `judgeIds` is empty or exceeds 50.

---

## 10. Bulk Court Creation

### `POST /api/admin/courts/bulk`

Create court types across all counties in a state. (FR-013, US3)

**Request**: `application/json`

```json
{
  "stateId": "uuid",
  "courtTypes": ["District Court", "County Court", "Justice of the Peace Court"]
}
```

| Field        | Type     | Required | Description                       |
| ------------ | -------- | -------- | --------------------------------- |
| `stateId`    | UUID     | Yes      | Target state                      |
| `courtTypes` | String[] | Yes      | Court type names to create (1–10) |

**Response**: `200 OK`

```json
{
  "stateId": "uuid",
  "stateName": "Texas",
  "totalCounties": 254,
  "courtsCreated": 762,
  "courtsSkipped": 0,
  "details": [
    { "courtType": "District Court", "created": 254, "skipped": 0 },
    { "courtType": "County Court", "created": 254, "skipped": 0 },
    { "courtType": "Justice of the Peace Court", "created": 254, "skipped": 0 }
  ]
}
```

**Error Responses**:

| Status | Condition                           |
| ------ | ----------------------------------- |
| 404    | State not found                     |
| 422    | `courtTypes` is empty or exceeds 10 |

---

## 11. Ingestion Dashboard

### `GET /api/admin/dashboard`

Aggregated statistics for the ingestion progress dashboard. (FR-014, US4)

**Query Parameters**:

| Param         | Type   | Default | Description                                                    |
| ------------- | ------ | ------- | -------------------------------------------------------------- |
| `pilotStates` | String | —       | Comma-separated state slugs (e.g., `texas,california,florida`) |

**Response**: `200 OK`

```json
{
  "target": 1500,
  "totals": {
    "imported": 1200,
    "verified": 850,
    "unverified": 320,
    "rejected": 30,
    "percentComplete": 56.7
  },
  "byState": [
    {
      "stateId": "uuid",
      "stateName": "Texas",
      "stateSlug": "texas",
      "imported": 600,
      "verified": 450,
      "unverified": 140,
      "rejected": 10,
      "percentOfTarget": 30.0
    },
    {
      "stateId": "uuid",
      "stateName": "California",
      "stateSlug": "california",
      "imported": 400,
      "verified": 300,
      "unverified": 90,
      "rejected": 10,
      "percentOfTarget": 20.0
    }
  ],
  "recentBatches": [
    {
      "id": "uuid",
      "fileName": "texas-judges-batch2.csv",
      "successCount": 200,
      "status": "COMPLETE",
      "createdAt": "2026-02-18T10:30:00Z"
    }
  ],
  "milestoneReached": false
}
```

---

## Existing Endpoints — Required Changes

| Endpoint                              | Change                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `GET /api/admin/judges`               | Replace `verified` filter parameter with `status` filter (`UNVERIFIED`, `VERIFIED`, `REJECTED`)                                |
| `POST /api/admin/judges`              | Remove `verified: false` default, use `status: 'UNVERIFIED'` default                                                           |
| `PUT /api/admin/judges/[id]`          | Support `status` field updates                                                                                                 |
| `PATCH /api/admin/judges/[id]/verify` | **Deprecate or update** — redirect to `PATCH /api/admin/verification/{judgeId}` pattern, or update to set `status: 'VERIFIED'` |
