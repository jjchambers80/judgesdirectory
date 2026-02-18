# Tasks: Florida Judge Data Harvest (AI-Assisted)

**Input**: Design documents from `/specs/004-florida-judge-harvest/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/cli-contract.md ✅, quickstart.md ✅

**Tests**: Not requested in the feature specification. No test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and create project directory structure

- [ ] T001 Install npm dependencies: `@anthropic-ai/sdk`, `zod`, `cheerio`, `turndown`, and `@types/turndown` (dev)
- [ ] T002 Create `scripts/harvest/` directory structure and add `scripts/harvest/output/` to `.gitignore`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared configuration, types, and utilities that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T003 Create `scripts/harvest/config.ts` — parse CLI flags (`--resume`, `--reset`, `--seed-courts-only`, `--dry-run`, `--output-dir`), validate env vars (`ANTHROPIC_API_KEY`, `DATABASE_URL`), resolve output directory, export shared TypeScript interfaces (`FloridaCourtsConfig`, `Checkpoint`, `CliFlags`, `JudgeRecord`)
- [ ] T004 [P] Create `scripts/harvest/florida-courts.json` — complete curated URL configuration with Supreme Court (1 URL), 6 District Courts of Appeal (URLs + circuit-to-county mappings), and 20 Circuit Courts (URLs + county lists for all 67 Florida counties)
- [ ] T005 [P] Create `scripts/harvest/normalizer.ts` — `normalizeJudgeName()` (strip "Hon."/"Judge"/"Justice"/"Chief" prefixes, handle "Last, First" → "First Last", preserve suffixes Jr./Sr./III), `canonicalizeCourtType()` (map variations like "Circuit Ct." to canonical "Circuit Court"), and re-export `normalizeCountyName()` from `src/lib/csv.ts`

**Checkpoint**: Foundation ready — user story implementation can now begin

---

## Phase 3: User Story 2 — Bulk Court Seeding for Florida (Priority: P1)

**Goal**: Seed Florida's court structure (Supreme Court, 6 DCAs, 20 Circuit Courts, 67 County Courts) into the database so courts exist before judge import

**Independent Test**: Run `npx ts-node scripts/harvest/index.ts --seed-courts-only`. Verify all 67 counties have Circuit Court and County Court records, DCAs are associated with correct counties, and the Supreme Court is created as a statewide court. Confirm in admin panel at `/admin/courts/`.

### Implementation for User Story 2

- [ ] T006 [US2] Create `scripts/harvest/court-seeder.ts` — read `florida-courts.json`, use Prisma client to seed: 1 Supreme Court (Leon County), 6 District Courts of Appeal (one per DCA, associated to all counties in their district), 20 Circuit Courts (one per circuit, associated to all counties in the circuit), and 67 County Courts (one per county). Skip courts that already exist. Log created vs skipped counts.
- [ ] T007 [US2] Create initial `scripts/harvest/index.ts` — CLI entry point that imports `config.ts` for flag parsing, routes `--seed-courts-only` to `court-seeder.ts`, and exits. Include basic console logging for start/complete messages.

**Checkpoint**: Florida court structure seeded — admin panel shows courts for all 67 counties

---

## Phase 4: User Story 1 — AI-Assisted Extraction of Florida Judge Rosters (Priority: P1) 🎯 MVP

**Goal**: Fetch Florida court web pages, extract judge data via Anthropic Claude, and produce a timestamped CSV file importable through the existing `/admin/import/` pipeline

**Independent Test**: Run the extraction script targeting all Florida court URLs. Verify the output CSV contains judge names in "First Last" format, correct court types, valid county names, and source URLs. Spot-check 10-20 entries against their source pages. Import the CSV via the admin panel and confirm records appear in the verification queue.

### Implementation for User Story 1

- [ ] T008 [P] [US1] Create `scripts/harvest/fetcher.ts` — `fetchPage(url: string)` with native Node `fetch`, 1-second minimum delay between requests (FR-009), 3 retries with linear backoff on failure, `User-Agent: JudgesDirectory/1.0` header. Include `cleanHtml(html: string)` that uses `cheerio` to strip `<script>`, `<style>`, `<nav>`, `<footer>`, `<header>` tags, then `turndown` to convert remaining HTML to Markdown for token reduction. Return `{ markdown: string, htmlSize: number, markdownSize: number }`.
- [ ] T009 [P] [US1] Create `scripts/harvest/checkpoint.ts` — `loadCheckpoint(outputDir)`, `saveCheckpoint(outputDir, data)`, `resetCheckpoint(outputDir)`. Use atomic writes via `.tmp` file + `fs.renameSync`. Checkpoint stores: `startedAt`, `lastUpdated`, `completedUrls[]`, per-URL results (`judgesFound`, `errors`), `totalJudges` count. File location: `{outputDir}/checkpoints/harvest-checkpoint.json`.
- [ ] T010 [US1] Create `scripts/harvest/extractor.ts` — initialize Anthropic client from `ANTHROPIC_API_KEY`, define Zod schemas (`JudgeRecord`, `ExtractionResult` per contracts/cli-contract.md), implement `extractJudges(markdown: string, courtConfig: object)` using `messages.parse()` with `claude-sonnet-4-5-20250929` model and structured output. System prompt instructs "First Last" normalization, no fabrication, null for uncertain fields. Return typed `ExtractionResult`.
- [ ] T011 [US1] Add CSV writing to `scripts/harvest/index.ts` — after extraction loop completes, use `papaparse.unparse()` to write all collected judge records to `{outputDir}/florida-judges-{timestamp}.csv` with columns: `Judge Name`, `Court Type`, `County`, `State` (always "FL"), `Source URL`, `Selection Method`. Timestamp format: `YYYY-MM-DDTHH-MM-SS`.
- [ ] T012 [US1] Implement full extraction pipeline in `scripts/harvest/index.ts` — for each URL in `florida-courts.json`: load/check checkpoint → skip if already completed → `fetchPage()` → `extractJudges()` → `normalizeJudgeName()` + `canonicalizeCourtType()` on each result → expand multi-county circuits (one record per county for circuit/county judges) → save checkpoint → after all URLs complete, write CSV. Handle interruption gracefully (checkpoint saved on each URL completion).
- [ ] T013 [US1] Add `--dry-run`, `--resume`, `--reset`, and `--output-dir` flag handling in `scripts/harvest/index.ts` — `--dry-run`: fetch and clean HTML but skip Claude API calls (log HTML sizes); `--resume` (default): load checkpoint and skip completed URLs; `--reset`: delete checkpoint before starting; `--output-dir`: override default `scripts/harvest/output` path.

**Checkpoint**: Extraction pipeline produces a valid CSV with 500+ Florida judges — importable via admin panel

---

## Phase 5: User Story 3 — Extraction Quality Report & Deduplication (Priority: P2)

**Goal**: Deduplicate judge records across overlapping court pages and generate a Markdown quality report for admin review before import

**Independent Test**: Run extraction on overlapping Florida court pages (e.g., a circuit page and county pages within that circuit). Verify the quality report flags duplicate names with both source URLs, the deduplicated CSV has no repeated judge-court-county combinations, and the report lists any counties with zero judges.

### Implementation for User Story 3

- [ ] T014 [P] [US3] Create `scripts/harvest/deduplicator.ts` — `deduplicateJudges(records: JudgeRecord[])` using dedup key: `lowercase(fullName) + courtType + normalizeCountyName(county)`. Return `{ unique: JudgeRecord[], duplicates: Array<{ record: JudgeRecord, duplicateOf: JudgeRecord }> }`. When duplicates found, keep the record with more populated fields; log both source URLs.
- [ ] T015 [P] [US3] Create `scripts/harvest/reporter.ts` — `generateReport(stats)` producing a Markdown quality report (per contracts/cli-contract.md format): run timestamp, pages fetched/successful/failed, total judges extracted, duplicates removed, final judge count, court type breakdown table, counties with zero judges, failed pages table. Write to `{outputDir}/florida-report-{timestamp}.md` and print summary to stdout.
- [ ] T016 [US3] Integrate deduplication and reporting into `scripts/harvest/index.ts` — after extraction loop and before CSV write: run `deduplicateJudges()` on all collected records, then write deduplicated records to CSV. After CSV write: collect pipeline statistics and call `generateReport()`. Update console output to show dedup counts.

**Checkpoint**: Extraction produces deduplicated CSV + quality report — all 3 user stories functional

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Logging, edge case handling, and end-to-end validation

- [ ] T017 [P] Add timestamped file-based logging in `scripts/harvest/index.ts` — write all console log/warn/error events to `{outputDir}/florida-harvest-{timestamp}.log` in `[ISO timestamp] LEVEL message` format (per contracts/cli-contract.md). Include robots.txt warning logging when `fetcher.ts` encounters restricted paths (log WARN but proceed per research.md Decision 7).
- [ ] T018 [P] Add `.gitignore` entry for `scripts/harvest/output/` and create a `scripts/harvest/output/.gitkeep` placeholder so the directory exists in the repo but generated files are excluded
- [ ] T019 Run `quickstart.md` end-to-end validation — execute all 4 quickstart steps (seed courts → dry run → full extraction → review & import) and verify outputs match expected behavior documented in `specs/004-florida-judge-harvest/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS all user stories**
- **US2 — Court Seeding (Phase 3)**: Depends on Foundational (T003, T004) — independent of US1, US3
- **US1 — Extraction (Phase 4)**: Depends on Foundational (T003, T004, T005) — independent of US2 for extraction, but US2 should complete first for clean end-to-end import
- **US3 — Report & Dedup (Phase 5)**: Depends on US1 (needs extraction pipeline to exist in index.ts)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 2 (P1)**: Can start after Foundational (Phase 2) — no dependencies on other stories
- **User Story 1 (P1 MVP)**: Can start after Foundational (Phase 2) — parallel with US2 (different files), but recommended after US2 since index.ts is first created in US2
- **User Story 3 (P2)**: Depends on US1 (extends the extraction pipeline in index.ts)

