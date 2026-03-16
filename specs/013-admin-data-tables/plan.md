# Implementation Plan: Admin Data Tables

**Branch**: `013-admin-data-tables` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/013-admin-data-tables/spec.md`

## Summary

Replace 6 hand-rolled admin `<table>` implementations with a reusable DataTable component built on TanStack Table (`@tanstack/react-table`) and the existing shadcn/ui Table primitives. The DataTable provides declarative column-header sorting (with visual arrow indicators), per-column filtering (debounced text search or faceted value-selection in a toolbar), standardized pagination with rows-per-page selection, checkbox row selection with bulk actions, and optional column visibility toggling. Server-side tables delegate sort/filter/page to existing API endpoints; small fully-loaded tables sort and filter client-side. Migration is incremental — one table at a time, starting with URL Discovery.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Next.js 14.2, React 18  
**Primary Dependencies**: `@tanstack/react-table` (new), `radix-ui` (existing), `class-variance-authority` + `clsx` + `tailwind-merge` (existing), `lucide-react` (shadcn icon library)  
**Storage**: PostgreSQL via Prisma ORM (existing — no schema changes)  
**Testing**: Manual verification per table migration; Playwright available for E2E  
**Target Platform**: Web (Vercel deployment), admin-only pages (no SSR/SEO requirement)  
**Project Type**: Web application (Next.js monorepo)  
**Performance Goals**: Filter/sort interactions complete within 1 second; debounced text filters fire at ~300ms  
**Constraints**: No new API endpoints; expand existing endpoint sort allowlists only. Preserve all existing admin functionality (bulk actions, expandable rows, verify workflows).  
**Scale/Scope**: 6 admin tables, ~6 page/component files to migrate, 1 new reusable DataTable component + supporting primitives

### Existing API Capabilities

| Endpoint                  | Sort Fields                                     | Filter Params                              | Pagination                | Model                   |
| ------------------------- | ----------------------------------------------- | ------------------------------------------ | ------------------------- | ----------------------- |
| `/api/admin/discovery`    | discoveredAt, confidenceScore                   | state, status                              | page, limit (50, max 100) | UrlCandidate            |
| `/api/admin/health`       | healthScore, lastScrapedAt, lastYield, avgYield | state, status, failuresOnly                | page, limit (50, max 100) | UrlHealth               |
| `/api/admin/verification` | createdAt, fullName, updatedAt                  | stateId, countyId, batchId, status         | page, limit (50, max 50)  | Judge                   |
| `/api/admin/judges`       | ❌ hardcoded createdAt DESC                     | search, stateId, countyId, courtId, status | page, limit (50, max 100) | Judge                   |
| `/api/admin/import`       | ❌ hardcoded createdAt DESC                     | status                                     | page, limit (20, max 50)  | ImportBatch             |
| `/api/admin/dashboard`    | ❌ aggregation only                             | pilotStates                                | ❌ none                   | Judge/State/ImportBatch |

**API Gaps to Address**:

- `/api/admin/judges` — needs sort param with allowlist: `fullName`, `createdAt`, `status`
- `/api/admin/import` — needs sort param with allowlist: `createdAt`, `status`, `totalRows`
- `/api/admin/dashboard` — no API changes; State Breakdown sorts client-side

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Research Check (2026-03-15)

| Principle                              | Verdict                  | Notes                                                                                                                                                                                                                     |
| -------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Data Accuracy & Source Attribution  | **PASS**                 | No data model changes. Admin tables display existing verified/unverified data. No new data paths.                                                                                                                         |
| II. SEO-First Architecture             | **PASS / N/A**           | Admin pages are not public-facing; no SEO impact.                                                                                                                                                                         |
| III. Legal Safety & Neutrality         | **PASS**                 | No new public content. Admin-only UI changes.                                                                                                                                                                             |
| IV. State-by-State Expansion           | **PASS**                 | Feature is orthogonal to state expansion. Does not alter harvest/import/verification flow.                                                                                                                                |
| V. Simplicity & Incremental Discipline | **PASS**                 | One new dependency (`@tanstack/react-table`, ~15kb). Justified: replaces ~1500 lines of duplicated hand-rolled table logic across 6 files. Incremental migration (one table per step) follows YAGNI.                      |
| VI. Accessibility & WCAG Compliance    | **PASS with conditions** | Sortable headers MUST use `<button>` elements with `aria-sort`; filter inputs MUST have `aria-label`; row checkboxes MUST have accessible names. shadcn/ui + TanStack defaults support this — implementation must verify. |
| VII. Data Pipeline Integrity           | **PASS / N/A**           | No harvesting pipeline changes.                                                                                                                                                                                           |

### Post-Design Re-Check (2026-03-15)

| Principle                              | Verdict        | Notes                                                                                                                                                                                                                                                                                                      |
| -------------------------------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Data Accuracy & Source Attribution  | **PASS**       | Design adds no new data paths. Sort/filter operations read existing verified data. API allowlist changes are additive (read-only params).                                                                                                                                                                  |
| II. SEO-First Architecture             | **PASS / N/A** | No public page changes. All modifications are in `/admin/` routes.                                                                                                                                                                                                                                         |
| III. Legal Safety & Neutrality         | **PASS**       | No new public content or judicial ratings/commentary introduced.                                                                                                                                                                                                                                           |
| IV. State-by-State Expansion           | **PASS**       | Incremental table migration is independently deployable and doesn't block state expansion.                                                                                                                                                                                                                 |
| V. Simplicity & Incremental Discipline | **PASS**       | New dependencies: `@tanstack/react-table` (justified above) + 4 shadcn/ui components (dropdown-menu, checkbox, select, popover — all from the project's established component library). No over-engineering: the DataTable is composable, not monolithic. Each table migration is a self-contained commit. |
| VI. Accessibility & WCAG Compliance    | **PASS**       | Research phase confirmed: `aria-sort` on headers, `aria-label` on filters/checkboxes, native `<table>` elements (via shadcn/ui), keyboard-operable sort buttons. Documented in research.md §6.                                                                                                             |
| VII. Data Pipeline Integrity           | **PASS / N/A** | No pipeline changes.                                                                                                                                                                                                                                                                                       |

**Gate status: PASS** — No violations at either check.

## Project Structure

### Documentation (this feature)

```text
specs/013-admin-data-tables/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (column definitions per table)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API sort allowlist changes)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── components/
│   ├── ui/
│   │   ├── table.tsx                    # Existing shadcn Table primitives (unchanged)
│   │   ├── data-table.tsx               # NEW: Reusable DataTable component
│   │   ├── data-table-column-header.tsx  # NEW: Sortable column header with arrow icons
│   │   ├── data-table-toolbar.tsx        # NEW: Filter bar + column visibility + clear-all
│   │   ├── data-table-pagination.tsx     # NEW: Standardized pagination controls
│   │   └── data-table-faceted-filter.tsx # NEW: Faceted value-selection filter
│   └── admin/
│       ├── VerificationQueue.tsx         # MODIFY: Replace raw table with DataTable
│       ├── ProgressDashboard.tsx         # MODIFY: Replace State Breakdown table
│       ├── ColumnMapper.tsx              # UNCHANGED
│       └── ImportSummary.tsx             # UNCHANGED
├── app/
│   ├── admin/
│   │   ├── discovery/page.tsx           # MODIFY: Replace raw table with DataTable
│   │   ├── health/page.tsx              # MODIFY: Replace raw table with DataTable
│   │   ├── judges/page.tsx              # MODIFY: Replace raw table with DataTable
│   │   └── import/page.tsx              # MODIFY: Replace batch history table only
│   └── api/admin/
│       ├── judges/route.ts              # MODIFY: Add sort param allowlist
│       └── import/route.ts              # MODIFY: Add sort param allowlist
├── hooks/
│   └── use-debounce.ts                  # NEW: Debounce hook for text filter inputs
└── lib/
    └── utils.ts                         # UNCHANGED
```

**Structure Decision**: All new DataTable components go under `src/components/ui/` following the existing shadcn/ui pattern. Table-specific column definitions are co-located within each page/component file where the DataTable is consumed. No new directories needed.

## Complexity Tracking

> No constitution violations — this section is intentionally empty.
