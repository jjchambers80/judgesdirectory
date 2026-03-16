# Tasks: Admin Data Tables

**Input**: Design documents from `/specs/013-admin-data-tables/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Tests**: Not requested — test tasks omitted per specification.

**Organization**: Tasks are organized by user story. Each user story migrates a subset of tables, validating that story's primary capability. All tables receive full DataTable features upon migration.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3, US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Install dependencies and create shared utilities

- [x] T001 Install @tanstack/react-table dependency via `npm install @tanstack/react-table`
- [x] T002 [P] Install shadcn/ui components via `npx shadcn@latest add dropdown-menu checkbox select popover`
- [x] T003 [P] Create useDebounce hook in src/hooks/use-debounce.ts — generic hook accepting value and delay (default 300ms), returns debounced value; see research.md §3 for implementation pattern

---

## Phase 2: Foundational (Core DataTable Components + API Changes)

**Purpose**: Build all reusable DataTable primitives and expand API sort capabilities. MUST complete before any table migration.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

### DataTable Primitives

- [x] T004 [P] Create DataTableColumnHeader component in src/components/ui/data-table-column-header.tsx — renders sortable `<button>` in table header with ascending/descending/unsorted arrow icons (lucide ArrowUp, ArrowDown, ArrowUpDown), sets aria-sort attribute, calls column.toggleSorting() on click; accepts Column instance and title string; non-sortable columns render plain text
- [x] T005 [P] Create DataTablePagination component in src/components/ui/data-table-pagination.tsx — renders page navigation (prev/next buttons via shadcn Button), page indicator ("Page X of Y"), rows-per-page selector (shadcn Select with options 25, 50, 100), selected row count display ("N of M row(s) selected"); accepts table instance; uses aria-label on all buttons
- [x] T006 [P] Create DataTableFacetedFilter component in src/components/ui/data-table-faceted-filter.tsx — renders a shadcn Popover containing a scrollable list of shadcn Checkbox items for value-selection filtering; shows filter title as trigger button text + selected count Badge; accepts column instance and options array (label, value, icon?); fires column.setFilterValue() on selection change
- [x] T007 Create DataTableToolbar component in src/components/ui/data-table-toolbar.tsx — renders toolbar row above table containing: debounced text filter Input (wired to useDebounce from src/hooks/use-debounce.ts), DataTableFacetedFilter dropdowns per filterable column, column visibility DropdownMenu (shadcn DropdownMenu with checkbox items per column), "Clear filters" Button (shadcn Button variant="ghost") shown only when any filter is active; accepts table instance and toolbar configuration object describing which filters to render
- [x] T008 Create DataTable component in src/components/ui/data-table.tsx — generic `DataTable<TData, TValue>` component accepting ColumnDef[], data[], and optional configuration (manualSorting, manualFiltering, manualPagination, onStateChange callback, toolbar config, pagination config, renderSubComponent for expandable rows); instantiates useReactTable with getCoreRowModel + conditional getSortedRowModel/getFilteredRowModel/getPaginationRowModel for client-side mode + getExpandedRowModel when renderSubComponent is provided; renders DataTableToolbar + shadcn Table/TableHeader/TableBody/TableRow/TableCell with flexRender for cells + DataTablePagination; when a row is expanded and renderSubComponent is provided, renders a full-width TableRow below the data row containing the sub-component output; shows "No results." empty state row when filtered data is empty; supports row selection via getRowSelectionRowModel; supports column visibility via getVisibilityRowModel

### API Sort Allowlist Expansion

- [x] T009 [P] Expand sort allowlist in src/app/api/admin/discovery/route.ts — define VALID_SORT_FIELDS array containing discoveredAt, confidenceScore, stateAbbr, status, url; validate incoming sort param against allowlist with fallback to discoveredAt; build dynamic Prisma orderBy object from validated field and order param; replace existing two-branch conditional with allowlist pattern per contracts/api-sort-allowlists.md
- [x] T010 [P] Expand sort allowlist in src/app/api/admin/health/route.ts — add url, stateAbbr, totalScrapes to existing sort field validation alongside healthScore, lastScrapedAt, lastYield, avgYield; build dynamic Prisma orderBy from validated sort/order params per contracts/api-sort-allowlists.md
- [x] T011 [P] Add sort/order query params to src/app/api/admin/judges/route.ts — define VALID_SORT_FIELDS (fullName, createdAt, status); parse sort and order from searchParams with defaults (createdAt, desc); validate against allowlist; build dynamic Prisma orderBy replacing hardcoded `{ createdAt: "desc" }` per contracts/api-sort-allowlists.md
- [x] T012 [P] Add sort/order query params to src/app/api/admin/import/route.ts — define VALID_SORT_FIELDS (createdAt, status, totalRows); parse sort and order from searchParams with defaults (createdAt, desc); validate against allowlist; build dynamic Prisma orderBy replacing hardcoded `{ createdAt: "desc" }` per contracts/api-sort-allowlists.md

**Checkpoint**: Foundation ready — all DataTable primitives built, all API endpoints support expanded sorting. Table migrations can begin.

---

## Phase 3: User Story 1 — Sort Any Column (Priority: P1) 🎯 MVP

**Goal**: Validate the entire DataTable architecture by migrating URL Discovery — the most feature-rich admin table (9 columns, server-side sort/filter/page, row selection, bulk actions). Admins can click any sortable column header to sort with visual arrow indicators cycling through ascending → descending → unsorted.

**Independent Test**: Load /admin/discovery, click "State" column header → rows reorder by state ascending with up-arrow icon. Click again → descending with down-arrow. Click again → sort resets. Verify bulk approve/reject still works with selected rows.

### Implementation for User Story 1

- [x] T013 [US1] Migrate URL Discovery table to DataTable in src/app/admin/discovery/page.tsx — define ColumnDef[] array (9 columns per data-model.md Table 1: select checkbox, url with truncated link + domain subtitle, stateAbbr with select filter, suggestedType with select filter, suggestedLevel with select filter, confidenceScore with color-coded badge, status with color-coded badge + isStale handling + select filter, discoveredAt formatted date, actions with Approve/Reject buttons); replace raw `<table>` with DataTable component; wire server-side state with manualSorting/manualFiltering/manualPagination passing sort/order/state/status/page/limit to existing fetch; preserve row selection state and bulk approve/reject toolbar; preserve state and status filter dropdowns as faceted filters in toolbar; use controlled sorting/columnFilters/pagination/rowSelection state

**Checkpoint**: Discovery table fully functional with DataTable — sorting, filtering, pagination, row selection, bulk actions all work. Remaining 5 tables still use original implementation.

---

## Phase 4: User Story 2 — Filter by Column Values (Priority: P2)

**Goal**: Validate filtering patterns — text search on URL fields, faceted status/state/trend dropdowns, debounced text input — by migrating URL Health and Verification Queue tables. Admins can filter any column with real-time results.

**Independent Test**: Load /admin/health, select "unhealthy" in Status faceted filter → only unhealthy URLs display. Type a URL fragment in the URL text filter → results narrow after 300ms debounce. Click "Clear filters" → all results return.

### Implementation for User Story 2

- [x] T014 [P] [US2] Migrate URL Health table to DataTable in src/app/admin/health/page.tsx — define ColumnDef[] array (9 columns per data-model.md Table 2: url with text filter, healthScore with color-coded numeric, yieldTrend with arrow icon + select filter, totalScrapes, lastYield, lastScrapedAt, stateAbbr with select filter, status derived from healthScore/anomaly/active with select filter, actions with dismiss/deactivate/reactivate buttons); wire server-side state; preserve expandable row detail panel showing scrape history (render expanded content below the row); preserve summary cards above the table; preserve action button logic
- [x] T015 [P] [US2] Migrate Verification Queue to DataTable in src/components/admin/VerificationQueue.tsx — define ColumnDef[] array (8 columns per data-model.md Table 3: select checkbox, fullName with text filter, court, county, state with select filter via stateId param, sourceUrl as "View Source" link, status with select filter, actions with Verify/Reject/Unverify buttons); wire server-side state; preserve row selection with bulk verify/reject toolbar actions; preserve batch filter dropdown in toolbar; preserve status badge rendering

**Checkpoint**: Health and Verification tables migrated. Text search, faceted filters, debounced input, clear-all action, expandable rows, and batch-specific filtering all validated.

---

## Phase 5: User Story 3 — Consistent Pagination and Row Selection (Priority: P3)

**Goal**: Migrate Judge Records and Import Batch History tables, demonstrating consistent pagination UI (prev/next, page indicator, rows-per-page selector) across all admin tables. These tables receive newly-added sort capabilities from Phase 2 API changes.

**Independent Test**: Load /admin/judges, change rows-per-page from 50 to 25 → table shows 25 records, page count updates. Sort by Name → server returns alphabetically sorted judges. Navigate to next page → page indicator reads "Page 2 of N."

### Implementation for User Story 3

- [x] T016 [P] [US3] Migrate Judge Records table to DataTable in src/app/admin/judges/page.tsx — define ColumnDef[] array (5 columns per data-model.md Table 4: fullName as bold text with text filter via search param, courtType, location rendering "{county}, {state}" in muted text, status with color-coded badge + select filter, actions with Verify/Unverify + Delete buttons); wire server-side state; convert existing name search input to DataTable toolbar text filter; convert existing status dropdown to faceted filter in toolbar
- [x] T017 [P] [US3] Migrate Import Batch History table to DataTable in src/app/admin/import/page.tsx — define ColumnDef[] array (6 columns per data-model.md Table 5: fileName with text filter, totalRows sortable, result computed as "{successCount} ok / {skipCount} skip / {errorCount} err", status with color-coded badge + select filter, createdAt formatted date sortable, actions with conditional Rollback button); wire server-side state; migrate ONLY the batch history table — do NOT modify Import Preview, Column Mapper, or Import Summary sub-components on the same page

**Checkpoint**: All 5 server-side tables migrated with consistent pagination and sorting. Judges and Import now have dynamic sort (previously hardcoded createdAt DESC).

---

## Phase 6: User Story 4 — Column Visibility Toggle (Priority: P4)

**Goal**: Migrate the final table (Dashboard State Breakdown, client-side only) and enable column visibility toggle on tables with many columns. Admins can show/hide columns via a dropdown.

**Independent Test**: Load /admin/discovery, open column visibility dropdown, uncheck "Type" and "Level" → those columns disappear and table re-renders. Re-check them → columns reappear in their original position.

### Implementation for User Story 4

- [x] T018 [US4] Migrate Dashboard State Breakdown to DataTable in src/components/admin/ProgressDashboard.tsx — define ColumnDef[] array (6 columns per data-model.md Table 6: stateName as bold font-medium with text filter, imported sortable, verified sortable, unverified sortable, rejected sortable, percentOfTarget as "{value}%" sortable); configure client-side mode with getSortedRowModel and getFilteredRowModel (no server-side state — data fully loaded from dashboard API); render number columns with toLocaleString() formatting
- [x] T019 [P] [US4] Enable column visibility toggle on wide tables — set initial column visibility state in src/app/admin/discovery/page.tsx to hide suggestedType and suggestedLevel by default (users can re-enable via dropdown); set initial column visibility in src/app/admin/health/page.tsx with all columns visible; persist column visibility state to sessionStorage keyed by table name (read on mount, write on change) so visibility survives page refresh within the same session; verify DropdownMenu toggle in DataTableToolbar correctly shows/hides columns and the table re-renders without layout breakage

**Checkpoint**: All 6 tables migrated to DataTable. Column visibility toggle functional on Discovery (2 cols hidden by default) and Health. Feature complete.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Validate edge cases, accessibility, and end-to-end quality across all migrated tables.

- [x] T020 [P] Verify edge cases across all 6 tables: null values sort to end regardless of sort direction, zero-result filters display "No results found" empty state with clear-filters prompt, overflow-x-auto horizontal scroll preserved on narrow viewports, row selection clears when filters change
- [x] T021 Verify accessibility compliance across all tables: aria-sort attribute set on sorted column headers (ascending/descending/none), aria-label on all filter inputs and row selection checkboxes, keyboard Tab navigation between sort buttons and filter controls, focus remains on triggering element after sort/filter actions, pagination buttons have descriptive aria-labels
- [x] T022 Run quickstart.md validation steps from specs/013-admin-data-tables/quickstart.md — verify npm install succeeds, dev server starts, all 6 admin pages load correctly, DataTable renders on each page

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — validates full architecture with Discovery table
- **US2 (Phase 4)**: Depends on Phase 2 — can start in parallel with US1 (different files)
- **US3 (Phase 5)**: Depends on Phase 2 — can start in parallel with US1/US2 (different files)
- **US4 (Phase 6)**: T018 depends on Phase 2; T019 depends on T013 + T014 (modifies Discovery/Health pages after migration)
- **Polish (Phase 7)**: Depends on all user story phases being complete

### Within Phase 2

```
T004 ─┐
T005 ─┤
T006 ─┼─→ T007 ──→ T008
      │
