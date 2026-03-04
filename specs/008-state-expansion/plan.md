# Implementation Plan: State Expansion — Texas, California & New York Judge Harvesting

**Branch**: `008-state-expansion` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/008-state-expansion/spec.md`

## Summary

Extend the existing multi-state harvesting infrastructure (built in 007) to execute and validate judge harvesting for Texas, California, and New York. The CLI (`--state`, `--all`, `--list`), state configs, extraction prompts, and per-state output/checkpoint isolation are already implemented. This plan covers the remaining gaps: county alias maps for name resolution (FR-025), data freshness tracking (FR-026), division/subject-matter extraction in prompts (FR-027), combined multi-state summary reports (FR-010), soft quality gate flagging (FR-024), and end-to-end execution and validation of all 3 state harvests against success criteria.

## Technical Context

**Language/Version**: TypeScript 5.x / Node.js 20.18.0 (strict mode)
**Primary Dependencies**: Zod (validation), Cheerio (deterministic extraction), OpenAI gpt-4o-mini (LLM extraction), tsx (runtime)
**Storage**: PostgreSQL 16 via Prisma ORM — existing State → County → Court → Judge hierarchy; no schema migrations needed
**Testing**: Manual spot-check (20 records per state against source URLs) + Zod schema validation + quality report review
**Target Platform**: CLI (Node.js scripts in `scripts/harvest/`)
**Project Type**: Single project — CLI pipeline extension
**Performance Goals**: Complete single-state harvest in < 30 minutes; combined `--all` run in < 2 hours for 4 states
**Constraints**: LLM API cost < $10 total for 3 new states; rate-limited to respect court website ToS (1.5s TX/CA, 3s NY)
**Scale/Scope**: TX ~200 appellate judges (initial), CA ~1,700 judges, NY ~1,000 judges → ~2,900 total new records

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                          | Status  | Notes                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Data Accuracy & Source Attribution**          | ✅ PASS | FR-022 requires source URL per record. CSV → admin import → verification queue before publication. Only VERIFIED records go public.                                                                                                                                                                                                                                                                                                                                                |
| **II. SEO-First Architecture**                     | ✅ N/A  | No frontend or URL changes. Harvested data enters existing SSR pages via import pipeline.                                                                                                                                                                                                                                                                                                                                                                                          |
| **III. Legal Safety & Neutrality**                 | ✅ PASS | Only publicly available government roster pages. No editorial content. Neutral factual extraction.                                                                                                                                                                                                                                                                                                                                                                                 |
| **IV. State-by-State Expansion & Phased Delivery** | ✅ PASS | Phase 5 in roadmap. Quality gates: court structure seeded (FR-011), Zod validation (FR-005), identity resolution + dedup (existing), soft quality gate (FR-024), admin verification queue. TX phased approach (appellate first). Gate 4 (verification throughput): ~2,900 new records enter the manual verification queue — operational cadence (~100 records/week) is an admin capacity concern, not a pipeline feature. Throughput planning deferred to post-harvest operations. |
| **V. Simplicity & Incremental Discipline**         | ✅ PASS | No new services or dependencies. Extends existing JSON config + CLI patterns. Judge.division is an existing nullable field — no schema change needed.                                                                                                                                                                                                                                                                                                                              |
| **VI. Accessibility & WCAG**                       | ✅ N/A  | No frontend UI changes in this feature.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **VII. Data Pipeline Integrity & Cost Discipline** | ✅ PASS | Deterministic-first for CA (FR-020, ~$0.14 vs $5 LLM). Checkpoint/resume per state (FR-006). Zod validation on all extraction. Quality report per state (FR-009). gpt-4o-mini as default (cheapest reliable model).                                                                                                                                                                                                                                                                |

**Gate Result**: ALL PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/008-state-expansion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── county-alias-resolver.ts    # Interface for alias resolution
│   ├── combined-report.ts          # Interface for multi-state summary
│   ├── freshness-tracker.ts        # Interface for data age tracking
│   └── quality-gate.ts             # Interface for soft quality gate
├── checklists/
│   └── requirements.md  # Quality checklist (complete)
└── tasks.md             # Phase 2 output (NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
scripts/harvest/
├── index.ts                    # CLI orchestrator (EXISTING — add combined report + freshness)
├── config.ts                   # CLI flags + state config loader (EXISTING — no changes needed)
├── state-config-schema.ts      # Zod schemas (EXISTING — add countyAliases field)
├── reporter.ts                 # Quality report generator (EXISTING — add soft gate flags + combined summary)
├── deterministic-extractor.ts  # Cheerio extraction (EXISTING — verify CA support)
├── extractor.ts                # LLM extraction (EXISTING — verify division field in output)
├── normalizer.ts               # Record normalization (EXISTING — add county alias lookup)
├── court-seeder.ts             # Court record creator (EXISTING — verify multi-state)
├── florida-courts.json         # FL config (EXISTING)
├── texas-courts.json           # TX config (EXISTING — add countyAliases)
├── california-courts.json      # CA config (EXISTING — add countyAliases)
├── new-york-courts.json        # NY config (EXISTING — add countyAliases)
├── prompts/
│   ├── texas-extraction-prompt.txt       # (EXISTING — add division instructions)
│   ├── california-extraction-prompt.txt  # (EXISTING — add division instructions)
│   ├── new-york-extraction-prompt.txt    # (EXISTING — add division instructions)
│   └── generic-extraction.txt            # (EXISTING)
└── output/
    ├── texas/          # Per-state output (created at runtime)
    ├── california/     # Per-state output (created at runtime)
    └── new-york/       # Per-state output (created at runtime)
```