### Within Each User Story

- Config/types before modules that consume them
- Independent modules (fetcher, checkpoint) before orchestration (index.ts)
- Normalize before extract (normalizer used by extraction output processing)
- Dedup before report (reporter needs dedup stats)

### Parallel Opportunities

**Phase 2** — T004 and T005 can run in parallel (different files, no dependencies):
```
T003 (config.ts)
├── T004 [P] (florida-courts.json)
└── T005 [P] (normalizer.ts)
```

**Phase 4** — T008 and T009 can run in parallel (different files):
```
T008 [P] (fetcher.ts)
T009 [P] (checkpoint.ts)
  └── T010 (extractor.ts — needs config types)
      └── T011 (CSV writing in index.ts)
          └── T012 (pipeline orchestration in index.ts)
              └── T013 (CLI flag handling in index.ts)
```

**Phase 5** — T014 and T015 can run in parallel (different files):
```
T014 [P] (deduplicator.ts)
T015 [P] (reporter.ts)
  └── T016 (integration in index.ts)
```

**Phase 6** — T017 and T018 can run in parallel (different concerns):
```
T017 [P] (logging)
T018 [P] (.gitignore)
  └── T019 (end-to-end validation)
```

---

## Implementation Strategy

### MVP First (User Story 1 + User Story 2)

