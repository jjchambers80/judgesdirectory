# Tasks: Phase 2 — Data Ingestion

**Input**: Design documents from `/specs/003-data-ingestion/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story to enable independent implementation and testing. User stories ordered by priority (P1 → P2).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies and create project scaffolding for Phase 2

- [x] T001 Install papaparse and @types/papaparse dependencies per research.md §1
- [x] T002 Add ImportBatch model, JudgeStatus enum, and ImportBatchStatus enum to prisma/schema.prisma per data-model.md
- [x] T003 Replace `verified Boolean` with `status JudgeStatus @default(UNVERIFIED)` and add `importBatchId` FK on Judge model in prisma/schema.prisma per data-model.md
- [x] T004 Run Prisma migration (`npx prisma migrate dev --name add-import-batch-and-judge-status`) and regenerate client
- [x] T005 [P] Add CSV import constants (MAX_FILE_SIZE_BYTES, MAX_CSV_ROWS, VERIFICATION_PAGE_SIZE, PILOT_TARGET) to src/lib/constants.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Migrate existing code from `verified: Boolean` to `status: JudgeStatus` enum. MUST complete before any user story work — all existing queries and UI references to `verified` must use `status` instead.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete — the schema has changed.

- [x] T006 Update public court page to filter judges by `status: 'VERIFIED'` instead of `verified: true` in src/app/judges/[state]/[county]/[courtType]/page.tsx
- [x] T007 [P] Update public judge detail page to check `judge.status === 'VERIFIED'` instead of `judge.verified` in src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx
- [x] T008 [P] Update sitemap to filter by `status: 'VERIFIED'` instead of `verified: true` in src/app/sitemap.ts
- [x] T009 Update admin judges list API to replace `verified` query param with `status` filter and return `status` field instead of `verified` in src/app/api/admin/judges/route.ts
- [x] T010 Update admin judges list API POST handler to set `status: 'UNVERIFIED'` instead of `verified: false` in src/app/api/admin/judges/route.ts
- [x] T011 [P] Update admin judge detail API to return `status` field instead of `verified` in src/app/api/admin/judges/[id]/route.ts
- [x] T012 Refactor admin verify endpoint to use `status` enum (VERIFIED/UNVERIFIED) instead of `verified` boolean toggle in src/app/api/admin/judges/[id]/verify/route.ts
- [x] T013 Update admin judges page UI to use `status` filter (UNVERIFIED/VERIFIED/REJECTED) instead of `verified` boolean filter, update type interface, status badges, and verify/unverify handlers in src/app/admin/judges/page.tsx
- [x] T014 Add new admin navigation links (Import, Verification, Courts, Dashboard) to src/app/admin/layout.tsx

**Checkpoint**: All existing functionality works with the new `status` enum. No references to `verified` remain in source code. Admin nav includes links to new pages (which will be built in subsequent phases).

---

## Phase 3: User Story 3 — Pilot State Seeding with Court Data (Priority: P1)

**Goal**: Bulk court creation tool allowing admins to define court types and apply them across all counties in a selected state — unblocking judge import.

**Independent Test**: Select Texas (254 counties). Define 3 court types. Apply. Confirm 762 courts created.

**Why Phase 3 before US1**: Courts are required as parents for judge records. Court seeding must happen before CSV import can succeed.

### Implementation for User Story 3

- [x] T015 [P] [US3] Create bulk court creation API route handling POST requests per contracts §10 in src/app/api/admin/courts/bulk/route.ts
- [x] T016 [P] [US3] Create BulkCourtForm component (state selector dropdown, court type multi-input, submit button, results display) in src/components/admin/BulkCourtForm.tsx
- [x] T017 [US3] Create bulk court creation admin page composing BulkCourtForm with state list fetched from existing states API in src/app/admin/courts/page.tsx

**Checkpoint**: Admin can select a state, define court types, and create courts in bulk. Courts appear in admin court dropdowns. US3 is independently testable.

---

## Phase 4: User Story 1 — Bulk CSV Import of Judge Records (Priority: P1) 🎯 MVP

**Goal**: Admin uploads a CSV, maps columns, previews parsed records, and imports judges in bulk — all created as UNVERIFIED with source URLs.

**Independent Test**: Create a 50-row CSV for a single county. Upload via admin. Confirm all 50 records appear in judge list as UNVERIFIED with correct court assignments and source URLs.

### Implementation for User Story 1

- [x] T018 [P] [US1] Create CSV parsing and validation module (parse CSV with papaparse, detect non-UTF-8 encoding and return clear error per EC-002, validate required fields, detect duplicates via pre-fetch Set, auto-match state/county names, validate slug generation handles long names and special characters per EC-007) in src/lib/csv.ts
- [x] T019 [P] [US1] Create sequential import lock module (in-memory Promise-based mutex, ~15 LOC per research.md §3) in src/lib/import-lock.ts
- [x] T020 [US1] Create CSV upload + parse API route handling POST multipart/form-data (validate file size ≤5MB, row count ≤10K, parse CSV, create PENDING ImportBatch, return preview with valid/invalid/duplicate breakdown) per contracts §1 in src/app/api/admin/import/route.ts
- [x] T021 [US1] Add import batch list API route handling GET with pagination and status filter per contracts §3 in src/app/api/admin/import/route.ts (same file as T020, GET handler)
- [x] T022 [P] [US1] Create import confirm API route handling POST (acquire import lock, validate batch + column mapping, auto-create courts in transaction, bulk insert judges via createMany with skipDuplicates, update ImportBatch counts, release lock) per contracts §2 in src/app/api/admin/import/confirm/route.ts
- [x] T023 [P] [US1] Create import lock status API route handling GET per contracts §4 in src/app/api/admin/import/status/route.ts
- [x] T024 [P] [US1] Create import batch detail API route handling GET per contracts §5 in src/app/api/admin/import/[batchId]/route.ts
- [x] T025 [US1] Add import batch rollback API route handling DELETE (check no verified judges, delete all batch judges, update status to ROLLED_BACK) per contracts §6 in src/app/api/admin/import/[batchId]/route.ts (same file as T024, DELETE handler)
- [x] T026 [P] [US1] Create CsvUploader component (file input with drag-drop, 5MB limit display, upload progress, error states) in src/components/admin/CsvUploader.tsx
- [x] T027 [P] [US1] Create ColumnMapper component (auto-detected mapping with manual override dropdowns, required field indicators) in src/components/admin/ColumnMapper.tsx
- [x] T028 [P] [US1] Create ImportSummary component (post-import results: success/skip/error counts, duplicate details, error details, rollback button) in src/components/admin/ImportSummary.tsx
- [x] T029 [US1] Create CSV import admin page composing CsvUploader → preview → ColumnMapper → confirm → ImportSummary flow, plus batch list table with rollback actions in src/app/admin/import/page.tsx

**Checkpoint**: Full CSV import workflow functional end-to-end. Admin can upload CSV, preview, map columns, confirm import, view batch history, and rollback. All imported judges created as UNVERIFIED. US1 is independently testable.

---

## Phase 5: User Story 2 — Verification Workflow for Imported Records (Priority: P1)

**Goal**: Admin reviews imported judges against source URLs, verifies accurate records (making them public), and rejects inaccurate ones (soft-delete).

**Independent Test**: Import 10 judges via CSV. Navigate to verification queue. Verify 5. Confirm only the 5 verified judges appear on public pages. Confirm 5 remain in queue.

### Implementation for User Story 2

- [x] T030 [P] [US2] Create verification queue API route handling GET with pagination (50/page), filtering by state/county/batch/status, and sorting per contracts §7 in src/app/api/admin/verification/route.ts
- [x] T031 [P] [US2] Create single-record verify/reject API route handling PATCH with status transition validation (UNVERIFIED→VERIFIED, UNVERIFIED→REJECTED, VERIFIED→UNVERIFIED, REJECTED→UNVERIFIED) per contracts §8 in src/app/api/admin/verification/[judgeId]/route.ts
- [x] T032 [P] [US2] Create VerificationQueue component (table with judge name, court, county, state, source URL link, status badge, verify/reject/edit action buttons, filter controls for state/county/batch, pagination) in src/components/admin/VerificationQueue.tsx
- [x] T033 [US2] Create verification admin page composing VerificationQueue with filter state management and inline edit capability in src/app/admin/verification/page.tsx

**Checkpoint**: Full verification workflow functional. Admin can filter queue, verify/reject records, edit inline. Verified judges appear on public pages. Rejected judges are soft-deleted. US2 is independently testable.

---

## Phase 6: User Story 4 — Import Progress Dashboard (Priority: P2)

**Goal**: Admin views dashboard showing total imported, total verified, per-state breakdown, and progress toward the 1,500-judge pilot target.

**Independent Test**: Import records for 2 states. Navigate to dashboard. Confirm state-level breakdown matches. Confirm progress bar reflects 1,500 target.

### Implementation for User Story 4

- [x] T034 [P] [US4] Create dashboard stats API route handling GET with optional pilotStates filter, returning totals (imported/verified/unverified/rejected/percentComplete), byState breakdown, recentBatches, and milestoneReached flag per contracts §11 in src/app/api/admin/dashboard/route.ts
- [x] T035 [P] [US4] Create ProgressDashboard component (overall progress bar toward 1,500 target, total counts, per-state breakdown table, recent batches list, milestone celebration indicator) in src/components/admin/ProgressDashboard.tsx
- [x] T036 [US4] Create dashboard admin page composing ProgressDashboard with pilot state configuration in src/app/admin/dashboard/page.tsx

**Checkpoint**: Dashboard accurately reflects import/verification progress. State-level breakdown visible. Milestone indicator works. US4 is independently testable.

---

## Phase 7: User Story 5 — Batch Verification (Priority: P2)

**Goal**: Admin selects multiple records from the verification queue and verifies/rejects them in a single action.

**Independent Test**: Import 20 records. Select all 20 in verification queue. Click "Verify Selected". Confirm all 20 are verified.

### Implementation for User Story 5

- [x] T037 [P] [US5] Create batch verify/reject API route handling PATCH with array of judgeIds (max 50) and action per contracts §9 in src/app/api/admin/verification/batch/route.ts
- [x] T038 [US5] Add multi-select checkboxes, "Select All on Page" toggle, and "Verify Selected"/"Reject Selected" batch action buttons to VerificationQueue component in src/components/admin/VerificationQueue.tsx
- [x] T039 [US5] Wire batch action buttons in verification page to call batch API endpoint and refresh queue after completion in src/app/admin/verification/page.tsx

**Checkpoint**: Batch verification functional. Admin can select multiple records and verify/reject in bulk. Partial failures reported. US5 is independently testable.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, cleanup, and documentation

- [x] T040 [P] Verify all admin pages meet Constitution Principle VI requirements: semantic HTML with proper form labels and table headers, keyboard navigation, skip-navigation links, visible focus indicators, 200% zoom usability, 320px reflow without horizontal scroll, `prefers-reduced-motion` respected, color contrast ≥ 4.5:1 (normal) / 3:1 (large), Lighthouse accessibility score ≥ 90 in src/app/admin/ and src/components/admin/
- [x] T041 [P] Confirm no remaining references to `verified` boolean in any source file — complete migration to `status` enum
- [x] T042 Run quickstart.md walkthrough end-to-end (seed courts → import CSV → verify → dashboard), validate import performance with a 5,000-row CSV completes within 30 seconds per FR-017, and fix any issues
- [x] T043 Update admin home page to include summary links to new sections (import, verification, courts, dashboard) in src/app/admin/page.tsx

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema must be migrated first) — **BLOCKS all user stories**
- **US3 Courts (Phase 3)**: Depends on Phase 2 — courts must exist before judge import
- **US1 Import (Phase 4)**: Depends on Phase 2; benefits from Phase 3 (courts exist) but can auto-create courts
- **US2 Verification (Phase 5)**: Depends on Phase 2; benefits from Phase 4 (judges to verify)
- **US4 Dashboard (Phase 6)**: Depends on Phase 2; benefits from Phase 4 (data to display)
- **US5 Batch Verification (Phase 7)**: Depends on Phase 5 (extends VerificationQueue component)
- **Polish (Phase 8)**: Depends on all phases complete

### User Story Dependencies

- **US3 (Courts)**: Independent after Phase 2 — no dependency on other stories
- **US1 (Import)**: Independent after Phase 2 — auto-creates courts if needed, but recommended after US3
- **US2 (Verification)**: Independent after Phase 2 — can verify manually-created judges, but most useful after US1
- **US4 (Dashboard)**: Independent after Phase 2 — shows zero counts until judges exist
- **US5 (Batch Verify)**: Depends on US2 — extends the VerificationQueue component

### Within Each User Story

- Lib modules before API routes
- API routes before UI components
- UI components before page composition
- Core implementation before integration

### Parallel Opportunities

**Phase 2 (Foundational)**: T006 + T007 + T008 can run in parallel; T009 + T011 can run in parallel
**Phase 3 (US3)**: T015 + T016 can run in parallel (API + component), then T017
**Phase 4 (US1)**: T018 + T019 in parallel (lib modules); T022 + T023 + T024 in parallel (independent API routes); T026 + T027 + T028 in parallel (independent components)
**Phase 5 (US2)**: T030 + T031 + T032 in parallel (API routes + component), then T033
**Phase 6 (US4)**: T034 + T035 in parallel (API + component), then T036
**Phase 7 (US5)**: T037 in parallel with nothing (extends existing), then T038, then T039
**Phase 8**: T040 + T041 in parallel

---

## Parallel Example: User Story 1

```bash
# Step 1 — Lib modules in parallel:
Task T018: "Create CSV parsing module in src/lib/csv.ts"
Task T019: "Create import lock module in src/lib/import-lock.ts"