**Structure Decision**: No new source files needed. All changes are modifications to existing files in `scripts/harvest/`. The 008 implementation is primarily enhancement of existing modules + end-to-end validation, not greenfield code.

## What's Already Implemented (from 007)

| Component                                | File                       | Status      |
| ---------------------------------------- | -------------------------- | ----------- |
| CLI flags (`--state`, `--all`, `--list`) | config.ts                  | ✅ Complete |
| StateConfigSchema + CourtEntrySchema     | state-config-schema.ts     | ✅ Complete |
| State config loader + validator          | config.ts                  | ✅ Complete |
| Multi-state sequential processing        | index.ts                   | ✅ Complete |
| Per-state checkpoint/output isolation    | index.ts                   | ✅ Complete |
| Texas court config (16 URLs)             | texas-courts.json          | ✅ Complete |
| California court config (8 URLs)         | california-courts.json     | ✅ Complete |
| New York court config (11 URLs)          | new-york-courts.json       | ✅ Complete |
| Florida flat-format migration            | florida-courts.json        | ✅ Complete |
| TX/CA/NY extraction prompts              | prompts/\*.txt             | ✅ Complete |
| Deterministic extractor (636 lines)      | deterministic-extractor.ts | ✅ Complete |
| Court seeder (generic)                   | court-seeder.ts            | ✅ Complete |
| Per-state quality report                 | reporter.ts                | ✅ Complete |

## What Needs Implementation (new in 008)

| Gap                                    | FR     | Scope                                                             | Complexity |
| -------------------------------------- | ------ | ----------------------------------------------------------------- | ---------- |
| County alias map in StateConfig schema | FR-025 | Add `countyAliases` to Zod schema + JSON configs                  | Low        |
| County alias resolution in normalizer  | FR-025 | Lookup alias before DB county match; warn on miss                 | Low        |
| Data freshness tracking                | FR-026 | Write harvest timestamp; check age in reporter                    | Low        |
| Division extraction in prompts         | FR-027 | Add `division` field instructions to all 3 state prompts          | Low        |
| Division field in LLM output schema    | FR-027 | Ensure extractor passes division through pipeline to CSV          | Low        |
| Combined multi-state summary report    | FR-010 | Aggregate per-state reports when `--all` completes                | Medium     |
| Soft quality gate flagging             | FR-024 | Flag accuracy concerns in reporter (missing fields, zero results) | Medium     |
| TX harvest execution + validation      | SC-002 | Run TX harvest, spot-check 20 records, verify ≥200 judges         | Medium     |
| CA harvest execution + validation      | SC-003 | Run CA harvest, spot-check 20 records, verify ≥1,500 judges       | Medium     |
| NY harvest execution + validation      | SC-004 | Run NY harvest, spot-check 20 records, verify ≥1,000 judges       | Medium     |
| Combined `--all` execution             | SC-008 | Run full multi-state harvest, verify combined summary             | Low        |
| FL backward compatibility check        | SC-009 | Verify `--state florida` output unchanged                         | Low        |

## Complexity Tracking

> No constitution violations to justify. All principles pass cleanly.
