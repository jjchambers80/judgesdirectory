# Data Model: Phase 2 — Data Ingestion

**Feature Branch**: `003-data-ingestion`
**Date**: 2026-02-18
**Derived From**: [spec.md](spec.md), [research.md](research.md)

---

## Entity Relationship Overview

```
State (existing)
  └── County (existing)
       └── Court (existing)
            └── Judge (extended)
                 └── ImportBatch (NEW) ←───┐
                      │                     │
                      └── judges[] ─────────┘
```

**Changes from existing schema:**

- `ImportBatch` — new model
- `Judge` — add optional `importBatchId` foreign key + `status` field
- No changes to `State`, `County`, or `Court` models

---

## New Model: ImportBatch

Represents a single CSV import operation. Tracks the batch lifecycle from upload through completion or rollback.

| Field          | Type     | Constraints        | Description                                           |
| -------------- | -------- | ------------------ | ----------------------------------------------------- |
| `id`           | UUID     | PK, auto-generated | Unique batch identifier (FR-009)                      |
| `fileName`     | String   | Required           | Original CSV file name for reference                  |
| `totalRows`    | Int      | Required           | Total rows in the uploaded CSV                        |
| `successCount` | Int      | Default: 0         | Records successfully imported                         |
| `skipCount`    | Int      | Default: 0         | Records skipped (duplicates)                          |
| `errorCount`   | Int      | Default: 0         | Records that failed validation                        |
| `status`       | Enum     | Required           | `PENDING` → `PROCESSING` → `COMPLETE` / `ROLLED_BACK` |
| `createdAt`    | DateTime | Auto               | Timestamp of upload                                   |
| `updatedAt`    | DateTime | Auto               | Last modified                                         |

**Relations:**

- `judges` — one-to-many with `Judge` (all judges created by this batch)

**Indexes:**

- `status` — for filtering active/rolled-back batches
- `createdAt` — for sorting in dashboard

**State machine:**

```
PENDING → PROCESSING → COMPLETE
                    ↘ ROLLED_BACK
```

---

## Extended Model: Judge

Two new fields added to the existing `Judge` model.

| Field (NEW)     | Type  | Constraints               | Description                                                                   |
| --------------- | ----- | ------------------------- | ----------------------------------------------------------------------------- |
| `importBatchId` | UUID? | Optional FK → ImportBatch | Traces judge back to import batch (FR-018). Null for manually-created judges. |
| `status`        | Enum  | Default: `UNVERIFIED`     | Record lifecycle: `UNVERIFIED` / `VERIFIED` / `REJECTED`                      |

**Changes to existing fields:**

- `verified` — **REMOVED**. Replaced by `status` enum which covers three states: `UNVERIFIED`, `VERIFIED`, `REJECTED`. The existing `verified: Boolean` only supported two states (true/false) and cannot represent soft-deleted/rejected records.

**Migration note:** Existing judge records (if any) with `verified: true` → `status: VERIFIED`, `verified: false` → `status: UNVERIFIED`. Since zero judges currently exist in the database, this migration is safe.

**Relations:**

- `importBatch` — optional many-to-one with `ImportBatch`
- `court` — existing (unchanged)

**Indexes (new):**

- `importBatchId` — for batch rollback queries
- `status` — for verification queue filtering

---

## Enum Definitions

### ImportBatchStatus

| Value         | Description                                            |
| ------------- | ------------------------------------------------------ |
| `PENDING`     | Batch created, CSV parsed, awaiting admin confirmation |
| `PROCESSING`  | Import in progress (import lock held)                  |
| `COMPLETE`    | Import finished successfully                           |
| `ROLLED_BACK` | Batch was rolled back by admin                         |

### JudgeStatus

| Value        | Description                                                                                                       |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `UNVERIFIED` | Default. Record imported but not yet reviewed. Hidden from public pages.                                          |
| `VERIFIED`   | Admin confirmed accuracy against source. Visible on public pages.                                                 |
| `REJECTED`   | Admin found record inaccurate. Soft-deleted — hidden from queue and public pages, retained in database for audit. |

