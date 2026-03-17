# Implementation Plan: Pragmatic Auto-Verification

**Branch**: `014-auto-verification` | **Date**: 2026-03-16 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/014-auto-verification/spec.md`

## Summary

The harvest pipeline produces thousands of judge records from official government court websites, but nearly all land in UNVERIFIED status because the confidence scoring formula (base 0.50, auto-verify threshold 0.80) is too conservative for government-sourced data. This plan implements source-aware confidence scoring (varied base by source authority + deterministic extraction bonus), tiered auto-verify thresholds, a re-scoring migration for existing records, and a batch-verify admin UI — shifting from "verify every record manually" to "verify by exception."

## Technical Context

**Language/Version**: TypeScript (Node.js runtime, strict mode)
**Primary Dependencies**: Next.js 14, Prisma ORM, Zod, cheerio, @tanstack/react-table
**Storage**: PostgreSQL via Prisma ORM
**Testing**: Manual verification via harvest dry-run and import dry-run; quality reports
**Target Platform**: Linux server (Vercel) for web app; local CLI for harvest/import/maintenance scripts
**Project Type**: Web application (Next.js SSR frontend + CLI scripts)
**Performance Goals**: Re-scoring must process 5,000+ records in under 60 seconds with batch transactions
**Constraints**: No new runtime dependencies; must be backward-compatible with existing CSVs
**Scale/Scope**: ~5,000 existing judge records; 50+ source URLs; 4 states harvested

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Accuracy & Source Attribution | ✅ PASS | Auto-verification is restricted to official government sources (`.gov` domains) and known court websites. Anomaly flags override all auto-verify decisions. NEEDS_REVIEW and REJECTED records require human attention. Source authority is classified and persisted — strengthens source attribution. |
| II. SEO-First Architecture | ✅ PASS | No routing, URL, or page-rendering changes. More VERIFIED judges means more populated public pages, which is a net SEO positive (reduces thin pages). |
| III. Legal Safety & Neutrality | ✅ PASS | No editorial content, ratings, or scoring introduced. Auto-verification only promotes factual data from government sources. No new public-facing content types. |
| IV. State-by-State Expansion | ✅ PASS | Feature applies to all states equally via source authority classification. No state-specific logic beyond what already exists in court config JSON files. |
| V. Simplicity & Incremental Discipline | ✅ PASS | Adds two new fields to Judge model (`rosterUrl`, `extractionMethod`). Uses existing `sourceAuthority` enum. No new services, no new dependencies. Quality gate and confidence scoring are refinements of existing logic, not new abstractions. |
| VI. Accessibility & WCAG Compliance | ✅ PASS | Batch verify UI additions to admin panel must use semantic HTML, keyboard-navigable buttons, and proper ARIA attributes. Admin panel follows existing component patterns (DataTable). |
| VII. Data Pipeline Integrity & Cost Discipline | ✅ PASS | Deterministic extraction is explicitly rewarded with higher confidence. Source authority classification strengthens provenance tracking. Quality report format unchanged. Re-scoring preserves all existing data — no destructive operations. |

**Gate result: PASS** — No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/014-auto-verification/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-contract.md
└── checklists/
    └── requirements.md  # Spec quality checklist
```

### Source Code (repository root)

```text
# Harvest pipeline (CLI scripts)
scripts/harvest/
├── config.ts              # EnrichedJudgeRecord type + source-authority utility
├── extractor.ts           # Tag extraction method on results
├── bio-enricher.ts        # New confidence formula
├── index.ts               # Propagate extraction method to records
└── reporter.ts            # Add CSV columns

# Import pipeline (CLI scripts)
scripts/import/
├── csv-importer.ts        # Parse new CSV columns
├── index.ts               # Use parsed sourceAuthority
└── quality-gate.ts        # Source-aware thresholds

# Maintenance scripts (CLI)
scripts/maintenance/
└── rescore-judges.ts      # NEW: re-score existing records

# Database schema
prisma/
├── schema.prisma          # Add rosterUrl and extractionMethod fields
└── migrations/            # New migration for rosterUrl and extractionMethod

# Admin API + UI
src/app/api/admin/judges/
├── route.ts               # Existing (unchanged)
├── sources/
│   └── route.ts           # NEW: sources aggregation endpoint
└── batch-verify/
    └── route.ts           # NEW: batch verify endpoint
src/app/admin/judges/
└── page.tsx               # Batch verify UI
```

**Structure Decision**: This feature modifies existing files across the harvest pipeline, import pipeline, and admin UI. One new CLI script (`rescore-judges.ts`), two new API routes (`sources`, `batch-verify`), and one Prisma migration. No new directories beyond the API route folders.

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design artifacts (data-model.md, contracts/, quickstart.md) are complete.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Data Accuracy & Source Attribution | ✅ PASS | Data model adds `rosterUrl` (strengthens provenance) and `extractionMethod` (strengthens attribution). Source authority classified from URL domain + court config allowlist. No data is published without verification — anomaly flags always override auto-verify. |
| II. SEO-First Architecture | ✅ PASS | No routing or URL changes. New API endpoints are admin-only. More VERIFIED judges → more populated public pages → improved crawl value. |
| III. Legal Safety & Neutrality | ✅ PASS | No editorial content introduced. Batch verify UI is admin-only with confirmation dialog. Auto-verification is restricted to factual government data. |
| IV. State-by-State Expansion | ✅ PASS | Source classifier reads state court config JSONs — new states automatically benefit when their config is created. No Florida-specific logic. |
| V. Simplicity & Incremental Discipline | ✅ PASS | Two nullable fields added (`rosterUrl`, `extractionMethod`) — both have clear user value (batch grouping, analytics). No new dependencies. REST contracts follow existing API patterns (NextResponse JSON, Prisma queries). Re-scoring CLI follows existing script patterns. |
| VI. Accessibility & WCAG Compliance | ✅ PASS | Batch verify UI specified in contracts as a table with action buttons — must use semantic HTML, keyboard navigation, proper focus management. Follows existing DataTable patterns. |
| VII. Data Pipeline Integrity & Cost Discipline | ✅ PASS | Deterministic extraction explicitly rewarded (+0.10 confidence). Confidence formula caps at 0.95. Re-scoring is batched (100/txn), idempotent, and safe to interrupt. CSV backward-compatible. Quality report format unchanged. |

**Post-design gate result: PASS** — All principles satisfied. Design artifacts are consistent with spec and constitution.
