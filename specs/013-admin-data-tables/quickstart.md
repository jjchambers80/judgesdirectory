# Quickstart: Admin Data Tables

**Feature**: 013-admin-data-tables  
**Branch**: `013-admin-data-tables`

## Prerequisites

- Node.js 18+
- PostgreSQL running with seed data (`npx prisma db seed`)
- Project dependencies installed (`npm install`)

## Setup

```bash
# Switch to feature branch
git checkout 013-admin-data-tables

# Install new dependency
npm install @tanstack/react-table

# Install required shadcn/ui components
npx shadcn@latest add dropdown-menu checkbox select popover

# Start dev server
npm run dev
```

## Verification

Open `http://localhost:3000/admin/discovery` and verify:

1. Column headers show sort arrows on click
2. Toolbar above table contains filter inputs
3. Pagination bar shows rows-per-page selector
4. Checkbox column enables row selection with bulk actions
5. Existing approve/reject functionality works

## File Map

| Component      | Path                                              | Purpose                         |
| -------------- | ------------------------------------------------- | ------------------------------- |
| DataTable      | `src/components/ui/data-table.tsx`                | Core reusable table             |
| Column Header  | `src/components/ui/data-table-column-header.tsx`  | Sortable header with arrows     |
| Toolbar        | `src/components/ui/data-table-toolbar.tsx`        | Filter bar + column visibility  |
| Pagination     | `src/components/ui/data-table-pagination.tsx`     | Standardized pagination         |
| Faceted Filter | `src/components/ui/data-table-faceted-filter.tsx` | Value-selection dropdown filter |
| Debounce Hook  | `src/hooks/use-debounce.ts`                       | 300ms debounce for text inputs  |

## Migration Checklist

Each table migration follows this pattern:

1. Define `columns` array with `ColumnDef<TData>[]`
2. Replace raw `<table>` with `<DataTable columns={columns} data={data} />`
3. Wire up server-side sort/filter/page via `onStateChange` callback (if applicable)
4. Expand API sort allowlist (if applicable)
5. Verify all existing actions still work
6. Test accessibility: keyboard nav, screen reader labels, focus management