T009 ─┤   (API changes run in parallel with component creation)
T010 ─┤
T011 ─┤
T012 ─┘
```

### User Story Independence

Each migrated table is in a separate file, so user stories can proceed in parallel after Phase 2:

```
Phase 2 ──→ US1 (T013: Discovery)
         ├─→ US2 (T014: Health, T015: Verification)
         ├─→ US3 (T016: Judges, T017: Import)
         └─→ US4 (T018: Dashboard; T019 waits for T013+T014)
```

### Parallel Opportunities

**Phase 1**: T002 + T003 can run in parallel after T001
**Phase 2**: T004 + T005 + T006 + T009 + T010 + T011 + T012 all in parallel → T007 → T008
**Phases 3–5**: T013, T014, T015, T016, T017 are all different files — can be staffed in parallel
**Phase 6**: T018 independent of other stories; T019 depends on T013 + T014

---

## Parallel Example: Phase 2 Foundational

```bash
# Launch all independent component + API tasks together:
Task: "Create DataTableColumnHeader in src/components/ui/data-table-column-header.tsx"
Task: "Create DataTablePagination in src/components/ui/data-table-pagination.tsx"
Task: "Create DataTableFacetedFilter in src/components/ui/data-table-faceted-filter.tsx"
Task: "Expand sort allowlist in src/app/api/admin/discovery/route.ts"
Task: "Expand sort allowlist in src/app/api/admin/health/route.ts"
Task: "Add sort/order params to src/app/api/admin/judges/route.ts"
Task: "Add sort/order params to src/app/api/admin/import/route.ts"

