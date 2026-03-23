# JudgesDirectory

## What This Is

JudgesDirectory.org is a programmatic SEO directory of U.S. judges organized hierarchically by state, county, court type, and individual judge. Built on verified government records with source attribution, it captures high-intent legal search traffic (e.g., "judges in Broward County Florida", "Judge Jane Smith biography") and monetizes through display ads, attorney affiliate referrals, and sponsored attorney listings. The site serves anyone with active legal intent — citizens looking up their judge, attorneys researching jurisdictions, journalists covering the courts, and civic organizations tracking the judiciary.

## Core Value

Every judge profile is accurate, source-attributed, and discoverable via search — trust and coverage are the moat.

## Requirements

### Validated

- ✓ 5-level URL hierarchy (state → county → court type → judge) with SSR and Schema.org JSON-LD — 001-foundation
- ✓ Light/dark theme toggle via localStorage — 002-theme-toggle
- ✓ CSV bulk import pipeline with verification queue and progress dashboard — 003-data-ingestion
- ✓ Florida judge harvesting: deterministic + LLM extraction, Ballotpedia enrichment, bio crawling, identity resolution, deduplication — 004-florida-judge-harvest
- ✓ CSS variable design system with typography and spacing — 005-design-system
- ✓ Repeatable state-by-state harvesting with config-driven court URLs — 007/008-state-expansion
- ✓ Full-text site search with pg_trgm fuzzy matching — 009-search-discovery
- ✓ Persistent global footer navigation — 010-global-footer
- ✓ URL discovery workflow with DiscoveryRun/UrlCandidate models and approval gate — 011-url-discovery
- ✓ URL health scoring, anomaly detection, ScrapeLog audit trail — 012-url-health
- ✓ Enhanced admin data tables with judge verification, bulk actions — 013-admin-data-tables
- ✓ Confidence-based auto-verification (≥0.9 auto-verify), anomaly flags, review prioritization — 014-auto-verification
- ✓ Autonomous harvest pipeline with batch processing, checkpointing, parallel state ingestion — 015-autonomous-pipeline
- ✓ Admin UI for state discovery and bulk court registration — 016-admin-state-discovery
- ✓ Scrapling browser automation fallback for JS-heavy sites — 017-scrapling-fallback

### Active

- [ ] Complete shadcn/ui + Tailwind CSS design system migration (started in 006, incomplete)
- [ ] Analytics instrumentation (Search Console, GA4, or Vercel Analytics)
- [ ] Display ad integration (AdSense initially, Mediavine at scale)
- [ ] Attorney affiliate referral widgets (Avvo, LegalMatch, FindLaw)
- [ ] Sponsored attorney listing placements with practice-area targeting
- [ ] Multi-state expansion (TX, CA as pilot states to validate ops at scale)
- [ ] Public page performance optimization (Core Web Vitals, TTFB)
- [ ] Pillar pages for thin-content jurisdictions
- [ ] Judge photo pipeline (scrape + display on profile pages)

### Out of Scope

- User ratings/reviews/scoring of judges — legal risk, violates Constitution Principle III
- Real-time chat or messaging — not core to directory value
- Mobile native app — web-first, mobile-responsive sufficient
- OAuth/social login — unnecessary complexity for current use case
- Public API/data licensing — defer until core monetization validated
- Video or multimedia content — storage/bandwidth costs, not validated
- Civic observation integration — defer until post-expansion

## Context

**Technical Environment:**

- Next.js 14 (App Router, SSR) with React 18, deployed on Vercel
- PostgreSQL via Prisma ORM v6 (State → County → Court → Judge hierarchy)
- Harvesting pipeline: deterministic CSS/XPath extraction first, LLM fallback (OpenAI gpt-4o-mini default), Scrapling browser automation for JS-heavy sites
- 17 feature specs completed (001–017), production-ready FL harvest pipeline
- Design system in transition: CSS custom properties → shadcn/ui + Tailwind (006 incomplete)

**Prior Work:**

- Florida fully harvested with 19/27 court sites using deterministic extraction (free)
- Identity resolution, deduplication, quality reporting all production-ready
- Admin panel with CSV import, verification queue, URL discovery, health monitoring
- Site search with pg_trgm fuzzy text matching

**Business Context:**

- Legal traffic: $5–50+ CPC, $15–30 RPM display — exceptionally high-value
- VoterRecords.com validates the directory-affiliate model (100M+ pages, affiliate revenue)
- Target: 100K pageviews ≈ $1.5–2.5K/month (AdSense); at scale, affiliate could reach $75K/month
- Sponsored attorney listings: $99–199/month per placement, 20 clients = ~$2K MRR baseline
- 6-month organic SEO ramp expected — this is a patience business

**Known Issues:**

- shadcn/ui migration incomplete (006) — public pages use CSS variables, admin uses mixed styling
- No analytics instrumentation yet — can't validate traffic assumptions
- No monetization widgets live — all revenue is theoretical until launched
- State expansion not stress-tested beyond Florida
- Judge photos not yet displayed on profiles

## Constraints

- **Data Accuracy**: All data from government records only; VERIFIED status required for public display (Constitution Principle I)
- **Legal Neutrality**: No opinions, ratings, or commentary on judges (Constitution Principle III)
- **SEO Architecture**: SSR mandatory; hierarchical URLs, JSON-LD, sitemaps non-negotiable (Constitution Principle II)
- **Cost Discipline**: Deterministic extraction first; cheapest LLM model by default; checkpoint/resume required (Constitution Principle VII)
- **Accessibility**: WCAG 2.1 AA for all public pages (Constitution Principle VI)
- **Tech Stack**: TypeScript strict mode, Next.js App Router, Prisma ORM, PostgreSQL — no new frameworks without justification
- **Deployment**: Vercel (SSR native, env var management, preview deploys)

## Key Decisions

| Decision                            | Rationale                                                                                          | Outcome                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------- |
| Programmatic SEO + directory model  | Long-tail search capture across 50 states × 3K+ counties; validated by VoterRecords.com benchmarks | ✓ Good                 |
| Deterministic extraction before LLM | 19/27 FL sites free; LLM only for unknowns; massive cost savings                                   | ✓ Good                 |
| OpenAI gpt-4o-mini as default LLM   | 10x cheaper than Claude, sufficient for structured JSON extraction                                 | ✓ Good                 |
| Verification-first publishing       | Only VERIFIED records public; prevents inaccurate judicial data from being indexed                 | ✓ Good                 |
| Florida as first state              | Rich court structure, good test coverage, manageable scope                                         | ✓ Good                 |
| Next.js SSR on Vercel               | Native SSR, edge deployment, preview deploys; SEO-first architecture                               | ✓ Good                 |
| shadcn/ui + Tailwind migration      | Modern component library, accessible defaults, consistent admin + public styling                   | — Pending (incomplete) |
| Display ads before affiliate        | Lowest friction monetization; validate traffic quality before complex affiliate integrations       | — Pending              |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):

1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):

1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---

_Last updated: 2026-03-22 after initialization_
