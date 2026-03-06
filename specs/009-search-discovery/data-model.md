# Data Model: Search & Discovery

**Feature**: 009-search-discovery  
**Date**: 2026-03-06

## Overview

This feature does not introduce new database tables. It adds a database index for search optimization and defines TypeScript interfaces for the search API.

## Schema Changes

### New Index: pg_trgm for fullName search

```sql
-- Migration: add_search_index
-- Enable PostgreSQL trigram extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on judges.fullName for ILIKE queries
CREATE INDEX CONCURRENTLY idx_judges_fullname_trgm
ON judges USING GIN (fullName gin_trgm_ops);
```

**Why GIN over GiST?**

- GIN indexes are faster for read-heavy workloads (search queries)
- GiST is better for frequent updates; judge data is write-infrequent
- GIN with `gin_trgm_ops` supports `ILIKE` with `%pattern%`

## Entity Relationships (existing)

```
State (1) ──────< County (N)
                     │
                     └──────< Court (N)
                                  │
                                  └──────< Judge (N)
```

Search queries traverse this hierarchy via Prisma includes.

## TypeScript Interfaces

### SearchParams

Input parameters for search API requests.

```typescript
interface SearchParams {
  /** Text query for judge name (partial match) */
  q?: string;

  /** Filter by state abbreviation (e.g., "CA", "FL") */
  state?: string;

  /** Filter by county slug */
  county?: string;

  /** Filter by court type (e.g., "Supreme Court") */
  courtType?: string;

  /** Page number (1-indexed), default 1 */
  page?: number;

  /** Results per page, default 20, max 100 */
  limit?: number;
}
```

### SearchResult

Individual judge result in search response.

```typescript
interface SearchResult {
  /** Judge UUID */
  id: string;

  /** Judge's full name */
  fullName: string;

  /** URL slug for judge profile */
  slug: string;

  /** Court information for context */
  court: {
    type: string;
    slug: string;
    county: {
      name: string;
      slug: string;
      state: {
        name: string;
        abbreviation: string;
        slug: string;
      };
    };
  };
}
```

### SearchResponse

Full response envelope from search API.

```typescript
interface SearchResponse {
  /** Array of matching judges */
  results: SearchResult[];

  /** Total count of matches (for pagination) */
  total: number;

  /** Current page number */
  page: number;

  /** Results per page */
  limit: number;

  /** Total pages available */
  totalPages: number;

  /** Active filters echoed back */
  filters: {
    q?: string;
    state?: string;
    county?: string;
    courtType?: string;
  };
}
```

### FilterOptions

Available filter values for UI dropdowns.

```typescript
interface FilterOptions {
  /** All states with verified judges */
  states: Array<{
    name: string;
    abbreviation: string;
    slug: string;
  }>;

  /** Court types (distinct values from database) */
  courtTypes: string[];

  /** Counties in selected state (dynamic) */
  counties?: Array<{
    name: string;
    slug: string;
  }>;
}
```

## Query Patterns

### Search with filters (Prisma)

```typescript
const where: Prisma.JudgeWhereInput = {
  status: "VERIFIED", // Constitution Principle I
  ...(q && { fullName: { contains: q, mode: "insensitive" } }),
  ...(courtType && { court: { type: courtType } }),
  ...(county && { court: { county: { slug: county } } }),
  ...(state && { court: { county: { state: { abbreviation: state } } } }),
};

const [judges, total] = await Promise.all([
  prisma.judge.findMany({
    where,
    select: {
      /* SearchResult fields */
    },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { fullName: "asc" },
  }),
  prisma.judge.count({ where }),
]);
```

### Distinct court types (for filter)

```typescript
const courtTypes = await prisma.court.findMany({
  where: { judges: { some: { status: "VERIFIED" } } },
  select: { type: true },
  distinct: ["type"],
  orderBy: { type: "asc" },
});
```

### Counties by state (for cascading filter)

```typescript
const counties = await prisma.county.findMany({
  where: {
    state: { abbreviation: stateAbbr },
    courts: { some: { judges: { some: { status: "VERIFIED" } } } },
  },
  select: { name: true, slug: true },
  orderBy: { name: "asc" },
});
```

## Performance Considerations

| Query Pattern          | Expected Performance | Index Used                        |
| ---------------------- | -------------------- | --------------------------------- |
| Name search only       | <100ms               | `idx_judges_fullname_trgm`        |
| State filter only      | <50ms                | `idx_judges_status` + county join |
| Name + state           | <100ms               | Combined scan                     |
| Autocomplete (limit 5) | <50ms                | `idx_judges_fullname_trgm`        |
| Full scan (no filters) | <200ms               | `idx_judges_status`               |

At 10,000+ judges, all queries should remain under 500ms target (SC-002).

## Validation Rules

- `q` (query): Min 1 character, max 100 characters
- `state`: Must be valid 2-letter abbreviation
- `county`: Must exist in selected state
- `courtType`: Must match existing court type
- `page`: Positive integer, default 1
- `limit`: 1-100, default 20

Invalid filter values are ignored (return unfiltered results for that dimension).
