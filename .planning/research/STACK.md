# Technology Stack

**Project:** JudgesDirectory — Monetization, Analytics, Design System & Scale Milestone
**Researched:** 2026-03-22
**Overall Confidence:** HIGH

---

## Existing Stack (Do Not Change)

Already production-deployed. This milestone builds on top of these — no framework migrations.

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 14.2.35 | App Router, SSR, programmatic SEO |
| React | 18.x | UI framework |
| Prisma ORM | 6.19.2 | Database ORM (State → County → Court → Judge hierarchy) |
| PostgreSQL | (managed) | Primary database |
| Tailwind CSS | 4.2.1 | Utility-first CSS (already using `@tailwindcss/postcss`) |
| Radix UI | 1.4.3 | Accessible primitives (via shadcn/ui) |
| shadcn/ui | CLI 4.1.0 | Component library (new-york style, partial adoption — 18 components installed) |
| TypeScript | 5.x | Type safety |
| Vercel | — | Hosting, SSR, edge, cron |
| Zod | 4.3.6 | Schema validation |
| Lucide React | 0.577.0 | Icons |

---

## Recommended Additions

### 1. Analytics & Performance Monitoring

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **@vercel/analytics** | ^2.0.1 | Page view tracking, custom events, visitor insights | Zero-config on Vercel, no GDPR cookie banner needed (privacy-first, no cookies), free tier covers early traffic, SSR-compatible. Drop-in `<Analytics />` component. **Confidence: HIGH** |
| **@vercel/speed-insights** | ^2.0.0 | Real User Monitoring (RUM) for Core Web Vitals (LCP, FID, CLS, TTFB) | Real CWV data from actual visitors, not lab tests. Critical for a programmatic SEO site — Google uses CWV as ranking signal. Free tier included with Vercel plan. **Confidence: HIGH** |
| **Google Search Console** | (external) | Index coverage, search queries, CTR, crawl errors | Non-negotiable for programmatic SEO. Monitors which of your 50K+ pages are indexed, what queries drive traffic, and where crawl budget is wasted. No package needed — meta tag or DNS verification. **Confidence: HIGH** |

**Why NOT these alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Google Analytics 4 (GA4) | Requires cookie consent banner (GDPR/CCPA), complex setup, overkill for early-stage traffic validation. Add later if you need funnel analysis or audience segmentation. Vercel Analytics covers everything needed now. |
| PostHog (`posthog-js` 1.363.x) | Powerful product analytics but heavy (~45KB gzipped), self-host complexity, overkill when you need pageview counts and CWV, not session replay. Consider at Phase 5 (data product) if you need event funnels. |
| Plausible (`plausible-tracker` 0.3.9) | Good privacy-first option but $9+/month hosted, and Vercel Analytics is free on your plan. Redundant. |

**Integration point:**

```tsx
// src/app/layout.tsx — add to <body> before closing tag
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";

// Inside body:
<Analytics />
<SpeedInsights />
```

---

### 2. Display Advertising (AdSense → Mediavine)

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **@next/third-parties** | 14.2.35 | Optimized third-party script loading (Google Tag Manager, AdSense) | Official Next.js package for loading ad scripts without wrecking CWV. Handles `afterInteractive` strategy, deferred loading, and worker threads. Pin to 14.x to match your Next.js version. **Confidence: HIGH** |
| **next/script** (built-in) | — | Fallback script loading for ad networks | Built into Next.js. Use `strategy="lazyOnload"` for ad scripts to prevent blocking LCP. No additional install needed. **Confidence: HIGH** |
| **Custom `<AdSlot />` component** | — | Reusable ad placement component | Build a thin wrapper that renders ad units with consistent spacing/labeling ("Sponsored"). Encapsulates the AdSense `data-ad-slot` divs. Switch to Mediavine's script when you qualify (50K sessions). **Confidence: HIGH** |

**Why NOT these alternatives:**

| Alternative | Why Not |
|-------------|---------|
| `react-adsense` or third-party React ad wrappers | Unmaintained, add abstraction over a simple `<script>` + `<ins>` tag. AdSense integration is just a script include + div placement — doesn't need a library. |
| Ezoic | Lower RPMs than Mediavine, aggressive ad injection, poor CWV impact. Not suitable for a trust-focused legal directory. |

**Ad loading strategy for CWV protection:**

1. Load AdSense script with `strategy="lazyOnload"` (loads after page is interactive)
2. Place ad `<ins>` elements below the fold only — no ads above fold on judge profiles
3. Use `min-height` on ad containers to prevent CLS (Cumulative Layout Shift)
4. When qualifying for Mediavine (50K sessions), swap the script; Mediavine handles placement optimization

