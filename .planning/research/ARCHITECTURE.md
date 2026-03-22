# Architecture Patterns

**Domain:** Legal judge directory with monetization, analytics, and multi-state scale
**Researched:** 2026-03-22
**Confidence:** HIGH (verified against Next.js 14/16 official docs, Vercel platform docs, Prisma docs)

---

## Current Architecture (Baseline)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Vercel Edge Network                       │
│                    (CDN, SSL, routing, preview)                   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                     Next.js 14 App Router                        │
│                                                                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐    │
│  │ Public SSR   │  │ Admin Panel  │  │ API Routes          │    │
│  │ /judges/**   │  │ /admin/**    │  │ /api/cron/harvest   │    │
│  │ (Server      │  │ (Basic Auth) │  │ /api/admin/**       │    │
│  │  Components) │  │              │  │                     │    │
│  └──────┬───────┘  └──────┬───────┘  └──────┬──────────────┘    │
│         │                 │                  │                   │
│  ┌──────▼─────────────────▼──────────────────▼──────────────┐   │
│  │                    Prisma ORM v6                          │   │
│  │         State → County → Court → Judge                    │   │
│  └──────────────────────────┬───────────────────────────────┘   │
└─────────────────────────────┼───────────────────────────────────┘
                              │
               ┌──────────────▼──────────────┐
               │     PostgreSQL (Neon/Supabase)│
               │  + pg_trgm search indexes     │
               └───────────────────────────────┘
```

**Current rendering:** All public pages are pure SSR — every request hits the database. No ISR, no caching layer. This works at Florida-only scale but will not survive multi-state expansion.

---

## Recommended Architecture (Next Milestone)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Vercel Edge Network                             │
│              (CDN, Cache-Control headers, ISR cache)                     │
└────────────────────────────┬────────────────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────────────────┐
│                      Next.js 14 App Router                               │
│                                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │                    PUBLIC PAGES (ISR)                             │    │
│  │  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌──────────────┐ │    │
│  │  │ State     │  │ County    │  │ Court     │  │ Judge Profile │ │    │
│  │  │ Listing   │  │ Listing   │  │ Listing   │  │              │ │    │
│  │  └─────┬─────┘  └─────┬─────┘  └─────┬─────┘  └──────┬───────┘ │    │
│  │        │               │               │               │         │    │
│  │  ┌─────▼───────────────▼───────────────▼───────────────▼───────┐ │    │
│  │  │              MONETIZATION LAYER (Client Components)          │ │    │
│  │  │  ┌──────────┐  ┌──────────────┐  ┌───────────────────┐     │ │    │
│  │  │  │ AdSlot   │  │ AffiliateWidget│  │ SponsoredListing │     │ │    │
│  │  │  │ (display)│  │ (referral CTA)│  │ (featured atty)  │     │ │    │
│  │  │  └──────────┘  └──────────────┘  └───────────────────┘     │ │    │
│  │  └─────────────────────────────────────────────────────────────┘ │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────┐  ┌─────────────────────┐  ┌──────────────────┐   │
│  │  Admin Panel      │  │  Monetization Admin  │  │  Analytics API   │   │
│  │  /admin/**        │  │  /admin/sponsors/**  │  │  /api/analytics  │   │
│  │                   │  │  /admin/ads/**       │  │  /api/impressions│   │
│  └────────┬──────────┘  └──────────┬──────────┘  └────────┬─────────┘   │
│           │                        │                       │             │
│  ┌────────▼────────────────────────▼───────────────────────▼───────────┐ │
│  │                         Prisma ORM v6                               │ │
│  │  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │ │
│  │  │ Directory Models │  │ Monetization     │  │ Analytics        │  │ │
│  │  │ State/County/    │  │ SponsoredListing │  │ PageView         │  │ │
│  │  │ Court/Judge      │  │ AdPlacement      │  │ AdImpression     │  │ │
│  │  │                  │  │ AffiliateClick   │  │ AffiliateClick   │  │ │
│  │  └──────────────────┘  └──────────────────┘  └──────────────────┘  │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │                    ANALYTICS LAYER (Client)                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐    │  │
│  │  │ GA4 via GTM  │  │ Vercel       │  │ Custom Event         │    │  │
│  │  │ (@next/      │  │ Analytics +  │  │ Tracking (ad clicks, │    │  │
│  │  │  third-      │  │ Speed        │  │  affiliate clicks,   │    │  │
│  │  │  parties)    │  │ Insights     │  │  sponsored views)    │    │  │
│  │  └──────────────┘  └──────────────┘  └──────────────────────┘    │  │
│  └────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
                             │
              ┌──────────────▼──────────────┐
              │     PostgreSQL               │
              │  + pg_trgm search            │
              │  + monetization tables       │
              │  + analytics tables          │
              └──────────────────────────────┘
```

---

## Component Boundaries

### 1. Rendering & Caching Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ISR Pages** | Pre-render public pages, serve from cache, revalidate on schedule or on-demand | Prisma (read), Monetization DB (read) |
| **On-Demand Revalidation** | Invalidate cached pages after harvest completes or sponsor data changes | Harvest pipeline (trigger), Admin panel (trigger) |
| **`unstable_cache` wrappers** | Cache Prisma query results with tags for targeted invalidation | Prisma ORM |

**Why ISR over pure SSR:** Judge data changes infrequently (monthly harvests). Pages at scale (50 states × 3K counties × N courts × N judges = hundreds of thousands of pages) cannot sustain per-request DB queries. ISR gives:
- Near-zero TTFB for cached pages (Vercel edge serves from CDN cache)
- Automatic background regeneration keeping data fresh
- No cold-start penalty — cached HTML served instantly

**Implementation pattern:**

```typescript
// In each public page route (e.g., [state]/page.tsx)
export const revalidate = 3600; // 1 hour time-based ISR

// In harvest completion webhook/action
import { revalidatePath } from 'next/cache';
revalidatePath('/judges/florida/'); // invalidate after harvest
```

For Prisma queries (not `fetch`), wrap with `unstable_cache`:

```typescript
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/db';

export const getStateJudges = unstable_cache(
  async (stateSlug: string) => {
    return prisma.judge.findMany({
      where: { status: 'VERIFIED', court: { county: { state: { slug: stateSlug } } } },
      orderBy: { fullName: 'asc' },
      select: { /* ... */ },
    });
  },
  ['state-judges'],
  { revalidate: 3600, tags: ['judges'] }
);
```

### 2. Monetization Layer

Three distinct components, each a Client Component rendered within ISR Server Component pages. The server renders the structural shell (slot position, targeting data), the client hydrates and loads ad scripts / tracks interactions.

#### 2a. Display Ad System (`AdSlot`)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **`AdSlot`** (Client Component) | Render ad container div, load ad network script, manage ad refresh on navigation | AdSense/Mediavine external script |
| **`AdProvider`** (Client Component, layout-level) | Initialize ad network SDK once, manage global ad state | `AdSlot` children, external ad network |
| **Ad Config** (server lib) | Define slot positions per page type, enforce placement rules | Page components |

**Placement rules (from monetization-plan.md):**
- No ads above the fold on judge profiles
- Sidebar ad on desktop, in-content on long listing pages
- No interstitials or pop-ups
- Admin pages: no ads

**Ad slot architecture:**

```
┌─ Page Layout ────────────────────────────────────────┐
│                                                       │
│  ┌─ Server Component (ISR-cached HTML) ────────────┐ │
│  │                                                   │ │
│  │  <JudgeProfile data={judge} />                   │ │
│  │                                                   │ │
│  │  ┌─ Client Component ─────────────────────────┐  │ │
│  │  │  <AdSlot                                    │  │ │
│  │  │    slot="judge-profile-sidebar"             │  │ │
│  │  │    format="rectangle"                       │  │ │
│  │  │    targeting={{ state, county, courtType }} │  │ │
│  │  │  />                                         │  │ │
│  │  └─────────────────────────────────────────────┘  │ │
│  │                                                   │ │
│  └───────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────┘
```

**Key architectural decision — ad network abstraction:** Build `AdSlot` as an abstraction layer. Initially renders AdSense `<ins>` tags. When traffic hits Mediavine thresholds, swap the implementation inside the same component boundary. Pages never change — only the ad provider module.

```typescript
// src/lib/ads/provider.ts — swap implementation here
export type AdProvider = 'adsense' | 'mediavine' | 'none';
export const AD_PROVIDER: AdProvider = (process.env.NEXT_PUBLIC_AD_PROVIDER as AdProvider) || 'none';
```

#### 2b. Affiliate Widget System (`AffiliateWidget`)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **`AffiliateWidget`** (Client Component) | Render contextual CTA, track outbound clicks, handle UTM params | Affiliate partner URLs, Analytics API |
| **Affiliate Config** (server lib) | Map page context → appropriate affiliate partner + CTA copy | Page components |

**Data flow:**
1. Server Component determines page context (court type, county, state)
2. Passes context props to `AffiliateWidget` Client Component
3. Widget renders "Need a Lawyer for [Court Type] in [County]?" CTA
4. On click: fire analytics event → redirect to affiliate URL with UTM tracking
5. Post-click tracking via affiliate partner's postback API (if available)

**Affiliate URL construction (server-side, never expose raw affiliate IDs to client):**

```typescript
// src/lib/affiliates/config.ts
export function buildAffiliateUrl(partner: string, context: AffiliateContext): string {
  const base = AFFILIATE_PARTNERS[partner].baseUrl;
  const params = new URLSearchParams({
    utm_source: 'judgesdirectory',
    utm_medium: 'affiliate',
    utm_campaign: `${context.state}-${context.county}`,
    practice_area: context.courtType,
  });
  return `${base}?${params.toString()}`;
}
```

#### 2c. Sponsored Listing System (`SponsoredListing`)

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **`SponsoredListing`** (Server Component) | Query active sponsors for this page's jurisdiction, render cards | Prisma (SponsoredListing model) |
| **`SponsoredListingCard`** (Client Component) | Track impressions/clicks, handle outbound navigation | Analytics API |
| **Sponsor Admin** (`/admin/sponsors/**`) | CRUD for sponsors, placement targeting, billing status | Prisma, Stripe (future) |

**Data model (new Prisma models):**

```prisma
model SponsoredListing {
  id              String   @id @default(uuid())
  firmName        String
  firmUrl         String
  contactEmail    String
  practiceAreas   String[] // e.g., ["criminal-defense", "family-law"]
  
  // Targeting
  targetStates    String[] // state abbreviations, empty = all
  targetCountyIds String[] // specific counties, empty = all in state
  targetPageTypes String[] // ["state", "county", "court", "judge"]
  
  // Display
  headline        String
  description     String   @db.Text
  logoUrl         String?
  
  // Billing
  tier            SponsorTier @default(COUNTY)
  monthlyPriceCents Int
  status          SponsorStatus @default(PENDING)
  startsAt        DateTime
  expiresAt       DateTime?
  
  // Tracking
  totalImpressions Int @default(0)
  totalClicks      Int @default(0)
  
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([status, startsAt, expiresAt])
  @@index([targetStates])
  @@map("sponsored_listings")
}

enum SponsorTier {
  STATE    // appears on /judges/{state}
  COUNTY   // appears on /judges/{state}/{county}
  COURT    // appears on court-type pages
  JUDGE    // appears on judge profile sidebar
  BUNDLE   // all pages in a county
}

enum SponsorStatus {
  PENDING
  ACTIVE
  PAUSED
  EXPIRED
  CANCELLED
}
```

**Query pattern (ISR-compatible, cached):**

```typescript
export const getSponsorsForPage = unstable_cache(
  async (stateAbbr: string, countyId?: string, pageType?: string) => {
    const now = new Date();
    return prisma.sponsoredListing.findMany({
      where: {
        status: 'ACTIVE',
        startsAt: { lte: now },
        OR: [{ expiresAt: null }, { expiresAt: { gte: now } }],
        targetStates: { has: stateAbbr },
        targetPageTypes: pageType ? { has: pageType } : undefined,
      },
      take: 3, // max sponsors per page
      orderBy: { tier: 'asc' }, // higher tiers first
    });
  },
  ['sponsors'],
  { revalidate: 300, tags: ['sponsors'] } // 5-minute cache for sponsor changes
);
```

### 3. Analytics Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **GA4 via `@next/third-parties`** | Pageviews, user demographics, traffic sources, Search Console integration | Google servers (client-side) |
| **Vercel Analytics** | Real user performance (Core Web Vitals), per-route TTFB/LCP/CLS | Vercel platform (automatic) |
| **Vercel Speed Insights** | Detailed Web Vitals dashboard, route-level perf breakdown | Vercel platform (automatic) |
| **Custom Event Tracker** (Client Component) | Ad impressions, affiliate clicks, sponsored listing views/clicks | Internal API route → PostgreSQL |
| **`WebVitals`** (Client Component) | Report Core Web Vitals to GA4 | GA4 via `sendGAEvent` |

**Analytics initialization (root layout):**

```typescript
// src/app/layout.tsx
import { GoogleAnalytics } from '@next/third-parties/google';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        {process.env.NEXT_PUBLIC_GA_ID && (
          <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID} />
        )}
      </body>
    </html>
  );
}
```

**Custom monetization event tracking:**

```
User clicks affiliate widget
       │
       ▼
AffiliateWidget (Client Component)
  │ sendGAEvent('select_content', { content_type: 'affiliate', ... })
  │ navigator.sendBeacon('/api/analytics/events', eventPayload)
  │ window.open(affiliateUrl)
       │
       ▼
/api/analytics/events (Route Handler)
  │ Validate + batch insert to analytics table
  │ Increment SponsoredListing.totalClicks (if sponsored)
       │
       ▼
PostgreSQL → analytics_events table
```

**Analytics data model (lightweight, not a full analytics platform):**

```prisma
model AnalyticsEvent {
  id          String   @id @default(uuid())
  eventType   String   // 'ad_impression', 'affiliate_click', 'sponsor_view', 'sponsor_click'
  pageType    String   // 'state', 'county', 'court', 'judge'
  pagePath    String
  stateAbbr   String?  @db.VarChar(2)
  countySlug  String?
  metadata    Json?    // flexible: { partner, adSlot, sponsorId, etc. }
  createdAt   DateTime @default(now())
  
  @@index([eventType, createdAt])
  @@index([stateAbbr, eventType])
  @@index([createdAt])
  @@map("analytics_events")
}
```

**Why not a separate analytics service?** At this scale (sub-1M pageviews), a PostgreSQL table with periodic cleanup (delete events older than 90 days) is cheaper and simpler than running a separate analytics DB. GA4 handles the heavy lifting for traffic analysis. The internal table is only for monetization metrics the team can't get from GA4 (ad impression counts per slot, affiliate click-through by jurisdiction, sponsor ROI reporting).

### 4. Multi-State Expansion Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **State Config Registry** (`src/lib/states/`) | Per-state court structure, extraction URLs, court type mappings | Harvest pipeline, page rendering |
| **ISR with `generateStaticParams`** | Pre-render known states/counties at build, on-demand for new | Prisma (read) |
| **Harvest → Revalidate Pipeline** | After harvest completes for a state, invalidate all cached pages for that state | Harvest pipeline → `revalidatePath` |

**State config pattern:**

```typescript
// src/lib/states/registry.ts
export interface StateConfig {
  abbreviation: string;
  name: string;
  courtTypes: string[];        // valid court types for this state
  courtSystemUrl?: string;     // state judiciary website
  harvestConfig: {
    deterministic: boolean;    // has CSS/XPath extractors
    needsBrowser: boolean;     // requires Scrapling fallback
  };
}

// Loaded from DB or config files — NOT hardcoded per-state
```

**Scaling strategy:**

```
Build-time: generateStaticParams() → pre-render all known states
Runtime:    dynamicParams = true → on-demand ISR for new counties/courts
Harvest:    harvest completes → revalidatePath('/judges/texas/') → all TX pages refresh
```

**Critical: `generateStaticParams` for ISR pre-rendering:**

```typescript
// src/app/judges/[state]/page.tsx
export async function generateStaticParams() {
  const states = await prisma.state.findMany({ select: { slug: true } });
  return states.map((s) => ({ state: s.slug }));
}

export const dynamicParams = true; // allow new states without rebuild
export const revalidate = 3600;    // revalidate every hour
```

### 5. Performance Optimization Layer

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **ISR Cache** (Vercel) | Cache pre-rendered HTML at edge, serve without hitting origin | CDN edge nodes |
| **Prisma Query Cache** (`unstable_cache`) | Cache DB query results server-side with tag-based invalidation | Prisma ORM |
| **Ad Lazy Loading** | Defer ad script loading until after page content renders | `next/dynamic` with `ssr: false` |
| **Image Optimization** | Judge photos via `next/image` with responsive sizing | Vercel Image Optimization |

**Ad loading strategy — critical for Core Web Vitals:**

Ads are the #1 CWV killer for content sites. Architecture MUST ensure:

1. **No layout shift (CLS):** Pre-define ad slot dimensions in CSS. Reserve space even before ad fills.
2. **No render blocking (LCP):** Load ad scripts with `strategy="lazyOnload"` (Next.js Script component) or inside dynamically-imported Client Components.
3. **No TTFB impact:** Ad markup is NOT in the ISR-cached HTML. Only the empty `<div>` placeholder is cached. Client hydration loads the ad.

```typescript
// src/components/ads/AdSlot.tsx
'use client';
import dynamic from 'next/dynamic';

// Only load ad runtime on client, never block SSR
const AdRuntime = dynamic(() => import('./AdRuntime'), { ssr: false });

export function AdSlot({ slot, format, targeting }: AdSlotProps) {
  return (
    <div 
      className="ad-slot" 
      style={{ minHeight: AD_FORMAT_HEIGHTS[format] }} // prevent CLS
      data-slot={slot}
    >
      <AdRuntime slot={slot} format={format} targeting={targeting} />
      <span className="text-xs text-muted-foreground">Sponsored</span>
    </div>
  );
}
```

---

## Data Flow

### Public Page Render (ISR)

```
Request: GET /judges/florida/miami-dade/circuit-court/

1. Vercel CDN checks ISR cache
   ├─ CACHE HIT → Return cached HTML immediately (TTFB < 50ms)
   └─ CACHE MISS or STALE →
       2. Next.js Server Component executes
          ├─ unstable_cache('judges', ['florida', 'miami-dade', 'circuit-court'])
          │   ├─ CACHE HIT → Return cached query result
          │   └─ CACHE MISS → Prisma query → PostgreSQL → cache result
          ├─ unstable_cache('sponsors', ['FL', 'miami-dade', 'court'])
          │   └─ Return active sponsored listings for this page
          └─ Render HTML (judge list + sponsor cards + ad slot placeholders)
       3. Return HTML → Client
       4. Client hydration (non-blocking):
          ├─ <AdSlot> → loads AdSense, fills ad container
          ├─ <AffiliateWidget> → renders CTA with tracked links
          ├─ <SponsoredListingCard> → fires impression beacon
          └─ <GoogleAnalytics> → sends pageview to GA4
```

### Monetization Event Flow

```
User Action: Click affiliate CTA

1. AffiliateWidget onClick handler fires
2. Parallel:
   ├─ sendGAEvent('select_content', { content_type: 'affiliate', ... })
   ├─ navigator.sendBeacon('/api/analytics/events', { eventType: 'affiliate_click', ... })
   └─ window.open(affiliateUrl) // navigate to partner
3. /api/analytics/events Route Handler:
   ├─ Validate event payload (server-side, no trusting client data for billing)
   └─ INSERT INTO analytics_events (event_type, page_path, state_abbr, metadata, ...)
```

### Harvest → Cache Invalidation Flow

```
Harvest Pipeline completes for Texas

1. Harvest job marked COMPLETED
2. Server Action or API route fires:
   ├─ revalidatePath('/judges/texas/')          // state page
   ├─ revalidateTag('judges')                   // all judge query caches
   └─ revalidateTag('sponsors')                 // refresh sponsor targeting
3. Next request to any TX page triggers fresh render → new ISR cache entry
```

### Sponsor Lifecycle Flow

```
Admin creates sponsored listing via /admin/sponsors/new

1. POST /api/admin/sponsors → INSERT SponsoredListing (status: ACTIVE)
2. revalidateTag('sponsors') → all pages re-query sponsors on next request
3. Sponsor appears on targeted pages within 5 minutes (sponsor cache TTL)
4. Impressions/clicks tracked via analytics_events
5. Monthly report generated from analytics_events WHERE metadata.sponsorId = X
6. Sponsor expires → status changes to EXPIRED → revalidateTag('sponsors')
```

---

## Component Communication Map

```
┌──────────────────────────────────────────────────────────────────────┐
│                         SERVER BOUNDARY                               │
│                                                                       │
│  Page Component (Server)                                              │
│    │                                                                  │
│    ├── Prisma: getStateJudges() ─────────── PostgreSQL                │
│    ├── Prisma: getSponsorsForPage() ─────── PostgreSQL                │
│    ├── lib/affiliates: buildAffiliateUrl() (pure function)            │
│    │                                                                  │
│    ├── Props ──▶ <AdSlot slot="sidebar" targeting={...} />            │
│    ├── Props ──▶ <AffiliateWidget partner="avvo" url={affiliateUrl} />│
│    └── Props ──▶ <SponsoredListingCard sponsor={sponsor} />           │
│                                                                       │
│═════════════════════ SERVER / CLIENT BOUNDARY ════════════════════════│
│                                                                       │
│  Client Components                                                    │
│    │                                                                  │
│    ├── AdSlot ───── dynamic import ──▶ AdRuntime ──▶ AdSense script   │
│    │                                                                  │
│    ├── AffiliateWidget ─── onClick ──▶ sendGAEvent()                  │
│    │                   └── onClick ──▶ sendBeacon('/api/analytics')    │
│    │                   └── onClick ──▶ window.open(affiliateUrl)       │
│    │                                                                  │
│    ├── SponsoredListingCard                                           │
│    │   └── onVisible ──▶ IntersectionObserver ──▶ sendBeacon()        │
│    │   └── onClick ──▶ sendBeacon() + navigate                        │
│    │                                                                  │
│    └── GoogleAnalytics ──▶ gtag.js (auto pageviews)                   │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## Patterns to Follow

### Pattern 1: ISR + On-Demand Revalidation Hybrid

**What:** Use time-based ISR (`revalidate = 3600`) as the default, supplemented by on-demand revalidation when data actually changes.

**When:** All public pages. The 1-hour TTL is a safety net; most cache busting happens via explicit `revalidatePath` after harvests or sponsor changes.

**Why:** Avoids stale data (on-demand) while preventing thundering herd on cold cache (time-based ensures regeneration is bounded).

### Pattern 2: Server-Renders Shell, Client Hydrates Monetization

**What:** ISR pages render the full content + empty slot containers. Client Components hydrate to fill ads, track events, and load third-party scripts.

**When:** Every page with monetization elements.

**Why:** ISR caching requires deterministic server output. Ads are inherently dynamic (auction-based, user-targeted). Separating them into Client Components means the cached HTML is stable and fast, while ads load asynchronously without blocking.

### Pattern 3: Feature Flags via Environment Variables

**What:** Control monetization features via `NEXT_PUBLIC_*` env vars. `NEXT_PUBLIC_AD_PROVIDER=adsense|mediavine|none`, `NEXT_PUBLIC_AFFILIATE_ENABLED=true|false`.

**When:** Enablement of ads, affiliates, and sponsored listings.

**Why:** Enables gradual rollout. Can disable ads on staging/preview. Can switch ad networks without code changes. Vercel env vars are per-environment (preview vs production).

### Pattern 4: Contextual Targeting via Server Props

**What:** Server Components determine the page context (state, county, court type, practice area) and pass it as props to monetization Client Components.

**When:** Ad targeting, affiliate CTA copy, sponsor filtering.

**Why:** Targeting logic runs server-side (fast, no client computation), and the same ISR-cached props work for every visitor. The ad network then applies user-level targeting on top of our contextual signals.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Side Data Fetching for Core Content

**What:** Using `useEffect` + `fetch` to load judge data client-side.

**Why bad:** Destroys SEO. Googlebot won't wait for client-side fetches. Adds waterfall requests. Defeats ISR caching.

**Instead:** All directory data fetched in Server Components, cached via ISR.

### Anti-Pattern 2: Putting Ad Scripts in `<head>` or Root Layout Synchronously

**What:** Loading AdSense or Mediavine scripts synchronously in the root layout.

**Why bad:** Blocks rendering for ALL pages including admin. Adds 200-500ms to every page load. Tanks LCP and TTFB scores.

**Instead:** Lazy-load ad scripts only in Client Components on public pages. Use `next/dynamic` with `ssr: false`. Scripts load after content paints.

### Anti-Pattern 3: Separate Database for Analytics

**What:** Running a separate ClickHouse/TimescaleDB for internal analytics.

**Why bad:** Premature infrastructure complexity. At sub-1M pageviews, PostgreSQL handles the write load easily. GA4 does the heavy analytics.

**Instead:** Simple `analytics_events` table in existing PostgreSQL. Prune events older than 90 days via cron. Revisit at 1M+ pageviews.

### Anti-Pattern 4: Hardcoding State-Specific Logic

**What:** `if (state === 'florida') { ... } else if (state === 'texas') { ... }` scattered through components.

**Why bad:** Does not scale to 50 states. Every new state requires code changes.

**Instead:** State config registry with court type mappings, extraction configs, and feature flags per state. Pages consume config generically.

---

## Scalability Considerations

| Concern | At 1 state (FL) | At 5 states (FL, TX, CA, NY, IL) | At 50 states |
|---------|------------------|-----------------------------------|--------------|
| Page count | ~2K pages | ~20K pages | ~200K+ pages |
| DB queries/sec | Low (SSR is fine) | Medium (ISR essential) | High (ISR + query caching critical) |
| Build time | < 1 min | ~5 min with `generateStaticParams` | Use `dynamicParams=true`, build only known paths |
| Ad revenue per page | Low traffic per page | Moderate (concentrated in high-pop counties) | Long tail — most pages get < 10 views/month |
| Sponsor inventory | 10 counties | 50+ counties | 3,000+ counties — self-serve needed |
| ISR cache size | Negligible | ~50MB | ~2GB (Vercel handles, no limit on Pro plan) |
| Analytics table size | ~10K rows/month | ~100K rows/month | ~1M rows/month → 90-day prune keeps it manageable |

---

## Suggested Build Order (Dependencies)

Build order matters because each layer depends on the previous:

```
Phase 1: Analytics Foundation
├── GA4 + Vercel Analytics setup (no code dependency, immediate value)
├── WebVitals reporting component
└── WHY FIRST: Need traffic data before optimizing anything else.
    Can't validate monetization without knowing visitor volume.

Phase 2: Performance / ISR Migration  
├── Add `revalidate` to all public pages
├── Add `generateStaticParams` to pre-render known paths
├── Wrap Prisma queries with `unstable_cache`
├── Add on-demand revalidation after harvest completion
└── DEPENDS ON: Analytics (Phase 1) to measure improvement.
    MUST precede ads — ad networks penalize slow sites.

Phase 3: Display Ad System
├── AdSlot abstraction component
├── AdProvider configuration (AdSense initially)
├── Placement rules per page type
├── Ad-specific CSS (CLS prevention)
└── DEPENDS ON: ISR (Phase 2) — cannot serve ads from slow pages.
    Lowest friction revenue. No data model changes needed.

Phase 4: Sponsored Listing Data Model + Admin
├── Prisma migration: SponsoredListing model
├── Admin CRUD for sponsors (/admin/sponsors/*)
├── SponsoredListing server component (query + render)
├── SponsoredListingCard client component (impression/click tracking)
├── Analytics events table for tracking
└── DEPENDS ON: Analytics (Phase 1) for tracking. 
    Before affiliates because it validates the sales motion.

Phase 5: Affiliate Widget System
├── Affiliate partner configuration
├── AffiliateWidget component with contextual targeting
├── Click tracking + attribution
├── A/B testing hooks for CTA copy
└── DEPENDS ON: Analytics + Tracking (Phases 1, 4).
    Highest revenue potential but requires affiliate partnerships (external).

Phase 6: Multi-State Expansion Architecture
├── State config registry
├── Harvest pipeline generalization (already mostly done)
├── Sponsor inventory scaling (self-serve signup page)
└── DEPENDS ON: ISR (Phase 2), Sponsors (Phase 4) working at FL scale.
    Expanding without ISR = DB overload. Expanding without sponsors = no revenue per state.
```

**Key dependency chain:**
```
Analytics → ISR → Ads → Sponsors → Affiliates → Multi-State
    │                      │            │
    └──────────────────────┴────────────┘
    (Analytics needed by all monetization phases for tracking)
```

---

## Sources

- Next.js ISR documentation (v14-16): https://nextjs.org/docs/app/guides/incremental-static-regeneration — HIGH confidence
- Next.js caching model (previous model, applies to v14): https://nextjs.org/docs/app/guides/caching-without-cache-components — HIGH confidence
- Next.js analytics guide: https://nextjs.org/docs/app/guides/analytics — HIGH confidence
- `@next/third-parties` for GA4/GTM: https://nextjs.org/docs/app/guides/third-party-libraries — HIGH confidence
- Vercel Speed Insights: https://vercel.com/docs/speed-insights — HIGH confidence
- AdSense with SSR/ISR: training data + official AdSense docs — MEDIUM confidence (AdSense docs not directly verified today)
- Sponsored listing pricing model: docs/business/monetization-plan.md — project-internal, validated
- Affiliate partner list: docs/business/monetization-plan.md — project-internal, validated
