# Quickstart: Global Footer with Disclaimer

**Feature**: `010-global-footer` | **Branch**: `010-global-footer`

## Prerequisites

- Node.js 18+
- The project runs: `npm run dev`

## What Changed

1. **New component**: `src/components/SiteFooter.tsx` — a server component rendering copyright + disclaimer in a `<footer>` element.
2. **Root layout**: `src/app/layout.tsx` — imports and renders `<SiteFooter />` after `<main>`, adds flexbox sticky footer classes to `<body>`.
3. **Theme variables**: `src/app/theme-vars.css` — disclaimer color variables updated from amber/yellow to neutral grey.
4. **Page cleanups**: Disclaimer import and usage removed from 5 page files under `src/app/judges/`.
5. **Deleted**: `src/components/Disclaimer.tsx` — absorbed into SiteFooter.

## How to Verify

```bash
# Start dev server
npm run dev

# Visit any page and scroll to bottom — footer should be visible
open http://localhost:3000/judges/

# Test short page — footer should be at viewport bottom
# Test theme toggle — grey colors in both light and dark modes
```

### Acceptance Checks

- [ ] Footer visible on every page (judges list, state, county, court type, judge profile)
- [ ] Copyright shows current year and "judgesdirectory.org"
- [ ] Disclaimer text matches original wording exactly
- [ ] Disclaimer styled in grey (no amber/yellow)
- [ ] No duplicate disclaimer on any page
- [ ] Footer at viewport bottom on short pages
- [ ] Works in both light and dark themes
- [ ] Footer renders without JavaScript (SSR)

## Files Modified

| File | Action |
|------|--------|
| `src/components/SiteFooter.tsx` | CREATE |
| `src/app/layout.tsx` | MODIFY |
| `src/app/theme-vars.css` | MODIFY |
| `src/app/judges/page.tsx` | MODIFY |
| `src/app/judges/[state]/page.tsx` | MODIFY |
| `src/app/judges/[state]/[county]/page.tsx` | MODIFY |
| `src/app/judges/[state]/[county]/[courtType]/page.tsx` | MODIFY |
| `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` | MODIFY |
| `src/components/Disclaimer.tsx` | DELETE |