**Key env vars:**
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID` — your AdSense publisher ID (ca-pub-XXXXXXXX)
- `NEXT_PUBLIC_ADS_ENABLED` — feature flag to toggle ads on/off during development

---

### 3. Affiliate Referral Widgets

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **Custom `<AffiliateWidget />` component** | — | Contextual "Find an Attorney" referral blocks | No library needed. Build a server component that receives `county`, `courtType`, and `practiceArea` props and renders the appropriate affiliate link with UTM params. Context-driven by page data you already have in your hierarchy. **Confidence: HIGH** |
| **UTM parameter builder** (utility function) | — | Track which pages/placements convert | Simple utility — `buildAffiliateUrl(partner, county, practiceArea)`. No package needed. **Confidence: HIGH** |

**Why NOT these alternatives:**

| Alternative | Why Not |
|-------------|---------|
| Embed-based affiliate widgets from Avvo/FindLaw | They inject iframes that hurt CWV (LCP, CLS), can't be styled to match your design system, and add third-party JavaScript. Build native components with affiliate links instead. |
| Third-party referral tracking platforms (Impact, PartnerStack) | Overkill until you have 5+ affiliate partners. For 2-3 partners, simple UTM links with Vercel Analytics event tracking is sufficient. |

**Architecture:**

```
Prisma schema addition:
  model SponsoredListing {
    id          String   @id @default(cuid())
    firmName    String
    practiceArea String
    countyId    String
    courtType   String?
    linkUrl     String
    logoUrl     String?
    tier        String   // "county" | "court" | "judge" | "state"
    monthlyFee  Int
    active      Boolean  @default(true)
    startsAt    DateTime
    expiresAt   DateTime?
    impressions Int      @default(0)
    clicks      Int      @default(0)
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    county      County   @relation(fields: [countyId], references: [id])
  }
