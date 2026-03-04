# Tasks: State Expansion — TX/CA/NY Harvest Execution

**Input**: Design documents from `/specs/008-state-expansion/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: No automated tests requested. Validation is manual spot-check (20 records per state) + quality report review + Zod schema validation.

**Organization**: Tasks are grouped by user story. Most code changes are in Phase 2 (Foundational) since 007 already built the core infrastructure. Phases 3–7 are primarily execution and validation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: CLI pipeline at `scripts/harvest/`
- **Prompts**: `scripts/harvest/prompts/`
- **State configs**: `scripts/harvest/{state}-courts.json`
- **Output**: `scripts/harvest/output/{state-slug}/`

---

## Phase 1: Setup

**Purpose**: Verify branch and existing 007 infrastructure before making changes

- [x] T001 Verify branch 008-state-expansion is active, run `npx tsx scripts/harvest/index.ts --list` to confirm all 4 state configs load and validate
- [x] T001a Capture Florida baseline quality report — run `--state florida --dry-run` and save the quality report to `output/florida/baseline-quality-report.md` BEFORE any Phase 2 code changes (required for Constitution Principle VII before/after comparison in T041)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: All code changes needed before any harvest can execute — county alias support, quality gate, freshness tracking, division extraction, combined report enhancement

**⚠️ CRITICAL**: No user story work (court seeding or harvesting) can begin until this phase is complete

### County Alias Support (FR-025)

- [x] T002 Add `countyAliases` field to `StateConfigSchema` in scripts/harvest/state-config-schema.ts — `z.record(z.string().min(1), z.string().min(1)).optional().default({})`
- [x] T003 [P] Add `countyAliases` to scripts/harvest/texas-courts.json with known TX aliases: `{"Dewitt": "DeWitt", "De Witt": "DeWitt"}`
- [x] T004 [P] Add `countyAliases` to scripts/harvest/california-courts.json with known CA aliases: `{"San Buenaventura": "Ventura"}`
- [x] T005 [P] Add `countyAliases` to scripts/harvest/new-york-courts.json with known NY aliases: `{"Manhattan": "New York", "Brooklyn": "Kings", "Staten Island": "Richmond", "Saint Lawrence": "St. Lawrence"}`
- [x] T006 Implement `resolveCountyAlias()` and `resolveCountyAliases()` in scripts/harvest/normalizer.ts per contract in contracts/county-alias-resolver.ts — case-insensitive lookup, apply before county DB match during normalization
- [x] T007 Add county alias lookup before `countyMap.get()` in scripts/harvest/court-seeder.ts — resolve config county names through alias map before DB lookup, log `UnresolvedCountyWarning` for misses

### Data Freshness Tracking (FR-026)

- [x] T008 [P] Add `HarvestManifestSchema` Zod schema and `HarvestManifest` type to scripts/harvest/state-config-schema.ts per contract in contracts/freshness-tracker.ts
- [x] T009 Implement `writeManifest()` (atomic tmp+rename) and `readManifest()` in scripts/harvest/index.ts — write manifest to `output/{state-slug}/harvest-manifest.json` after successful `runSingleState()` completion
- [x] T010 Implement `checkFreshness()` and `formatFreshnessSection()` in scripts/harvest/reporter.ts — calculate days since last harvest, flag states > 90 days with `DATA_FRESHNESS_THRESHOLD_DAYS` constant
- [x] T011 Add freshness check at startup in scripts/harvest/index.ts — print freshness table to stdout before processing for `--all` runs; show single-state freshness for `--state` runs

### Soft Quality Gate (FR-024)

- [x] T012 Implement `evaluateQualityGate()` with 5 proxy metrics in scripts/harvest/reporter.ts per contract in contracts/quality-gate.ts — failed page rate, zero-judge page rate, missing county rate, core field incompleteness, Zod failure rate with warning/critical thresholds
- [x] T013 Add quality gate Markdown section rendering (`formatQualityGateMarkdown()`) to scripts/harvest/reporter.ts — ✅ PASS / ⚠️ WARNING / 🔴 CRITICAL section placed immediately after report header, before summary
- [x] T014 Integrate quality gate into existing `generateReport()` and `generateEnrichedReport()` in scripts/harvest/reporter.ts — call `evaluateQualityGate()` with harvest stats and embed result Markdown in report output

### Division Extraction (FR-027)

- [x] T015 [P] Add `## Division Extraction` section to scripts/harvest/prompts/texas-extraction-prompt.txt — TX division = subject-matter (Criminal, Family, Civil); Courts of Appeals districts are structural NOT division; add `"division": null` to example JSON
- [x] T016 [P] Add `## Division Extraction` section to scripts/harvest/prompts/california-extraction-prompt.txt — CA division = subject-matter (Criminal, Civil, Family, Juvenile, Probate); appellate numbered divisions are structural NOT division; add `"division": null` to example JSON
- [x] T017 [P] Add `## Division Extraction` section to scripts/harvest/prompts/new-york-extraction-prompt.txt — NY division = specialized assignment (Commercial Division, IDV Part); "Appellate Division" is a court name NOT a division value; add `"division": null` to example JSON
- [x] T018 [P] Add division extraction rule to scripts/harvest/prompts/generic-extraction.txt — extract subject-matter division if listed (Criminal, Civil, Family, Juvenile); set to null if not stated; add `"division": null` to example JSON
- [x] T019 Verify division field flows end-to-end through extraction pipeline in scripts/harvest/extractor.ts — confirm Zod schema includes `division`, `EnrichedJudgeRecord` propagates it, CSV output includes Division column, `buildRosterPrompt` template includes division placeholder

