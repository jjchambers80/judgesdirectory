# Phase 1: Production Readiness — Research

**Researched:** 2026-03-22
**Phase:** 01-production-readiness
**Plans:** 01-01 (Design), 01-02 (Analytics/SEO/ISR), 01-03 (Legal/Content/Photos)
**Requirements:** DSGN-01–05, ANLT-01–07, PERF-01–04, LEGL-01–04, CONT-01–03, PHOTO-01–04

---

## Table of Contents

1. [Design System Migration (DSGN-01 to DSGN-05)](#1-design-system-migration)
2. [Analytics & SEO (ANLT-01 to ANLT-07)](#2-analytics--seo)
3. [ISR Performance (PERF-01 to PERF-04)](#3-isr-performance)
4. [Legal Pages (LEGL-01 to LEGL-04)](#4-legal-pages)
5. [Judge Photos (PHOTO-01 to PHOTO-04)](#5-judge-photos)
6. [Content Quality (CONT-01 to CONT-03)](#6-content-quality)
7. [Dependency Summary](#7-dependency-summary)
8. [Risk Register](#8-risk-register)
9. [Requirement → Implementation Map](#9-requirement--implementation-map)

---

## 1. Design System Migration

### DSGN-01: Complete 006 Migration (All Public Pages → shadcn/ui + Tailwind)

**Current State:**
- 18 shadcn/ui components installed in `src/components/ui/`: badge, button, card, checkbox, data-table (+ column-header, faceted-filter, pagination, toolbar), dropdown-menu, input, pagination, popover, progress, select, separator, table, tabs
- Tailwind v4 bridge layer in `globals.css` is complete — all shadcn/ui semantic tokens mapped, extended FR-029 tokens for badge/warning/success/error/disclaimer/link colors
- Typography base layer (FR-028) already in `globals.css` with `@layer base` styles for h1–h6, p, a
- Box-sizing reset compensating for omitted preflight already present
- Only 2 remaining `style={{}}` occurrences across all `.tsx` files:
  - `src/components/admin/ProgressDashboard.tsx:176` — dynamic width for progress bar (acceptable, dynamic value)
  - `src/components/ui/progress.tsx:25` — shadcn component internal (do not modify)
- `unoptimized` flag on Image in 4 files — handled under PERF-04

**Migration is largely DONE.** The 006 spec targeted 21 files (FR-027). Review needed to confirm all are migrated. The bridge layer, typography, and box-sizing are complete.

**What remains for DSGN-01:**
1. Audit all 21 files from FR-027 to confirm zero inline styles (excluding dynamic values)
2. Verify all color references use semantic tokens (no hardcoded hex)
3. Confirm all uses of `cn()` for class composition
4. Install any missing shadcn/ui components needed for public pages

**shadcn/ui components to install:**

```bash
npx shadcn@latest add skeleton    # Loading states (DSGN-03)
npx shadcn@latest add breadcrumb  # Shared navigation (DSGN-05)
npx shadcn@latest add avatar      # Judge photos (PHOTO-01/02)
```

These three are the only new components needed. The existing 18 cover all other use cases.

### DSGN-02: Admin Panel Styling Unified

**Current State:**
- Admin pages were part of the 006 migration scope (7 admin pages + 6 admin components in FR-027)
- Admin nav uses flex-wrap per Q2 clarification
- Data tables use shadcn DataTable with horizontal scroll containers

**What to verify:** Same audit as DSGN-01 but for admin files. If 006 migration was completed, this should pass verification.

### DSGN-03: Loading Skeleton Components

**Current State:**
- ZERO `loading.tsx` files exist in the app directory
- One custom `LoadingSkeleton` function exists in `src/components/search/SearchResults.tsx` — uses `animate-pulse` + `bg-muted` div pattern
- The judges index page (`/judges/page.tsx`) has an inline Suspense fallback: `<div className="h-10 w-full max-w-md bg-muted rounded-md animate-pulse mb-8" />`
- shadcn/ui `Skeleton` component is NOT yet installed

**Implementation Strategy:**
Use Next.js `loading.tsx` convention files for route-level skeletons. This provides automatic Suspense boundaries without manual `<Suspense>` wrappers.

**Pattern using shadcn/ui Skeleton:**

```tsx
// src/app/judges/[state]/loading.tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="space-y-6">
      {/* Breadcrumb skeleton */}
      <div className="flex items-center gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-4" />
        <Skeleton className="h-4 w-24" />
      </div>
      {/* Title skeleton */}
      <Skeleton className="h-8 w-64" />
      {/* Grid skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
```

**Files to create:**
- `src/app/judges/loading.tsx` — States grid / search skeleton
- `src/app/judges/[state]/loading.tsx` — County list skeleton
- `src/app/judges/[state]/[county]/loading.tsx` — Court types skeleton
- `src/app/judges/[state]/[county]/[courtType]/loading.tsx` — Judge list skeleton
- `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/loading.tsx` — Judge profile skeleton

Each skeleton should match the layout structure of its corresponding page to prevent CLS.

### DSGN-04: Mobile Responsiveness

**Current State:**
- Root layout uses responsive classes: `px-4 py-6 mx-auto max-w-[1400px] sm:px-8 sm:py-8`
- SiteHeader uses `gap-6 px-4 py-3 sm:px-8`
- SiteFooter uses `px-4 py-6 mx-auto max-w-[1400px] sm:px-8`
- Judge profile uses `flex flex-col gap-6 mb-8 sm:flex-row sm:items-start` for photo/info stacking
- Photo container: `w-[150px] h-[180px]` — fixed dimensions on mobile; acceptable for portrait
- Box-sizing reset applied globally

**Acceptance criteria from 006 spec:**
- 375px: Single column layouts, no horizontal scroll, touch targets ≥ 44px (updated to ≥ 48px in REQUIREMENTS)
- 768px: 2-column grids
- 1280px: 3-column grids

**What to verify:**
1. Test all 5 public page templates at 375px, 768px, 1280px
2. Confirm no horizontal overflow on any page
3. Confirm all interactive elements meet 48px touch target requirement
4. Verify breadcrumb text truncation on mobile for long court names (edge case from 006 spec)

### DSGN-05: Breadcrumb Component + BreadcrumbList JSON-LD

**Current State:**
- Breadcrumbs are implemented INLINE on at least 2 pages:
  - `src/app/judges/[state]/[county]/page.tsx` — county page has breadcrumb nav
  - `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` — full 5-level breadcrumb
- Both use identical pattern: `<nav aria-label="Breadcrumb">` with `<ol>` and inline SVG chevron separators
- Missing pages: states grid (no breadcrumb — it's the root), state page (needs "States" link)
- No BreadcrumbList JSON-LD exists anywhere

**Extraction to shared component:**

Install shadcn/ui breadcrumb component and build a wrapper:

```bash
npx shadcn@latest add breadcrumb
```

The shadcn/ui Breadcrumb provides `<Breadcrumb>`, `<BreadcrumbList>`, `<BreadcrumbItem>`, `<BreadcrumbLink>`, `<BreadcrumbSeparator>`, `<BreadcrumbPage>` with built-in accessibility (`aria-label`, `aria-current`).

**Shared component pattern:**

```tsx
// src/components/Breadcrumbs.tsx
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import JsonLd from "@/components/seo/JsonLd";
import { SITE_URL } from "@/lib/constants";

interface BreadcrumbSegment {
  label: string;
  href: string;
}

interface BreadcrumbsProps {
  segments: BreadcrumbSegment[];
  currentPage: string;
}

export default function Breadcrumbs({ segments, currentPage }: BreadcrumbsProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      ...segments.map((seg, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: seg.label,
        item: `${SITE_URL}${seg.href}`,
      })),
      {
        "@type": "ListItem",
        position: segments.length + 1,
        name: currentPage,
      },
    ],
  };

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumb className="mb-6">
        <BreadcrumbList>
          {segments.map((seg, i) => (
            <BreadcrumbItem key={seg.href}>
              <BreadcrumbLink href={seg.href}>{seg.label}</BreadcrumbLink>
              <BreadcrumbSeparator />
            </BreadcrumbItem>
          ))}
          <BreadcrumbItem>
            <BreadcrumbPage>{currentPage}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </>
  );
}
```

**Usage per page template:**

| Page | Segments | Current Page |
|------|----------|-------------|
| `/judges/` (States grid) | None | No breadcrumb needed (root page) |
| `/judges/[state]/` | `[{States, /judges/}]` | `{state.name}` |
| `/judges/[state]/[county]/` | `[{States, /judges/}, {state, /judges/[state]/}]` | `{county.name}` |
| `/judges/[state]/[county]/[courtType]/` | `[{States, /judges/}, {state, ...}, {county, ...}]` | `{court.type}` |
| `/judges/.../[judgeSlug]/` | `[{States, /judges/}, {state, ...}, {county, ...}, {court, ...}]` | `{judge.fullName}` |

**BreadcrumbList JSON-LD requirements:**
- Each `ListItem` needs: `position` (1-based), `name`, and `item` (URL) — except the last item which omits `item` per Google's documentation
- Validate via Google's Rich Results Test or Schema.org validator

---

## 2. Analytics & SEO

### ANLT-01: Vercel Analytics + Speed Insights

**Current State:**
- Neither `@vercel/analytics` nor `@vercel/speed-insights` are in `package.json`
- Root layout has no analytics components

**Installation:**

```bash
npm install @vercel/analytics @vercel/speed-insights
```

**Integration in root layout (`src/app/layout.tsx`):**

```tsx
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Add before closing </body>:
<Analytics />
<SpeedInsights />
```

**Key properties:**
- Cookie-free — no GDPR consent banner needed (Decision D-04)
- `<Analytics />` auto-tracks page views including App Router soft navigations
- `<SpeedInsights />` reports real-user Core Web Vitals (LCP, INP, CLS, FCP, TTFB) to Vercel dashboard
- Both are Client Components internally but can be placed in the Server Component layout
- Zero configuration required beyond installation — Vercel detects them automatically

### ANLT-02: Google Search Console

**No code changes needed.** This is a manual configuration task:

1. Verify domain ownership via DNS TXT record: `google-site-verification=XXXXXXX`
2. Add the property at `search.google.com/search-console`
3. Submit sitemap URL: `https://judgesdirectory.org/sitemap.xml`
4. Verify sitemap is processed and pages are being crawled

**Alternatively:** Add meta tag verification in root layout metadata:

```tsx
export const metadata: Metadata = {
  // ... existing
  verification: {
    google: "YOUR_VERIFICATION_CODE",
  },
};
```

### ANLT-03: Core Web Vitals Baseline

**No code needed.** Once ANLT-01 is deployed:
1. Vercel Speed Insights dashboard shows real-user CWV per page template
2. Use PageSpeed Insights to get lab data for all 5 templates
3. Document baseline LCP, INP, CLS values per template type
4. Target: LCP < 2.5s, INP < 200ms, CLS < 0.1 (PERF-03)

### ANLT-04: Dynamic XML Sitemaps

**Current State:**
- `src/app/sitemap.ts` is COMPLETE with:
  - `generateSitemaps()` for 50K URL splitting
  - Full state → county → court → judge URL generation
  - VERIFIED-only judge filtering
  - `lastModified` from `updatedAt` field
  - Priority hierarchy: index (1.0), states (0.9), counties (0.8), courts (0.7), judges (0.6)
  
**Assessment:** This requirement is ALREADY SATISFIED. Verify the sitemap renders correctly and submit to GSC (ANLT-02).

**Minor improvement to consider:** The current implementation loads all states with all counties, courts, and judges in a single query per sitemap page. At multi-state scale this may need pagination. For Phase 1 (Florida only) it's fine.

### ANLT-05: Open Graph & Twitter Card Meta Tags

**Current State:**
- All 5 page templates export `generateMetadata()` with `title` and `alternates.canonical`
- States grid uses static `export const metadata` with title and description
- NO Open Graph or Twitter Card meta tags anywhere

**Implementation pattern — extend `generateMetadata()`:**

```tsx
// Example for judge profile page
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { state, county, court, judge } = data;
  
  const title = judgeProfileTitle(judge.fullName, court.type, county.name, state.name);
  const description = `Judge ${judge.fullName} serves on the ${court.type} in ${county.name}, ${state.name}. View term dates, court information, and official records.`;
  const url = `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      siteName: SITE_NAME,
      type: "profile",  // "profile" for judge pages, "website" for listings
      locale: "en_US",
      ...(judge.photoUrl ? {
        images: [{
          url: judge.photoUrl,
          width: 300,
          height: 360,
          alt: `Photo of Judge ${judge.fullName}`,
        }],
      } : {}),
    },
    twitter: {
      card: judge.photoUrl ? "summary_large_image" : "summary",
      title,
      description,
    },
  };
}
```

**Template-specific OG types:**
| Page | `og:type` | Image |
|------|-----------|-------|
| States grid | `website` | None (or a default site OG image) |
| State listing | `website` | None |
| County listing | `website` | None |
| Court listing | `website` | None |
| Judge profile | `profile` | `judge.photoUrl` if available |

**Consider creating a default OG image** for pages without photos — a branded card with the site name and page title. Can be a static image in `/public/og-default.png` or generated via `next/og` (ImageResponse). For Phase 1, a static default is simpler.

**Helper function to add to `seo.ts`:**

```tsx
export function buildOpenGraph(opts: {
  title: string;
  description: string;
  url: string;
  type?: "website" | "profile";
  imageUrl?: string;
}): Metadata["openGraph"] {
  return {
    title: opts.title,
    description: opts.description,
    url: opts.url,
    siteName: SITE_NAME,
    type: opts.type ?? "website",
    locale: "en_US",
    ...(opts.imageUrl ? {
      images: [{ url: opts.imageUrl }],
    } : {
      images: [{ url: `${SITE_URL}/og-default.png`, width: 1200, height: 630 }],
    }),
  };
}
```

### ANLT-06: Canonical URLs + Trailing Slash + 301 Redirects

**Current State:**
- `next.config.mjs` has `trailingSlash: true` — Next.js appends trailing slashes on all routes
- Middleware (`src/middleware.ts`) handles lowercase normalization with 308 redirects
- All `generateMetadata()` functions include `alternates: { canonical: ... }` with trailing slashes
- Canonical URLs confirmed on: judges index, state pages, county pages, court pages, judge profiles

**Assessment:** This requirement is LARGELY SATISFIED.

**What to verify:**
1. Non-trailing-slash URLs redirect to trailing-slash (Next.js does this when `trailingSlash: true`)
2. Mixed-case URLs redirect to lowercase (middleware handles this)
3. All canonical URLs match the actual rendered URL
4. No duplicate pages in Google Search Console

**Potential gap:** The middleware uses 308 (permanent redirect) for lowercase normalization but relies on Next.js default behavior for trailing slash. Confirm both redirect correctly together (e.g., `/Judges/Florida` → 308 → `/judges/florida/`).

### ANLT-07: JSON-LD Validation + BreadcrumbList

**Current State:**
- `seo.ts` has builders for: `ItemList` (listing pages), `Person` (judge profiles)
- `JsonLd.tsx` server component with XSS sanitization
- State, county, and court listing pages use `buildItemListJsonLd()`
- Judge profile uses `buildPersonJsonLd()`
- **BreadcrumbList JSON-LD: MISSING** — addressed under DSGN-05 (shared Breadcrumbs component includes it)

**What to add:**
1. `buildBreadcrumbListJsonLd()` helper in `seo.ts` (or embed in shared Breadcrumbs component as shown in DSGN-05)
2. Validate ALL JSON-LD via [validator.schema.org](https://validator.schema.org/) and Google's Rich Results Test

**BreadcrumbList JSON-LD structure:**

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "States",
      "item": "https://judgesdirectory.org/judges/"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "Florida",
      "item": "https://judgesdirectory.org/judges/florida/"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "Miami-Dade County"
    }
  ]
}
```

**Note:** The last item (current page) MUST NOT include `item` per Google's BreadcrumbList documentation. Including it causes a validation warning.

---

## 3. ISR Performance

### PERF-01: ISR Caching on All Public Routes

**Current State:**
- ZERO `revalidate` exports on any route segment
- All pages are pure SSR — every request hits the database
- No `unstable_cache` usage anywhere
- React `cache()` used in state page for `getState()` — but this only deduplicates within a single request, not across requests

**Implementation — route-segment `revalidate` exports:**

```tsx
// Judge profiles — daily revalidation (86400s)
// src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx
export const revalidate = 86400;

// Listing pages — hourly revalidation (3600s)
// src/app/judges/page.tsx
// src/app/judges/[state]/page.tsx
// src/app/judges/[state]/[county]/page.tsx
// src/app/judges/[state]/[county]/[courtType]/page.tsx
export const revalidate = 3600;
```

**How it works in Next.js 14 App Router:**
1. First request → SSR, result cached at Vercel edge
2. Subsequent requests within `revalidate` window → served from cache (near-zero TTFB)
3. After window expires, next request triggers background regeneration — stale cache served immediately while fresh page generates
4. Fresh page replaces cache

**Important:** `export const revalidate` applies to the ENTIRE route segment. If a layout and page both export `revalidate`, the most restrictive (shortest) wins.

**Wrap Prisma queries with `unstable_cache` for finer control:**

```tsx
import { unstable_cache } from "next/cache";

const getStateJudges = unstable_cache(
  async (stateSlug: string) => {
    return prisma.judge.findMany({
      where: {
        status: "VERIFIED",
        court: { county: { state: { slug: stateSlug } } },
      },
      orderBy: { fullName: "asc" },
      select: { /* ... */ },
    });
  },
  ["state-judges"],            // cache key prefix
  { revalidate: 3600, tags: ["judges"] }  // 1 hour TTL, taggable
);
```

**Recommendation:**
- Start with route-segment `revalidate` exports only — simplest and sufficient for Phase 1
- Add `unstable_cache` wrappers if PERF-02 (on-demand revalidation) needs tag-based granularity
- Both approaches are complementary, not mutually exclusive

### PERF-02: On-Demand Revalidation After Harvest

**Current State:**
- Harvest pipeline runs via cron: `vercel.json` → `"path": "/api/cron/harvest"` monthly
- Harvest scripts in `scripts/harvest/`
- No revalidation trigger after harvest completes

**Implementation pattern — API route for on-demand revalidation:**

```tsx
// src/app/api/revalidate/route.ts
import { revalidateTag, revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  // Authenticate — use a secret token
  const token = request.headers.get("x-revalidation-token");
  if (token !== process.env.REVALIDATION_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  // Option 1: Tag-based invalidation (granular)
  if (body.tag) {
    revalidateTag(body.tag);
    return NextResponse.json({ revalidated: true, tag: body.tag });
  }

  // Option 2: Path-based invalidation (specific page)
  if (body.path) {
    revalidatePath(body.path);
    return NextResponse.json({ revalidated: true, path: body.path });
  }

  // Option 3: Revalidate all judges
  revalidateTag("judges");
  return NextResponse.json({ revalidated: true, scope: "all-judges" });
}
```

**Trigger from harvest pipeline:**

```typescript
// At end of harvest script
await fetch(`${SITE_URL}/api/revalidate`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-revalidation-token": process.env.REVALIDATION_SECRET!,
  },
  body: JSON.stringify({ tag: "judges" }),
});
```

**Alternatively**, call `revalidatePath()` directly in the harvest cron API route handler after import completes — avoids the extra HTTP call.

### PERF-03: Core Web Vitals Targets

**Targets:** LCP < 2.5s, INP < 200ms, CLS < 0.1

**Strategies to hit targets:**
1. **LCP**: ISR caching eliminates database latency from TTFB. `next/image` optimization reduces hero image load time. No render-blocking scripts (Vercel Analytics + Speed Insights load async)
2. **INP**: No heavy client-side JavaScript on public pages — all Server Components. Only SiteHeader search is interactive
3. **CLS**: Loading skeletons (DSGN-03) reserve layout space. `next/image` with explicit width/height prevents image shift. Reserved ad slot dimensions (Phase 2)

**Measurement approach:**
- Lab: Lighthouse CI in build pipeline
- Field: Vercel Speed Insights (ANLT-01) + Google Search Console CWV report

### PERF-04: Image Optimization (sharp + next/image)

**Current State:**
- `next.config.mjs` already configured: `images: { formats: ["image/avif", "image/webp"] }`
- NO `images.unoptimized` in next.config (good — optimization is enabled at config level)
- `unoptimized` flag set per-component in 4 files:
  - `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx:261`
  - `src/components/JudgeGrid.tsx:66`
  - `src/components/search/SearchInput.tsx:366`
  - `src/components/search/SearchResults.tsx:101`
- `sharp` is NOT in `package.json` — Vercel provides it in production but it should be explicit for dev/build consistency

**Implementation:**

1. Install sharp:
```bash
npm install sharp
```

2. Remove `unoptimized` prop from all 4 Image components

3. Ensure all `<Image>` tags have explicit `width` and `height`:
```tsx
<Image
  src={judge.photoUrl}
  alt={`Photo of Judge ${judge.fullName}`}
  width={150}
  height={180}
  className="object-cover w-full h-full"
  // NO unoptimized prop
/>
```

4. For external image sources (court website photos), add domains to `next.config.mjs`:
```js
images: {
  formats: ["image/avif", "image/webp"],
  remotePatterns: [
    {
      protocol: "https",
      hostname: "**.blob.vercel-storage.com",  // Vercel Blob
    },
    // Add court website domains as needed
  ],
},
```

**Note on Vercel Blob images:** If photos are stored in Vercel Blob (see PHOTO-04), the URLs are already on Vercel's CDN. `next/image` will still optimize them (resize, format convert) on first request, then cache.

---

## 4. Legal Pages

### LEGL-01 to LEGL-03: Privacy, Terms, About Pages

**Current State:**
- No `/privacy`, `/terms`, or `/about` routes exist
- SiteFooter has a well-written legal disclaimer

**Implementation — simple static pages:**

Create 3 new route files as plain Server Components with prose content:

```
src/app/privacy/page.tsx     → /privacy/
src/app/terms/page.tsx       → /terms/
src/app/about/page.tsx       → /about/
```

**Pattern:**

```tsx
// src/app/privacy/page.tsx
import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `Privacy policy for ${SITE_NAME}`,
  alternates: { canonical: `${SITE_URL}/privacy/` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <article className="prose max-w-3xl mx-auto">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
      {/* Content sections */}
    </article>
  );
}
```

**Content outline for each page:**

**Privacy Policy (`/privacy/`):**
- What data is collected (no cookies — Vercel Analytics is cookie-free)
- No personal data collection from visitors
- Third-party services (Vercel Analytics, Google Search Console)
- Data source transparency (public records, court websites)
- Contact information for privacy questions

**Terms of Service (`/terms/`):**
- Informational purposes only — not legal advice
- No warranties on accuracy (mirrors footer disclaimer)
- Acceptable use (no scraping, no bulk downloading)
- Intellectual property (directory compilation, not individual judge info)
- Limitation of liability
- Contact information

**About Page (`/about/`):**
- Mission: making public judicial information accessible and searchable
- Data sources: official court websites, public records, state bar associations
- Methodology: automated harvesting with human verification
- Verification process: cross-reference multiple sources, VERIFIED status only on public pages
- Coverage: currently Florida (expanding)
- How to report errors: contact info/form

**Note on `prose` class:** Tailwind's `@tailwindcss/typography` plugin is NOT installed. Options:
1. Install `@tailwindcss/typography` — adds `prose` class for formatted long-form content
2. Use manual Tailwind classes (more verbose but no extra dependency)

**Recommendation:** Install `@tailwindcss/typography` since legal/about pages are long-form content and future pillar pages (v2) will need it too. It's a dev dependency with minimal overhead.

```bash
npm install -D @tailwindcss/typography
```

Add to `globals.css`:
```css
@import "tailwindcss/utilities.css" layer(utilities);
@plugin "@tailwindcss/typography";
```

### LEGL-04: Footer Disclaimer Verification

**Current State:**
- `SiteFooter.tsx` already renders on every page via root layout
- Uses semantic markup: `<aside role="note" aria-label="Legal disclaimer">`
- Uses design system tokens: `text-disclaimer-text`
- Content is comprehensive and appropriate

**Assessment:** ALREADY SATISFIED. Verify post-migration that it renders correctly on all pages including new legal pages.

**Enhancement to consider:** Add footer links to `/privacy/`, `/terms/`, `/about/`:

```tsx
<div className="flex gap-4 mt-2 text-sm">
  <Link href="/privacy/">Privacy Policy</Link>
  <Link href="/terms/">Terms of Service</Link>
  <Link href="/about/">About</Link>
</div>
```

---

## 5. Judge Photos

### PHOTO-01: Display Photos on Profile Page via next/image

**Current State:**
- Judge profile already displays photo via `<Image>` component with `unoptimized` flag
- Photo container: `w-[150px] h-[180px]` with `rounded-lg overflow-hidden shadow-md`
- Prisma schema has `Judge.photoUrl: String?`

**What to change:**
1. Remove `unoptimized` prop (covered in PERF-04)
2. Configure `remotePatterns` in `next.config.mjs` for photo URLs
3. Consider using shadcn/ui `Avatar` component for consistent styling:

```tsx
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

<Avatar className="w-[150px] h-[180px] rounded-lg">
  <AvatarImage src={judge.photoUrl} alt={`Photo of Judge ${judge.fullName}`} />
  <AvatarFallback className="rounded-lg">
    <JudgeSilhouette />
  </AvatarFallback>
</Avatar>
```

**Note:** shadcn/ui Avatar uses Radix UI Avatar internally — it handles loading states and fallback automatically.

### PHOTO-02: Fallback Avatar with Initials

**Current State:**
- `JudgeSilhouette` SVG component exists inline in judge profile page
- It renders a generic silhouette with robe and gavel hint

**Enhancement per Decision D-12:**
Add initials overlay when judge name is available:

```tsx
function JudgeInitials({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
      <span className="text-3xl font-semibold text-muted-foreground">
        {initials}
      </span>
    </div>
  );
}
```

**Or combine with shadcn Avatar:**

```tsx
<Avatar className="w-[150px] h-[180px] rounded-lg">
  <AvatarImage src={judge.photoUrl} alt={`Photo of ${judge.fullName}`} />
  <AvatarFallback className="rounded-lg text-3xl font-semibold">
    {getInitials(judge.fullName)}
  </AvatarFallback>
</Avatar>
```

### PHOTO-03: Photo Scraping Pipeline

**Current State:**
- Harvest pipeline exists in `scripts/harvest/`
- Pipeline already visits court bio pages and extracts judge data
- `Judge.photoUrl` field exists but is likely null for most judges
- `Judge.sourceUrl` stores the court bio page URL

**Implementation approach — extend harvest pipeline:**

During the existing bio page scrape step, add photo URL extraction:

```typescript
// In the harvest extraction logic
function extractPhotoUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);
  
  // Common patterns on court bio pages:
  // 1. <img> inside a .judge-photo or .bio-photo container
  // 2. <img> with alt text containing "judge" or the judge's name
  // 3. <img> in the first content area that's not a logo/icon
  
  const selectors = [
    '.judge-photo img',
    '.bio-photo img',
    '.judge-image img',
    '.profile-photo img',
    'article img[alt*="judge" i]',
    '.content-area img:first-of-type',
  ];
  
  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const src = img.attr('src');
      if (src) {
        return new URL(src, baseUrl).href;
      }
    }
  }
  
  return null;
}
```

**Important considerations:**
- Photo extraction is best-effort — not all court pages have photos in consistent locations
- Store the raw URL initially; optimize on upload to Vercel Blob (PHOTO-04)
- Copyright: court bio page photos are typically public-domain government works — safe to use
- Don't scrape photos from non-government sources (LinkedIn, news sites)

### PHOTO-04: Photo Storage & Optimization

**Decision D-11:** Store optimized images via sharp (WebP, ~300×360px) in Vercel Blob storage.

**Vercel Blob overview:**
- Serverless file storage with CDN
- Free tier: 1GB storage (enough for thousands of photos at ~50KB each)
- Files served from Vercel's edge CDN
- SDK: `@vercel/blob`

```bash
npm install @vercel/blob
```

**Photo processing pipeline:**

```typescript
import sharp from "sharp";
import { put } from "@vercel/blob";

async function processAndStorePhoto(
  sourceUrl: string,
  judgeSlug: string
): Promise<string> {
  // Fetch the original image
  const response = await fetch(sourceUrl);
  const buffer = Buffer.from(await response.arrayBuffer());
  
  // Optimize with sharp
  const optimized = await sharp(buffer)
    .resize(300, 360, { fit: "cover", position: "top" })
    .webp({ quality: 80 })
    .toBuffer();
  
  // Upload to Vercel Blob
  const { url } = await put(
    `judges/${judgeSlug}.webp`,
    optimized,
    { access: "public", contentType: "image/webp" }
  );
  
  return url;
}
```

**next/image configuration for Vercel Blob:**

```js
// next.config.mjs
images: {
  formats: ["image/avif", "image/webp"],
  remotePatterns: [
    {
      protocol: "https",
      hostname: "*.public.blob.vercel-storage.com",
    },
  ],
},
```

**Alternative: `/public` directory storage:**
- Simpler — no SDK needed, files served as static assets
- Downside: images are part of the deployment bundle, increasing deploy size
- Downside: can't update photos without redeploying
- **Not recommended** for a growing dataset

---

## 6. Content Quality

### CONT-01: Empty Jurisdiction "Coming Soon" Pattern

**Current State:**
- County and court pages render whatever judges are found (could be 0)
- No special handling for empty results
- `notFound()` is only called if the jurisdiction entity itself doesn't exist, not if it has 0 judges

**Implementation pattern:**

```tsx
// In county/court page components, after fetching judges:
if (judges.length === 0) {
  return (
    <>
      <Breadcrumbs segments={...} currentPage={...} />
      <h1>{pageTitle}</h1>
      <aside className="py-12 text-center border rounded-lg bg-muted/50">
        <h2 className="text-lg font-semibold mb-2">Coverage Coming Soon</h2>
        <p className="text-muted-foreground mb-4">
          We're working on adding verified judge information for {jurisdictionName}.
        </p>
        <nav className="flex flex-wrap justify-center gap-4">
          {/* Links to parent jurisdiction and neighboring counties */}
          <Link href={parentUrl}>← Back to {parentName}</Link>
          {neighboringCounties.map(county => (
            <Link key={county.slug} href={countyUrl}>{county.name}</Link>
          ))}
        </nav>
      </aside>
    </>
  );
}
```

**Data for neighboring counties:**
Query sibling counties from the same state. The Prisma query is straightforward:

```typescript
const neighbors = await prisma.county.findMany({
  where: {
    stateId: state.id,
    id: { not: county.id },
    courts: { some: { judges: { some: { status: "VERIFIED" } } } },
  },
  take: 5,
  orderBy: { name: "asc" },
  select: { name: true, slug: true },
});
```

### CONT-02: noindex for Thin Content Pages

**Current State:**
- No `robots` metadata on any page
- All pages are indexable by default

**Implementation — conditional `robots` in `generateMetadata()`:**

```tsx
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // ... existing code to get data
  
  const verifiedCount = await prisma.judge.count({
    where: {
      status: "VERIFIED",
      court: { countyId: county.id },
    },
  });
  
  return {
    title: /* ... */,
    alternates: { canonical: /* ... */ },
    // Threshold: < 3 verified judges → noindex
    ...(verifiedCount < 3 ? {
      robots: { index: false, follow: true },
    } : {}),
  };
}
```

**Key detail:** Use `follow: true` even when `index: false` — this allows Google to discover linked pages through the noindexed page, which maintains link equity flow in the site hierarchy.

**Threshold per Decision D-16:** `< 3` verified judges → noindex. `≥ 3` → indexable.

**Apply to these page templates:**
- `/judges/[state]/[county]/` — county page: count verified judges in county
- `/judges/[state]/[county]/[courtType]/` — court page: count verified judges for court
- State-level pages and the judges index should always be indexed (even if empty, they're structural)

### CONT-03: Enhanced 404 Page

**Current State:**
- `src/app/not-found.tsx` is minimal: title, single paragraph, single link to `/judges/`
- No navigation to existing jurisdictions

**Enhancement per Decision D-17:**

```tsx
import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function NotFound() {
  // Fetch states that have verified judges for helpful navigation
  const states = await prisma.state.findMany({
    where: { counties: { some: { courts: { some: { judges: { some: { status: "VERIFIED" } } } } } } },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  return (
    <div className="text-center py-16 px-4 sm:px-8">
      <h1>404 — Page Not Found</h1>
      <p className="text-muted-foreground mb-8">
        The page you're looking for doesn't exist or may have moved.
      </p>
      
      <div className="max-w-md mx-auto space-y-6">
        <Link href="/judges/" className="inline-block text-link underline">
          Search all judges
        </Link>
        
        {states.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              Browse by state
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {states.map((state) => (
                <Link
                  key={state.slug}
                  href={`/judges/${state.slug}/`}
                  className="px-3 py-1 rounded-md bg-muted text-sm hover:bg-muted/80"
                >
                  {state.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

**Important note on Next.js 14 not-found.tsx:** The `not-found.tsx` file at the app root is a special page. In Next.js 14 App Router, it does NOT have access to `params` or request data. However, it CAN be an async Server Component that fetches data. Using Prisma to query states is valid here.

---

## 7. Dependency Summary

### New packages to install:

| Package | Type | Purpose | Requirement |
|---------|------|---------|-------------|
| `@vercel/analytics` | production | Page view tracking | ANLT-01 |
| `@vercel/speed-insights` | production | Real-user CWV monitoring | ANLT-01 |
| `sharp` | production | Image optimization for next/image | PERF-04 |
| `@vercel/blob` | production | Photo storage with CDN | PHOTO-04 |
| `@tailwindcss/typography` | dev | Prose styling for legal/about pages | LEGL-01–03 |

### shadcn/ui components to add:

| Component | Purpose | Requirement |
|-----------|---------|-------------|
| `skeleton` | Loading state placeholders | DSGN-03 |
| `breadcrumb` | Shared navigation with a11y | DSGN-05 |
| `avatar` | Judge photo + fallback | PHOTO-01, PHOTO-02 |

### Install commands:

```bash
# NPM packages
npm install @vercel/analytics @vercel/speed-insights sharp @vercel/blob
npm install -D @tailwindcss/typography

# shadcn/ui components
npx shadcn@latest add skeleton breadcrumb avatar
```

---

## 8. Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Photo scraping extracts wrong image (logo, banner) | HIGH | LOW | Validate extracted images for portrait aspect ratio and minimum dimensions; human review during verification |
| ISR cache serves stale data after emergency correction | MEDIUM | MEDIUM | On-demand revalidation API (PERF-02) + short TTL during initial rollout, extend later |
| `@tailwindcss/typography` prose styles conflict with existing base layer | LOW | LOW | Scope `prose` class to legal pages only; typography base layer in globals.css targets bare elements, prose targets `.prose` container |
| Vercel Blob free tier (1GB) exceeded | LOW | LOW | At 50KB per photo × 10K judges = 500MB. Won't exceed for Phase 1 Florida-only. Monitor. |
| Court bio pages block scraping (Cloudflare) | MEDIUM | MEDIUM | Already documented in `docs/research/new-york-cloudflare-block.md`. Use existing scrapling fallback fetcher (spec 017). Florida pages generally not blocked. |
| shadcn/ui Breadcrumb component styling conflicts with bridge layer | LOW | LOW | shadcn/ui components are designed for the same CSS variable system already in place |
| OG images missing for most pages (no judge photos yet) | HIGH | LOW | Create a branded default OG image (`/public/og-default.png`) as fallback |
| `loading.tsx` skeletons cause CLS if they don't match page layout | MEDIUM | MEDIUM | Design each skeleton to closely match the structure of its corresponding page; measure CLS before/after |

---

## 9. Requirement → Implementation Map

This maps each of the 27 Phase 1 requirements to specific implementation actions and their target plan.

### Plan 01-01: Design System + Mobile Responsiveness

| Req | Implementation | Files |
|-----|---------------|-------|
| DSGN-01 | Audit 21 files for inline styles, verify shadcn/ui adoption, install missing components | All FR-027 files |
| DSGN-02 | Same audit for admin panel files | 7 admin pages + 6 admin components |
| DSGN-03 | Install shadcn/ui Skeleton; create `loading.tsx` for all 5 public routes | 5 new loading.tsx files |
| DSGN-04 | Test all pages at 375/768/1280px; fix any overflow, touch target, or layout issues | All public templates |
| DSGN-05 | Install shadcn/ui Breadcrumb; create shared `<Breadcrumbs>` component with JSON-LD; replace inline breadcrumbs on all pages | New `Breadcrumbs.tsx` + 4 page templates |

### Plan 01-02: Analytics, SEO & ISR Performance

| Req | Implementation | Files |
|-----|---------------|-------|
| ANLT-01 | Install @vercel/analytics + @vercel/speed-insights; add components to root layout | `layout.tsx`, `package.json` |
| ANLT-02 | Manual: verify domain in GSC, submit sitemap | N/A (manual task) |
| ANLT-03 | Run Lighthouse + PageSpeed on all 5 templates; document baseline | Documentation task |
| ANLT-04 | Already done — verify sitemap renders correctly | `sitemap.ts` (verify only) |
| ANLT-05 | Add OG/Twitter meta to all 5 `generateMetadata()` functions; add helper to seo.ts; create default OG image | `seo.ts` + 5 page templates + `/public/og-default.png` |
| ANLT-06 | Already largely done — verify canonical + trailing slash + redirects work together | Middleware + verify |
| ANLT-07 | BreadcrumbList JSON-LD via shared Breadcrumbs component (DSGN-05); validate all existing JSON-LD | `seo.ts` + `Breadcrumbs.tsx` |
| PERF-01 | Add `export const revalidate` to all 5 public route segments | 5 page files |
| PERF-02 | Create on-demand revalidation API route; add trigger to harvest pipeline | New `api/revalidate/route.ts` + harvest scripts |
| PERF-03 | Verify CWV targets met after all optimizations; document results | Documentation task |
| PERF-04 | Install sharp; remove `unoptimized` from 4 Image components; configure `remotePatterns` | `next.config.mjs` + 4 component files |

### Plan 01-03: Legal Pages, Content Quality & Judge Photos

| Req | Implementation | Files |
|-----|---------------|-------|
| LEGL-01 | Create `/privacy/page.tsx` with privacy policy content | New file |
| LEGL-02 | Create `/terms/page.tsx` with terms of service content | New file |
| LEGL-03 | Create `/about/page.tsx` with data sources, methodology, verification info | New file |
| LEGL-04 | Verify footer disclaimer renders on all pages; add links to new legal pages | `SiteFooter.tsx` |
| CONT-01 | Add "coming soon" UI for empty jurisdictions with neighbor links | County + court page templates |
| CONT-02 | Add conditional `robots: { index: false }` in `generateMetadata()` when < 3 verified judges | County + court page templates |
| CONT-03 | Enhance 404 page with state navigation and search link | `not-found.tsx` |
| PHOTO-01 | Use next/image with proper dimensions + shadcn Avatar; remove `unoptimized` | Judge profile page |
| PHOTO-02 | Add initials fallback via Avatar component | Judge profile page, `Breadcrumbs.tsx` |
| PHOTO-03 | Extend harvest pipeline with photo URL extraction from court bio pages | `scripts/harvest/` |
| PHOTO-04 | Install @vercel/blob; build photo processing pipeline (sharp resize → WebP → Blob upload) | New harvest utility + `package.json` |

---

## Key Implementation Sequence

The three plans should execute in order because of dependencies:

1. **Plan 01-01 (Design)** must go first because:
   - Loading skeletons (DSGN-03) must exist before ISR caching is enabled (otherwise stale layout flash)
   - Breadcrumb component (DSGN-05) is needed by ANLT-07 (JSON-LD validation)
   - Mobile responsiveness (DSGN-04) affects CWV measurements (ANLT-03)

2. **Plan 01-02 (Analytics/SEO/ISR)** depends on 01-01 because:
   - CWV baseline (ANLT-03) should reflect the final design, not pre-migration state
   - BreadcrumbList JSON-LD (ANLT-07) requires the shared Breadcrumbs component from DSGN-05
   - ISR (PERF-01) works better when loading skeletons prevent CLS during revalidation

3. **Plan 01-03 (Legal/Content/Photos)** has minimal dependencies but:
   - Legal pages benefit from `@tailwindcss/typography` which should be installed early
   - Photo display (PHOTO-01) requires PERF-04 (image optimization) from Plan 01-02
   - noindex logic (CONT-02) should be implemented after ISR is in place so cached pages include the correct robots meta

---

*Research complete: 2026-03-22*
*Phase: 01-production-readiness*
