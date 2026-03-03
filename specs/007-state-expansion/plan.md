# Implementation Plan: State Expansion — Multi-State Harvesting Infrastructure

**Branch**: `007-state-expansion` | **Date**: 2026-03-01 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/007-state-expansion/spec.md`

## Summary

Generalize the Florida-specific harvesting pipeline into a state-agnostic system that supports multiple states via JSON configuration files. Add multi-state CLI orchestration (`--state`, `--all`, `--list`), per-state checkpoints and output directories, separate extraction prompt files, per-state rate limits, and fail-forward multi-state runs. Create configuration files and extraction prompts for Texas (appellate + district), California (Supreme Court + Courts of Appeal + 58 Superior Courts), and New York (Court of Appeals + Appellate Division + Supreme Court + County/Family/Surrogate's Courts).

## Technical Context

**Language/Version**: TypeScript (strict mode), Node.js 20+  
**Primary Dependencies**: Zod (schema validation), Cheerio + Turndown (HTML→Markdown), PapaParse (CSV), Prisma (ORM), multi-provider LLM abstraction (OpenAI/Anthropic)  
**Storage**: PostgreSQL via Prisma ORM (State→County→Court→Judge hierarchy); JSON config files on disk; CSV output files  
**Testing**: Manual verification + quality reports (no automated test framework currently in harvester)  
**Target Platform**: macOS/Linux CLI (Node.js runtime)  
**Project Type**: Single project — CLI tool within existing monorepo  
**Performance Goals**: Process all configured states in a single `--all` invocation; per-state rate limits configurable  
**Constraints**: LLM API cost minimization (deterministic extraction first); polite rate limiting per state website; checkpoint/resume for long runs  
**Scale/Scope**: 4 states (FL + 3 new), ~4,800+ judge records total; ~30 court config URLs per state average

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Principle I — Data Accuracy & Source Attribution ✅ PASS

- All new state data originates from official state judiciary websites (public government records).
- Source URLs are tracked per-record via `rosterUrl` and `bioPageUrl` fields.
- Records remain `UNVERIFIED` until manual/automated verification — no change to verification workflow.

### Principle II — SEO-First Architecture ✅ PASS (no impact)

- This feature affects only the harvesting pipeline (CLI tool), not public-facing pages.
- No URL structure, SSR, or sitemap changes. Harvested data enters the existing import pipeline.

### Principle III — Legal Safety & Neutrality ✅ PASS

- Only publicly available court rosters are scraped. No private data.
- Neutral, factual extraction — no editorial commentary added.

### Principle IV — State-by-State Expansion & Phased Delivery ✅ PASS (directly implements)

- This IS Phase 5 of the roadmap. Quality gates per state:
  1. Court structure seeded and URL configuration curated ← FR-007, FR-012/13/14
  2. Pipeline produces Zod-validated records ← FR-001, FR-002 (schema validation)
  3. Identity resolution and dedup stable ← existing deduplicator preserved
  4. Verification throughput sufficient ← out of scope (manual verification unchanged)
  5. Coverage sufficient ← FR-009 quality reports measure this

### Principle V — Simplicity & Incremental Discipline ✅ PASS

- Minimal new code: refactors existing modules rather than adding services.
- No new dependencies. The state-agnostic config is the simplest approach.
- JP courts excluded from Texas initial harvest (scope control).

### Principle VI — Accessibility & WCAG Compliance ✅ PASS (no UI changes)

- This feature is CLI-only. No public-facing UI changes.

### Principle VII — Data Pipeline Integrity & Cost Discipline ✅ PASS

- Preserves established pipeline order: seed → fetch → extract → enrich → normalize → deduplicate → output.
- Deterministic extraction preferred (existing behavior preserved).
- Zod validation on all extraction results (existing + extended schemas).
- Per-state checkpoints and quality reports.
- Cheapest model remains default.

### Infrastructure Rules ✅ PASS

- State configs stored as versioned JSON files in `scripts/harvest/` (per constitution).
- No schema migrations needed — existing State→County→Court→Judge model sufficient.
- No env vars committed.

**Gate Result: ALL PASS — no violations. Proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/007-state-expansion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── cli-contract.md  # Updated CLI contract with --state/--all/--list
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
scripts/harvest/
├── index.ts                         # Refactored: state-aware orchestrator
├── config.ts                        # Refactored: generic StateConfig + loader
├── state-config-schema.ts           # NEW: Zod schema for state JSON validation
├── court-seeder.ts                  # Refactored: generic state court seeder
├── normalizer.ts                    # Extended: per-state court type mappings
├── extractor.ts                     # Extended: load prompt from file path
├── checkpoint.ts                    # Refactored: per-state checkpoint paths
├── reporter.ts                      # Extended: combined summary report
├── fetcher.ts                       # Extended: per-state rate limit config
├── florida-courts.json              # Migrated: nested → flat courts[] format
├── texas-courts.json                # NEW: Texas court hierarchy
├── california-courts.json           # NEW: California court hierarchy
├── new-york-courts.json             # NEW: New York court hierarchy
├── prompts/                         # NEW directory
│   ├── generic-extraction.txt       # Extracted from current inline prompts
│   ├── texas-extraction-prompt.txt  # NEW: Texas-specific extraction prompt
│   ├── california-extraction-prompt.txt  # NEW
│   └── new-york-extraction-prompt.txt    # NEW
└── output/
    ├── florida/                     # Per-state output (migrated from flat)
    ├── texas/
    ├── california/
    └── new-york/
```

**Structure Decision**: Single project, extending the existing `scripts/harvest/` CLI tool. No new top-level directories. State configs and prompt files live alongside the existing `florida-courts.json`. Output is reorganized into per-state subdirectories.

## Complexity Tracking

> No constitution violations — this section is not needed.

## Post-Design Constitution Re-Check

_Re-evaluated after Phase 1 design (data-model.md, contracts/, quickstart.md)._

All 7 principles + infrastructure rules: **PASS — no new violations introduced.**

Notable design decisions validated:

- Flat `courts[]` schema is simpler than nested (Principle V ✅)
- `deterministic` flag reinforces deterministic-first extraction (Principle VII ✅)
- Zod validation at config load satisfies schema validation requirement (Principle VII ✅)
- Per-state quality reports produced (Principle VII ✅)
- `fetchMethod: "browser"` defined in schema but browser scraping is out of scope — entries skipped with warning
- No new dependencies added (Principle V ✅)
- No database schema changes needed (Infrastructure Rules ✅)
