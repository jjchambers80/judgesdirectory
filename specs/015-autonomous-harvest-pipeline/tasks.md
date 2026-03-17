# Tasks: Autonomous Harvest Pipeline

**Input**: Design documents from `/specs/015-autonomous-harvest-pipeline/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/harvest-api.md ✅, quickstart.md ✅

**Tests**: Not requested in spec — test tasks omitted.

**Organization**: Tasks grouped by user story in priority order. 6 user stories from spec.md:
- US1: Admin Triggers State Harvest (P1)
- US2: Database-Driven URL Source (P1)
- US3: Intelligent URL Classification (P2)
- US4: Autonomous Annual Delta Harvests (P2)
- US5: Post-Harvest Reports (P3)
- US6: Remove CSV Import Workflow (P1)

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6)
- All file paths are relative to repository root

---

## Phase 1: Setup

**Purpose**: Prisma schema migration and config archival

- [ ] T001 Update prisma/schema.prisma — add HarvestJob model with HarvestJobStatus and HarvestTrigger enums, add UrlCandidate fields (scrapeWorthy Boolean?, autoClassifiedAt DateTime?, fetchMethod String @default("http"), extractionHints Json?, @@index([scrapeWorthy])), swap Judge importBatchId → harvestJobId FK with @@index([harvestJobId]), remove ImportBatch model and ImportBatchStatus enum
- [ ] T002 Run `npx prisma migrate dev --name autonomous-harvest-pipeline` to generate and apply the migration in prisma/migrations/
- [ ] T003 [P] Move existing JSON config files to scripts/harvest/legacy/ directory (florida-courts.json, california-courts.json, south-carolina-courts.json, and any other *-courts.json files)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core pipeline modules that multiple user stories depend on

**⚠️ CRITICAL**: US1, US2, and US4 all depend on these modules

- [ ] T004 Create scripts/harvest/db-config-loader.ts — export `loadUrlsFromDb(stateAbbr: string)` that queries UrlCandidate table for APPROVED URLs where scrapeWorthy !== false, returning url, fetchMethod, extractionHints, domain, suggestedType, suggestedLevel per data-model.md key queries section
- [ ] T005 Create scripts/harvest/db-writer.ts — export `writeJudgesToDb(judges: EnrichedJudgeRecord[], jobId: string)` that resolves court via state→county→court lookup (absorb logic from scripts/import/court-resolver.ts), then Prisma upserts each judge using courtId_slug unique key, preserving status/autoVerified/verifiedAt on update, linking to harvestJobId, returning {new: number, updated: number}
- [ ] T006 Create scripts/harvest/runner.ts — extract core pipeline logic from index.ts, accept --job-id and --state CLI args, manage HarvestJob lifecycle (set RUNNING + startedAt on start, update urlsProcessed/judgesFound/judgesNew/judgesUpdated every 5 URLs, set COMPLETED/FAILED + completedAt on finish), orchestrate: db-config-loader → fetcher → extractor → enrichers → normalizer → deduplicator → db-writer
- [ ] T007 Update scripts/harvest/config.ts — update StateConfig type to support DB-driven config (add DbUrlConfig interface with url, fetchMethod, extractionHints fields), remove JSON file path references, update loadStateConfig to accept URL array from db-config-loader
- [ ] T008 Refactor scripts/harvest/index.ts — convert to thin CLI wrapper that parses args (--state, --job-id, --list), creates HarvestJob record if no --job-id provided, delegates execution to runner.ts, removes discoverStates() JSON scanning and Papa.unparse() CSV output

**Checkpoint**: Core pipeline can load URLs from DB, write judges to DB, and track job progress. All P1 user stories can now begin.

---

## Phase 3: User Story 2 — Database-Driven URL Source (Priority: P1)

**Goal**: Harvest reads URLs exclusively from the discovery database, not JSON config files

**Independent Test**: Approve a URL in admin discovery, run harvest for that state — the URL is scraped without any JSON file

- [ ] T009 [US2] Create scripts/harvest/migrate-json-to-db.ts — one-time migration script that reads each *-courts.json from scripts/harvest/legacy/, upserts UrlCandidate records with status=APPROVED, scrapeWorthy=true, confidenceScore=1.0, fetchMethod from JSON entry, extractionHints from deterministic pattern, creates stub DiscoveryRun for provenance
- [ ] T010 [US2] Update scripts/discovery/config-promoter.ts — remove JSON file write step (fs.writeFileSync of *-courts.json), simplify to DB-only status update: set UrlCandidate status=APPROVED and promotedAt=now()
- [ ] T011 [US2] Update scripts/discovery/candidate-store.ts — persist new UrlCandidate fields (scrapeWorthy, autoClassifiedAt, fetchMethod) when storing candidates, default fetchMethod to "http"

**Checkpoint**: URLs flow from discovery → DB → harvest with zero JSON intermediary. SC-003 (regression parity) and SC-004 (auto-inclusion) can be validated.

---

## Phase 4: User Story 1 — Admin Triggers State Harvest (Priority: P1) 🎯 MVP

**Goal**: Admin selects a state, clicks "Start Harvest," judges appear in DB via background job

**Independent Test**: Navigate to /admin/harvest, select SC, click Start Harvest, verify judges in DB with correct court linkage

- [ ] T012 [P] [US1] Create src/app/api/admin/harvest/states/route.ts — GET endpoint returning harvestable states with approved URL count, last harvest date, last harvest status, and active job indicator per contracts/harvest-api.md
- [ ] T013 [P] [US1] Create src/app/api/admin/harvest/route.ts — POST endpoint: validate stateAbbr, check for active jobs (409 Conflict), check for approved URLs (422), create HarvestJob record as QUEUED, spawn background runner via child_process.spawn('npx', ['tsx', 'scripts/harvest/runner.ts', '--job-id', jobId]) detached; GET endpoint: list jobs with optional stateAbbr/status filters, limit/offset pagination per contracts/harvest-api.md
- [ ] T014 [P] [US1] Create src/app/api/admin/harvest/[jobId]/route.ts — GET endpoint returning full HarvestJob record including reportMarkdown, 404 if not found per contracts/harvest-api.md
- [ ] T015 [US1] Create src/app/admin/harvest/page.tsx — admin page with: state selector dropdown (populated from /api/admin/harvest/states), "Start Harvest" button (disabled when no approved URLs or active job exists), active job progress card (status, urlsProcessed, judgesFound, judgesNew — polling every 5s via setInterval), job history table (state, status, trigger, judges, dates)
- [ ] T016 [US1] Update src/app/admin/layout.tsx — add "Harvest" navigation link to admin sidebar pointing to /admin/harvest

**Checkpoint**: Admin can trigger harvests, monitor progress, and see judges in DB. SC-001 and SC-002 can be validated. **This is the MVP.**

---

## Phase 5: User Story 6 — Remove CSV Import Workflow (Priority: P1)

**Goal**: Eliminate the CSV upload/import path entirely — admin panel has no import UI or API

**Independent Test**: Verify /admin/import/ returns 404, no Import link in nav, no CSV API endpoints accessible

- [ ] T017 [P] [US6] Delete src/app/admin/import/ directory and all contents (import wizard pages, column mapper UI, batch management)
- [ ] T018 [P] [US6] Delete src/app/api/admin/import/ directory and all contents (upload, process, batches API routes)
- [ ] T019 [P] [US6] Delete scripts/import/ directory and all contents (csv-importer.ts, court-resolver.ts, bridge scripts)
- [ ] T020 [P] [US6] Delete CSV-related components and utilities: src/components/admin/CsvUploader.tsx, src/components/admin/ColumnMapper.tsx, src/components/admin/ImportSummary.tsx, src/lib/csv.ts, src/lib/import-lock.ts (verify files exist before deleting — some may have different names)
- [ ] T021 [US6] Update src/app/admin/layout.tsx — remove "Import" navigation link from admin sidebar
- [ ] T022 [US6] Update src/components/admin/VerificationQueue.tsx — replace any importBatchId references with harvestJobId for filtering and display

**Checkpoint**: Zero CSV import paths remain. SC-007 and SC-008 can be validated. All P1 stories are complete.

---

## Phase 6: User Story 3 — Intelligent URL Classification (Priority: P2)

**Goal**: Discovered URLs are auto-classified as scrape-worthy/not based on classifier confidence

**Independent Test**: Run discovery, verify high-confidence URLs get scrapeWorthy=true, low-confidence get false, mid-range get null

- [ ] T023 [US3] Update scripts/discovery/classifier.ts — after existing classification, compute scrapeWorthy: confidence ≥ 0.7 with positive roster detection → true, confidence < 0.3 or negative roster detection → false, else → null; set autoClassifiedAt timestamp; return scrapeWorthy in classifier output
- [ ] T024 [US3] Update src/app/api/admin/discovery/[id]/route.ts — accept scrapeWorthy (boolean | null) in PATCH request body for admin override, clear autoClassifiedAt when admin overrides per contracts/harvest-api.md PATCH endpoint
- [ ] T025 [US3] Update src/app/admin/discovery/page.tsx — add scrapeWorthy badge column (green "Scrape-worthy", red "Not scrape-worthy", yellow "Needs review"), add filter dropdown for scrape-worthiness, add override toggle button that calls PATCH endpoint

**Checkpoint**: Discovery auto-classifies URLs. SC-009 can be validated.

---

## Phase 7: User Story 4 — Autonomous Annual Delta Harvests (Priority: P2)

**Goal**: System auto-re-harvests stale states on schedule, skipping fresh URLs

**Independent Test**: Call cron endpoint, verify only states >11 months since last harvest get jobs created

- [ ] T026 [US4] Create src/app/api/cron/harvest/route.ts — POST endpoint: validate Authorization Bearer CRON_SECRET header (401 if invalid), query all states with approved URLs, check last COMPLETED HarvestJob per state, create QUEUED jobs for states stale >11 months, skip states with active jobs, spawn runners sequentially per FR-020, return summary per contracts/harvest-api.md cron endpoint
- [ ] T027 [US4] Update vercel.json — add crons configuration: path "/api/cron/harvest", schedule "0 3 1 * *" (3:00 AM UTC on 1st of each month)
- [ ] T028 [US4] Add delta URL filtering to scripts/harvest/runner.ts — when triggeredBy is CRON, query UrlHealth.lastSuccessAt for each URL, skip URLs whose last successful scrape is within freshness window (365 days default per FR-019), log skipped URLs

**Checkpoint**: Scheduled harvests work with delta logic. SC-005 can be validated.

---

## Phase 8: User Story 5 — Post-Harvest Reports (Priority: P3)

**Goal**: Every harvest produces a persistent report viewable in admin UI

**Independent Test**: Complete a harvest, click on job in history table, verify report shows all metrics

- [ ] T029 [P] [US5] Create scripts/harvest/report-generator.ts — export `generateReport(metrics: HarvestMetrics): { markdown: string, data: ReportData }` that produces markdown with: summary stats (judges new/updated, URLs processed/failed, duration), failed URLs list with HTTP status and reason, court-type breakdown table, quality assessment (field coverage percentages)
- [ ] T030 [US5] Integrate report-generator into scripts/harvest/runner.ts — call generateReport() on job completion, write reportMarkdown to HarvestJob record via Prisma update, also write markdown file to scripts/harvest/output/ for archival per research.md R-007
- [ ] T031 [US5] Add report view to src/app/admin/harvest/page.tsx — when admin clicks a COMPLETED job row in the history table, fetch /api/admin/harvest/[jobId] and render reportMarkdown as formatted HTML (use a markdown renderer or dangerouslySetInnerHTML with sanitization)
- [ ] T032 [US5] Update src/app/admin/dashboard/page.tsx — replace any ImportBatch statistics with HarvestJob summary: total judges per state, last harvest date per state, staleness indicator (fresh/stale/never harvested) per FR-023

**Checkpoint**: Reports are generated, stored, and viewable. SC-006 can be validated.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: Edge case handling and validation

- [ ] T033 [P] Add zero-yield auto-downgrade to scripts/harvest/runner.ts — after harvest completes, query UrlCandidate URLs that have scrapeWorthy=true but yielded zero judges in this AND at least one prior harvest, set scrapeWorthy=false with rejectionReason="zero-yield" per FR-005
- [ ] T034 [P] Add stale-job detector to src/app/api/admin/harvest/route.ts — on GET requests, check for HarvestJob records in RUNNING status with no updatedAt change in >2 hours, mark as FAILED with errorMessage="Job timed out — no progress in 2 hours" per edge case spec
- [ ] T035 Run quickstart.md end-to-end validation: execute migrate-json-to-db.ts, trigger SC harvest via admin UI, verify judges appear in DB with correct court linkage, verify report is generated, verify import routes return 404

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (schema must exist) — **BLOCKS all user stories**
- **US2 (Phase 3)**: Depends on Phase 2 (needs db-config-loader)
- **US1 (Phase 4)**: Depends on Phase 2 (needs runner, db-writer) — can run **in parallel** with Phase 3
- **US6 (Phase 5)**: No dependencies on other stories — can run **in parallel** with Phases 3-4
- **US3 (Phase 6)**: Depends on Phase 2 (needs candidate-store updates) — can run **in parallel** with Phases 3-5
- **US4 (Phase 7)**: Depends on Phase 4 (needs harvest API pattern) and Phase 2 (needs runner)
- **US5 (Phase 8)**: Depends on Phase 4 (needs harvest page) and Phase 2 (needs runner)
- **Polish (Phase 9)**: Depends on all story phases being complete

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US2 (DB URL Source) | Foundational | US1, US6, US3 |
| US1 (Admin Harvest) | Foundational | US2, US6, US3 |
| US6 (Remove CSV) | Phase 1 only | US1, US2, US3, US4, US5 |
| US3 (Classification) | Foundational | US1, US2, US6 |
| US4 (Annual Deltas) | US1 (API pattern) | US5 |
| US5 (Reports) | US1 (harvest page) | US4 |

### Within Each User Story

- Models/schema before services
- Services/modules before API routes
- API routes before UI pages
- Core implementation before integration features

---

## Parallel Execution Examples

### Parallel: After Foundational Phase Completes

```
Thread A: T009 → T010 → T011  (US2: DB URL Source)
Thread B: T012, T013, T014    (US1: API routes — all [P])
Thread C: T017, T018, T019, T020  (US6: Delete files — all [P])
Thread D: T023               (US3: Classifier update)
```

### Parallel: US1 API Routes (Phase 4)

```
T012: src/app/api/admin/harvest/states/route.ts  [P]
T013: src/app/api/admin/harvest/route.ts          [P]
T014: src/app/api/admin/harvest/[jobId]/route.ts  [P]
→ Then sequentially: T015 (UI needs all 3 routes) → T016 (nav link)
```

### Parallel: US6 Deletions (Phase 5)

```
T017: Delete src/app/admin/import/           [P]
T018: Delete src/app/api/admin/import/       [P]
T019: Delete scripts/import/                  [P]
T020: Delete CSV components + libs            [P]
→ Then sequentially: T021 (update nav) → T022 (update verification queue)
```

---

## Implementation Strategy

### MVP First (US1 + US2 + US6)

1. Complete Phase 1: Setup (schema migration)
2. Complete Phase 2: Foundational (core modules)
3. Complete Phase 3: US2 (DB URL source + JSON migration)
4. Complete Phase 4: US1 (admin harvest trigger + UI) ← **MVP READY**
5. Complete Phase 5: US6 (remove CSV import)
6. **STOP and VALIDATE**: Run quickstart.md, trigger SC harvest, verify end-to-end

### Incremental Delivery

1. Setup + Foundational → Pipeline core ready
2. US2 + US1 → Admin can trigger harvests from DB (MVP!)
3. US6 → Old import path removed (clean codebase)
4. US3 → Discovery auto-classifies URLs (reduced admin burden)
5. US4 → Annual cron runs autonomously (hands-off operation)
6. US5 → Reports provide observability (admin confidence)
7. Polish → Edge cases handled (production hardening)

---

## Notes

- [P] tasks = different files, no dependencies on other in-progress tasks
- [USn] label maps task to spec user story for traceability
- All Prisma schema changes are in ONE migration (T001-T002) to maintain atomic consistency
- db-writer.ts absorbs court-resolver logic from scripts/import/court-resolver.ts before that file is deleted in T019
- Layout.tsx is touched in both T016 (add Harvest link) and T021 (remove Import link) — can be combined if implementing sequentially
- JSON configs are archived to legacy/ (T003) before migration script reads them (T009) — T009 reads from legacy/
