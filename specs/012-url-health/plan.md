# Implementation Plan: URL Health Scoring & Delta-Run Prioritization

**Branch**: `012-url-health` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/012-url-health/spec.md`

## Summary

Add URL-level health tracking to the harvest pipeline. A new `UrlHealth` table maintains a composite quality score (0.0–1.0) for every harvested URL, computed from success rate, yield consistency, freshness, and volume signals across a sliding 10-scrape window. A companion `ScrapeLog` table replaces the existing `ScrapeFailure` table, recording every harvest attempt (success and failure) in a single canonical event log. The harvest pipeline gains a `--delta` mode that prioritizes stale-but-healthy URLs and defers broken ones. An admin health dashboard at `/admin/health/` replaces `/admin/failures/` with full health visibility and drill-down scrape history.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js  
**Primary Dependencies**: Next.js 14, Prisma ORM v6, Tailwind CSS, shadcn/ui  
**Storage**: PostgreSQL (existing, via Prisma)  
**Testing**: Manual verification + build validation  
**Target Platform**: Vercel (SSR)  
**Project Type**: Web (monolith)  
**Performance Goals**: Health score recomputation for ~30 URLs/state in <2s; admin page load <1s  
**Constraints**: No external notification services; health recording must not block harvest pipeline  
**Scale/Scope**: ~50 states × ~30 URLs/state = ~1,500 UrlHealth records; ~18,000 ScrapeLog rows/year

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Accuracy & Source Attribution | PASS | Health tracking adds operational observability — does not change how data is sourced, verified, or published |
| II. SEO-First Architecture | N/A | No public-facing URL or page changes |
| III. Legal Safety & Neutrality | N/A | Admin-only feature, no public content |
| IV. State-by-State Expansion | PASS | Health scoring directly supports expansion quality gates with per-URL reliability data |
| V. Simplicity & Incremental Discipline | PASS | Two new tables (UrlHealth, ScrapeLog) with clear purpose; ScrapeFailure retired (net: same table count). Weighted formula configurable via constants |
| VI. Accessibility & WCAG | PASS | Admin health page must meet WCAG 2.1 AA |
| VII. Data Pipeline Integrity & Cost Discipline | PASS | Health recording follows existing pipeline stage order; checkpoint/resume preserved; quality report enhanced |
| Schema via Prisma migrations | PASS | New migration required |
| State config JSON format | PASS | No changes |

**Post-Phase 1 re-check**: PASS. Data model adds UrlHealth + ScrapeLog, removes ScrapeFailure. Net complexity neutral. No additional services or dependencies introduced.

## Project Structure

### Documentation (this feature)

```text
specs/012-url-health/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── api.md           # Phase 1 output
├── checklists/
│   └── requirements.md  # Spec quality checklist
└── tasks.md             # Phase 2 output (created by /speckit.tasks)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                     # Add UrlHealth + ScrapeLog models, remove ScrapeFailure
└── migrations/
    └── YYYYMMDD_url_health/          # New migration

scripts/harvest/
├── index.ts                          # Modified: add --delta, --skip-broken flags; integrate health recording
├── health-scorer.ts                  # NEW: health score computation (weighted formula)
├── health-recorder.ts                # NEW: ScrapeLog + UrlHealth upsert logic
├── failure-tracker.ts                # Modified: rewrite to use ScrapeLog instead of ScrapeFailure
├── config.ts                         # Modified: add HealthConfig types
└── reporter.ts                       # Modified: append health summary to quality report

scripts/discovery/
└── config-promoter.ts                # Modified: seed UrlHealth on promote

scripts/maintenance/
└── purge-failures.ts                 # Modified: query ScrapeLog instead of ScrapeFailure

src/app/admin/
├── health/
│   └── page.tsx                      # NEW: URL health dashboard
├── failures/
│   └── page.tsx                      # REMOVED: replaced by /admin/health/
├── layout.tsx                        # Modified: update nav links
└── page.tsx                          # Modified: update dashboard cards

src/app/api/admin/
├── health/
│   ├── route.ts                      # NEW: GET list health records
│   ├── summary/
│   │   └── route.ts                  # NEW: GET per-state health summary
│   ├── [id]/
│   │   └── route.ts                  # NEW: GET detail + PATCH actions
│   └── scrape-logs/
│       └── [id]/
│           └── route.ts              # NEW: PATCH resolve scrape log
├── failures/
│   ├── route.ts                      # REMOVED
│   └── [id]/
│       └── route.ts                  # REMOVED
└── discovery/
    └── promote/
        └── route.ts                  # Modified: seed UrlHealth on promote
```

**Structure Decision**: Extends existing monolith structure. New files follow established patterns (API routes in `src/app/api/admin/`, pages in `src/app/admin/`, pipeline scripts in `scripts/harvest/`). Two new pipeline modules (`health-scorer.ts`, `health-recorder.ts`) keep health logic isolated from existing extraction/normalization code.

## Complexity Tracking

No constitution violations to justify. Net +1 table (add 2, remove 1), but ScrapeLog subsumes ScrapeFailure's purpose so net complexity is neutral. No new external dependencies.