1. Complete Phase 1: Setup (install deps, create directories)
2. Complete Phase 2: Foundational (config, court data, normalizer)
3. Complete Phase 3: User Story 2 (court seeding — quick win, verifiable)
4. Complete Phase 4: User Story 1 (extraction pipeline — core value)
5. **STOP and VALIDATE**: Run extraction, import CSV, verify in admin panel
6. If MVP satisfactory, can ship without US3

### Incremental Delivery

1. Setup + Foundational → Config and utilities ready
2. Add User Story 2 → Seed courts → Verify in admin panel (first deliverable)
3. Add User Story 1 → Extract judges → Import CSV → Verify in verification queue (MVP!)
4. Add User Story 3 → Dedup + quality report → Cleaner data, admin confidence
5. Polish → Logging, validation → Production-ready tool

### File Creation Order

| Task | File | New/Modified |
|------|------|-------------|
| T001 | `package.json` | Modified (add deps) |
| T002 | `scripts/harvest/` | New directory |
| T003 | `scripts/harvest/config.ts` | New |
| T004 | `scripts/harvest/florida-courts.json` | New |
| T005 | `scripts/harvest/normalizer.ts` | New |
| T006 | `scripts/harvest/court-seeder.ts` | New |
| T007 | `scripts/harvest/index.ts` | New |
| T008 | `scripts/harvest/fetcher.ts` | New |
| T009 | `scripts/harvest/checkpoint.ts` | New |
| T010 | `scripts/harvest/extractor.ts` | New |
| T011 | `scripts/harvest/index.ts` | Modified |
| T012 | `scripts/harvest/index.ts` | Modified |
| T013 | `scripts/harvest/index.ts` | Modified |
| T014 | `scripts/harvest/deduplicator.ts` | New |
| T015 | `scripts/harvest/reporter.ts` | New |
| T016 | `scripts/harvest/index.ts` | Modified |
| T017 | `scripts/harvest/index.ts` | Modified |
| T018 | `.gitignore` | Modified |
| T019 | — (validation) | — |

---

## Notes

- All 10 source files from plan.md are covered: `index.ts`, `config.ts`, `fetcher.ts`, `extractor.ts`, `normalizer.ts`, `deduplicator.ts`, `reporter.ts`, `checkpoint.ts`, `court-seeder.ts`, `florida-courts.json`
- No database schema changes — all judge data flows through existing CSV import pipeline
- `index.ts` is created in US2 (T007) and progressively extended in US1 (T011-T013) and US3 (T016)
- `florida-courts.json` requires research for accurate URLs — some circuit court websites may need verification during implementation
- Estimated API cost: ~$3-5 for full Florida extraction (~28 pages × $0.05-0.15 per page)
- The `--dry-run` flag (T013) enables testing the fetch+clean pipeline without spending API credits
