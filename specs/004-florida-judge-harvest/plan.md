# Implementation Plan: Florida Judge Data Harvest (AI-Assisted)

**Branch**: `004-florida-judge-harvest` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/004-florida-judge-harvest/spec.md`

## Summary

Build a CLI extraction tool that fetches Florida judicial branch web pages from a curated URL list, uses Anthropic Claude to parse unstructured HTML into structured judge records, and produces import-ready CSV files. The tool seeds Florida's court structure (Supreme Court, District Court of Appeal, Circuit Court, County Court) and generates a quality report with deduplication. Output CSVs feed directly into the existing Phase 2 admin import pipeline — no database schema changes required.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.18.0
**Primary Dependencies**: Next.js 14.2.35 (existing app), Anthropic SDK (new — Claude API), Prisma 6.19.2, papaparse 5.5.3
**Storage**: PostgreSQL via Prisma ORM (existing — courts and judges imported via CSV pipeline); file system for CSV output, logs, and checkpoints
**Testing**: Manual verification against source URLs (per spec SC-002); existing import pipeline handles validation
**Target Platform**: macOS/Linux CLI (admin's local machine)
**Project Type**: CLI tool within existing Next.js monorepo
**Performance Goals**: Full Florida extraction + import in <15 minutes (SC-004); ~100-200 Claude API calls
**Constraints**: 1-second minimum delay between web requests (FR-009); Anthropic API rate limits; Florida Courts website availability
**Scale/Scope**: ~950-1,000 Florida judges across 67 counties, 20 circuits, 6 DCA districts, 1 Supreme Court

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Accuracy & Source Attribution | **PASS** | FR-004 requires source URL for every record. All judges enter as UNVERIFIED — manual verification workflow from Phase 2 applies. |
| II. SEO-First Architecture | **N/A** | This feature is a CLI tool, not a public-facing page. No routing/URL/rendering changes. |
| III. Legal Safety & Neutrality | **PASS** | Extracts only publicly available government records. No editorial content, ratings, or opinions generated. |
| IV. Progressive Launch & Phased Delivery | **PASS with justification** | This is a Data Ingestion phase tool (Phase 2 continuation). Semi-automated CSV *preparation* — import still uses the existing manual pipeline. "Automated ingestion" (post-MVP per constitution) refers to server-side scheduled pipelines, not admin-run CLI tools. |
| V. Simplicity & MVP Discipline | **PASS with justification** | Adds 4 new dependencies (Anthropic SDK, Zod, Cheerio, Turndown — all justified in research.md). CLI tool is the simplest approach to bulk data preparation. No new services, no server-side automation, no user-facing features added. See Complexity Tracking. |
| VI. Accessibility & WCAG Compliance | **N/A** | CLI tool — no UI/public-facing pages affected. |

**Gate result: PASS** — No violations. Two principles require justification (documented above); both are within constitution bounds.

**Post-design re-evaluation (Phase 1 complete)**: No new violations introduced. Source URL is required in Zod schema and CSV output. Claude prompt explicitly prohibits data fabrication. All 4 new dependencies justified. No database schema changes, no new API routes, no UI changes.

## Project Structure

### Documentation (this feature)

```text
specs/004-florida-judge-harvest/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
scripts/
└── harvest/
    ├── index.ts             # CLI entry point — orchestrates extraction
    ├── config.ts            # Curated URL list + environment config
    ├── fetcher.ts           # HTTP fetching with rate limiting + retries
    ├── extractor.ts         # Anthropic Claude prompt + response parsing
    ├── normalizer.ts        # Name normalization, court type canonicalization
    ├── deduplicator.ts      # Cross-page deduplication logic
    ├── reporter.ts          # Quality report generation
    ├── checkpoint.ts        # Resumable execution — save/load progress
    ├── court-seeder.ts      # Florida court structure seeding via Prisma
    ├── florida-courts.json  # Static config: circuit→county mappings, DCA districts
    └── output/              # Generated CSV files + logs (gitignored)
        ├── *.csv
        ├── *.log
        └── checkpoints/

src/                         # Existing app (unchanged)
├── app/
├── components/
└── lib/
    └── csv.ts               # Existing — normalizeCountyName() reused by harvest
```

**Structure Decision**: Standalone `scripts/harvest/` directory at repo root. This is a CLI tool that shares the Prisma client and `src/lib/csv.ts` utilities with the main app but runs independently via `ts-node`. Keeps harvest logic cleanly separated from the Next.js application code while sharing the database connection and county normalization logic.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| New dependency: `@anthropic-ai/sdk` | Claude API access for HTML→structured data extraction (FR-002) | Manual copy-paste from websites is the only alternative — defeats the purpose of the feature. The SDK is a single, well-maintained package with no transitive bloat. |
