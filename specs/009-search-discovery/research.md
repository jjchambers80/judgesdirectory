# Research: Search & Discovery

**Feature**: 009-search-discovery  
**Date**: 2026-03-06

## Research Tasks

This document resolves technical unknowns identified during planning.

---

## 1. PostgreSQL Full-Text Search Approach

### Question
Which PostgreSQL text search capability should be used: `pg_trgm` (trigram similarity) or `tsvector` (full-text search)?

### Research

**pg_trgm (Trigram Similarity)**
- Works by comparing 3-character sequences (trigrams) between strings
- Excellent for fuzzy matching and typo tolerance ("Smth" → "Smith")
- Supports `ILIKE` with index acceleration via GIN/GiST indexes
- No need for preprocessing or lexeme parsing
- Natural fit for searching proper names (judge names)

**tsvector (Full-Text Search)**
- Document-oriented search with lexeme parsing, stemming, and ranking
- Optimized for searching body text with stop words and word variations
- Requires text preprocessing into tsvector format
- Overkill for single-field name search
- Better suited for searching across multiple fields (descriptions, bios)

### Decision
**Use `pg_trgm`** for judge name search.

**Rationale**:
- Judge names are proper nouns — no stemming or stop word removal needed
- pg_trgm handles partial matches and typos naturally
- Pattern: `WHERE fullName ILIKE '%query%'` with GIN index for performance
- Simpler implementation: no tsvector column maintenance

### Implementation Notes
```sql
-- Enable extension (one-time)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Create GIN index on fullName
CREATE INDEX CONCURRENTLY idx_judges_fullname_trgm 
ON judges USING GIN (fullName gin_trgm_ops);

-- Query pattern
SELECT * FROM judges 
WHERE fullName ILIKE '%martinez%'
ORDER BY similarity(fullName, 'martinez') DESC
LIMIT 20;
```

---

## 2. Court Type Filter Values

### Question
What court type values should the filter dropdown display, given variation across states?

### Research

**Discovered court types in existing data**:

| State | Court Types |
|-------|-------------|
| California | Supreme Court, Court of Appeal, Superior Court |
| Florida | Supreme Court, District Court of Appeal, Circuit Court |
| Texas | Supreme Court, Court of Criminal Appeals, Court of Appeals |

**Taxonomy challenge**: Different states use different terminology for similar court levels:
- Appellate courts: "Court of Appeal" (CA), "District Court of Appeal" (FL), "Court of Appeals" (TX)
- Trial courts: "Superior Court" (CA), "Circuit Court" (FL)

### Decision
**Auto-populate filter from distinct `court.type` values in the database.**

**Rationale**:
- Court types vary significantly by state jurisdiction
- Hardcoding values would require maintenance as states are added
- Dynamic population ensures filter always matches actual data
- Prevents zero-result searches from mismatched labels

### Implementation Notes
```typescript
// Fetch distinct court types from database
const courtTypes = await prisma.court.findMany({
  where: { judges: { some: { status: 'VERIFIED' } } },
  select: { type: true },
  distinct: ['type'],
});
```

---

## 3. URL State Persistence Strategy

### Question
How should filter and pagination state be persisted in the URL for sharing/bookmarking?

### Research

**Options evaluated**:

1. **Query parameters** (e.g., `?q=smith&state=CA&page=2`)
   - Standard approach, understood by users
   - Works with SSR (URL parsed on server)
   - Easily shareable
   - Supported by Next.js `searchParams`

2. **Hash fragments** (e.g., `#q=smith&state=CA`)
   - Not sent to server (client-only)
   - Breaks SSR capability
   - Less SEO-friendly

3. **Encoded path segments** (e.g., `/judges/search/smith/CA/2`)
   - Complex routing
   - Less flexible for optional params
   - Would conflict with existing `/judges/[state]` route

### Decision
**Use query parameters** via Next.js `searchParams`.

**Rationale**:
- SSR-compatible: search results can be pre-rendered for SEO
- Standard web pattern: users understand `?q=` URLs
- Next.js App Router has native support via page props
- Easy to add/remove parameters without breaking URLs

### Implementation Notes
```typescript
// Server component receives searchParams
export default async function JudgesPage({
  searchParams,
}: {
  searchParams: { q?: string; state?: string; courtType?: string; county?: string; page?: string };
}) {
  const query = searchParams.q || '';
  const state = searchParams.state;
  const page = parseInt(searchParams.page || '1', 10);
  // ... server-side search
}
```

---

## 4. Autocomplete Request Pattern

### Question
Should autocomplete use a separate endpoint or the same search endpoint with parameters?

### Research

**Option A: Separate `/api/suggest` endpoint**
- Optimized for speed (lighter response)
- Returns only names, not full judge records
- Separate caching strategy

**Option B: Same `/api/search` endpoint with `limit` parameter**
- Single endpoint to maintain
- Consistent query logic
- Returns full search results (can be rendered directly)

### Decision
**Use same `/api/search` endpoint with `limit=5` for autocomplete.**

**Rationale**:
- Simpler to maintain one search endpoint
- Autocomplete results can double as quick navigation (click shows profile)
- Spec assumption aligned: "Autocomplete will query the same search endpoint"

### Implementation Notes
```typescript
// Autocomplete request
fetch('/api/search?q=smi&limit=5')

// Full search request
fetch('/api/search?q=smith&state=CA&page=1')
```

---

## 5. Keyboard Navigation Pattern

### Question
What keyboard interaction patterns are required for accessibility (FR-018)?

### Research

**WCAG 2.1 requirements for search forms**:
- All inputs reachable via Tab key
- Autocomplete dropdown navigable with Arrow keys
- Enter key submits search or selects autocomplete item
- Escape key closes autocomplete dropdown
- Focus indicators visible on all interactive elements

**Combobox pattern (WAI-ARIA)**:
- Search input with `role="combobox"`
- Dropdown list with `role="listbox"`
- Options with `role="option"` and `aria-selected`
- `aria-expanded` toggled with dropdown visibility

### Decision
**Implement standard combobox pattern per WAI-ARIA APG.**

**Rationale**:
- Industry-standard pattern for autocomplete
- Screen reader compatible
- Meets WCAG 2.1 AA requirements (Principle VI)

### Implementation Notes
- Use `@radix-ui/react-combobox` or custom implementation
- Ensure focus trap within autocomplete when open
- Visual focus indicator using existing theme variables

---

## Summary

| Topic | Decision | Key Reason |
|-------|----------|------------|
| Text search | pg_trgm | Better for proper name fuzzy matching |
| Court type filter | Dynamic from DB | Avoids hardcoding state-specific terminology |
| URL state | Query parameters | SSR-compatible, standard pattern |
| Autocomplete endpoint | Same as search | Single endpoint simplicity |
| Keyboard nav | WAI-ARIA combobox | Accessibility compliance |

All NEEDS CLARIFICATION items resolved. Ready for Phase 1 design.
