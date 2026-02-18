# Implementation Plan: Phase 1 — Foundation

**Branch**: `001-foundation` | **Date**: 2026-02-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-foundation/spec.md`

## Summary

Build the foundational infrastructure for judgesdirectory.org: a Next.js application with PostgreSQL/Prisma persistence implementing the five-level URL hierarchy (`/judges` → `/{state}` → `/{county}` → `/{court-type}` → `/{judge-slug}`), server-side rendered pages with Schema.org JSON-LD structured data, an XML sitemap generator, a protected admin ingestion panel for judge records, and a seed dataset of all 50 U.S. states with ~3,143 counties. Deployed to Vercel with environment variable management and preview deployments.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20 LTS  
**Primary Dependencies**: Next.js 14 (App Router, SSR), Prisma ORM 5.x, slugify  
**Storage**: PostgreSQL 15+ (managed, e.g., Neon, Supabase, or Vercel Postgres)  
**Testing**: Jest + React Testing Library for component tests; Prisma test utilities for data layer  
**Target Platform**: Vercel (Node.js serverless functions + Edge Runtime for SSR)  
**Project Type**: Web — single Next.js application (public pages + admin routes under `/admin`)  
**Performance Goals**: < 800ms TTFB for SSR pages; Lighthouse SEO ≥ 90  
**Constraints**: < 250ms p95 database queries; no client-side-only rendering on indexable pages; sitemap ≤ 50,000 URLs per file  
**Scale/Scope**: 50 states, ~3,143 counties, variable courts/judges (target 1,500+ judges by end of Phase 2), 5 page templates

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Research Gate (initial evaluation)

| #   | Principle                                           | Status  | Evidence                                                                                                                                                                                                   |
| --- | --------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I   | Data Accuracy & Source Attribution (NON-NEGOTIABLE) | ✅ PASS | Admin ingestion panel includes field validation (FR-007); spec assumes data from public government records; seed data from Census Bureau FIPS codes. No judge data published without verification pathway. |
| II  | SEO-First Architecture                              | ✅ PASS | Five-level hierarchical URL structure (FR-002); SSR on all public pages (FR-001); JSON-LD on every page (FR-004); XML sitemap (FR-005); SEO title templates (FR-012); canonical URLs (FR-013).             |
| III | Legal Safety & Neutrality (NON-NEGOTIABLE)          | ✅ PASS | Informational disclaimer on every profile (FR-008); no ratings, reviews, commenting, or scoring in scope; only public records used; neutral factual tone enforced by spec exclusions.                      |
| IV  | Progressive Launch & Phased Delivery                | ✅ PASS | This is Phase 1 of 4. Deliverables are scoped to foundation only. No Phase 2–4 items (search, ads, attorney placements) included. All 50 states seeded structurally; judge data deferred to Phase 2.       |
| V   | Simplicity & MVP Discipline                         | ✅ PASS | Tech stack matches constitution exactly (Next.js, PostgreSQL, Prisma, Vercel). No extra dependencies beyond what's required. Admin panel uses simple auth gate, not a user account system.                 |
| —   | Technology Stack Compliance                         | ✅ PASS | Next.js, PostgreSQL, Prisma ORM, Vercel — all match constitution. No Google Ad Manager integration needed in Phase 1 (that's Phase 4).                                                                     |
| —   | Development Workflow                                | ✅ PASS | PR-based workflow, Prisma migrations in source control (FR-010), Vercel preview deployments, no secrets in client bundles (FR-015).                                                                        |

**Gate Result**: ✅ ALL PASS — Proceed to Phase 0 research.

### Post-Design Gate (after Phase 1 artifacts)

Re-evaluated after completion of `research.md`, `data-model.md`, `contracts/api-routes.md`, and `quickstart.md`.

| #   | Principle                                           | Status  | Evidence                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I   | Data Accuracy & Source Attribution (NON-NEGOTIABLE) | ✅ PASS | Data model includes `sourceUrl` (required) and `verified` (default false) on Judge entity. Admin API contract requires `sourceUrl` on POST. No auto-publish — judges are unverified by default. Seed data is structural only (states + counties from Census FIPS).  |
| II  | SEO-First Architecture                              | ✅ PASS | Contracts define JSON-LD (`ItemList` on listings, `Person` on profiles) + `generateMetadata` title templates + canonical URLs on every public page. Sitemap contract uses `generateSitemaps()` for >50k URL support. All public routes are Server Components (SSR). |
| III | Legal Safety & Neutrality (NON-NEGOTIABLE)          | ✅ PASS | Data model has no rating/review/comment/scoring fields. Contracts include `Disclaimer` component on judge profiles. No editorial content in page contracts. Only public records sourced.                                                                            |
| IV  | Progressive Launch & Phased Delivery                | ✅ PASS | Design scoped strictly to Phase 1. Seed plan is states + counties only; judge ingestion deferred to Phase 2. No ad placements, search, or monetization features in contracts.                                                                                       |
| V   | Simplicity & MVP Discipline                         | ✅ PASS | Tech stack unchanged: Next.js 14, PostgreSQL 15+, Prisma 5.x, Vercel. Research chose built-in `app/sitemap.ts` over `next-sitemap` (fewer deps). Admin auth is middleware Basic Auth (no user account system). No unnecessary abstractions in data model.           |
| —   | Technology Stack Compliance                         | ✅ PASS | All dependencies match constitution. No new services introduced. Neon PostgreSQL is a managed PG provider (not a different database).                                                                                                                               |
| —   | Development Workflow                                | ✅ PASS | Quickstart defines Prisma migration workflow. `.env.example` template provided (no secrets committed). Vercel preview deploy documented. PR workflow assumed per constitution.                                                                                      |

**Gate Result**: ✅ ALL PASS — Design artifacts are constitution-compliant. Proceed to Phase 2 task breakdown.

## Project Structure

### Documentation (this feature)

```text
specs/001-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (API route contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks — NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                              # Root layout (metadata, fonts)
│   ├── page.tsx                                # Homepage redirect → /judges
│   ├── judges/
│   │   ├── page.tsx                            # US1: States grid
│   │   ├── [state]/
│   │   │   ├── page.tsx                        # US2: Counties list
│   │   │   ├── [county]/
│   │   │   │   ├── page.tsx                    # US3: Court types
│   │   │   │   ├── [courtType]/
│   │   │   │   │   ├── page.tsx                # US4: Judges list
│   │   │   │   │   ├── [judgeSlug]/
│   │   │   │   │   │   └── page.tsx            # US5: Judge profile
│   ├── admin/
│   │   ├── layout.tsx                          # US6: Admin auth gate
│   │   ├── page.tsx                            # Admin dashboard
│   │   └── judges/
│   │       ├── page.tsx                        # Judge listing/search
│   │       └── new/
│   │           └── page.tsx                    # Judge create/edit form
│   ├── api/
│   │   └── admin/
│   │       └── judges/
│   │           └── route.ts                    # Admin API: CRUD for judges
│   ├── not-found.tsx                           # Custom 404 page
│   └── sitemap.ts                              # US7: Dynamic XML sitemap
├── components/
│   ├── ui/                                     # Reusable UI primitives
│   ├── seo/
│   │   └── JsonLd.tsx                          # JSON-LD structured data component
│   ├── Disclaimer.tsx                          # Legal disclaimer component (all public pages)
│   └── StateGrid.tsx                           # State tiles grid component
├── lib/
│   ├── db.ts                                   # Prisma client singleton
│   ├── slugify.ts                              # Slug generation + disambiguation
│   ├── seo.ts                                  # Title templates, JSON-LD builders
│   └── constants.ts                            # Site-wide constants
├── prisma/
│   ├── schema.prisma                           # Database schema
│   ├── migrations/                             # Prisma migration files
│   └── seed.ts                                 # US8: Seed 50 states + counties
└── middleware.ts                                # URL normalization (trailing slash, case)

tests/
├── unit/
│   ├── lib/
│   │   ├── slugify.test.ts
│   │   └── seo.test.ts
│   └── components/
│       └── JsonLd.test.tsx
├── integration/
│   ├── pages/
│   │   ├── states-grid.test.tsx
│   │   ├── county-list.test.tsx
│   │   ├── court-types.test.tsx
│   │   ├── judge-list.test.tsx
│   │   └── judge-profile.test.tsx
│   └── api/
│       └── admin-judges.test.ts
└── contract/
    └── sitemap.test.ts

public/
└── favicon.ico

next.config.js                                  # Next.js configuration
tsconfig.json                                   # TypeScript configuration
.env.example                                    # Environment variable template
.env.local                                      # Local env (gitignored)
package.json
```

**Structure Decision**: Single Next.js application using the App Router. The `/admin` route group provides the internal ingestion panel behind an auth gate. No separate backend/frontend split needed since Next.js SSR + API routes handle both concerns. This is the simplest structure that satisfies all requirements (Constitution V: Simplicity).

## Complexity Tracking

> No constitution violations detected. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
