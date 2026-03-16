# Feature Specification: Admin Data Tables

**Feature Branch**: `013-admin-data-tables`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "Enhance admin tables with TanStack Table integration — add column sorting (up/down arrows), per-column filtering, and improved data table functionality across all admin views using the shadcn/ui DataTable pattern"

## Context

The admin interface currently contains 10 data tables across 6 pages. These tables are built with raw HTML `<table>` elements — each with hand-rolled sorting, filtering, pagination, and row selection logic (where present). The existing shadcn/ui Table primitives (`Table`, `TableHeader`, `TableBody`, etc.) are exported but unused.

**Current state of admin tables:**

| Table                      | Location               | Sorting  | Filtering              | Pagination    | Row Selection   |
| -------------------------- | ---------------------- | -------- | ---------------------- | ------------- | --------------- |
| Judge Records              | /admin/judges          | No       | Name search + Status   | Yes (50/page) | No              |
| URL Discovery              | /admin/discovery       | 2 fields | State + Status         | Yes (50/page) | Yes             |
| URL Health                 | /admin/health          | 4 fields | State + Status         | Yes (50/page) | No (expandable) |
| Import Preview             | /admin/import          | No       | No                     | No            | No              |
| Import History             | /admin/import          | No       | No                     | No            | No              |
| Verification Queue         | /admin/verification    | No       | Status + State + Batch | Yes (50/page) | Yes             |
| Dashboard: State Breakdown | /admin/dashboard       | No       | No                     | No            | No              |
| Dashboard: Recent Imports  | /admin/dashboard       | No       | No                     | No            | No              |
| Column Mapper              | /admin/import (step 3) | No       | No                     | No            | No              |
| Import Summary             | /admin/import (step 5) | No       | No                     | No            | No              |

The goal is to introduce a reusable DataTable component that standardizes sorting, filtering, and pagination across all primary admin tables — reducing duplicated code and giving admins a consistent, powerful interface for managing data.

## Clarifications

### Session 2026-03-15

- Q: Which sorting/filtering strategy should tables with small, fully-loaded datasets use? → A: Client-side sort/filter for small fully-loaded tables; server-side for paginated tables
- Q: Should text-based column filters use debounced live search or explicit submit? → A: Debounced live search (~300ms delay), results update as user types
- Q: How should API endpoints that currently only support 1–2 sort fields handle new sortable columns? → A: Allowlist valid sort columns per endpoint; reject unknown values with fallback to default sort
- Q: Should the DataTable toolbar (filters, column visibility, clear-all) be positioned above the table or inline with column headers? → A: Toolbar above the table with filter inputs, column visibility dropdown, and clear-all in a dedicated bar
- Q: Should the migration be incremental (one table at a time) or a single cutover replacing all 6 tables at once? → A: Incremental — migrate one table at a time starting with Discovery, each independently deployable

## Assumptions

- The 4 small/specialized tables (Column Mapper, Import Preview, Import Summary, Dashboard Recent Imports) will **not** be migrated — they serve narrow purposes where a full DataTable adds no value.
- Server-side sorting, filtering, and pagination will remain for tables backed by API endpoints. The DataTable component will manage UI state and delegate data fetching to existing API routes.
- Existing bulk actions (approve/reject on Discovery, verify/reject on Verification Queue) will be preserved and integrated into the new DataTable pattern.
- The existing shadcn/ui Table primitives will be used as the rendering layer.
- No new API endpoints are needed — existing endpoints already support sort, order, filter, and pagination parameters. However, some endpoints will need their allowlisted sort columns expanded to cover newly sortable fields.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Sort Any Column (Priority: P1)

An admin viewing any primary data table (Judges, Discovery, Health, Verification, State Breakdown) clicks a column header to sort by that column. Clicking the same header again toggles between ascending, descending, and unsorted. A visual indicator (arrow icon) shows the current sort direction.

**Why this priority**: Sorting is the most universally requested table interaction. Every table benefits immediately, and it's the foundation for all other DataTable features.

