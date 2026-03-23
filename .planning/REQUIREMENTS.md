# Requirements: JudgesDirectory

**Defined:** 2026-03-22
**Core Value:** Every judge profile is accurate, source-attributed, and discoverable via search — trust and coverage are the moat.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Design System

- [x] **DSGN-01**: All public pages use shadcn/ui components with consistent Tailwind CSS styling (complete 006 migration)
- [x] **DSGN-02**: Admin panel styling unified under shadcn/ui + Tailwind (no more CSS variable / inline style mix)
- [x] **DSGN-03**: Loading skeleton components render during data fetches to prevent CLS
- [x] **DSGN-04**: All public pages are mobile-responsive with touch targets ≥ 48px and no horizontal scroll
- [x] **DSGN-05**: Breadcrumb navigation component matches URL hierarchy and Schema.org BreadcrumbList structured data

### Analytics & SEO Foundation

- [x] **ANLT-01**: Vercel Analytics and Speed Insights instrumented on all public pages (cookie-free, zero GDPR banner)
- [x] **ANLT-02**: Google Search Console property configured with sitemap submitted
- [x] **ANLT-03**: Core Web Vitals baseline captured (LCP, INP, CLS per page template type)
- [x] **ANLT-04**: Dynamic XML sitemaps generated per state with lastmod from updatedAt, split for >50K URLs
- [x] **ANLT-05**: Open Graph and Twitter Card meta tags on all public page templates via generateMetadata()
- [x] **ANLT-06**: Canonical URLs enforced on all pages; trailing slash convention consistent; 301 redirects for common variants
- [x] **ANLT-07**: Existing Schema.org JSON-LD validated across all 5 template types; BreadcrumbList added if missing

### Performance

- [x] **PERF-01**: ISR caching enabled on all public routes (judge profiles revalidate daily, listing pages hourly)
- [x] **PERF-02**: On-demand revalidation triggered after harvest pipeline imports new data (revalidatePath/revalidateTag)
- [x] **PERF-03**: LCP < 2.5s, INP < 200ms, CLS < 0.1 on all public page templates
- [x] **PERF-04**: Judge photos optimized via sharp + next/image with lazy loading and fallback avatar

### Legal Pages

- [ ] **LEGL-01**: Privacy Policy page published at /privacy
- [ ] **LEGL-02**: Terms of Service page published at /terms
- [ ] **LEGL-03**: About page explaining data sources, methodology, and verification process at /about
- [ ] **LEGL-04**: Informational disclaimer displayed on every public page (existing — verify completeness)

### Display Advertising

- [ ] **ADS-01**: AdSense integration via @next/third-parties with script loading that doesn't block LCP
- [ ] **ADS-02**: Ad placement zones defined: sidebar + in-content on listing pages; below-fold only on judge profiles
- [ ] **ADS-03**: Ad slots have reserved dimensions to prevent CLS during lazy load
- [ ] **ADS-04**: AdSlot component abstracts provider (AdSense → Mediavine swap without page changes)
- [ ] **ADS-05**: No above-fold ads on judge profile core content zone (trust signal)

### Affiliate Referrals

- [ ] **AFFL-01**: "Need a Lawyer?" affiliate widget component renders on judge profile and court listing pages
- [ ] **AFFL-02**: Widget targets by practice area + county/jurisdiction context
- [ ] **AFFL-03**: FTC-compliant "Sponsored" disclosure on all affiliate widgets
- [ ] **AFFL-04**: Click tracking on affiliate widgets (impressions, clicks, CTR by placement zone)
- [ ] **AFFL-05**: Initial integration with 2-3 partners (Avvo, LegalMatch, FindLaw) via referral URLs with UTM parameters

### Sponsored Listings

- [ ] **SPNS-01**: SponsoredListing Prisma model with geo + practice-area targeting, active dates, display priority
- [ ] **SPNS-02**: Admin CRUD for managing sponsored attorney listings (create, edit, activate, deactivate)
- [ ] **SPNS-03**: Sponsored listing cards render on county/court pages with "Sponsored" badge
- [ ] **SPNS-04**: Sponsored listings cached via unstable_cache with 5-minute TTL and tag-based invalidation
- [ ] **SPNS-05**: Click tracking on sponsored listing impressions and clicks

### Judge Photos

- [ ] **PHOTO-01**: Judge photo displayed on profile page via next/image with optimized dimensions
- [ ] **PHOTO-02**: Fallback avatar with initials when no photo available
- [ ] **PHOTO-03**: Photo scraping pipeline extracts photos from official court bio pages during harvest
- [ ] **PHOTO-04**: Photos stored optimized via sharp (WebP, resized to profile dimensions)

### Content Quality

- [ ] **CONT-01**: Empty jurisdictions (no verified judges) show "coverage coming soon" with related jurisdictions, not empty/404
- [ ] **CONT-02**: Pages with insufficient data use noindex until coverage threshold met
- [ ] **CONT-03**: 404 page with helpful navigation to existing jurisdictions

### Multi-State Expansion

- [ ] **EXPN-01**: TX court structure seeded with URL configuration curated
- [ ] **EXPN-02**: CA court structure seeded with URL configuration curated
- [ ] **EXPN-03**: Harvesting pipeline validated for TX (extraction success rate > 70%)
- [ ] **EXPN-04**: Harvesting pipeline validated for CA (extraction success rate > 70%)
- [ ] **EXPN-05**: Verification throughput sufficient to clear TX + CA queues
- [ ] **EXPN-06**: Identity resolution and deduplication stable for new states (no duplicate public pages)

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Content Strategy

