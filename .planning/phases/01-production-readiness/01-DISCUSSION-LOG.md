# Phase 1: Production Readiness - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-22
**Phase:** 01-production-readiness
**Areas discussed:** Design System Migration, Analytics Stack, ISR Strategy, Judge Photo Pipeline, Legal Pages Format, Mobile Responsiveness, Breadcrumb Component, Content Quality Thresholds
**Mode:** Auto (all recommended)

---

## Design System Migration Approach

| Option                                   | Description                                                                                                         | Selected |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | -------- |
| Complete 006 spec (incremental per-page) | Migrate page-by-page using existing bridge layer, test responsiveness at each step per spec 006 acceptance criteria | ✓        |
| Full redesign                            | Rebuild all pages from scratch with shadcn/ui components                                                            |          |
| Bridge-only (no migration)               | Keep current CSS variables, only fix critical issues                                                                |          |

**User's choice:** Auto-selected recommended: Complete 006 spec incrementally
**Notes:** Bridge layer in globals.css already maps shadcn/ui tokens → CSS variables. Spec 006 has detailed acceptance criteria at 375/768/1280px breakpoints. Incremental migration is lowest risk.

---

## Analytics Stack

| Option                            | Description                                                                                        | Selected |
| --------------------------------- | -------------------------------------------------------------------------------------------------- | -------- |
| Vercel Analytics + Speed Insights | Cookie-free, zero GDPR banner, native Next.js integration. GSC separately via domain verification. | ✓        |
| Google Analytics 4                | Full-featured but requires GDPR cookie banner, more complex setup                                  |          |
| Both Vercel + GA4                 | Maximum data but unnecessary complexity at current stage                                           |          |

**User's choice:** Auto-selected recommended: Vercel Analytics + Speed Insights
**Notes:** REQUIREMENTS (ANLT-01) specifies cookie-free Vercel Analytics. No GDPR banner needed. GA4 is premature — no traffic to analyze yet.

---

## ISR Strategy

| Option                          | Description                                                                                                           | Selected |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------- | -------- |
| Time-based + on-demand triggers | `revalidate` exports on routes (daily profiles, hourly listings) + `revalidateTag`/`revalidatePath` API after harvest | ✓        |
| On-demand only                  | Only revalidate when data changes via harvest pipeline                                                                |          |
| Static generation with fallback | `generateStaticParams` + ISR fallback for new pages                                                                   |          |

**User's choice:** Auto-selected recommended: Time-based + on-demand triggers
**Notes:** Standard Next.js ISR pattern. Time-based ensures pages stay fresh even without harvest runs. On-demand triggers provide immediate updates when new data arrives.

---

## Judge Photo Pipeline

| Option                                      | Description                                                                                                                           | Selected |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| Harvest-time scraping + sharp + Vercel Blob | Extend harvester to scrape photos from court bio pages; optimize with sharp (WebP, ~300×360px); store in Vercel Blob (free tier, CDN) | ✓        |
| Manual upload only                          | Admin uploads photos manually — no automation                                                                                         |          |
| External URL references                     | Store photo URLs from source sites, don't download                                                                                    |          |

**User's choice:** Auto-selected recommended: Harvest-time scraping + sharp + Vercel Blob
**Notes:** PHOTO-03 explicitly requires harvest-time scraping. External URLs break when source sites change. Vercel Blob is free-tier, CDN-served, integrates with next/image.

---

## Legal Pages Format

| Option             | Description                                                                      | Selected |
| ------------------ | -------------------------------------------------------------------------------- | -------- |
| Static React pages | Simple JSX with prose content at /privacy, /terms, /about. No build deps needed. | ✓        |
| MDX pages          | Markdown with React components — more flexible but adds build complexity         |          |
| CMS-managed        | Content from external CMS — over-engineering for 3 static pages                  |          |

**User's choice:** Auto-selected recommended: Static React pages
**Notes:** Three simple pages. MDX adds a build dependency for no benefit. CMS is out of scope per REQUIREMENTS.

---

## Mobile Responsiveness

| Option                           | Description                                                                                                 | Selected |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------- |
| Follow 006 spec per-page rebuild | Execute spec 006 acceptance criteria: 375/768/1280px breakpoints, touch targets ≥48px, single-column mobile | ✓        |
| Patch critical issues only       | Fix only horizontal scroll and layout breaks, skip comprehensive rebuild                                    |          |
| Mobile-specific stylesheets      | Create separate mobile views — anti-pattern for Tailwind                                                    |          |

**User's choice:** Auto-selected recommended: Follow 006 spec per-page rebuild
**Notes:** Spec 006 has thorough per-page acceptance criteria. This is the design system migration — responsiveness is built in, not bolted on.

---

## Breadcrumb Component

| Option                                               | Description                                                                                    | Selected |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------- |
| Extract to shared component + BreadcrumbList JSON-LD | Create reusable `<Breadcrumbs>` with Schema.org structured data, deploy on all 5 public routes | ✓        |
| Keep inline per-page                                 | Leave breadcrumbs as inline JSX on each page — works but duplicates code                       |          |
| Use shadcn/ui breadcrumb                             | Install shadcn/ui Breadcrumb component if available                                            |          |

**User's choice:** Auto-selected recommended: Extract to shared component + BreadcrumbList JSON-LD
**Notes:** Current inline implementation only exists on judge profile page. DSGN-05 + ANLT-07 both require breadcrumbs with Schema.org structured data across all pages.

---

## Content Quality Thresholds

| Option                                | Description                                                                                              | Selected |
| ------------------------------------- | -------------------------------------------------------------------------------------------------------- | -------- |
| noindex <3 judges; "coming soon" at 0 | Empty jurisdictions get helpful messaging + related links. <3 verified judges = noindex. ≥3 = indexable. | ✓        |
| noindex <5 judges                     | Higher threshold — more conservative but may exclude valid small jurisdictions                           |          |
| No threshold (index everything)       | Let Google decide content quality — risky for programmatic SEO                                           |          |

**User's choice:** Auto-selected recommended: noindex <3 judges; "coming soon" at 0
**Notes:** CONT-01 requires "coming soon" for empty jurisdictions. CONT-02 requires noindex for insufficient data. 3 judges is a reasonable minimum for a meaningful listing page.

---

## Agent's Discretion

- Font choices, ISR exact intervals, sharp dimensions, loading skeleton visual design, legal page draft wording — all within agent's discretion per auto-mode config.

## Deferred Ideas

- Storybook setup (docs/design/storybook-plan.md) — not needed for production readiness
- Pillar pages — deferred to v2 (CSTG-01)
- Coverage dashboard — deferred to v2 (SCLE-03)