**Independent Test**: Load any admin table page, click a column header, and verify rows reorder correctly with a visible sort indicator.

**Acceptance Scenarios**:

1. **Given** the Judges table is loaded with records, **When** the admin clicks the "Name" column header, **Then** records sort alphabetically by name ascending and an up-arrow icon appears on that header.
2. **Given** the Judges table is sorted ascending by Name, **When** the admin clicks the "Name" header again, **Then** records sort descending and the arrow flips to point down.
3. **Given** the Discovery table is sorted by Confidence descending, **When** the admin clicks the "State" header, **Then** the table sorts by State instead, and the Confidence header loses its sort indicator.
4. **Given** any sortable table, **When** the admin clicks a sorted column header a third time, **Then** the sort resets to the default order and the indicator is removed.

---

### User Story 2 — Filter by Column Values (Priority: P2)

An admin uses per-column filters to narrow table results. For text columns, a search input appears. For status/category columns, a dropdown or faceted filter shows available values with counts. Active filters are visually indicated on the column header.

**Why this priority**: Filtering lets admins find specific records quickly across large datasets. It builds on the DataTable component established in P1 and is the second most-requested feature.

**Independent Test**: Load the Discovery table, apply a State filter for "FL," and verify only Florida candidates appear. Clear the filter and verify all records return.

**Acceptance Scenarios**:

1. **Given** the Verification Queue with mixed states, **When** the admin opens the "State" column filter and selects "FL", **Then** only Florida records display and the State column header shows a filter-active indicator.
2. **Given** the Judges table, **When** the admin types "Smith" in the Name column filter, **Then** only judges with "Smith" in their name appear.
3. **Given** the Health table with multiple statuses, **When** the admin selects "Unhealthy" from the Status column filter, **Then** only unhealthy URLs display and a count badge shows how many match.
4. **Given** multiple active column filters, **When** the admin clicks a "Clear all filters" button, **Then** all filters reset and the full dataset is displayed.

---

### User Story 3 — Consistent Pagination and Row Selection (Priority: P3)

All primary admin tables share a consistent pagination UI (page numbers, prev/next, rows-per-page selector) and tables that support bulk actions have standardized checkbox selection with a select-all toggle.

**Why this priority**: Pagination and row selection already exist but are implemented differently per table. Standardizing them through the DataTable component reduces maintenance burden and gives admins a predictable experience.

**Independent Test**: Navigate to any paginated admin table, change the rows-per-page to 25, verify the table updates, navigate forward/back pages, and confirm the page indicator is accurate.

**Acceptance Scenarios**:

1. **Given** the Judges table with 200+ records, **When** the admin changes rows-per-page from 50 to 25, **Then** the table shows 25 records and total pages updates accordingly.
2. **Given** the Discovery table on page 3, **When** the admin clicks "Next", **Then** page 4 loads and the pagination indicator shows "Page 4 of N."
3. **Given** the Discovery table, **When** the admin clicks the header checkbox, **Then** all visible rows are selected and the bulk action bar appears.
4. **Given** 5 selected rows in the Verification Queue, **When** the admin changes to page 2, **Then** the selection is preserved and a "5 selected" indicator remains visible.

---

### User Story 4 — Column Visibility Toggle (Priority: P4)

An admin toggles which columns are visible in any primary table using a column visibility dropdown. The choice persists for the current session.

**Why this priority**: Nice-to-have for tables with many columns (Discovery has 9 columns). Lower priority because all columns are useful by default.

**Independent Test**: Open the Discovery table, hide the "Type" and "Level" columns via the dropdown, verify they disappear, refresh the page and confirm the choice persists.

**Acceptance Scenarios**:

1. **Given** the Discovery table with all columns visible, **When** the admin unchecks "Type" and "Level" in the column dropdown, **Then** those columns hide and the table re-renders without them.
2. **Given** hidden columns, **When** the admin re-checks them in the dropdown, **Then** they reappear in their original position.

---

### Edge Cases