---

## Prisma Schema Changes

```prisma
// NEW enum
enum ImportBatchStatus {
  PENDING
  PROCESSING
  COMPLETE
  ROLLED_BACK
}

// NEW enum
enum JudgeStatus {
  UNVERIFIED
  VERIFIED
  REJECTED
}

// NEW model
model ImportBatch {
  id           String            @id @default(uuid())
  fileName     String
  totalRows    Int
  successCount Int               @default(0)
  skipCount    Int               @default(0)
  errorCount   Int               @default(0)
  status       ImportBatchStatus @default(PENDING)
  judges       Judge[]
  createdAt    DateTime          @default(now())
  updatedAt    DateTime          @updatedAt

  @@index([status])
  @@index([createdAt])
  @@map("import_batches")
}

// MODIFIED model — changes marked with // NEW or // CHANGED
model Judge {
  id                   String      @id @default(uuid())
  courtId              String
  court                Court       @relation(fields: [courtId], references: [id], onDelete: Cascade)
  fullName             String
  slug                 String
  termStart            DateTime?
  termEnd              DateTime?
  selectionMethod      String?
  appointingAuthority  String?
  education            String?     @db.Text
  priorExperience      String?     @db.Text
  politicalAffiliation String?
  sourceUrl            String?
  status               JudgeStatus @default(UNVERIFIED)  // CHANGED: replaces `verified Boolean`
  importBatchId        String?                            // NEW
  importBatch          ImportBatch? @relation(fields: [importBatchId], references: [id], onDelete: SetNull)  // NEW
  createdAt            DateTime    @default(now())
  updatedAt            DateTime    @updatedAt

  @@unique([courtId, slug])
  @@index([courtId])
  @@index([fullName])
  @@index([importBatchId])   // NEW
  @@index([status])          // NEW
  @@map("judges")
}
```

---

## Validation Rules

### ImportBatch

- `fileName` — non-empty string, max 255 characters
- `totalRows` — positive integer, max 10,000 (EC-001)
- `successCount + skipCount + errorCount` ≤ `totalRows`
- `status` transitions: PENDING → PROCESSING → COMPLETE or ROLLED_BACK only (no backwards transitions)
- **Recovery**: On server restart, any batches stuck in `PROCESSING` status should be reset to `PENDING` since the in-memory import lock is lost on restart

### Judge (import-specific)

- `fullName` — required, non-empty, max 200 characters
- `sourceUrl` — required for imported judges (FR-004), valid URL format
- `status` — transitions: UNVERIFIED → VERIFIED, UNVERIFIED → REJECTED, VERIFIED → UNVERIFIED (for un-verify before rollback), REJECTED → UNVERIFIED (for recovery)
- `slug` — auto-generated from `fullName`, unique within `courtId` scope

### Duplicate Detection

- Duplicate key: `fullName` (case-insensitive) + `courtId`
- Checked at import time via in-memory Set (not a database constraint)
- Applied within a single CSV and against existing database records

---

## Impact on Existing Queries

| Location                | Current Query                                                    | Required Change                               |
| ----------------------- | ---------------------------------------------------------------- | --------------------------------------------- |
| Public judge list pages | `where: { verified: true }`                                      | → `where: { status: 'VERIFIED' }`             |
| Admin judge list        | `where: { verified: ... }` filter                                | → `where: { status: ... }` filter             |
| Admin verify endpoint   | `PATCH /api/admin/judges/[id]/verify` toggles `verified` boolean | → Sets `status` to `VERIFIED` or `UNVERIFIED` |
| Judge creation form     | Sets `verified: false`                                           | → Sets `status: 'UNVERIFIED'` (default)       |
| Sitemap generation      | May filter by `verified`                                         | → Filter by `status: 'VERIFIED'`              |
| SEO/public pages        | Check `verified` for display                                     | → Check `status === 'VERIFIED'`               |