### Combined Report Enhancement (FR-010)

- [x] T020 Enhance `runSingleState()` return type from `number` to `StateRunResult` interface in scripts/harvest/index.ts per contract in contracts/combined-report.ts — return judgeCount, pages stats, courtTypeCounts, duplicatesRemoved, reportPath, qualityVerdict, error
- [x] T021 Implement `computeAggregateStats()` in scripts/harvest/index.ts per contract in contracts/combined-report.ts — aggregate per-state results into totals with worst-verdict calculation
- [x] T022 Implement enhanced `writeCombinedSummary()` in scripts/harvest/index.ts — change output from `.txt` to `.md`, include run metadata, per-state results table with quality verdicts, aggregate totals, failed state details, court type breakdown

**Checkpoint**: All code changes complete — infrastructure ready for court seeding and harvest execution

---

## Phase 3: User Story 5 — Court Structure Seeding for New States (Priority: P1)

**Goal**: Create Court records in the database for TX, CA, NY using state configs with county alias resolution

**Independent Test**: Run `--state {state} --seed-courts-only` for each state. Verify Court records appear with correct county assignments. No "missing court" errors on subsequent harvest.

- [x] T023 [US5] Seed Texas courts by running `--state texas --seed-courts-only` via scripts/harvest/index.ts — verify 16+ Court records created matching TX config court hierarchy with correct county assignments across 254 counties
- [x] T024 [P] [US5] Seed California courts by running `--state california --seed-courts-only` via scripts/harvest/index.ts — verify Court records created for Supreme Court, 6 Courts of Appeal, and 58 Superior Courts with 1:1 county mapping
- [x] T025 [P] [US5] Seed New York courts by running `--state new-york --seed-courts-only` via scripts/harvest/index.ts — verify Court records created for Court of Appeals, 4 Appellate Division Departments, Supreme Court, and County Courts with NYC borough-to-county alias resolution (Manhattan→New York, Brooklyn→Kings, etc.)

**Checkpoint**: All 3 states' court structures seeded in database — harvest can now assign judges to courts

---

## Phase 4: User Story 1 — Harvest Texas Judges (Priority: P1) 🎯 MVP

**Goal**: Execute TX harvest producing ≥200 appellate judges with quality report showing ≥90% spot-check accuracy

**Independent Test**: Run `--state texas`. Verify output CSV has judges from ≥3 court levels. Cross-reference 20 random records against txcourts.gov. Import CSV through admin panel.

- [x] T026 [US1] Execute Texas harvest with `--state texas` via scripts/harvest/index.ts — verify pipeline completes, CSV written to output/texas/, quality report and harvest manifest generated
- [x] T027 [US1] Review Texas quality report — verify quality gate section present, check failed page rate, zero-judge page rate, county coverage, court type breakdown; verify any court entries with fetchMethod "browser" or "manual" appear as skipped in the report (EC-007)
- [x] T028 [US1] Spot-check 20 random Texas records against txcourts.gov source URLs — verify judge name, court type, county assignment match source page (target: ≥18/20 correct = 90%+)
- [x] T029 [US1] Validate Texas output CSV contains ≥200 appellate judges (Supreme Court + CCA + Courts of Appeals), correct CSV column format (Judge Name, Court Type, County, State, Source URL, Selection Method), all records have source URLs per FR-022, and verify 5 random records have correctly normalized court type names per FR-017 (e.g., no abbreviations like "Ct. App.")
- [x] T029a [US1] Import Texas CSV through scripts/import/index.ts — verify <5% error rows per SC-007; confirm records appear in verification queue

**Checkpoint**: Texas harvest validated — MVP milestone complete (SC-002)

---

## Phase 5: User Story 2 — Harvest California Judges (Priority: P1)

**Goal**: Execute CA harvest producing ≥1,500 judges across Supreme Court, Courts of Appeal, and all 58 Superior Courts

**Independent Test**: Run `--state california`. Verify output includes all 3 court levels with correct county mappings. Cross-reference 20 random records against courts.ca.gov.

