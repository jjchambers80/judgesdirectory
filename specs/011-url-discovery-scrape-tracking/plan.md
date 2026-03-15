# Implementation Plan: URL Discovery & Scrape Failure Tracking

**Branch**: `011-url-discovery-scrape-tracking` | **Date**: 2026-03-15 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/011-url-discovery-scrape-tracking/spec.md`

## Summary

Build a semi-automated URL discovery pipeline using Google Custom Search JSON API to find court roster pages for new states, store candidates in the database with AI-scored confidence, and track all scrape failures (403s, bot blocks, timeouts, CAPTCHAs, empty pages, SSL errors, DNS failures) during harvest runs. Includes CLI commands for discovery runs and admin UI pages for candidate review/approve/reject and failure management workflows. Integrates non-destructively with the existing harvest pipeline.

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js 20+  
**Primary Dependencies**: Next.js (SSR), Prisma ORM, Google Custom Search JSON API (direct HTTP via native `fetch`), OpenAI gpt-4o-mini (for classification), Zod (validation), cheerio/turndown (existing fetcher)  
**Storage**: PostgreSQL via Prisma ORM (existing `judgesdirectory` database)  
**Testing**: Manual CLI verification + admin UI testing (project does not have an automated test framework yet)  
**Target Platform**: macOS local dev, Vercel production deployment  
**Project Type**: Web application (Next.js monolith with CLI scripts)  
**Performance Goals**: Discovery command completes a full state in <5 minutes; failure recording adds <50ms overhead per harvest URL  
**Constraints**: Google CSE free tier (100 queries/day); 2-second minimum delay between court website requests; admin pages behind Basic Auth  
**Scale/Scope**: 50 US states × ~3 court levels each = ~150 discovery queries per full scan; failure table grows ~1 record per failed URL per harvest run

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                      | Status   | Notes                                                                                                                                                                        |
| ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Data Accuracy & Source Attribution          | **PASS** | Discovery stores source URLs and search queries. Candidates require human review before entering harvest pipeline. No data enters production without verification.           |
| II. SEO-First Architecture                     | **PASS** | No public-facing pages affected. Admin-only feature.                                                                                                                         |
| III. Legal Safety & Neutrality                 | **PASS** | Only government court roster pages are targeted. No judicial scoring or commentary.                                                                                          |
| IV. State-by-State Expansion & Phased Delivery | **PASS** | This feature directly enables the state expansion quality gate: "Court structure is seeded and URL configuration is curated." Discovery automates the curation step.         |
| V. Simplicity & Incremental Discipline         | **PASS** | Minimal new dependencies (googleapis SDK). Builds on existing patterns (admin pages, Prisma models, CLI scripts). No over-engineering.                                       |
| VI. Accessibility & WCAG Compliance            | **PASS** | New admin pages will follow existing admin patterns (semantic HTML, form labels, keyboard navigation, WCAG 2.1 AA contrast).                                                 |
| VII. Data Pipeline Integrity & Cost Discipline | **PASS** | Uses gpt-4o-mini (cheapest model) for classification. Failure tracking is non-blocking. Discovery runs are advisory-locked to prevent waste. Throttling enforces politeness. |

**Gate result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/011-url-discovery-scrape-tracking/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # REST API contract for admin endpoints
└── tasks.md             # Phase 2 output (speckit.tasks command)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma              # + UrlCandidate, ScrapeFailure, DiscoveryRun models
└── migrations/
    └── 2026MMDD_url_discovery/ # New migration

scripts/
├── harvest/
│   ├── fetcher.ts             # Modified: wrap errors with failure classification
│   ├── failure-tracker.ts     # NEW: failure recording + resolution + purge logic
│   ├── state-config-schema.ts # Modified: fetchDelayMs default 1500→2000
│   └── index.ts               # Modified: integrate failure tracker into pipeline
└── discovery/
    ├── discover.ts            # NEW: CLI entry point for URL discovery
    ├── search-client.ts       # NEW: Google CSE API wrapper
    ├── classifier.ts          # NEW: LLM-based URL classification
    ├── candidate-store.ts     # NEW: DB operations for URL candidates
    └── config-promoter.ts     # NEW: Generate state config from approved candidates

src/app/admin/
├── layout.tsx                 # Modified: add Discovery + Failures nav links
├── page.tsx                   # Modified: add Dashboard cards
├── discovery/
│   └── page.tsx               # NEW: URL candidate review page
└── failures/
    └── page.tsx               # NEW: Scrape failures management page

src/app/api/admin/
├── discovery/
│   ├── route.ts               # NEW: GET candidates list
│   ├── [id]/route.ts          # NEW: PATCH approve/reject single candidate
│   └── bulk/route.ts          # NEW: PATCH bulk approve/reject
├── discovery/promote/
│   └── route.ts               # NEW: POST promote approved to config
└── failures/
    ├── route.ts               # NEW: GET failures list
    └── [id]/route.ts          # NEW: PATCH mark resolved
```

**Structure Decision**: Follows existing project conventions — Prisma models in schema.prisma, CLI scripts in `scripts/`, admin pages under `src/app/admin/`, API routes under `src/app/api/admin/`. Discovery scripts get their own `scripts/discovery/` directory since they are a distinct CLI workflow from harvesting.

## Complexity Tracking

No constitution violations — no complexity justification needed.

## Post-Design Constitution Re-Check

_Re-evaluation after Phase 1 design artifacts are complete._

| Principle                              | Status   | Post-Design Notes                                                                                                                               |
| -------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| I. Data Accuracy & Source Attribution  | **PASS** | UrlCandidate stores `searchQuery`, `snippetText`, `pageTitle` — full provenance. Human review gate before promotion.                            |
| II. SEO-First Architecture             | **PASS** | No public-facing routes added. Admin-only pages and CLI.                                                                                        |
| III. Legal Safety & Neutrality         | **PASS** | Only government roster pages targeted. No judicial commentary.                                                                                  |
| IV. State-by-State Expansion           | **PASS** | Discovery automates the "URL config curated" quality gate. Config promotion generates validated StateConfig JSON.                               |
| V. Simplicity & Incremental Discipline | **PASS** | Zero new npm deps (direct HTTP to Google CSE). Reuses gpt-4o-mini, existing admin patterns, existing fetcher. Staleness computed at query time. |
| VI. Accessibility & WCAG               | **PASS** | Admin pages follow existing patterns: semantic HTML, labeled controls, keyboard navigation.                                                     |
| VII. Data Pipeline Integrity           | **PASS** | Failure tracking non-blocking. Cheapest model. 2s throttle default.                                                                             |

**Gate result**: ALL PASS post-design.
