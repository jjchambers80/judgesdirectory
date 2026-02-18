# Feature Specification: Phase 2 — Data Ingestion

**Feature Branch**: `003-data-ingestion`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "phase 2"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Bulk CSV Import of Judge Records (Priority: P1) 🎯 MVP

An admin user prepares a CSV file containing judge records sourced from a state judicial branch website. The admin uploads the CSV through the admin panel, maps columns to judge fields, previews the parsed records, and imports them in a single batch. All imported records are created with `verified: false` and a source URL linking to the official government page.

**Why this priority**: The existing one-at-a-time admin form cannot practically reach the 1,500-judge pilot target across 3 states. Bulk CSV import is the minimum viable path to populate the directory at the scale required by Constitution Principle IV.

**Independent Test**: Create a CSV with 50 judge records for a single county. Upload via the admin panel. Confirm all 50 records appear in the judge list as unverified with correct court assignments and source URLs.

**Acceptance Scenarios**:

1. **Given** a CSV file with columns for judge name, court type, county, state, and source URL, **When** the admin uploads the file, **Then** the system parses the CSV and displays a preview showing the number of records, detected columns, and any validation warnings.
2. **Given** a parsed CSV preview with 50 valid records, **When** the admin confirms import, **Then** all 50 judge records are created with `verified: false`, correct court/county/state associations, and the provided source URL.
3. **Given** a CSV containing a judge whose name and court already exist in the database, **When** the admin confirms import, **Then** the duplicate record is skipped and reported in the import summary (not silently lost, not double-inserted).
4. **Given** a CSV with some rows missing required fields (full name or source URL), **When** the admin previews the file, **Then** the invalid rows are highlighted with specific error messages and excluded from the importable count.
5. **Given** a CSV where a court type does not yet exist for a county, **When** the import is confirmed, **Then** the system auto-creates the court record (matching the existing inline court creation behavior from the admin form).

---

### User Story 2 — Verification Workflow for Imported Records (Priority: P1)

An admin reviews imported judge records against their official government source. The admin opens a verification queue filtered to unverified records, clicks through to each record's source URL, confirms the data is accurate, and marks the record as verified. Verified records become visible on public-facing pages.

**Why this priority**: Constitution Principle I (NON-NEGOTIABLE) requires manual verification before publication. Without a verification workflow, imported records remain invisible to the public and the directory has no content. This is equally critical as import itself.

**Independent Test**: Import 10 judge records via CSV. Navigate to the verification queue. Verify 5 records. Confirm only the 5 verified judges appear on the public-facing pages. Confirm the remaining 5 are still in the queue.

**Acceptance Scenarios**:

1. **Given** 100 imported unverified judge records, **When** the admin navigates to the verification queue, **Then** the queue displays records sorted by import date (newest first) with the judge name, court, county, state, and a link to the source URL.
2. **Given** an unverified judge record with a source URL, **When** the admin clicks "Verify", **Then** the record is marked as verified and immediately becomes visible on the corresponding public page.
3. **Given** an unverified record that the admin finds inaccurate, **When** the admin clicks "Reject", **Then** the record is marked with a "rejected" status, hidden from the verification queue and public pages, but retained in the database for audit and potential recovery.
4. **Given** a verification queue with records from multiple states, **When** the admin filters by state, **Then** only records from the selected state are displayed.
5. **Given** an unverified record, **When** the admin wants to correct a minor detail before verifying, **Then** the admin can edit the record inline and then verify the corrected version.

---

### User Story 3 — Pilot State Seeding with Court Data (Priority: P1)

Before judge records can be imported, the 3 pilot states need court records associated with their counties. An admin selects a pilot state and uses a bulk court creation tool to define court types (e.g., "District Court", "Circuit Court", "Superior Court") and apply them across multiple counties at once rather than creating them one county at a time.

**Why this priority**: The current system has 50 states and ~3,143 counties seeded but zero courts. Courts are required as parents for judge records. Creating courts one-at-a-time per county across 3 states (potentially 100+ counties) is a bottleneck that blocks all judge data import.

**Independent Test**: Select a pilot state (e.g., Texas). Define 3 court types. Apply them to all counties in that state. Confirm courts are created and visible in the admin panel's court dropdown for each county.

**Acceptance Scenarios**:

