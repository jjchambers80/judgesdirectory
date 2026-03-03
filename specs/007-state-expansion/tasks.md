# Tasks: State Expansion — Multi-State Harvesting Infrastructure

**Input**: Design documents from `/specs/007-state-expansion/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/cli-contract.md, quickstart.md

**Tests**: No automated test framework exists in the harvester. Tests are manual verification via dry-run and quality reports. No test tasks generated.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks within the phase)
- **[Story]**: Which user story this task belongs to (US1–US5)
- All file paths are relative to repository root

## Path Conventions

- **Harvester source**: `scripts/harvest/`
- **State configs**: `scripts/harvest/{state-slug}-courts.json`
- **Extraction prompts**: `scripts/harvest/prompts/{name}.txt`
- **Per-state output**: `scripts/harvest/output/{state-slug}/`
- **Spec documents**: `specs/007-state-expansion/`

---

## Phase 1: Setup

**Purpose**: Create directory structure and foundational schema file before any refactoring begins

- [x] T001 Create scripts/harvest/prompts/ directory and add scripts/harvest/prompts/.gitkeep placeholder file
- [x] T002 [P] Create Zod validation schemas (StateConfigSchema, CourtEntrySchema, RateLimitConfigSchema) with defaults and constraints in scripts/harvest/state-config-schema.ts per data-model.md
- [x] T003 [P] Extract inline ROSTER_SYSTEM_PROMPT from scripts/harvest/extractor.ts to scripts/harvest/prompts/generic-extraction.txt (keep original inline as temporary fallback)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Refactor all pipeline modules from Florida-specific to state-agnostic. MUST complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 [P] Migrate scripts/harvest/florida-courts.json from nested format (supremeCourt/districtCourts/circuitCourts) to flat courts[] format per data-model.md — add state, abbreviation, and level fields to each entry
- [x] T005 Refactor scripts/harvest/config.ts — remove FloridaCourtsConfig, SupremeCourtConfig, DistrictCourtConfig, CircuitCourtConfig interfaces; add StateConfig and CourtEntry types re-exported from state-config-schema.ts; implement loadStateConfig(stateName) with Zod validation and discoverStates() to scan for \*-courts.json files; remove flattenCourtUrls()
- [x] T006 [P] Refactor scripts/harvest/checkpoint.ts — update loadCheckpoint(), saveCheckpoint(), resetCheckpoint() to accept a state slug parameter and use per-state paths (output/{state-slug}/checkpoints/harvest-checkpoint.json)
- [x] T007 [P] Extend scripts/harvest/fetcher.ts — accept RateLimitConfig parameter in fetch functions for per-state fetchDelayMs, maxConcurrent, requestTimeoutMs, and maxRetries instead of hardcoded 1500ms delay
- [x] T008 [P] Extend scripts/harvest/extractor.ts — add loadExtractionPrompt(promptFilePath?) function that reads from file path with fallback to scripts/harvest/prompts/generic-extraction.txt; use loaded prompt instead of inline ROSTER_SYSTEM_PROMPT
- [x] T009 [P] Refactor scripts/harvest/court-seeder.ts — replace seedFloridaCourts() with generic seedStateCourts(config: StateConfig) that creates court records from any state's CourtEntry[] array with correct county and court type mapping
- [x] T010 [P] Extend scripts/harvest/normalizer.ts — replace hardcoded Florida court type map with per-state registry keyed by state abbreviation; add registerStateCourtTypes(abbreviation, mapping) and getCourtTypeMapping(abbreviation) functions; register Florida mappings as default

**Checkpoint**: All pipeline modules are state-agnostic. Ready for user story integration.

---

## Phase 3: User Story 1 — State-Agnostic Harvester Configuration (Priority: P1) 🎯 MVP

**Goal**: The pipeline runs from any state's JSON configuration file without code changes. An admin can onboard a new state by adding a JSON file and optional extraction prompt.

**Independent Test**: Create a minimal test state config with 2–3 court URLs. Run the harvester targeting that config with `--dry-run`. Verify it loads the config, validates with Zod, fetches pages, and produces output in the correct per-state directory — without any Florida-specific code executing.

### Implementation

- [x] T011 [US1] Wire state config loading into scripts/harvest/index.ts — replace Florida-specific config loading and flattenCourtUrls() call with loadStateConfig() → CourtEntry[] pipeline; pass state slug to checkpoint, fetcher, extractor, court-seeder, normalizer, and reporter modules
- [x] T012 [P] [US1] Update scripts/harvest/reporter.ts to accept a state slug parameter; produce per-state quality reports at output/{state-slug}/{state-slug}-quality-report-{timestamp}.txt showing extraction statistics, coverage, failures, and deduplication results per FR-009
- [x] T013 [US1] Update scripts/harvest/index.ts output routing — create per-state output directories (output/{state-slug}/, output/{state-slug}/checkpoints/) at startup; route CSV, logs, and quality reports to per-state directories; update file naming to {state-slug}-judges-enriched-{timestamp}.csv
- [x] T014 [US1] Verify Florida backward compatibility — run pipeline with scripts/harvest/florida-courts.json (migrated format); compare quality report metrics (field coverage %, extraction count, dedup count) against baseline from pre-refactor Florida run; verify identity-resolver.ts and deduplicator.ts have no Florida-specific hardcoding that would prevent correct operation on other states

**Checkpoint**: Florida works identically on the new state-agnostic pipeline. A second state config (test or Texas) can load and run.

---

## Phase 4: User Story 2 — Multi-State CLI Orchestration (Priority: P1)

**Goal**: Admin runs the CLI targeting one state (`--state`), all states (`--all`), or lists available states (`--list`). Multi-state runs are independent with per-state checkpoints and fail-forward error handling.

**Independent Test**: Configure Florida and Texas. Run `--state texas` — only Texas is harvested. Run `--all` — both states process sequentially with separate output directories. Run `--list` — both state names printed. Run with no state flag — defaults to Florida.

### Implementation

- [x] T015 [US2] Add --state, --all, --list flag parsing and mutual-exclusion validation to scripts/harvest/config.ts parseFlags() — --state takes a string argument, --all and --list are booleans; --state and --all are mutually exclusive (exit code 1 with error)
- [x] T016 [US2] Implement state selection logic in scripts/harvest/index.ts — if --list: print discoverStates() results and exit; if --state: load single config; if --all: load all configs; if none: default to florida; if --state not found: exit with error listing available states
- [x] T017 [US2] Implement sequential multi-state orchestration loop in scripts/harvest/index.ts — iterate over selected state configs, run full pipeline per state with isolated checkpoint/output, catch errors per state (save checkpoint, log failure, continue to next), track per-state success/failure results
- [x] T018 [P] [US2] Implement combined summary report generation in scripts/harvest/reporter.ts — when --all completes, write output/combined-summary-{timestamp}.txt with per-state extraction counts, success/failure status, aggregate totals, and error summaries for failed states
- [x] T019 [US2] Add error handling per CLI contract in scripts/harvest/index.ts — unknown flags (exit 1), config validation failure with Zod details (exit 1), all-states-failed (exit 1), partial failure with --all (exit 0 with summary)

**Checkpoint**: Full CLI orchestration works. `--state`, `--all`, `--list`, and default-to-Florida all function correctly. Fail-forward produces summary.

---

## Phase 5: User Story 3 — Texas Court Structure and Harvest (Priority: P2)

**Goal**: Texas court hierarchy is configured and the harvester extracts Texas judge records from official state judiciary websites. Covers Supreme Court, Court of Criminal Appeals, 14 Courts of Appeals, and District Courts (JP and County Courts excluded per research decision D7).

**Independent Test**: Run `--state texas`. Verify output CSV contains judges from at least 3 different court types with correct county assignments. Cross-reference 10 random records against txcourts.gov.

### Implementation

- [x] T020 [P] [US3] Create scripts/harvest/texas-courts.json — map Supreme Court (1 URL, statewide), Court of Criminal Appeals (1 URL, statewide), 14 Courts of Appeals (14 URLs with district numbers and multi-county assignments from txcourts.gov), and District Courts with curated roster URLs; set level enum correctly per data-model.md. Note: District court roster URLs may not all be centrally published (research D8) — document any gaps and defer to config expansion.
- [x] T021 [P] [US3] Create scripts/harvest/prompts/texas-extraction-prompt.txt — include Texas-specific HTML structure hints from txcourts.gov, court type names (Court of Criminal Appeals, Courts of Appeals with numbered districts), judicial district→county mapping guidance, and expected output field examples
- [x] T022 [US3] Add Texas court type mappings to per-state registry in scripts/harvest/normalizer.ts — register TX abbreviation with court types: Supreme Court, Court of Criminal Appeals, Court of Appeals, District Court

**Checkpoint**: Texas harvest produces judge records from multiple court types with correct county assignments.

---

## Phase 6: User Story 4 — California Court Structure and Harvest (Priority: P2)

**Goal**: California court hierarchy is configured and the harvester extracts California judge records. Central roster page at courts.ca.gov enables deterministic (Cheerio-only) extraction for Superior Courts at near-zero LLM cost per research decision D9.

**Independent Test**: Run `--state california`. Verify output includes Superior Court judges with county mappings from all 58 counties. Verify appellate judges have division information. Cross-reference 10 random records against courts.ca.gov.

### Implementation

- [x] T023 [P] [US4] Create scripts/harvest/california-courts.json — map Supreme Court (1 URL, statewide), 6 Courts of Appeal with division info (6 URLs, multi-county), 58 Superior Courts from central roster (1 URL with deterministic: true and selectorHint for table parsing, per-county entries) with curated URLs from courts.ca.gov and appellate.courts.ca.gov
- [x] T024 [P] [US4] Create scripts/harvest/prompts/california-extraction-prompt.txt — include California-specific structure hints (Drupal CMS, county-header table format for central roster, appellate division numbering), court type names, county→Superior Court mapping
- [x] T025 [US4] Add California court type mappings to per-state registry in scripts/harvest/normalizer.ts — register CA abbreviation with court types: Supreme Court, Court of Appeal, Superior Court
- [x] T026 [US4] Implement deterministic extraction flag support in scripts/harvest/extractor.ts — when CourtEntry has deterministic: true, route to Cheerio-based extraction using selectorHint CSS selector instead of LLM; parse structured HTML tables (th=county, td=judge name) directly; output same JudgeRecord shape as LLM extraction (per FR-020)

**Checkpoint**: California harvest works with mixed extraction — deterministic Cheerio for Superior Courts, LLM for appellate courts. County mappings correct across all 58 counties.

---

## Phase 7: User Story 5 — New York Court Structure and Harvest (Priority: P3)

**Goal**: New York court hierarchy is configured for the state's complex judicial system. Appellate-level courts are harvested from accessible pages. Trial court entries marked `fetchMethod: "browser"` are documented but skipped with a warning (browser scraping out of scope per spec). Per research decision D10, NY is the most complex state.

**Independent Test**: Run `--state new-york`. Verify appellate-level judges are extracted (Court of Appeals, Appellate Division). Verify browser-required entries produce skip warnings in logs. Verify NYC borough→county mapping is correct.

### Implementation

- [x] T027 [P] [US5] Create scripts/harvest/new-york-courts.json — map Court of Appeals (1 URL, statewide), 4 Appellate Division Departments (4 URLs with department numbers and multi-county assignments), Supreme Court entries per county, County Courts, Family Courts, Surrogate's Courts across 62 counties; mark Cloudflare-protected trial court pages with fetchMethod: "browser"; use higher rate limits (fetchDelayMs: 3000, requestTimeoutMs: 30000) per research decision D10
- [x] T028 [P] [US5] Create scripts/harvest/prompts/new-york-extraction-prompt.txt — include NYC borough→county mapping (Manhattan→New York, Brooklyn→Kings, Queens→Queens, Bronx→Bronx, Staten Island→Richmond), note that NY "Supreme Court" is trial-level, document specialized courts (Family, Surrogate's, Housing), provide HTML structure hints from nycourts.gov
- [x] T029 [US5] Add New York court type mappings (including specialized courts) to per-state registry in scripts/harvest/normalizer.ts — register NY abbreviation with court types: Court of Appeals, Appellate Division, Supreme Court, County Court, Family Court, Surrogate's Court, Civil Court, Criminal Court
- [x] T030 [US5] Implement fetchMethod: "browser" skip-with-warning logic in scripts/harvest/fetcher.ts — when a CourtEntry has fetchMethod: "browser", log a warning with the court label and URL, skip the entry, and include skipped count in the quality report; also handle fetchMethod: "manual" the same way

**Checkpoint**: New York appellate courts harvested. Browser-required entries documented and skipped cleanly. NYC borough→county mapping verified.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Documentation, cleanup, and end-to-end validation across all stories

- [x] T031 [P] Update scripts/harvest/run-harvest.sh with multi-state CLI examples — add --state, --all, --list usage comments and example invocations for each configured state
- [x] T032 [P] Validate all quickstart.md scenarios — run through each usage example in specs/007-state-expansion/quickstart.md and confirm output matches documented structure
- [x] T033 Remove dead Florida-specific code paths — delete any remaining FloridaCourtsConfig references, flattenCourtUrls() if still present, and inline ROSTER_SYSTEM_PROMPT constant from scripts/harvest/extractor.ts (now loaded from file)
- [x] T034 Run end-to-end --all --dry-run across all 4 configured states and verify combined summary report includes per-state counts, success/failure status, and aggregate totals in scripts/harvest/output/combined-summary-{timestamp}.txt

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 completion
- **US2 (Phase 4)**: Depends on Phase 3 (US1) — CLI wraps the state-agnostic pipeline
- **US3 (Phase 5)**: Depends on Phase 2 completion — can run in parallel with US1/US2 (config files only)
- **US4 (Phase 6)**: Depends on Phase 2 completion + T026 depends on Phase 3 (extractor wiring)
- **US5 (Phase 7)**: Depends on Phase 2 completion + T030 depends on Phase 3 (fetcher wiring)
- **Polish (Phase 8)**: Depends on all previous phases

### Within-Phase Dependencies (Phase 2)

- T004 (migrate FL config) and T006–T010 (module refactors) can all run in parallel — all depend only on Phase 1
- T005 (config.ts refactor) depends on T004 (needs migrated FL config to validate against) — run T005 after T004

### User Story Independence

- **US3 config (T020, T021)**: JSON + prompt files — no code dependencies, can be authored any time after Phase 1
- **US3 normalizer (T022)**: Depends on T010 (normalizer registry exists)
- **US4 config (T023, T024)**: JSON + prompt files — no code dependencies
- **US4 deterministic (T026)**: Depends on T008 (extractor refactor)
- **US5 config (T027, T028)**: JSON + prompt files — no code dependencies
- **US5 browser skip (T030)**: Depends on T007 (fetcher refactor)

### Parallel Opportunities

Within each phase, tasks marked [P] can execute simultaneously:

- **Phase 1**: T002 ‖ T003
- **Phase 2**: T004 ‖ T006 ‖ T007 ‖ T008 ‖ T009 ‖ T010 (then T005 after T004)
- **Phase 3**: T012 ‖ T013 (both touch different files)
- **Phase 5**: T020 ‖ T021
- **Phase 6**: T023 ‖ T024
- **Phase 7**: T027 ‖ T028
- **Phase 8**: T031 ‖ T032

---

## Parallel Example: Phase 2 Batch Execution

```bash
# Batch 1 — all [P] tasks in parallel (different files):
T004: Migrate florida-courts.json
T006: Refactor checkpoint.ts
T007: Extend fetcher.ts
T008: Extend extractor.ts
T009: Refactor court-seeder.ts
T010: Extend normalizer.ts