- What happens when a column contains null values and the user sorts by that column? Null values should sort to the end regardless of sort direction.
- What happens when the admin applies filters that return zero results? The table should display an empty state message with a prompt to clear filters.
- What happens when the admin sorts a column that is handled server-side? The DataTable should send the sort parameter to the API and not attempt client-side sorting.
- How does the table behave on narrow screens? The existing `overflow-x-auto` horizontal scroll should be preserved.
- What happens to row selection when filters change? Selected rows that fall outside the new filter should be deselected.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a reusable DataTable component that accepts column definitions and renders using the existing shadcn/ui Table primitives.
- **FR-002**: Every sortable column MUST display a clickable header with an arrow icon indicating sort direction (ascending, descending, or none).
- **FR-003**: Sorting MUST cycle through ascending → descending → unsorted on repeated clicks of the same column header.
- **FR-004**: Tables backed by server-side APIs with pagination MUST delegate sorting and filtering to the API. Tables that load all rows in a single fetch (Dashboard: State Breakdown) MUST sort and filter client-side for responsiveness. API endpoints MUST allowlist valid sort columns and reject unknown sort values by falling back to the default sort order.
- **FR-005**: Each column MUST support an optional filter — either a text search input (with debounced live filtering, ~300ms delay) or a value-selection dropdown — configured in the column definition.
- **FR-006**: Active column filters MUST be visually indicated in the toolbar (e.g., highlighted filter chip or badge). The toolbar MUST be positioned above the table, containing filter inputs, column visibility dropdown, and a clear-all action.
- **FR-007**: A global "Clear all filters" action MUST be available in the toolbar when any filter is active.
- **FR-008**: Pagination controls MUST include page navigation (prev/next, page numbers), a current-page indicator, and a rows-per-page selector (25, 50, 100).
- **FR-009**: Tables with row selection MUST provide a header checkbox for "select all on page" and individual row checkboxes.
- **FR-010**: Selected row count MUST be displayed when any rows are selected, and bulk action buttons MUST appear contextually.
- **FR-011**: The DataTable MUST preserve existing functionality — bulk approve/reject on Discovery, verify/reject/unverify on Verification Queue, expandable rows on Health.
- **FR-012**: Column visibility toggle MUST be available as an optional feature per table, showing a dropdown to show/hide columns.
- **FR-013**: The DataTable component MUST be responsive: horizontally scrollable on narrow viewports, with no layout breakage.

### Tables to Migrate

The following 6 tables will be migrated incrementally to the DataTable component, one at a time. Each migration is independently deployable and testable. Migration order (starting with the table that exercises the most DataTable features):

1. **URL Discovery** — first migration; validates DataTable architecture with existing sort/filter, bulk actions, row selection
2. **URL Health** — validates expandable rows, summary cards coexistence
3. **Verification Queue** — validates bulk actions pattern with different action types
4. **Judge Records** — add sortable columns (Name, Court, Status), per-column filtering
5. **Import Batch History** — add sortable columns (Date, Status, Rows), basic filtering
6. **Dashboard: State Breakdown** — client-side only sort/filter (small dataset)

### Key Entities

- **Column Definition**: Describes a table column — its data accessor, display header, whether it's sortable, its filter type (text, select, none), and whether it's visible by default.
- **DataTable State**: The combined state of sorting (column + direction), active filters (column → value), pagination (page, page size), row selection (set of selected row IDs), and column visibility (set of visible columns).

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 6 primary admin tables support clickable column-header sorting with visual direction indicators.
- **SC-002**: Admins can filter any table by at least 2 column values simultaneously and results update within 1 second.
- **SC-003**: Every paginated table provides a consistent pagination bar with rows-per-page selection (25, 50, 100).
- **SC-004**: Total lines of table-related code across admin pages decreases by at least 30% through shared DataTable logic.
- **SC-005**: All existing admin functionality (bulk actions, expandable rows, verify/reject workflows) continues to work identically after migration.
- **SC-006**: Admins can locate a specific record (e.g., a judge by name, a URL by state) in under 10 seconds using column sorting and filtering together.