- [x] T030 [US2] Execute California harvest with `--state california` via scripts/harvest/index.ts — verify pipeline completes with deterministic extraction for structured pages (FR-020), CSV and quality report generated. Log wall-clock time — CA is the largest state and most likely to test the <30 min single-state performance target
- [x] T031 [US2] Review California quality report — verify quality gate section, check 58-county coverage for Superior Courts, appellate district assignments, deterministic vs LLM extraction breakdown; verify any court entries with fetchMethod "browser" or "manual" appear as skipped in the report (EC-007)
- [x] T032 [US2] Spot-check 20 random California records against courts.ca.gov source URLs — verify judge name, court type, county assignment match source page (target: ≥18/20 correct = 90%+)
- [x] T033 [US2] Validate California output CSV contains ≥1,500 judges with all 58 Superior Court counties represented, correct court type names (verify 5 random records have normalized names per FR-017), and source URLs per FR-022
- [x] T033a [US2] Import California CSV through scripts/import/index.ts — verify <5% error rows per SC-007; confirm records appear in verification queue

**Checkpoint**: California harvest validated (SC-003) — combined TX+CA should yield 1,700+ judges

---

## Phase 6: User Story 3 — Harvest New York Judges (Priority: P2)

**Goal**: Execute NY harvest producing ≥1,000 judges with correct borough-to-county mapping and inverted court naming

**Independent Test**: Run `--state new-york`. Verify NYC borough→county alias resolution works. Verify "Supreme Court" correctly mapped as trial court. Cross-reference 20 random records against nycourts.gov.

- [ ] T034 [US3] Execute New York harvest with `--state new-york` via scripts/harvest/index.ts — verify pipeline completes, county alias resolution resolves Manhattan/Brooklyn/Staten Island to canonical county names, CSV and quality report generated
- [ ] T035 [US3] Review New York quality report — verify quality gate section, check 62-county coverage, NYC borough-to-county resolution log, Appellate Division department assignments; verify any court entries with fetchMethod "browser" or "manual" appear as skipped in the report (EC-007)
- [ ] T036 [US3] Spot-check 20 random New York records against nycourts.gov source URLs — verify judge name, court type, county assignment, correct handling of NY "Supreme Court" as trial court (target: ≥18/20 correct = 90%+)
- [ ] T037 [US3] Validate New York output CSV contains ≥1,000 judges with NYC boroughs mapped to canonical counties, Appellate Division departments captured, source URLs per FR-022, and verify 5 random records have correctly normalized court type names per FR-017 (e.g., "Appellate Division" not "App. Div.")
- [ ] T037a [US3] Import New York CSV through scripts/import/index.ts — verify <5% error rows per SC-007; confirm records appear in verification queue

**Checkpoint**: New York harvest validated (SC-004) — combined TX+CA+NY should yield 2,700+ judges (SC-005)

---

## Phase 7: User Story 4 — Multi-State Orchestration and Combined Reporting (Priority: P2)

**Goal**: Execute `--all` to harvest all 4 states sequentially with independent checkpoints and combined summary report

**Independent Test**: Run `--all`. Verify each state processed sequentially with separate output directories. Verify combined summary has per-state totals and aggregate statistics.

- [ ] T038 [US4] Execute combined harvest with `--all` via scripts/harvest/index.ts — verify all 4 states (FL, TX, CA, NY) processed sequentially with independent checkpoints, output directories, and quality reports per state
- [ ] T039 [US4] Verify combined summary report at output/combined-summary-{timestamp}.md — confirm per-state results table with quality verdicts (✅/🟡/🔴), aggregate totals, court type breakdown, overall verdict per contracts/combined-report.ts
- [ ] T040 [US4] Verify per-state isolation — confirm each state has independent checkpoint in output/{state-slug}/checkpoints/, independent CSV output, independent quality report, independent harvest manifest (SC-008)
- [ ] T040a [US4] Verify combined judge count across TX + CA + NY CSVs totals ≥2,700 records (SC-005)

**Checkpoint**: Multi-state orchestration validated — all 4 states harvestable in a single invocation

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Backward compatibility, final validation, documentation