# Batch 2 — after T004 completes:
T005: Refactor config.ts (depends on migrated FL config from T004)
```

## Parallel Example: State Config Authoring

```bash
# Config files for US3/US4/US5 can be authored in parallel at any time after Phase 1:
T020: texas-courts.json          ‖  T023: california-courts.json  ‖  T027: new-york-courts.json
T021: texas-extraction-prompt.txt ‖  T024: california-extraction-prompt.txt ‖  T028: new-york-extraction-prompt.txt
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (3 tasks)
2. Complete Phase 2: Foundational (7 tasks)
3. Complete Phase 3: US1 — State-Agnostic Config (4 tasks)
4. **STOP and VALIDATE**: Run Florida on the refactored pipeline. Confirm identical output.
5. This is the minimum viable increment — the pipeline is now state-agnostic.

### Incremental Delivery

1. Setup + Foundational → Pipeline modules are generic
2. Add US1 → Florida works on new architecture → **MVP** ✓
3. Add US2 → CLI orchestration works → Multi-state operational ✓
4. Add US3 → Texas config + harvest → Second state live ✓
5. Add US4 → California config + deterministic extraction → Third state live ✓
6. Add US5 → New York config + browser-skip → Fourth state configured ✓
7. Polish → Cleanup, docs, end-to-end validation

### Recommended Execution Order

For a single developer working sequentially:

```
Phase 1 → Phase 2 → Phase 3 (US1) → Phase 4 (US2) → Phase 5 (US3) → Phase 6 (US4) → Phase 7 (US5) → Phase 8
```

State config files (T020/T021, T023/T024, T027/T028) can be researched and authored during any phase since they're just JSON + text files with no code dependencies.

---

## Notes

- No automated tests — harvester uses manual verification via --dry-run and quality reports
- [P] tasks target different files with no shared dependencies within the phase
- State config JSON files and extraction prompt .txt files have zero code dependencies — can be authored any time
- `fetchMethod: "browser"` is schema-documented but out of scope — entries are skipped with a warning (T030)
- `deterministic: true` extraction (T026) is California-specific but the mechanism is generic for future use (FR-020)
- Florida backward compatibility (T014) is a critical gate — must pass before proceeding to US2
- Commit after each task or logical group of parallel tasks