# Then sequentially:
Task: "Create DataTableToolbar in src/components/ui/data-table-toolbar.tsx"
Task: "Create DataTable in src/components/ui/data-table.tsx"
```

## Parallel Example: Table Migrations (Phases 3–5)

```bash
# All table migration tasks touch different files — can run simultaneously:
Task: "Migrate URL Discovery table in src/app/admin/discovery/page.tsx"
Task: "Migrate URL Health table in src/app/admin/health/page.tsx"
Task: "Migrate Verification Queue in src/components/admin/VerificationQueue.tsx"
Task: "Migrate Judge Records in src/app/admin/judges/page.tsx"
Task: "Migrate Import Batch History in src/app/admin/import/page.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (install deps)
2. Complete Phase 2: Foundational (build DataTable components + API changes)
3. Complete Phase 3: User Story 1 (migrate Discovery)
4. **STOP and VALIDATE**: Test Discovery table — sorting, filtering, pagination, row selection, bulk actions
5. Deploy if ready — remaining 5 tables still use original implementation

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. US1 → Discovery migrated → **Deploy** (MVP — sorting validated)
3. US2 → Health + Verification migrated → **Deploy** (filtering validated)
4. US3 → Judges + Import migrated → **Deploy** (all server-side tables done)
5. US4 → Dashboard migrated + column visibility → **Deploy** (feature complete)
6. Each increment is independently deployable and testable

### Single Developer Strategy

1. Phase 1 → Phase 2 → Phase 3 (MVP checkpoint) → validate
2. Phase 4 (Health, then Verification) → validate
3. Phase 5 (Judges, then Import) → validate
4. Phase 6 (Dashboard + visibility) → Phase 7 (polish) → done

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] labels map to spec.md user stories: US1=Sort, US2=Filter, US3=Pagination/Selection, US4=Visibility
- Each table migration is one task because column definitions, DataTable wiring, and feature preservation all happen in the same file
- Column definitions reference data-model.md for exact column specs (accessors, headers, filter types, cell renderers)
- API changes reference contracts/api-sort-allowlists.md for sort field allowlists
- No test tasks generated — tests not requested in feature specification
- Commit after each completed task or user story phase