- [ ] T041 Verify Florida backward compatibility — re-run `--state florida --dry-run` and diff quality report against baseline saved in T001a to confirm no regression (Constitution Principle VII). Run without --state flag, confirm default is Florida (SC-009, FR-001, FR-016)
- [ ] T042 Verify `--list` output shows all 4 states with correct court counts via scripts/harvest/index.ts (FR-003)
- [ ] T043 [P] Run full quickstart.md validation — execute all 9 steps from specs/008-state-expansion/quickstart.md end-to-end
- [ ] T044 [P] Update specs/008-state-expansion/ documentation with final harvest results — record actual judge counts, quality gate verdicts, and any deviations from expected targets in spec
- [ ] T045 Validate SC-001: time a mock state onboarding — create a dummy state JSON config (≥3 court levels, ≥5 court entries with county mappings, countyAliases, rate limits) + a custom extraction prompt from scratch and verify the setup can be completed in under 30 minutes without modifying source code

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — verify existing infrastructure
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user stories**
- **US5: Court Seeding (Phase 3)**: Depends on Phase 2 (needs alias resolution) — **BLOCKS US1, US2, US3**
- **US1: TX Harvest (Phase 4)**: Depends on Phase 3 (TX courts seeded) — MVP milestone
- **US2: CA Harvest (Phase 5)**: Depends on Phase 3 (CA courts seeded) — can run in parallel with US1
- **US3: NY Harvest (Phase 6)**: Depends on Phase 3 (NY courts seeded) — can run in parallel with US1/US2
- **US4: Multi-State (Phase 7)**: Depends on US1 + US2 + US3 (all states harvested at least once)
- **Polish (Phase 8)**: Depends on all prior phases completing

### User Story Dependencies

- **US5 (P1)**: Blocking prerequisite for US1, US2, US3 — court records must exist before judge import
- **US1 (P1 MVP)**: Independent after US5 — Texas only. No dependency on US2/US3
- **US2 (P1)**: Independent after US5 — California only. Can run in parallel with US1
- **US3 (P2)**: Independent after US5 — New York only. Can run in parallel with US1/US2
- **US4 (P2)**: Depends on US1 + US2 + US3 — requires all 3 new states completed to validate combined run

### Within Phase 2 (Foundational)

- T002 (schema) MUST precede T003–T007 (alias usage)
- T008 (manifest schema) MUST precede T009–T011 (manifest usage)
- T012 MUST precede T013–T014 (quality gate logic before rendering/integration)
- T015–T018 (prompts) are independent of each other [P]
- T020 (StateRunResult) MUST precede T021–T022 (combined report)

### Parallel Opportunities

**Phase 2 — Batch 1** (no dependencies):

```
T002 (schema)  |  T008 (manifest schema)  |  T015–T018 (prompts, all [P])
```

**Phase 2 — Batch 2** (depends on Batch 1):

```
T003–T005 (JSON configs, all [P])  |  T006–T007 (alias resolution)  |  T009 (manifest read/write)  |  T012 (quality gate logic)  |  T019 (division verify)
```

**Phase 2 — Batch 3** (depends on Batch 2):

```
T010–T011 (freshness)  |  T013–T014 (quality gate render/integrate)  |  T020 (StateRunResult)
```

**Phase 2 — Batch 4** (depends on Batch 3):

```
T021–T022 (combined report)
```

**Phase 3** — TX, CA, NY court seeding can run in parallel:

```
T023 (TX seed)  |  T024 (CA seed)  |  T025 (NY seed)
```

**Phases 4–6** — State harvests can run in parallel (if capacity allows):

```
T026–T029 (TX harvest)  |  T030–T033 (CA harvest)  |  T034–T037 (NY harvest)
```

---

## Implementation Strategy

### MVP First (User Story 1 = Texas Harvest)

1. Complete Phase 1: Setup (verify branch)
2. Complete Phase 2: Foundational (all code changes)
3. Complete Phase 3: Court seeding (at minimum TX)
4. Complete Phase 4: Texas harvest (US1)
5. **STOP and VALIDATE**: Verify ≥200 TX judges, 90%+ accuracy, quality report clean
6. This is the MVP milestone — Texas harvest validates the entire enhancement set

### Incremental Delivery

1. Phase 1 + 2 → All code changes complete, infrastructure enhanced
2. Phase 3 → Court structures seeded for all 3 states
3. Phase 4 (US1: TX) → First state validated → **MVP!**
4. Phase 5 (US2: CA) → Largest state validated → 1,700+ additional judges
5. Phase 6 (US3: NY) → Complex state validated → 1,000+ additional judges
6. Phase 7 (US4: Combined) → Multi-state orchestration validated
7. Phase 8 → Polish, backward compat, documentation finalized

### Cost Estimate

- TX: ~50 extraction calls × $0.003 = ~$0.15
- CA: ~100 extraction calls × $0.003 = ~$0.30 (plus deterministic pages at $0)
- NY: ~80 extraction calls × $0.003 = ~$0.24
- Total estimated: < $1 (well under $10 budget constraint)

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps tasks to user stories from spec.md (US1→US5)
- No automated tests — validation is manual spot-check + quality gate + Zod schema
- Most code changes are in Phase 2 (Foundational) since 007 built core infrastructure
- Phases 3–7 are primarily execution and validation, not new code
- Commit after each task or logical group within a phase
- Stop at any checkpoint to validate story independently
- All file modifications are in `scripts/harvest/` — no new files needed
