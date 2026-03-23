---
phase: 01-production-readiness
plan: "03"
subsystem: legal, content-quality, photos
tags: [typography, vercel-blob, sharp, privacy, terms, about, noindex, 404, avatar, photo-pipeline]

requires:
  - phase: 01-01
    provides: SEO metadata helpers (buildOpenGraph, buildTwitterCard), Breadcrumbs component
  - phase: 01-02
    provides: ISR caching, revalidation endpoint, Analytics/SpeedInsights

provides:
  - Privacy Policy page at /privacy/
  - Terms of Service page at /terms/
  - About page at /about/
  - Footer navigation to legal pages
  - "Coverage Coming Soon" empty state for jurisdictions without judges
  - noindex/follow for thin content pages (< 3 verified judges)
  - Enhanced 404 with state navigation
  - JudgeAvatar component with initials fallback (xs/sm/lg sizes)
  - Photo scraping pipeline script
  - Vercel Blob integration for photo storage

affects: [monetization, state-expansion, pillar-pages]

tech-stack:
  added: ["@vercel/blob", "@tailwindcss/typography"]
  patterns: [prose styling for long-form content, Avatar with initials fallback, empty-state pattern with neighbor links, noindex for thin content]

key-files:
  created:
    - src/app/privacy/page.tsx
    - src/app/terms/page.tsx
    - src/app/about/page.tsx
    - src/components/JudgeAvatar.tsx
    - scripts/harvest/photo-pipeline.ts
  modified:
    - src/app/globals.css
    - src/components/SiteFooter.tsx
    - src/app/judges/[state]/[county]/page.tsx
    - src/app/judges/[state]/[county]/[courtType]/page.tsx
    - src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx
    - src/app/not-found.tsx
    - src/components/JudgeGrid.tsx
    - src/components/search/SearchResults.tsx
    - src/components/search/SearchInput.tsx
    - package.json

key-decisions:
  - "Used @plugin directive for typography (Tailwind v4 CSS-first config)"
  - "JudgeAvatar uses conditional rendering instead of AvatarImage asChild for Radix compatibility"
  - "Added xs (32px), sm (44px), lg (150x180px) avatar sizes matching existing UI patterns"
  - "Circular avatars for grid/search, rectangular for profile page"
  - "Photo pipeline creates PrismaClient directly (matching existing harvest script pattern)"
  - "noindex threshold: < 3 verified judges, preserves follow for link equity"

patterns-established:
  - "Empty state pattern: Coverage Coming Soon with neighbor/parent navigation links"
  - "Thin content SEO: robots noindex/follow spread conditionally in generateMetadata"
  - "JudgeAvatar: reusable photo/initials component across all judge displays"
  - "Legal page pattern: prose article with Metadata export, canonical URL, OG/Twitter cards"

requirements-completed: [LEGL-01, LEGL-02, LEGL-03, LEGL-04, CONT-01, CONT-02, CONT-03, PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04]

duration: 13min
completed: 2026-03-23
---

# Phase 01 Plan 03: Legal Pages, Content Quality & Judge Photos Summary

**Privacy/Terms/About pages with prose typography, thin-content noindex, Coverage Coming Soon empties, and JudgeAvatar component with photo pipeline for Vercel Blob**

## Performance

- **Duration:** 13min
- **Started:** 2026-03-23T03:59:47Z
- **Completed:** 2026-03-23T04:12:24Z
- **Tasks:** 12/12
- **Files modified:** 14

## Accomplishments

- Published Privacy Policy, Terms of Service, and About pages with full SEO metadata and prose styling
- Footer now links to all legal pages with accessible navigation
- Empty jurisdictions show "Coverage Coming Soon" with neighbor county links instead of blank pages
- Thin content pages (< 3 verified judges) get noindex/follow to prevent indexing while preserving link equity
- 404 page now queries database for states with verified judges and shows "Browse by state" navigation
- JudgeAvatar component replaces all inline SVG silhouettes across profile, grid, and search results
- Photo scraping pipeline ready to extract, optimize (sharp → WebP), and store (Vercel Blob) judge photos

## Task Commits

Each task was committed atomically:

