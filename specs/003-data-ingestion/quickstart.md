# Quickstart: Phase 2 — Data Ingestion

**Feature Branch**: `003-data-ingestion`
**Prerequisite**: Phase 1 (Foundation) complete on `main` branch

---

## Prerequisites

- Node.js 20.18.0+
- PostgreSQL running at `localhost:5432/judgesdirectory`
- Environment variables set (`.env`):
  - `DATABASE_URL`
  - `DIRECT_URL`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD`

## Setup

```bash
# 1. Switch to feature branch
git checkout 003-data-ingestion

# 2. Install new dependency
npm install papaparse
npm install --save-dev @types/papaparse

# 3. Run Prisma migration (adds ImportBatch model, modifies Judge)
npx prisma migrate dev --name add-import-batch

# 4. Generate Prisma client
npx prisma generate

# 5. Start dev server
npm run dev
```

## Feature Walkthrough

### Step 1: Seed Courts (US3)

Before importing judges, create courts for a pilot state:

1. Navigate to `http://localhost:3000/admin/courts/`
2. Select a state (e.g., "Texas")
3. Enter court types: "District Court", "County Court", "Justice of the Peace Court"
4. Click "Create Courts" → courts are created for all counties in that state

### Step 2: Import Judges (US1)

1. Prepare a CSV file with columns: `Judge Name`, `Court Type`, `County`, `State`, `Source URL`
2. Navigate to `http://localhost:3000/admin/import/`
3. Select the target state from the dropdown
4. Upload the CSV file
5. Review the preview: valid rows, invalid rows, duplicates, courts to auto-create
6. Adjust column mapping if needed
7. Click "Confirm Import" → judge records are created as `UNVERIFIED`

> **Note**: If your CSV includes a `State` column, the system validates that each row's state matches the selected dropdown state. Mismatches are flagged as errors in the preview.

### Step 3: Verify Judges (US2)

1. Navigate to `http://localhost:3000/admin/verification/`
2. Review unverified records — each shows the judge's name, court, and source URL
3. Click the source URL to cross-reference against the official government page
4. Click "Verify" to publish, "Reject" to soft-delete, or edit inline before verifying

### Step 4: Track Progress (US4)

1. Navigate to `http://localhost:3000/admin/dashboard/`
2. View total imported, total verified, and per-state breakdown
3. Monitor progress toward the 1,500-judge pilot target

## New Admin Pages

| URL                    | Purpose                           |
| ---------------------- | --------------------------------- |
| `/admin/courts/`       | Bulk court creation by state      |
| `/admin/import/`       | CSV upload + preview + confirm    |
| `/admin/verification/` | Verification queue with filtering |
| `/admin/dashboard/`    | Ingestion progress dashboard      |

## New API Endpoints

| Method | Endpoint                            | Purpose              |
| ------ | ----------------------------------- | -------------------- |
| POST   | `/api/admin/import`                 | Upload + parse CSV   |
| POST   | `/api/admin/import/confirm`         | Execute import       |
| GET    | `/api/admin/import`                 | List batches         |
| GET    | `/api/admin/import/status`          | Import lock status   |
| GET    | `/api/admin/import/{batchId}`       | Batch detail         |
| DELETE | `/api/admin/import/{batchId}`       | Rollback batch       |
| GET    | `/api/admin/verification`           | Verification queue   |
| PATCH  | `/api/admin/verification/{judgeId}` | Verify/reject single |
| PATCH  | `/api/admin/verification/batch`     | Batch verify/reject  |
| POST   | `/api/admin/courts/bulk`            | Bulk court creation  |
| GET    | `/api/admin/dashboard`              | Dashboard stats      |

## Key Design Decisions

| Decision            | Choice                                 | Reference                         |
| ------------------- | -------------------------------------- | --------------------------------- |
| CSV parser          | papaparse                              | [research.md](research.md) §1     |
| File upload         | Native `request.formData()`            | [research.md](research.md) §2     |
| Import concurrency  | Sequential (in-memory lock)            | [research.md](research.md) §3     |
| Bulk insert         | Prisma `createMany` + `skipDuplicates` | [research.md](research.md) §4     |
| Duplicate detection | Pre-fetch + in-memory Set              | [research.md](research.md) §5     |
| Rejection behavior  | Soft-delete (`REJECTED` status)        | [spec.md](spec.md) Clarifications |
| Rollback constraint | Blocked if any judges verified         | [spec.md](spec.md) FR-016         |
| Queue pagination    | 50 records per page                    | [spec.md](spec.md) FR-010         |

## CSV Format Example

```csv
Judge Name,Court Type,County,State,Source URL,Selection Method
Jane Smith,District Court,Harris,Texas,https://txcourts.gov/judges/smith,Elected
John Doe,County Court,Dallas,Texas,https://txcourts.gov/judges/doe,Appointed
```

**Required columns**: `Judge Name` (or mapped equivalent), `Source URL`
**State**: Selected via dropdown during import. If a `State` column is present in the CSV, each row is validated against the dropdown selection (accepts full name, abbreviation, or slug).
**Optional columns**: `State`, `Term Start`, `Term End`, `Selection Method`, `Appointing Authority`, `Education`, `Prior Experience`, `Political Affiliation`
