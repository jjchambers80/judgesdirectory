---
phase: 01-production-readiness
plan: "02"
subsystem: seo, analytics, performance
tags:
  [
    vercel-analytics,
    speed-insights,
    open-graph,
    twitter-card,
    isr,
    sharp,
    revalidation,
  ]

# Dependency graph
requires:
  - phase: 01-01
    provides: shared Breadcrumbs component, loading skeletons
provides:
  - Vercel Analytics and Speed Insights instrumentation
  - Open Graph and Twitter Card meta on all 5 public page templates
  - ISR caching on all public routes (hourly listings, daily profiles)
  - On-demand revalidation API route
  - Image optimization via sharp with Vercel Blob remotePatterns
  - Default OG fallback image
  - Google Search Console verification meta tag
affects: [phase-02-revenue, phase-03-expansion]

# Tech tracking
tech-stack:
  added: ["@vercel/analytics", "@vercel/speed-insights", "sharp"]
  patterns:
    [
      "buildOpenGraph/buildTwitterCard helpers in seo.ts",
      "ISR revalidate exports per route segment",
      "timingSafeEqual for API auth tokens",
    ]

key-files:
  created: ["public/og-default.png", "src/app/api/revalidate/route.ts"]
  modified:
    [
      "package.json",
      "src/app/layout.tsx",
      "src/lib/seo.ts",
      "src/app/judges/page.tsx",
      "src/app/judges/[state]/page.tsx",
      "src/app/judges/[state]/[county]/page.tsx",
      "src/app/judges/[state]/[county]/[courtType]/page.tsx",
      "src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx",
      "next.config.mjs",
      "src/components/JudgeGrid.tsx",
      "src/components/search/SearchInput.tsx",
      "src/components/search/SearchResults.tsx",
    ]

key-decisions:
  - "Used crypto.timingSafeEqual for revalidation token comparison instead of simple equality"
  - "Combined T02+T03 into single commit since both modify layout.tsx"
  - "T11 and T12 were verification-only tasks — no code changes needed"

patterns-established:
  - "buildOpenGraph/buildTwitterCard: reusable OG+Twitter meta builders used by all page templates"
  - "ISR per-route: listing pages 3600s, profiles 86400s"
  - "Revalidation API: POST /api/revalidate/ with x-revalidation-token header"

requirements-completed:
  [
    ANLT-01,
    ANLT-02,
    ANLT-03,
    ANLT-04,
    ANLT-05,
    ANLT-06,
    ANLT-07,
    PERF-01,
    PERF-02,
    PERF-03,
    PERF-04,
  ]

# Metrics
duration: 13min
completed: 2026-03-23
---

# Phase 01 Plan 02: Analytics, SEO Foundation & ISR Performance Summary

**Vercel Analytics/SpeedInsights instrumented, OG+Twitter meta on all 5 templates, ISR caching enabled, on-demand revalidation API created, image optimization fixed with sharp**

## Performance

- **Duration:** 13 min
- **Started:** 2026-03-23T03:38:30Z
- **Completed:** 2026-03-23T03:51:26Z
- **Tasks:** 16/16 (including 2 verification-only tasks)
- **Files modified:** 14

## Accomplishments

- Installed and rendered `<Analytics />` and `<SpeedInsights />` in root layout for real-user pageview and CWV tracking
- Added Google Search Console verification meta tag (env var–driven)
- Created reusable `buildOpenGraph()` and `buildTwitterCard()` helpers in seo.ts
- Generated 1200×630 branded fallback OG image at public/og-default.png
- Added OG + Twitter Card meta to all 5 public page templates including judge photo support
- Verified canonical URLs with trailing slashes on all templates
- Verified sitemap.ts with 50K-URL splitting and JSON-LD with XSS sanitization
- Enabled ISR caching: 3600s for listings, 86400s for judge profiles
- Created authenticated on-demand revalidation API at /api/revalidate/
- Removed `unoptimized` prop from all 4 Image components and configured remotePatterns for Vercel Blob
- Build passes (`npm run build` exits 0)

## Task Commits

Each task was committed atomically:

1. **T01: Install analytics and performance packages** — `b7038d7` (chore)
2. **T02+T03: Add Analytics, SpeedInsights, Search Console verification** — `269c1de` (feat)
3. **T04: Add buildOpenGraph and buildTwitterCard helpers** — `271eafe` (feat)
4. **T05: Create default OG image** — `968b77d` (feat)
5. **T06: Add OG + Twitter meta to judges index** — `19ab253` (feat)
6. **T07: Add OG + Twitter meta to state page** — `503b7f6` (feat)
7. **T08: Add OG + Twitter meta to county page** — `20b92d9` (feat)
8. **T09: Add OG + Twitter meta to court type page** — `a20ed7b` (feat)
9. **T10: Add OG + Twitter meta to judge profile page** — `879b21d` (feat)
10. **T11: Verify canonical URLs** — no commit (verification only, all checks passed)
11. **T12: Verify sitemap and JSON-LD** — no commit (verification only, all checks passed)
12. **T13: Add ISR revalidate exports** — `cea43e6` (feat)
13. **T14: Create on-demand revalidation API route** — `81f5644` (feat)
14. **T15: Fix image optimization** — `981e124` (feat)
15. **T16: CWV baseline verification** — no commit (build verification, all checks passed)

## Files Created/Modified

- `package.json` — Added @vercel/analytics, @vercel/speed-insights, sharp
- `src/app/layout.tsx` — Analytics, SpeedInsights components, Google verification meta
- `src/lib/seo.ts` — buildOpenGraph, buildTwitterCard helpers
- `public/og-default.png` — 1200×630 branded fallback OG image
- `src/app/judges/page.tsx` — OG, Twitter meta, ISR revalidate
- `src/app/judges/[state]/page.tsx` — OG, Twitter meta, description, ISR revalidate
- `src/app/judges/[state]/[county]/page.tsx` — OG, Twitter meta, description, ISR revalidate
- `src/app/judges/[state]/[county]/[courtType]/page.tsx` — OG, Twitter meta, description, ISR revalidate
- `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` — OG (profile type), Twitter meta, ISR revalidate, removed unoptimized
- `next.config.mjs` — remotePatterns for Vercel Blob
- `src/app/api/revalidate/route.ts` — New authenticated revalidation endpoint
- `src/components/JudgeGrid.tsx` — Removed unoptimized from Image
- `src/components/search/SearchInput.tsx` — Removed unoptimized from Image
- `src/components/search/SearchResults.tsx` — Removed unoptimized from Image

## Decisions Made

- **crypto.timingSafeEqual for token comparison:** Plan suggested simple equality was acceptable; upgraded to timingSafeEqual for defense in depth (Deviation Rule 2 — security best practice).
- **Combined T02+T03:** Both modify layout.tsx, committed together to avoid intermediate state.
- **T11/T12/T16 verification-only:** No code changes needed — existing infrastructure (trailingSlash, middleware, sitemap, JSON-LD) was already correct.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Security] Used timingSafeEqual for revalidation token**

- **Found during:** Task 14
- **Issue:** Plan suggested simple string equality was acceptable for token comparison
- **Fix:** Used crypto.timingSafeEqual to prevent timing attacks on the revalidation secret
- **Files modified:** src/app/api/revalidate/route.ts
- **Verification:** Build passes, endpoint logic correct
- **Committed in:** 81f5644

## Known Stubs

None — all features are fully wired.

## Self-Check: PASSED