1. **Task 1: Install typography plugin and Vercel Blob SDK** — `f5fdd3b` (chore)
2. **Task 2: Create Privacy Policy page** — `0711906` (feat)
3. **Task 3: Create Terms of Service page** — `4066de9` (feat)
4. **Task 4: Create About page** — `d53f827` (feat)
5. **Task 5: Add footer links to legal pages** — `9dcd5f0` (feat)
6. **Task 6: Coverage Coming Soon for empty jurisdictions** — `1b238c2` (feat)
7. **Task 7: Add noindex for thin content pages** — `9a10d51` (feat)
8. **Task 8: Enhance 404 page with state navigation** — `17902fb` (feat)
9. **Task 9: Create JudgeAvatar component** — `fad647d` (feat)
10. **Task 10: Integrate JudgeAvatar on judge profile** — `6cb63cd` (feat)
11. **Task 11: Build photo scraping pipeline** — `f904149` (feat)
12. **Task 12: Integrate JudgeAvatar in grid and search** — `f77e439` (feat)

## Files Created/Modified

### Created

- `src/app/privacy/page.tsx` — Privacy Policy with cookie-free analytics disclosure
- `src/app/terms/page.tsx` — Terms of Service with no-legal-advice disclaimer
- `src/app/about/page.tsx` — About page with mission, methodology, verification process
- `src/components/JudgeAvatar.tsx` — Reusable avatar with photo/initials fallback (xs/sm/lg)
- `scripts/harvest/photo-pipeline.ts` — Photo extraction, optimization, Vercel Blob upload

### Modified

- `src/app/globals.css` — Added @plugin for @tailwindcss/typography
- `src/components/SiteFooter.tsx` — Added nav links to About, Privacy, Terms
- `src/app/judges/[state]/[county]/page.tsx` — Empty state + noindex for thin content
- `src/app/judges/[state]/[county]/[courtType]/page.tsx` — Empty state + noindex for thin content
- `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` — JudgeAvatar replaces silhouette
- `src/app/not-found.tsx` — Async Server Component with state navigation
- `src/components/JudgeGrid.tsx` — JudgeAvatar replaces inline SVG
- `src/components/search/SearchResults.tsx` — JudgeAvatar replaces inline SVG
- `src/components/search/SearchInput.tsx` — JudgeAvatar replaces inline SVG
- `package.json` — Added @vercel/blob, @tailwindcss/typography

## Decisions Made

- **Typography via @plugin**: Tailwind v4 uses CSS-first config with `@plugin` directives instead of config file plugins
- **JudgeAvatar conditional rendering**: Used conditional rendering instead of Radix `asChild` pattern for better type compatibility with next/image
- **Three avatar sizes**: xs (32px autocomplete), sm (44px grid/search), lg (150×180 profile) — matching existing UI dimensions
- **PrismaClient in scripts**: Photo pipeline creates its own PrismaClient instance, consistent with all other harvest scripts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed cheerio.Element type error in photo pipeline**

- **Found during:** Task 12 (build verification)
- **Issue:** `cheerio.Element` type doesn't exist in cheerio v1.1.0; the namespace has no `Element` export
- **Fix:** Changed parameter type to `ReturnType<ReturnType<typeof cheerio.load>>` which resolves correctly
- **Files modified:** `scripts/harvest/photo-pipeline.ts`
- **Verification:** `npm run build` exits 0
- **Committed in:** `f904149` (amended into T11 commit)

## Self-Check: PASSED

- [x] `src/app/privacy/page.tsx` — FOUND
- [x] `src/app/terms/page.tsx` — FOUND
- [x] `src/app/about/page.tsx` — FOUND
- [x] `src/components/JudgeAvatar.tsx` — FOUND
- [x] `scripts/harvest/photo-pipeline.ts` — FOUND
- [x] `f5fdd3b` — FOUND
- [x] `0711906` — FOUND
- [x] `4066de9` — FOUND
- [x] `d53f827` — FOUND
- [x] `9dcd5f0` — FOUND
- [x] `1b238c2` — FOUND
- [x] `9a10d51` — FOUND
- [x] `17902fb` — FOUND
- [x] `fad647d` — FOUND
- [x] `6cb63cd` — FOUND
- [x] `f904149` — FOUND
- [x] `f77e439` — FOUND
- [x] `npm run build` exits 0 — VERIFIED