1. **Given** a pilot state with 254 counties and no courts, **When** the admin defines court types ["District Court", "County Court", "Justice of the Peace Court"] and applies them to all counties, **Then** 762 court records are created (3 types × 254 counties).
2. **Given** a state where some counties already have certain court types, **When** the admin applies court types in bulk, **Then** existing court records are not duplicated and only missing combinations are created.
3. **Given** a completed bulk court creation, **When** the admin views any county in that state via the admin panel, **Then** the court dropdown shows the newly created courts.

---

### User Story 4 — Import Progress Dashboard (Priority: P2)

An admin needs to track the overall progress toward the 1,500-judge pilot target across the 3 pilot states. The admin views a dashboard showing total judges imported, total verified, breakdown by state, and progress toward the target.

**Why this priority**: Without visibility into progress, the team cannot coordinate data collection efforts, identify which states or counties still need attention, or confirm when the pilot milestone is reached. Important but not blocking data entry itself.

**Independent Test**: Import records for 2 states. Navigate to the dashboard. Confirm the state-level breakdown matches the imported counts. Confirm the progress bar reflects the 1,500 target.

**Acceptance Scenarios**:

1. **Given** judges imported across 3 pilot states, **When** the admin opens the ingestion dashboard, **Then** it displays total imported, total verified, total remaining (unverified), and a progress indicator toward the 1,500 target.
2. **Given** a dashboard showing state-level breakdown, **When** one state has 400 verified and another has 200, **Then** each state shows its individual count and percentage of total.
3. **Given** the verified count reaches 1,500, **When** the admin views the dashboard, **Then** a clear visual indicator confirms the pilot milestone is met.

---

### User Story 5 — Batch Verification (Priority: P2)

An admin who has cross-referenced a batch of records from a single source wants to verify multiple records at once instead of clicking "Verify" on each individually.

**Why this priority**: Verifying 1,500+ records one at a time is tedious and error-prone. Batch verification dramatically reduces the time to reach the pilot milestone. Not P1 because single-record verification (US2) is functional — this is an efficiency optimization.

**Independent Test**: Import 20 records from the same source. Select all 20 in the verification queue. Click "Verify Selected". Confirm all 20 are now verified.

**Acceptance Scenarios**:

1. **Given** 20 unverified records in the verification queue, **When** the admin selects all 20 and clicks "Verify Selected", **Then** all 20 records are marked as verified in a single operation.
2. **Given** a selection of 15 records, **When** 2 of them fail verification (e.g., source URL returns a 404), **Then** the 13 successful verifications proceed and the 2 failures are reported with reasons.
3. **Given** a large verification queue, **When** the admin uses "Select All on Page", **Then** only the visible page of records is selected (not the entire queue).

---

### Edge Cases

- **EC-001**: CSV file exceeds 10,000 rows — system MUST reject with a clear size limit message rather than timing out.
- **EC-002**: CSV file uses non-UTF-8 encoding (e.g., Windows-1252 from Excel) — system MUST detect and handle or display a clear encoding error.
- **EC-003**: CSV contains judges for a state not in the 3 pilot states — system MUST allow import (states are already seeded) but the dashboard only tracks pilot states.
- **EC-004**: Two concurrent admins import overlapping CSV files — system processes imports sequentially (one at a time); a second upload is rejected with a clear "import in progress" message (HTTP 409), preventing race-condition duplicates.
- **EC-005**: Admin accidentally imports the wrong CSV file — there MUST be a way to undo/rollback a specific import batch.
- **EC-006**: CSV column headers use inconsistent naming (e.g., "Judge Name" vs "Full Name" vs "Name") — the column mapping step MUST allow manual header-to-field mapping.
- **EC-007**: Judge has a very long name or name with special characters (hyphens, apostrophes, suffixes like "Jr.", "III") — slug generation MUST handle these gracefully.

## Clarifications

### Session 2026-02-18