```

---

### 4. Sponsored Listings Infrastructure

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **Prisma (existing)** | 6.19.2 | `SponsoredListing` model for law firm placements | Already your ORM. Add a model for listings with county/court targeting, pricing tier, active status, and impression/click counters. **Confidence: HIGH** |
| **Stripe** | (future, not this milestone) | Payment processing for self-serve listings | Don't add yet. Pilot with manual invoicing (Stripe Invoices or simple PayPal). Add Stripe Checkout/subscriptions when you have 10+ paying customers. |

**What NOT to build yet:**

| Feature | Why Defer |
|---------|-----------|
| Self-serve listing signup portal | Premature. First 20 customers come from cold outreach. Build the admin CRUD for listings, not a public signup flow. |
| Stripe subscriptions | Manual invoicing (or Stripe Invoices, which requires no code) for the pilot phase. Build subscription management when you have predictable churn patterns. |
| Real-time bidding / auction | Way too complex. Fixed monthly pricing per tier. Period. |

---

### 5. Design System Completion (shadcn/ui)

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **shadcn/ui** (already installed) | CLI 4.1.0 | Complete component coverage for public pages | You have 18 components for admin. Need to extend to public pages: `Breadcrumb`, `NavigationMenu`, `Sheet` (mobile nav), `Skeleton` (loading states), `Avatar` (judge photos), `Tooltip`, `Accordion` (FAQs). Use `npx shadcn@latest add [component]`. **Confidence: HIGH** |
| **Tailwind CSS** (already v4.2.1) | 4.2.1 | Stay on v4 — already configured with `@tailwindcss/postcss` | You're already on TW4. No migration needed. The `postcss.config.mjs` uses `@tailwindcss/postcss` which is the v4 approach. **Confidence: HIGH** |
| **`tailwind-merge`** (already installed) | 3.5.0 | Class merging utility for component variants | Already in deps. Used by shadcn's `cn()` utility. No change needed. **Confidence: HIGH** |
| **`class-variance-authority`** (already installed) | 0.7.1 | Component variant definitions | Already in deps. Used by shadcn components. No change needed. **Confidence: HIGH** |

**shadcn/ui components to add:**

| Component | Use Case | Priority |
|-----------|----------|----------|
| `breadcrumb` | Hierarchical navigation (State > County > Court > Judge) — critical for SEO | P0 |
| `skeleton` | Loading states for SSR hydration, ad placeholders | P0 |
| `avatar` | Judge photos on profile pages | P1 |
| `navigation-menu` | Desktop header navigation | P1 |
| `sheet` | Mobile navigation drawer | P1 |
| `accordion` | FAQ sections on pillar pages | P2 |
| `tooltip` | Info tooltips on judge data fields | P2 |
| `alert` | Sponsor disclaimers, data attribution notices | P2 |
| `dialog` | Admin listing management modals | P2 |

**What NOT to do:**

| Anti-Pattern | Why |
|--------------|-----|
| Migrate to a different component library (MUI, Chakra, Mantine) | shadcn/ui is already installed, Radix-based, accessible, and Tailwind-native. Switching would undo all existing admin work. |
| Add `@tailwindcss/typography` plugin now | Only needed when you build pillar/content pages. Defer until that phase. |
| Create a custom design token system | Tailwind CSS v4 with CSS variables (which shadcn/ui already uses via `globals.css`) IS the token system. Don't add another layer. |

---

### 6. Performance Optimization

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **sharp** | ^0.34.5 | Image optimization for judge photos | Next.js uses sharp under the hood for `next/image` optimization. Currently not explicitly installed — Vercel provides it, but explicit installation ensures consistent behavior across dev/prod and faster builds. **Confidence: HIGH** |
| **next/image** (built-in) | — | Responsive, lazy-loaded, format-negotiated images | Already configured in `next.config.mjs` with `formats: ["image/avif", "image/webp"]`. Use for all judge photos and any content images. **Confidence: HIGH** |
| **@next/bundle-analyzer** | 14.2.35 | Visualize bundle size to catch bloat | Dev-only. Pin to 14.x to match Next.js major version. Use periodically to ensure ad scripts and affiliate widgets don't balloon client JS. **Confidence: HIGH** |
| **ISR (Incremental Static Regeneration)** — built-in | — | Cache SSR pages with revalidation interval | Use `revalidate: 3600` (1 hour) on judge profile pages — data changes rarely. Dramatically reduces TTFB for repeat visits and reduces Vercel function invocations. **Confidence: HIGH** |

**Key optimization patterns:**

1. **Judge profile pages**: `export const revalidate = 3600` — ISR with 1-hour revalidation. Judge data changes monthly at most.
2. **State/County listing pages**: `export const revalidate = 86400` — ISR with 24-hour revalidation. Listings change when new judges are added.
3. **Ad scripts**: Load with `strategy="lazyOnload"` to never block LCP.
4. **Affiliate widgets**: Server Components (no client JS) with affiliate links. Zero impact on bundle size.
5. **Judge photos**: `next/image` with `loading="lazy"`, `sizes` attribute, AVIF/WebP format negotiation.

**What NOT to do:**

| Anti-Pattern | Why |
|--------------|-----|
| Upgrade to Next.js 15/16 | Not needed for this milestone. Next.js 14.2.35 is the latest 14.x patch. Upgrading to 15+ would require React 19 migration, App Router changes, and risk breaking production. Do this as a separate milestone when there's a compelling feature (e.g., partial prerendering). |
| Add a CDN in front of Vercel | Vercel already has a global edge network. Adding Cloudflare or another CDN in front creates cache invalidation complexity and double-caching bugs. |
| Install `web-vitals` package manually | `@vercel/speed-insights` already reports CWV. Don't duplicate. |
| Server-side ad rendering | Ads MUST be client-side (the ad network JavaScript needs browser context). Don't try to SSR ad placements. |

---

### 7. SEO Enhancements

| Technology | Version | Purpose | Why This One |
|------------|---------|---------|--------------|
| **next-sitemap** | ^4.2.3 | Enhanced sitemap generation with server-side sitemap index | You already have a custom `sitemap.ts` with splitting logic. `next-sitemap` adds: automatic `robots.txt` generation, sitemap index for multiple sitemap files, `lastmod` timestamps, and change frequency hints. Evaluate whether to adopt or keep custom — your current implementation may be sufficient. **Confidence: MEDIUM** |
| **Custom `sitemap.ts`** (existing) | — | Keep and enhance existing implementation | Your current sitemap already handles 50K URL splitting. May only need to add `lastmod` from the `updatedAt` field and `priority` weighting. Avoid adding a dependency if the current solution works. **Confidence: HIGH** |
| **Schema.org JSON-LD** (existing) | — | Structured data for judge profiles | Already implemented per spec 001. Ensure `Person` schema includes judge photos when added, and `BreadcrumbList` schema matches the new shadcn breadcrumb component. **Confidence: HIGH** |

---

## Stack Summary: What to Install

### New Production Dependencies

```bash
npm install @vercel/analytics@^2.0.1 @vercel/speed-insights@^2.0.0 @next/third-parties@14.2.35 sharp@^0.34.5
```

### New Dev Dependencies

```bash
npm install -D @next/bundle-analyzer@14.2.35
```

### shadcn/ui Components to Add

```bash
npx shadcn@latest add breadcrumb skeleton avatar navigation-menu sheet accordion tooltip alert dialog
```

### No-Install Items

| Item | Notes |
|------|-------|
| Google Search Console | External tool, DNS/meta verification only |
| Google AdSense | Script tag via `@next/third-parties` or `next/script` — no npm package |
| Affiliate widgets | Custom components with links — no package needed |
| Sponsored listings | Prisma model addition — no new package |
| ISR caching | Built into Next.js — add `revalidate` exports to route segments |

---

## Alternatives Considered (Full Matrix)

| Category | Recommended | Alternative | Why Not Alternative |
|----------|-------------|-------------|---------------------|
| **Analytics** | Vercel Analytics + Speed Insights | GA4 | Cookie consent overhead, privacy complexity, overkill for traffic validation |
| **Analytics** | Vercel Analytics | PostHog | 45KB+ client bundle, self-host complexity, premature for current stage |
| **Analytics** | Vercel Analytics | Plausible | $9+/month hosted when Vercel Analytics is free on plan |
| **Ad loading** | `@next/third-parties` | Raw `<script>` tags | @next/third-parties handles loading strategy, worker threads, CWV protection |
| **Ad network** | AdSense → Mediavine | Ezoic | Lower RPMs, aggressive injection, poor CWV — wrong for trust-focused legal site |
| **Design system** | shadcn/ui (extend existing) | Migrate to MUI/Chakra | Would undo 18 existing components and admin panel work |
| **Image pipeline** | sharp + next/image | Cloudinary/Imgix | External service cost, added complexity for judge headshots that rarely change |
| **SSG/caching** | ISR (built-in) | Full static export | Can't use with dynamic routes and SSR features already in use |
| **Framework** | Stay on Next.js 14.2.35 | Upgrade to Next.js 15/16 | Risk of breaking changes, React 19 migration required, no blocking feature need |
| **Sitemap** | Keep custom `sitemap.ts` | next-sitemap package | Current implementation already handles 50K splitting; adding a dep for marginal gain |
| **Affiliate tracking** | UTM params + Vercel events | Impact/PartnerStack | Overkill for 2-3 affiliate partners; consider at 5+ partners |
| **Payments** | Manual invoicing (pilot) | Stripe subscriptions now | Premature engineering — first 20 customers are cold outreach, not self-serve |

---

## Version Pinning Strategy

| Package | Pin Strategy | Rationale |
|---------|-------------|-----------|
| `next` | `14.2.35` (exact) | Production framework, breaking changes between majors |
| `@next/third-parties` | `14.2.35` (exact) | Must match Next.js major version |
| `@next/bundle-analyzer` | `14.2.35` (exact) | Must match Next.js major version |
| `@vercel/analytics` | `^2.0.1` (caret) | Stable API, safe to take patches |
| `@vercel/speed-insights` | `^2.0.0` (caret) | Stable API, safe to take patches |
| `sharp` | `^0.34.5` (caret) | Image processing, patches are safe |
| shadcn/ui components | Via CLI (copy-paste) | Not versioned as deps — you own the code |

---

## Sources

| Claim | Source | Confidence |
|-------|--------|------------|
| `@vercel/analytics` 2.0.1, cookie-free, zero-config on Vercel | npm registry (verified 2026-03-22) | HIGH |
| `@vercel/speed-insights` 2.0.0, reports CWV to Vercel dashboard | npm registry (verified 2026-03-22) | HIGH |
| `@next/third-parties` 14.2.35 for ad script optimization | npm registry (verified 2026-03-22) | HIGH |
| `sharp` 0.34.5 for Next.js image optimization | npm registry (verified 2026-03-22) | HIGH |
| `@next/bundle-analyzer` 14.2.35 | npm registry (verified 2026-03-22) | HIGH |
| Tailwind CSS 4.2.x uses `@tailwindcss/postcss` plugin approach | Project `postcss.config.mjs` (verified) | HIGH |
| shadcn/ui CLI 4.1.0 with new-york style | Project `components.json` (verified) | HIGH |
| AdSense no minimum traffic threshold | Google AdSense documentation | HIGH |
| Mediavine Journey accepts 5K-10K sessions | Mediavine publisher documentation | MEDIUM |
| ISR `revalidate` export in App Router route segments | Next.js 14 documentation | HIGH |
| Legal RPM $15-30, CPC $5-50+ | Project monetization-plan.md (industry benchmarks) | MEDIUM |
| next-sitemap 4.2.3 | npm registry (verified 2026-03-22) | HIGH |
