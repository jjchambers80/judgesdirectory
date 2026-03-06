# Quickstart: Search & Discovery

**Feature**: 009-search-discovery  
**Date**: 2026-03-06

This guide walks through testing the search feature after implementation.

## Prerequisites

- Development server running (`npm run dev`)
- Database seeded with judges (`npx prisma db seed` + import batches)
- At least some judges with `status = VERIFIED`

## Feature Verification

### 1. Search Index Migration

Verify the pg_trgm index was created:

```bash
# Connect to database
npx prisma db execute --stdin <<EOF
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'judges' AND indexname LIKE '%trgm%';
EOF
```

Expected output should show `idx_judges_fullname_trgm`.

### 2. Search API Endpoint

Test the search API directly:

```bash
# Basic name search
curl "http://localhost:3000/api/search?q=Smith" | jq

# With state filter
curl "http://localhost:3000/api/search?q=John&state=CA" | jq

# Autocomplete (limit 5)
curl "http://localhost:3000/api/search?q=Mar&limit=5" | jq

# Filter options endpoint
curl "http://localhost:3000/api/search/filters" | jq

# Counties for a state
curl "http://localhost:3000/api/search/filters?state=FL" | jq
```

### 3. UI Verification

Navigate to `http://localhost:3000/judges` and verify:

| Step | Action | Expected Result |
|------|--------|-----------------|
| 1 | Page loads | Search input visible at top |
| 2 | Type "Smith" in search | Results appear within 300ms |
| 3 | Click state dropdown | Shows CA, FL, TX (states with data) |
| 4 | Select "California" | Results filter to CA judges only |
| 5 | Select "Florida" from state | County dropdown becomes available |
| 6 | Select "Miami-Dade" county | Results filter to Miami-Dade |
| 7 | Click "Clear filters" | All filters reset, full results shown |
| 8 | Scroll to bottom | Pagination controls visible |
| 9 | Click "Page 2" | Next 20 results load |
| 10 | Copy URL and paste in new tab | Same filters and page preserved |

### 4. Keyboard Navigation

Test accessibility:

| Action | Expected Behavior |
|--------|-------------------|
| Tab through page | Focus moves through search → filters → results |
| Type in search, press Down | Autocomplete dropdown appears, first item focused |
| Press Down/Up in dropdown | Selection moves through suggestions |
| Press Enter on suggestion | Judge profile page loads |
| Press Escape | Autocomplete closes |
| Tab to filter, press Enter | Dropdown opens |

### 5. Performance Check

Use browser DevTools Network tab:

| Request | Target | Acceptable Max |
|---------|--------|----------------|
| `/api/search?q=...` | <200ms | 500ms |
| `/api/search/filters` | <100ms | 200ms |
| Autocomplete request | <100ms | 200ms |

### 6. Mobile Responsiveness

Test at 375px viewport width (iPhone SE):

- [ ] Search input spans full width
- [ ] Filters stack vertically
- [ ] Results cards are readable
- [ ] Pagination is touch-friendly
- [ ] No horizontal scroll

### 7. Empty States

| Scenario | Expected Message |
|----------|------------------|
| Search "xyzzzz" (no matches) | "No judges found matching 'xyzzzz'" |
| Filter state with no verified judges | "No verified judges in [State]. Check back soon." |
| Clear all filters on empty search | Returns to paginated list of all judges |

## Success Criteria Checklist

- [ ] **SC-001**: Find judge by name in <10 seconds
- [ ] **SC-002**: Search results return in <500ms
- [ ] **SC-003**: Expected judge in top 5 results (test with known names)
- [ ] **SC-004**: Filter updates in <300ms
- [ ] **SC-005**: All verified judges appear in results
- [ ] **SC-006**: Lighthouse SEO score ≥90
- [ ] **SC-007**: Fully functional on mobile
- [ ] **SC-008**: URL sharing preserves filters

## Troubleshooting

### Search returns no results

1. Check that judges exist with `status = VERIFIED`:
   ```sql
   SELECT COUNT(*) FROM judges WHERE status = 'VERIFIED';
   ```

2. Verify pg_trgm extension is enabled:
   ```sql
   SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
   ```

### Autocomplete is slow

1. Check index exists:
   ```sql
   SELECT indexname FROM pg_indexes WHERE indexname LIKE '%trgm%';
   ```

2. If missing, run the migration:
   ```bash
   npx prisma migrate deploy
   ```

### Filters show empty dropdowns

Check that filter options endpoint returns data:
```bash
curl "http://localhost:3000/api/search/filters" | jq '.states | length'
```

Should return > 0 if states have verified judges.

## Demo Script

For stakeholder demonstration:

1. Start at `/judges` page
2. "Let me show you how to find Judge Martinez in California"
3. Type "Martinez" → point out instant results
4. Select "California" → show results narrow
5. Click a judge → show profile page
6. Go back → show filters preserved
7. Copy URL → "This link can be shared"
8. Clear filters → "And reset to browse all judges"

## Related Documentation

- [spec.md](spec.md) — Feature requirements
- [data-model.md](data-model.md) — TypeScript interfaces
- [contracts/search-api.yaml](contracts/search-api.yaml) — OpenAPI specification
- [research.md](research.md) — Technical decisions