- Q: If an admin rolls back an import batch but some records are already verified, what happens? → A: Rollback is blocked if any records in the batch are verified. Admin must un-verify those records first.
- Q: How many records should the verification queue display per page? → A: 50 records per page.
- Q: What should happen to records when an admin rejects them during verification? → A: Soft-delete (mark as "rejected" status, hidden from queue and public pages, recoverable).
- Q: What constitutes a duplicate judge for import deduplication? → A: Same full name + same court (simplest rule, sufficient for pilot scale).
- Q: Should CSV imports process sequentially or in parallel? → A: Sequential (one import at a time, subsequent attempts rejected with 409). Eliminates race conditions at pilot scale.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST accept CSV file uploads through the admin panel with a maximum file size of 5 MB.
- **FR-002**: System MUST parse CSV files and display a preview of detected columns, row count, and sample data before any records are created.
- **FR-003**: System MUST allow admins to map CSV columns to judge record fields (full name, court type, county name, term start, term end, selection method, appointing authority, education, prior experience, political affiliation, source URL). State is specified once per import batch (not per-row) and MUST support non-standard column headers through a manual column mapping interface.
- **FR-004**: System MUST validate each CSV row — full name and source URL are required; rows missing either MUST be flagged as invalid and excluded from import.
- **FR-005**: System MUST auto-match county names from CSV values to existing database records using case-insensitive matching within the state specified at import confirmation time.
- **FR-006**: System MUST auto-create court records when a CSV references a court type that does not yet exist for a given county.
- **FR-007**: System MUST detect duplicate judges (same full name + same court) and skip them during import, reporting the number of duplicates in the import summary.
- **FR-008**: All imported judge records MUST be created with `status: UNVERIFIED` per Constitution Principle I.
- **FR-009**: System MUST assign each imported batch a unique batch identifier so that an entire import can be reviewed or rolled back.
- **FR-010**: System MUST provide a verification queue showing all unverified judge records with filtering by state, county, and import batch. The queue MUST be paginated at 50 records per page.
- **FR-011**: System MUST allow single-record verification (mark as verified) and single-record rejection (mark as "rejected" — soft-delete, hidden from queue and public pages but retained in database) from the verification queue.
- **FR-012**: System MUST allow batch verification — selecting multiple records and verifying them in a single action.
- **FR-013**: System MUST provide a bulk court creation tool that applies one or more court types across all counties in a selected state.
- **FR-014**: System MUST display an ingestion dashboard showing total imported, total verified, per-state breakdown, and progress toward the 1,500-judge pilot target.
- **FR-015**: _(Consolidated into FR-003.)_
- **FR-016**: System MUST allow admins to rollback an entire import batch, deleting all records created in that batch. Rollback MUST be blocked if any records in the batch have been verified; the admin must un-verify those records before rollback is permitted.
- **FR-017**: The CSV import process MUST complete within 30 seconds for files up to 5,000 rows.
- **FR-018**: System MUST record the import batch ID on each judge record so records can be traced back to their source import.
- **FR-019**: System MUST process CSV imports sequentially — only one import may execute at a time. If an import is already in progress, subsequent uploads MUST be rejected with a clear "import in progress" error message (HTTP 409).

### Key Entities

- **ImportBatch**: Represents a single CSV import operation. Key attributes: unique batch ID, file name, row count, success count, skip count, error count, timestamp, status (pending/complete/rolled-back). _(No individual admin user field — Basic Auth is shared.)_
- **Judge** (extended): Existing entity gains an optional association to ImportBatch for traceability.
- **Court** (existing): Auto-created during import when referenced court types don't exist for a county.
- **State / County** (existing): Used as lookup targets during CSV column matching. No schema changes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An admin can import a 500-row CSV file and have all valid records appear in the verification queue within 30 seconds.
- **SC-002**: 1,500 judge profiles are verified and publicly visible across the 3 pilot states, meeting the Constitution Principle IV milestone.
- **SC-003**: An admin can verify 50 records in a single batch action in under 10 seconds.
- **SC-004**: Zero duplicate judge records exist in the database after multiple overlapping CSV imports for the same state.
- **SC-005**: An admin can roll back an entire erroneous import batch and restore the database to its pre-import state within 1 minute.
- **SC-006**: 100% of published (verified) judge profiles have a non-empty source URL linking to an official government record, per Constitution Principle I.
- **SC-007**: The ingestion dashboard accurately reflects import/verification progress and clearly indicates when the 1,500-judge pilot milestone is reached.

### Assumptions

- The 3 pilot states will be selected by the project lead before data collection begins. The system does not restrict which states are chosen — any 3 of the 50 seeded states can serve as pilots.
- CSV files will be hand-prepared by the admin team from publicly available government judicial branch websites. The format may vary per source.
- The existing admin Basic Auth is sufficient for Phase 2 — no additional user roles or permissions are needed.
- Court type naming conventions (e.g., "District Court" vs "District") will be standardized by the admin team during data preparation, not enforced by the system beyond exact-match deduplication.
