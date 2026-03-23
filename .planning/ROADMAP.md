# Roadmap: JudgesDirectory

## Overview

Transform JudgesDirectory from a working Florida-only product into a revenue-generating, multi-state business. The path is sequential and dependency-driven: make the site production-ready (design, SEO, performance, legal compliance), then layer in all three revenue streams (display ads, affiliate referrals, sponsored listings), then scale content across new states. Every phase fully completes before the next begins — no value in scaling content without revenue infrastructure, and no monetization without a polished, fast, legally compliant site.

## Phases

**Phase Numbering:**

- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Production Readiness** - Complete design system, instrument analytics, optimize performance with ISR, publish legal pages, add judge photos, and handle content quality gaps
- [ ] **Phase 2: Revenue Integration** - Integrate display ads, affiliate referral widgets, and sponsored attorney listings with CWV protection and FTC compliance
- [ ] **Phase 3: Multi-State Expansion** - Seed and harvest TX + CA court structures, validate pipeline at scale, ensure deduplication and verification throughput

## Phase Details

### Phase 1: Production Readiness

**Goal**: The public site is polished, performant, SEO-optimized, and legally compliant — ready to generate and monetize organic search traffic
**Depends on**: Nothing (first phase)
**Requirements**: DSGN-01, DSGN-02, DSGN-03, DSGN-04, DSGN-05, ANLT-01, ANLT-02, ANLT-03, ANLT-04, ANLT-05, ANLT-06, ANLT-07, PERF-01, PERF-02, PERF-03, PERF-04, LEGL-01, LEGL-02, LEGL-03, LEGL-04, CONT-01, CONT-02, CONT-03, PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04
**Success Criteria** (what must be TRUE):

1. All public pages render with consistent shadcn/ui components, mobile-responsive layouts (no horizontal scroll, touch targets ≥ 48px), and loading skeletons during data fetches
2. Vercel Analytics and Speed Insights capture real user pageviews and Core Web Vitals; all metrics pass thresholds (LCP < 2.5s, INP < 200ms, CLS < 0.1)
3. Google Search Console shows dynamic sitemaps submitted, canonical URLs enforced, Schema.org JSON-LD validated across all template types, and Open Graph meta tags rendering social previews
4. Public pages load from ISR cache with fast TTFB; judge photos display via next/image with optimized dimensions and fallback avatars; on-demand revalidation triggers after harvest imports
5. Privacy Policy, Terms of Service, and About pages are published; legal disclaimer visible on every public page; empty jurisdictions show "coming soon" with related links; 404 page guides users to valid jurisdictions
   **Plans**: TBD
   **UI hint**: yes

Plans:

- [x] 01-01: Design system completion + mobile responsiveness
- [x] 01-02: Analytics, SEO foundation & ISR performance
- [x] 01-03: Legal pages, content quality & judge photos

### Phase 2: Revenue Integration

**Goal**: All three revenue streams are live — display ads, affiliate referral widgets, and sponsored attorney listings — with CWV protection, FTC compliance, and click tracking
**Depends on**: Phase 1
**Requirements**: ADS-01, ADS-02, ADS-03, ADS-04, ADS-05, AFFL-01, AFFL-02, AFFL-03, AFFL-04, AFFL-05, SPNS-01, SPNS-02, SPNS-03, SPNS-04, SPNS-05
**Success Criteria** (what must be TRUE):

1. Display ads render in defined zones (sidebar on desktop, in-content on listings, below-fold on profiles) without degrading Core Web Vitals below thresholds
2. "Need a Lawyer?" affiliate widgets appear on judge profile and court listing pages with practice-area and jurisdiction targeting, FTC "Sponsored" disclosure, and UTM-tracked referral URLs
3. Sponsored attorney listing cards render on county/court pages with "Sponsored" badge, geo + practice-area targeting, and cached rendering with tag-based invalidation
4. Click tracking captures impressions, clicks, and CTR by placement zone for all monetization widgets (ads, affiliates, sponsors)
5. AdSlot component abstracts the ad provider so AdSense can be swapped to Mediavine without page changes; all monetization components are feature-flagged via env vars
   **Plans**: TBD
   **UI hint**: yes

Plans:

- [ ] 02-01: Display ad integration (AdSense)
- [ ] 02-02: Affiliate referral widgets
- [ ] 02-03: Sponsored attorney listings

### Phase 3: Multi-State Expansion

**Goal**: TX and CA are fully harvested, verified, and live on the public site — validating the pipeline at scale beyond Florida
**Depends on**: Phase 2
**Requirements**: EXPN-01, EXPN-02, EXPN-03, EXPN-04, EXPN-05, EXPN-06
**Success Criteria** (what must be TRUE):

1. TX and CA court structures are seeded with curated URL configurations and harvested with >70% extraction success rate
2. Identity resolution and deduplication produce zero duplicate public pages across all three states
3. Verification pipeline clears TX + CA queues within operational budget; only VERIFIED judges appear on public pages
4. New state pages are automatically ISR-cached, included in dynamic sitemaps, and monetized through existing ad/affiliate/sponsor infrastructure
   **Plans**: TBD

Plans:

- [ ] 03-01: TX + CA court seeding, harvest & verification

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3

| Phase                    | Plans Complete | Status      | Completed |
| ------------------------ | -------------- | ----------- | --------- |
| 1. Production Readiness  | 2/3 | In Progress|  |
| 2. Revenue Integration   | 0/3            | Not started | -         |
| 3. Multi-State Expansion | 0/1            | Not started | -         |