- **CSTG-01**: Pillar pages for top 10-20 high-traffic counties (curated long-form jurisdiction overviews)
- **CSTG-02**: Evergreen legal explainer content ("How judges are selected in Florida", "What is a circuit court?")
- **CSTG-03**: "Term ending soon" computed pages per state (backlink magnet for journalists)

### Revenue Optimization

- **ROPT-01**: A/B testing framework for ad placement optimization (requires 50K+ monthly visitors)
- **ROPT-02**: Self-serve sponsored listing signup portal (after 20+ paying customers validated)
- **ROPT-03**: Stripe subscription billing automation (after $5K MRR)
- **ROPT-04**: Mediavine/Raptive upgrade from AdSense (at 50K monthly sessions)

### Distribution

- **DIST-01**: Email newsletter signup segmented by state/county
- **DIST-02**: RSS/JSON feed for judge updates (journalists, civic orgs)
- **DIST-03**: Search query analytics dashboard (top queries, zero-result queries)

### Scale

- **SCLE-01**: Expansion to 5+ additional states beyond TX/CA
- **SCLE-02**: Automated data refresh cycles (prevent staleness)
- **SCLE-03**: Coverage dashboard as public trust signal on state pages
- **SCLE-04**: Performance monitoring dashboard (TTFB by page template type)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                     | Reason                                                                                |
| ------------------------------------------- | ------------------------------------------------------------------------------------- |
| User ratings/reviews of judges              | Legal risk (defamation); violates Constitution Principle III (neutrality)             |
| Real-time case tracking / PACER integration | Different product category; massive complexity ($0.10/page PACER fees)                |
| Judge comparison / ranking tools            | Implies subjective judgment about public officials; legally risky                     |
| AI chatbot / Q&A about judges               | Hallucination risk with judicial data unacceptably high; undermines trust moat        |
| OAuth / social login                        | No user-generated content; unnecessary auth complexity                                |
| Mobile native app                           | Users find judge info via search, not app downloads; mobile-responsive web sufficient |
| Complex CMS                                 | Content is generated from structured data; MDX for pillar pages sufficient            |
| Aggressive ad density / interstitials       | Destroys trust; Google penalizes intrusive interstitials; Mediavine rejects poor UX   |
| Session replay / heatmaps                   | Premature; no traffic volume to analyze yet                                           |
| A/B testing framework                       | No statistical significance at current traffic levels; defer to v2                    |
| Multi-language / i18n                       | U.S. courts are English-language; no ROI signal                                       |
| Stripe subscription billing                 | Over-engineering for <20 customers; manual invoicing first                            |
| Paywall / premium tier                      | Kills SEO; entire model depends on free access driving volume                         |
| Next.js 15/16 upgrade                       | Risk without benefit; current v14 is stable and sufficient                            |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase   | Status  |
| ----------- | ------- | ------- |
| DSGN-01     | Phase 1 | Complete |
| DSGN-02     | Phase 1 | Complete |
| DSGN-03     | Phase 1 | Complete |
| DSGN-04     | Phase 1 | Complete |
| DSGN-05     | Phase 1 | Complete |
| ANLT-01     | Phase 1 | Complete |
| ANLT-02     | Phase 1 | Complete |
| ANLT-03     | Phase 1 | Complete |
| ANLT-04     | Phase 1 | Complete |
| ANLT-05     | Phase 1 | Complete |
| ANLT-06     | Phase 1 | Complete |
| ANLT-07     | Phase 1 | Complete |
| PERF-01     | Phase 1 | Complete |
| PERF-02     | Phase 1 | Complete |
| PERF-03     | Phase 1 | Complete |
| PERF-04     | Phase 1 | Complete |
| LEGL-01     | Phase 1 | Pending |
| LEGL-02     | Phase 1 | Pending |
| LEGL-03     | Phase 1 | Pending |
| LEGL-04     | Phase 1 | Pending |
| ADS-01      | Phase 2 | Pending |
| ADS-02      | Phase 2 | Pending |
| ADS-03      | Phase 2 | Pending |
| ADS-04      | Phase 2 | Pending |
| ADS-05      | Phase 2 | Pending |
| AFFL-01     | Phase 2 | Pending |
| AFFL-02     | Phase 2 | Pending |
| AFFL-03     | Phase 2 | Pending |
| AFFL-04     | Phase 2 | Pending |
| AFFL-05     | Phase 2 | Pending |
| SPNS-01     | Phase 2 | Pending |
| SPNS-02     | Phase 2 | Pending |
| SPNS-03     | Phase 2 | Pending |
| SPNS-04     | Phase 2 | Pending |
| SPNS-05     | Phase 2 | Pending |
| PHOTO-01    | Phase 1 | Pending |
| PHOTO-02    | Phase 1 | Pending |
| PHOTO-03    | Phase 1 | Pending |
| PHOTO-04    | Phase 1 | Pending |
| CONT-01     | Phase 1 | Pending |
| CONT-02     | Phase 1 | Pending |
| CONT-03     | Phase 1 | Pending |
| EXPN-01     | Phase 3 | Pending |
| EXPN-02     | Phase 3 | Pending |
| EXPN-03     | Phase 3 | Pending |
| EXPN-04     | Phase 3 | Pending |
| EXPN-05     | Phase 3 | Pending |
| EXPN-06     | Phase 3 | Pending |

**Coverage:**

- v1 requirements: 48 total
- Mapped to phases: 48
- Unmapped: 0 ✓

---

_Requirements defined: 2026-03-22_
_Traceability updated: 2026-03-22_
_Last updated: 2026-03-22 after initialization_
