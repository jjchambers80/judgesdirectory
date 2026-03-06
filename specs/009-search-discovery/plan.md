# Implementation Plan: Search & Discovery

**Branch**: `009-search-discovery` | **Date**: 2026-03-06 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/009-search-discovery/spec.md`

## Summary

Add judge search functionality with full-text name search, filterable by state/county/court type, with autocomplete suggestions and paginated results. Search will be implemented using PostgreSQL text search capabilities (pg_trgm extension) with server-side filtering and URL-persisted state for shareable searches.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20.x  
**Primary Dependencies**: Next.js 14 (App Router), React 18, Prisma ORM, PostgreSQL  
**Storage**: PostgreSQL with pg_trgm extension for fuzzy text search  
**Testing**: Manual testing per current project pattern (no automated test suite)  
**Target Platform**: Web (Vercel deployment), SSR for SEO  
**Project Type**: Web application (Next.js monorepo)  
**Performance Goals**: Search results <500ms, autocomplete <200ms, filter updates <300ms  
**Constraints**: Only VERIFIED judges in public results, keyboard-navigable, mobile-responsive  
**Scale/Scope**: ~2,800 judges current, designed for 10,000+ judges

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                              | Status  | Notes                                                               |
| -------------------------------------- | ------- | ------------------------------------------------------------------- |
| I. Data Accuracy & Source Attribution  | ✅ PASS | FR-012 requires only VERIFIED judges in results                     |
| II. SEO-First Architecture             | ✅ PASS | Search page will have SSR, URL state for indexable filtered views   |
| III. Legal Safety & Neutrality         | ✅ PASS | No ratings/reviews/commentary in search results                     |
| IV. State-by-State Expansion           | ✅ PASS | Search enables discovery across all expanded states                 |
| V. Simplicity & Incremental Discipline | ✅ PASS | Using PostgreSQL native search, no external service                 |
| VI. Accessibility & WCAG Compliance    | ✅ PASS | FR-018 requires keyboard navigation, SC-007 requires mobile support |
| VII. Data Pipeline Integrity           | N/A     | No pipeline changes in this feature                                 |

**Gate Status**: PASS — No violations requiring justification.

## Project Structure

### Documentation (this feature)

```text
specs/009-search-discovery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── search-api.yaml  # OpenAPI spec for search endpoint
└── tasks.md             # Phase 2 output (via /speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── judges/
│   │   └── page.tsx           # Enhanced with search UI (existing)
│   └── api/
│       └── search/
│           └── route.ts       # NEW: Search API endpoint
├── components/
│   ├── search/
│   │   ├── SearchInput.tsx    # NEW: Autocomplete search input
│   │   ├── SearchFilters.tsx  # NEW: State/County/CourtType filters
│   │   ├── SearchResults.tsx  # NEW: Results list with pagination
│   │   └── FilterChip.tsx     # NEW: Active filter badges
│   └── ui/
│       └── pagination.tsx     # NEW: Reusable pagination component
└── lib/
    └── search.ts              # NEW: Search query builder & types

prisma/
└── migrations/
    └── [timestamp]_add_search_index/
        └── migration.sql      # pg_trgm index on judges.fullName
```

**Structure Decision**: Extends existing Next.js App Router structure. New search components in `src/components/search/`, API route in `src/app/api/search/`, shared types/queries in `src/lib/search.ts`.

## Complexity Tracking

> No violations requiring justification — table omitted.