# Step 2 — API routes (some parallel, some sequential):
Task T020: "Create import upload+parse API in src/app/api/admin/import/route.ts"
Task T021: "Add batch list GET handler in src/app/api/admin/import/route.ts" (same file as T020)
  # T022, T023, T024 can run in parallel with each other (different files):
Task T022: "Create import confirm API in src/app/api/admin/import/confirm/route.ts"
Task T023: "Create import status API in src/app/api/admin/import/status/route.ts"
Task T024: "Create batch detail API in src/app/api/admin/import/[batchId]/route.ts"
Task T025: "Add rollback DELETE handler in src/app/api/admin/import/[batchId]/route.ts" (same file as T024)

# Step 3 — UI components in parallel:
Task T026: "Create CsvUploader component in src/components/admin/CsvUploader.tsx"
Task T027: "Create ColumnMapper component in src/components/admin/ColumnMapper.tsx"
Task T028: "Create ImportSummary component in src/components/admin/ImportSummary.tsx"

# Step 4 — Page composition (depends on all above):
Task T029: "Create import admin page in src/app/admin/import/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 3 + User Story 1)

1. Complete Phase 1: Setup (T001–T005)
2. Complete Phase 2: Foundational — migrate `verified` → `status` (T006–T014)
3. Complete Phase 3: US3 — Bulk Court Seeding (T015–T017)
4. Complete Phase 4: US1 — CSV Import (T018–T029)
5. **STOP and VALIDATE**: Seed courts for a pilot state, import a test CSV, verify records appear as UNVERIFIED
6. Deploy/demo if ready — MVP achieved

### Incremental Delivery

1. Setup + Foundational → Schema migrated, existing features work with new enum
2. Add US3 (Courts) → Seed pilot state courts → Validate
3. Add US1 (Import) → Import test CSV → Validate (MVP!)
4. Add US2 (Verification) → Verify imported judges → Public pages populated
5. Add US4 (Dashboard) → Track progress toward 1,500 target
6. Add US5 (Batch Verify) → Accelerate verification throughput
7. Polish → Accessibility audit, quickstart validation, cleanup

### Single Developer Strategy

Phases execute sequentially in priority order:

1. Setup → Foundational → US3 → US1 → **MVP checkpoint**
2. US2 → US4 → US5 → Polish

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks in this phase
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable after Phase 2
- No test tasks included — testing is manual per plan.md (no test framework installed)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Total tasks: 43
