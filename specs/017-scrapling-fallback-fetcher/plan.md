# Implementation Plan: Scrapling Fallback Fetcher

**Branch**: `017-scrapling-fallback-fetcher` | **Date**: 2026-03-19 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/017-scrapling-fallback-fetcher/spec.md`

## Summary

Integrate Scrapling as an optional fallback fetcher in the harvest pipeline for court websites with anti-bot protection (e.g., Cloudflare Turnstile) or heavy JavaScript rendering. The existing `fetchPage()` remains the default. A new `getPageContent()` dispatch layer routes fetches based on per-court `fetchMethod` configuration (`http`, `scrapling`, or `auto`). Scrapling is a Python CLI tool invoked via `child_process.spawn` — no new Node.js dependencies. The integration includes bug fixes to existing wrapper files, an availability guard, a domain allowlist, retry-once semantics, per-domain rate limiting, and full observability logging.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js; Python 3.10+ for Scrapling CLI  
**Primary Dependencies**: Existing — `node:child_process` (spawn), Zod (validation), Cheerio + Turndown (standard fetcher). New — Scrapling Python package (external CLI, not a Node.js dep)  
**Storage**: PostgreSQL with Prisma ORM (no schema changes for this feature)  
**Testing**: Manual validation via `--dry-run` harvest runs; `npx tsc --noEmit` for type checking  
**Target Platform**: macOS (development), Linux (Vercel deployment)  
**Project Type**: Single project — scripts/harvest/ pipeline extension  
**Performance Goals**: Standard fetcher unchanged (~1-2s/page). Stealth fetcher ≤30s/page. Per-domain delay configurable (default 2-5s).  
**Constraints**: Zero regression for FL, CA, TX, SC. Scrapling optional — pipeline must work without it. Domain allowlist enforced.  
**Scale/Scope**: ~7 files modified/created in scripts/harvest/. NY has ~15 court roster URLs. Feature adds two new fetch method enum values (`scrapling`, `auto`) to court config schema.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Accuracy & Source Attribution | **PASS** | Stealth fetcher retrieves from the same government court websites. Source URLs are preserved. No change to verification workflow. |
| II. SEO-First Architecture | **N/A** | No public-facing pages affected. This is a backend pipeline change only. |
| III. Legal Safety & Neutrality | **PASS** | FR-009 + FR-015 enforce public-court-only access via domain allowlist. No authentication bypass. |
| IV. State-by-State Expansion & Phased Delivery | **PASS** | This feature enables NY expansion. Quality gates (Zod validation, deduplication) remain unchanged downstream. |
| V. Simplicity & Incremental Discipline | **PASS** | No new Node.js dependencies. Scrapling is an external CLI tool. Hybrid pattern keeps standard path unchanged. fetchMethod enum extends existing schema field. |
| VI. Accessibility & WCAG Compliance | **N/A** | No UI changes. |
| VII. Data Pipeline Integrity & Cost Discipline | **PASS** | Pipeline stage order unchanged (fetch is the 2nd stage). Deterministic-first extraction unaffected. Zod validation still gates all output. Only the fetch mechanism for specific courts changes. |

**Gate result: PASS** — No violations. Proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/017-scrapling-fallback-fetcher/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
scripts/harvest/
├── scrapling-fetcher.ts       # MODIFY — fix bugs, add availability guard, add allowlist check
├── hybrid-fetcher.ts          # MODIFY — fix types, add domain configs, add getPageContent() dispatcher
├── fetcher.ts                 # READ ONLY — existing fetchPage(), FetchResult type (no changes)
├── index.ts                   # MODIFY — replace direct fetchPage() calls with getPageContent()
├── bio-enricher.ts            # MODIFY — replace fetchPage() with getPageContent() for bio pages
├── state-config-schema.ts     # MODIFY — extend fetchMethod enum with 'scrapling' and 'auto' values
├── config.ts                  # READ ONLY — CourtUrlEntry type derives from schema
└── legacy/
    └── new-york-courts.json   # MODIFY — update fetchMethod from 'browser' to 'scrapling'
```

**Structure Decision**: All changes are within the existing `scripts/harvest/` directory. No new directories or architectural patterns introduced. The `getPageContent()` dispatcher is added to `hybrid-fetcher.ts` as a new export alongside the existing `hybridFetch()`.

## Complexity Tracking

No constitution violations to justify — all gates passed.

## Constitution Re-Check (Post-Design)

*Re-evaluated after Phase 1 design artifacts were produced.*

| Principle | Status | Post-Design Notes |
|-----------|--------|-------------------|
| I. Data Accuracy & Source Attribution | **PASS** | Source URLs preserved through `getPageContent()`. Scrapling fetches from same government URLs. |
| II. SEO-First Architecture | **N/A** | No public-facing changes. |
| III. Legal Safety & Neutrality | **PASS** | Domain allowlist enforces FR-009/FR-015. Initial allowlist: `nycourts.gov`, `iapps.courts.state.ny.us` — both public government sites. |
| IV. State-by-State Expansion | **PASS** | Enables NY expansion. Existing quality gates (Zod validation, dedup) untouched. |
| V. Simplicity & Incremental Discipline | **PASS** | No new Node.js deps. 2 enum values added to schema. `getPageContent()` is a thin dispatcher. |
| VI. Accessibility & WCAG | **N/A** | No UI changes. |
| VII. Data Pipeline Integrity | **PASS** | Pipeline stage order preserved. Zod validation still gates extraction. Deterministic extraction preference unchanged. |

**Post-design gate: PASS** — No new violations surfaced during design.
