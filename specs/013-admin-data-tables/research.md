# Research: Admin Data Tables

**Feature**: 013-admin-data-tables  
**Date**: 2026-03-15

## 1. Table Library Selection

**Decision**: `@tanstack/react-table` v8  
**Rationale**: Headless UI library — provides sorting, filtering, pagination, row selection, and column visibility logic without any rendering opinions. Renders through existing shadcn/ui Table primitives. ~15kb gzipped, zero style dependencies.  
**Alternatives considered**:

- AG Grid (~300kb, brings own styles, overkill for admin tables)
- MUI DataGrid (locked to Material UI, conflicts with shadcn/Tailwind)
- React Data Table Component (opinionated UI, no headless mode)
- Custom from scratch (status quo — doesn't scale across 6+ tables)

## 2. Server-Side vs Client-Side Sorting/Filtering Strategy

**Decision**: Hybrid — server-side for paginated API-backed tables; client-side for small fully-loaded tables  
**Rationale**: Tables with server-side pagination (Discovery, Health, Verification, Judges) already send sort/filter/page params to APIs. Re-sorting 50 rows on the client when there are 5000+ total makes no sense. Tables that load all data (Dashboard State Breakdown ~50 rows, Import History ~20 rows) should sort client-side for instant responsiveness.

**TanStack pattern for server-side**: Use `manualSorting: true`, `manualFiltering: true`, `manualPagination: true` on the `useReactTable` hook. Pass controlled state (`sorting`, `columnFilters`, `pagination`) and corresponding `onXChange` handlers. On state change, re-fetch from API with updated params.

**TanStack pattern for client-side**: Provide `getSortedRowModel()`, `getFilteredRowModel()`, `getPaginationRowModel()` — TanStack handles everything internally.

## 3. Debounced Text Filtering

**Decision**: Custom `useDebounce` hook with ~300ms delay for text filter inputs  
**Rationale**: Prevents excessive API calls on server-side tables (one call per keystroke → one call per 300ms pause). For client-side tables debounce is less critical but still smooths the UX for fast typers.

**Implementation**:

```typescript
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}
```

## 4. API Endpoint Sort Allowlist Pattern

**Decision**: Each endpoint defines an allowlist of valid sort fields; unknown sort values fall back to the default sort.  
**Rationale**: Prevents exposing internal Prisma schema columns through query params. Typed and validated at the API boundary.

**Current gaps and required changes**:

| Endpoint                  | Current Sort                                            | Needs Added                                                  |
| ------------------------- | ------------------------------------------------------- | ------------------------------------------------------------ |
| `/api/admin/judges`       | hardcoded `createdAt DESC`                              | Add sort param: allowlist `fullName`, `createdAt`, `status`  |
| `/api/admin/import`       | hardcoded `createdAt DESC`                              | Add sort param: allowlist `createdAt`, `status`, `totalRows` |
| `/api/admin/discovery`    | `discoveredAt`, `confidenceScore`                       | Add `stateAbbr`, `status`, `url`                             |
| `/api/admin/health`       | `healthScore`, `lastScrapedAt`, `lastYield`, `avgYield` | Add `url`, `stateAbbr`, `totalScrapes`                       |
| `/api/admin/verification` | `createdAt`, `fullName`, `updatedAt`                    | Sufficient — no changes needed                               |
| `/api/admin/dashboard`    | N/A                                                     | N/A — client-side only                                       |

**Pattern**:

```typescript
const VALID_SORT_FIELDS = ["fullName", "createdAt", "status"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];
const sort: SortField = VALID_SORT_FIELDS.includes(rawSort as any)
  ? (rawSort as SortField)
  : "createdAt";
```

## 5. Required shadcn/ui Component Additions

**Decision**: Install `dropdown-menu`, `checkbox`, `select`, and `popover` from shadcn/ui registry  
**Rationale**: These are needed by DataTable subcomponents:

- `dropdown-menu` → Column visibility toggle dropdown
- `checkbox` → Row selection checkboxes (accessible, with indeterminate support)
- `select` → Rows-per-page selector in pagination
- `popover` → Faceted filter dropdowns per column

**Installation**: `npx shadcn@latest add dropdown-menu checkbox select popover`

Already available: `button`, `badge`, `input`, `table`, `card`, `pagination`

## 6. Accessibility Requirements for Data Table

**Decision**: Follow WAI-ARIA table patterns with shadcn/ui defaults  
**Rationale**: Constitution Principle VI (WCAG 2.1 AA) requires accessible admin pages.

**Requirements**:

- Sortable column headers MUST use `<button>` elements (keyboard accessible) with `aria-sort="ascending|descending|none"` attribute
- Filter inputs MUST have `aria-label` describing which column they filter
- Row checkboxes MUST have accessible names (`aria-label="Select {row identifier}"`)
- Pagination buttons MUST have `aria-label` for screen readers (e.g., "Go to next page")
- The table container MUST have `role="grid"` or use native `<table>` elements (shadcn/ui already uses native `<table>`)
- Focus management: focus should remain on the triggering element after sort/filter actions

## 7. DataTable Component Architecture

**Decision**: Composable component system — one generic DataTable with pluggable toolbar, pagination, and column header subcomponents  
**Rationale**: Each admin table has different columns, actions, and behaviors. A single monolithic component won't work. Instead:

```
<DataTable>
  <DataTableToolbar>       — filters, column visibility, clear-all
  <Table>                  — shadcn/ui Table (renders headers + body)
  <DataTablePagination>    — prev/next, page numbers, rows-per-page
</DataTable>
```

**Key subcomponents**:

- `DataTable` — orchestrator; accepts `columns`, `data`, and table config
- `DataTableColumnHeader` — sortable column header with arrow icons (replaces raw `<th>`)
- `DataTableToolbar` — renders active filters, column visibility toggle, clear-all button
- `DataTablePagination` — standardized pagination bar
- `DataTableFacetedFilter` — dropdown filter for status/category columns with value counts

**For server-side tables**: DataTable receives an `onStateChange` callback; the parent page manages fetch logic.
**For client-side tables**: DataTable manages state internally.

## 8. Migration Order and Strategy

**Decision**: Incremental — one table at a time, starting with URL Discovery  
**Rationale**: Discovery exercises the most features (sort, filter, pagination, row selection, bulk actions). Validating the DataTable architecture on this table first de-risks the remaining 5 migrations.

**Order**:

1. URL Discovery — full feature validation
2. URL Health — expandable rows pattern
3. Verification Queue — different bulk action types
4. Judge Records — add new sort capability
5. Import Batch History — add new sort capability
6. Dashboard: State Breakdown — client-side only
