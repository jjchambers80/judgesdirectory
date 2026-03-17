# Implementation Plan: Autonomous Harvest Pipeline

**Branch**: `015-autonomous-harvest-pipeline` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/015-autonomous-harvest-pipeline/spec.md`

## Summary

Replace the JSON-config + CSV-output + admin-import harvest pipeline with a fully database-driven architecture. The `UrlCandidate` table becomes the single source of truth for scrapeable URLs, the harvest pipeline writes judges directly to the database via Prisma upserts, and admins trigger harvests via a one-click admin UI backed by background jobs. Auto-classification filters non-judicial URLs during discovery, Vercel Cron handles annual delta re-harvests, and every run produces a persistent report stored on a `HarvestJob` record. The CSV import UI, API, scripts, and `ImportBatch` model are fully removed.

## Technical Context

**Language/Version**: TypeScript (strict mode) on Node.js  
**Primary Dependencies**: Next.js (App Router), Prisma ORM, Zod, PapaParse (removal), OpenAI/Anthropic LLM SDKs  
**Storage**: PostgreSQL via Prisma ORM  
**Testing**: Manual regression (harvest output parity), Prisma integration tests  
**Target Platform**: Vercel (production), local dev  
**Project Type**: Web application (Next.js full-stack)  
**Performance Goals**: Background harvest completes a 30-URL state in <30 min; admin polling latency <500ms  
**Constraints**: Vercel serverless function timeout (hobby: 60s, pro: 300s); harvest spawned as child process to avoid timeout; Vercel Cron max frequency = once/day  
**Scale/Scope**: 50 US states, ~100 URLs per state max, ~5000 judge records total near-term

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Accuracy & Source Attribution | ✅ PASS | FR-013 maintains UNVERIFIED status for new judges. FR-014 preserves source URLs on upsert. Direct DB writes maintain same provenance fields. |
| II. SEO-First Architecture | ✅ PASS | No changes to public-facing pages or URL structure. Admin-only feature. |
| III. Legal Safety & Neutrality | ✅ PASS | No change to public content or editorial features. |
| IV. State-by-State Expansion | ✅ PASS | DB-driven URL source simplifies state expansion — no JSON file curation needed per state. Quality gates (Zod validation, dedup, identity resolution) remain enforced in pipeline. |
| V. Simplicity & Incremental Discipline | ✅ PASS | Removes complexity (JSON configs, CSV bridge, ImportBatch). Adds necessary complexity (HarvestJob model, background execution) justified by spec scope. |
| VI. Accessibility & WCAG | ✅ PASS | Admin UI only; will follow existing admin patterns (shadcn/ui components, keyboard nav). |
| VII. Data Pipeline Integrity & Cost Discipline | ⚠️ VIOLATION | Constitution says "State harvesting configurations MUST be stored as versioned JSON files." This feature explicitly replaces JSON files with database records. See Complexity Tracking. |
| Infrastructure: JSON config rule | ⚠️ VIOLATION | "State harvesting configurations MUST be stored as versioned JSON files" in Infrastructure Rules section. This feature moves configs to DB. See Complexity Tracking. |

**Gate Result**: PASS with documented violations. Both violations are intentional — the spec explicitly requires eliminating JSON configs (FR-001). A constitution amendment is recommended but does not block implementation.

### Post-Design Re-evaluation (after Phase 1)

| Principle | Status | Phase 1 Design Impact |
|-----------|--------|-----------------------|
| I. Data Accuracy | ✅ PASS | `data-model.md`: Judge upsert preserves sourceUrl, rosterUrl, extractionMethod. New judges created as UNVERIFIED. Update path explicitly excludes status/verifiedAt from overwrite. |
| II. SEO-First | ✅ PASS | No changes to public routing or page rendering. All new routes are under `/api/admin/` and `/admin/`. |
| III. Legal Safety | ✅ PASS | No public content changes. Report markdown is admin-only. |
| IV. State-by-State Expansion | ✅ PASS | Quality gates preserved: `db-config-loader` only returns APPROVED URLs, Zod validation remains in extractor, identity resolution unchanged, dedup unchanged. New gate: `scrapeWorthy` classification filters URLs pre-harvest. |
| V. Simplicity | ✅ PASS | Net complexity reduction: removes ImportBatch model, CSV bridge, import UI (14 files deleted). Adds HarvestJob model (1 model) and 6 API routes — justified by spec scope. |
| VI. Accessibility | ✅ PASS | Admin harvest UI will use shadcn/ui components (existing pattern). No public pages affected. |
| VII. Pipeline Integrity | ✅ PASS | Stage order preserved (seed→fetch→extract→enrich→normalize→dedup→output). `data-model.md` shows output stage changes from CSV to DB upsert — same data, different sink. Deterministic-first extraction unchanged. Quality reports stored in `HarvestJob.reportMarkdown` per FR-021. |
| Infrastructure: JSON config | ⚠️ VIOLATION (intentional) | Configs move to DB. JSON files archived to `scripts/harvest/legacy/`. Constitution amendment recommended. |

**Post-Design Gate Result**: PASS. No new violations discovered. All Phase 1 design artifacts align with constitution principles. The data model, API contracts, and quickstart guide maintain pipeline integrity and data accuracy requirements.

## Project Structure

### Documentation (this feature)

```text
specs/015-autonomous-harvest-pipeline/
├── plan.md              # This file
├── spec.md              # Feature specification
├── research.md          # Phase 0: unknowns resolution
├── data-model.md        # Phase 1: schema changes
├── quickstart.md        # Phase 1: dev setup guide
├── contracts/           # Phase 1: API contracts
│   └── harvest-api.md   # All harvest + cron endpoints
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
prisma/
├── schema.prisma                          # UrlCandidate extensions, HarvestJob model, Judge FK change, ImportBatch removal
└── migrations/                            # New migration for schema changes

scripts/
├── harvest/
│   ├── index.ts                           # MODIFY: thin CLI wrapper calling runner
│   ├── runner.ts                          # NEW: extracted pipeline logic, accepts --job-id
│   ├── db-config-loader.ts                # NEW: load URLs from UrlCandidate table
│   ├── db-writer.ts                       # NEW: Prisma upsert for judges (replaces CSV output)
│   ├── config.ts                          # MODIFY: update types for DB-driven config
│   ├── reporter.ts                        # MODIFY: return structured data + markdown
│   ├── legacy/                            # NEW: archived JSON configs
│   │   ├── florida-courts.json
│   │   ├── california-courts.json
│   │   ├── texas-courts.json
│   │   └── new-york-courts.json
│   └── [existing: fetcher, extractor, enrichers, deduplicator, checkpoint...]
├── discovery/
│   ├── classifier.ts                      # MODIFY: set scrapeWorthy based on confidence
│   ├── candidate-store.ts                 # MODIFY: persist scrapeWorthy + autoClassifiedAt
│   └── config-promoter.ts                 # MODIFY: remove JSON write, DB status update only
└── import/                                # DELETE: entire directory

src/
├── app/
│   ├── admin/
│   │   ├── harvest/
│   │   │   └── page.tsx                   # NEW: harvest trigger UI + job history + reports
│   │   ├── import/                        # DELETE: entire directory
│   │   ├── dashboard/page.tsx             # MODIFY: swap ImportBatch stats for HarvestJob stats
│   │   ├── discovery/page.tsx             # MODIFY: add scrapeWorthy badges/filters/override
│   │   ├── verification/page.tsx          # MODIFY: swap batchId→harvestJobId filter
│   │   └── layout.tsx                     # MODIFY: remove import link, add harvest link
│   └── api/
│       ├── admin/
│       │   ├── harvest/
│       │   │   ├── route.ts               # NEW: POST (trigger) + GET (list jobs)
│       │   │   └── [jobId]/
│       │   │       └── route.ts           # NEW: GET job status/report
│       │   ├── import/                    # DELETE: entire directory
│       │   └── discovery/
│       │       ├── [id]/route.ts          # MODIFY: accept scrapeWorthy in PATCH
│       │       └── promote/route.ts       # MODIFY: remove JSON write
│       └── cron/
│           └── harvest/
│               └── route.ts               # NEW: Vercel Cron annual trigger
├── components/
│   └── admin/
│       ├── CsvUploader.tsx                # DELETE
│       ├── ColumnMapper.tsx               # DELETE
│       ├── ImportSummary.tsx              # DELETE
│       └── VerificationQueue.tsx          # MODIFY: swap batchId→harvestJobId
└── lib/
    ├── csv.ts                             # DELETE
    └── import-lock.ts                     # DELETE

vercel.json                                # MODIFY: add cron schedule
```

**Structure Decision**: Existing Next.js monorepo structure. Harvest scripts remain in `scripts/harvest/` (CLI + importable runner). New API routes follow existing admin pattern under `src/app/api/admin/`. New admin pages follow existing pattern under `src/app/admin/`. No new project directories or architectural layers.

## Complexity Tracking

> Constitution Check identified 2 violations requiring justification:

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Removing JSON config files (Infrastructure Rules) | FR-001 requires DB-driven URL source. JSON files create a manual bottleneck: every new state requires file creation, every new URL requires manual JSON edits and promotion scripts. DB records enable immediate eligibility after admin approval. | Keeping JSON as secondary source adds sync complexity without value — the DB is already the canonical source via discovery/approval workflow. JSON configs archived in `legacy/` for reference. |
| Overriding "versioned JSON files" mandate (Infrastructure Rules) | The URL candidate database table provides superior versioning: each record has `discoveredAt`, `reviewedAt`, `promotedAt` timestamps plus full audit trail via `DiscoveryRun`. Git-versioned JSON provided no rollback capability that the DB doesn't already have. | Dual-writing to both JSON and DB doubles maintenance without adding safety. Constitution amendment to update Infrastructure Rules section is recommended as follow-up. |
