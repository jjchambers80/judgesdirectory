# Tasks: URL Health Scoring & Delta-Run Prioritization

**Input**: Design documents from `/specs/012-url-health/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US3 (auto-update) precedes US1 (delta prioritization) because delta runs depend on health scores being populated.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Include exact file paths in descriptions

---

## Phase 1: Setup

**Purpose**: Schema changes, migration, and shared type definitions

- [X] T001 Add YieldTrend and HealthSource enums plus UrlHealth and ScrapeLog models to prisma/schema.prisma (keep ScrapeFailure temporarily)
- [X] T002 Create and apply Prisma migration with ScrapeFailure → ScrapeLog data migration SQL in prisma/migrations/
- [X] T003 Add HealthConfig, DeltaBucket, and delta-related types to scripts/harvest/config.ts

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core health modules that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T004 [P] Create health score computation module with weighted formula in scripts/harvest/health-scorer.ts
- [X] T005 [P] Create ScrapeLog writer and UrlHealth upsert module in scripts/harvest/health-recorder.ts
- [X] T006 Rewrite failure classification to write ScrapeLog instead of ScrapeFailure in scripts/harvest/failure-tracker.ts

**Checkpoint**: Foundation ready — health-scorer, health-recorder, and failure-tracker all write to new tables

---

## Phase 3: User Story 3 — Health Score Auto-Updates After Each Harvest (Priority: P1) 🎯 MVP

**Goal**: After every harvest run, the system automatically records a ScrapeLog entry for each URL and recomputes the UrlHealth score — no manual step required.

**Independent Test**: Run `npx tsx scripts/harvest/index.ts --state florida`, then query UrlHealth and ScrapeLog tables in Prisma Studio. Verify new records were created and health scores computed.

### Implementation for User Story 3

- [X] T007 [US3] Integrate per-URL health recording (success + failure) into the harvest pipeline loop in scripts/harvest/index.ts
- [X] T008 [US3] Add batch health score recomputation step after all URLs processed in scripts/harvest/index.ts
- [X] T009 [US3] Append health summary section (scores updated, anomalies detected) to quality report in scripts/harvest/reporter.ts

**Checkpoint**: Run a harvest for one state — UrlHealth records exist with computed scores, ScrapeLog entries for every URL attempt

---

## Phase 4: User Story 1 — Harvest Pipeline Prioritizes Healthy URLs (Priority: P1)

**Goal**: Delta harvest mode scrapes stale-but-healthy URLs first, defers broken URLs, and optionally skips chronically broken ones via `--skip-broken`.

**Independent Test**: Run `npx tsx scripts/harvest/index.ts --state florida --delta` on a state with mixed health data. Verify healthy-stale URLs processed first, broken URLs deferred, and bucket counts logged.

### Implementation for User Story 1

- [X] T010 [US1] Add --delta, --skip-broken, and --skip-broken-threshold CLI flag parsing to scripts/harvest/config.ts
- [X] T011 [US1] Implement delta URL prioritization with 5-bucket sorting (stale+healthy → never-scraped → stale+moderate → stale+unhealthy → fresh) in scripts/harvest/index.ts
- [X] T012 [US1] Add delta mode console output with bucket counts, skip reporting, and processing summary in scripts/harvest/index.ts

**Checkpoint**: Delta harvest runs process URLs in health-informed priority order, broken URLs skipped with --skip-broken

---

## Phase 5: User Story 2 — Admin Reviews URL Health in Dashboard (Priority: P2)

**Goal**: Admin views a health dashboard showing per-URL yield history, health scores, trends, and can filter/sort/drill-down into scrape history.

**Independent Test**: Start dev server (`npx next dev`), navigate to `/admin/health/`, verify URLs listed with health scores, trend indicators, expandable scrape history, and state filtering.

### Implementation for User Story 2

- [X] T013 [P] [US2] Create GET list endpoint with filtering, sorting, pagination, and inline summary in src/app/api/admin/health/route.ts
- [X] T014 [P] [US2] Create GET per-state health summary endpoint in src/app/api/admin/health/summary/route.ts
- [X] T015 [P] [US2] Create GET detail with scrape history and PATCH actions (dismiss-anomaly, deactivate, reactivate) endpoint in src/app/api/admin/health/[id]/route.ts
- [X] T016 [P] [US2] Create PATCH resolve scrape log endpoint in src/app/api/admin/health/scrape-logs/[id]/route.ts
- [X] T017 [US2] Create URL health dashboard page (WCAG 2.1 AA compliant) with table, color-coded badges, trend icons, anomaly flags, state filter, sort controls, and expandable row scrape history in src/app/admin/health/page.tsx
- [X] T018 [US2] Replace Failures nav link with Health link in src/app/admin/layout.tsx
- [X] T019 [US2] Replace Scrape Failures dashboard card with URL Health card in src/app/admin/page.tsx
- [X] T020 [US2] Remove failures page at src/app/admin/failures/page.tsx
- [X] T021 [US2] Remove failures API routes at src/app/api/admin/failures/route.ts and src/app/api/admin/failures/[id]/route.ts

**Checkpoint**: Admin can view, filter, sort, and drill into URL health data at /admin/health/. Old failures page removed.

---

## Phase 6: User Story 4 — Config Promoter Seeds Health Record (Priority: P3)

**Goal**: When a UrlCandidate is promoted to state config, a UrlHealth record is seeded so it immediately participates in delta-run prioritization.

**Independent Test**: Promote an approved UrlCandidate via admin UI, then check UrlHealth table for a new record with source=DISCOVERED and healthScore=0.5.

### Implementation for User Story 4

- [X] T022 [US4] Seed UrlHealth record (source=DISCOVERED, healthScore=0.5) on promote in scripts/discovery/config-promoter.ts
- [X] T023 [US4] Seed UrlHealth record on promote API endpoint in src/app/api/admin/discovery/promote/route.ts
- [X] T024 [US4] Update purge script to query ScrapeLog instead of ScrapeFailure in scripts/maintenance/purge-failures.ts

**Checkpoint**: Promoted candidates have UrlHealth records seeded; purge script targets ScrapeLog

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Schema cleanup, build validation, and verification

- [X] T025 Remove ScrapeFailure model from prisma/schema.prisma and create drop-table migration
- [X] T026 [P] Run quickstart.md validation checklist end-to-end
- [X] T027 Verify production build passes with npx next build

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────→ Phase 2 (Foundational) ─────→ Phase 3 (US3: Auto-Update) ──→ Phase 4 (US1: Delta)
                                                  │                                         │
                                                  └─→ Phase 5 (US2: Dashboard) ────────────┤
                                                  │                                         │
                                                  └─→ Phase 6 (US4: Promoter) ─────────────┤
                                                                                            │
                                                                                     Phase 7 (Polish)
```

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 — BLOCKS all user stories
- **Phase 3 (US3)**: Depends on Phase 2 — health recording must work before delta runs
- **Phase 4 (US1)**: Depends on Phase 3 — delta prioritization needs populated UrlHealth data
- **Phase 5 (US2)**: Depends on Phase 2 — can run in parallel with Phase 3/4
- **Phase 6 (US4)**: Depends on Phase 2 — can run in parallel with Phase 3/4/5
- **Phase 7 (Polish)**: Depends on all phases complete

### User Story Dependencies

- **US3 (P1)**: First story — establishes health data in the database
- **US1 (P1)**: Depends on US3 — reads health scores for prioritization
- **US2 (P2)**: Independent of US1/US3 (reads from same tables but doesn't depend on pipeline changes)
- **US4 (P3)**: Independent of all other stories

### Within Each User Story

- Models → modules → integration → reporting
- Core implementation before UI
- Story complete and testable before moving to next priority

### Parallel Opportunities

- **Phase 2**: T004 + T005 can run in parallel (different new files)
- **Phase 5**: T013 + T014 + T015 + T016 can run in parallel (different API route files)
- **Phase 5 + Phase 3/4**: US2 dashboard work can overlap with US3/US1 pipeline work (different directories)
- **Phase 6**: Can overlap with Phase 5 (different files)

---

## Parallel Example: User Story 2 (Dashboard)

```bash
# Launch all API routes in parallel (different files):
Task T013: "Create GET list endpoint in src/app/api/admin/health/route.ts"
Task T014: "Create GET summary endpoint in src/app/api/admin/health/summary/route.ts"
Task T015: "Create GET+PATCH detail endpoint in src/app/api/admin/health/[id]/route.ts"
Task T016: "Create PATCH resolve endpoint in src/app/api/admin/health/scrape-logs/[id]/route.ts"

# Then sequentially (depends on API routes):
Task T017: "Create health dashboard page in src/app/admin/health/page.tsx"
Task T018-T021: Nav/card updates and old page removal
```

---

## Implementation Strategy

### MVP First (User Story 3 Only)

1. Complete Phase 1: Setup (schema + migration + types)
2. Complete Phase 2: Foundational (health-scorer, health-recorder, failure-tracker rewrite)
3. Complete Phase 3: User Story 3 (auto-update health scores)
4. **STOP and VALIDATE**: Run harvest, verify UrlHealth + ScrapeLog records in Prisma Studio
5. This alone delivers value: every URL now has a health profile

### Incremental Delivery

1. Setup + Foundational → Schema and core modules ready
2. Add US3 (auto-update) → Run harvest → Health data populated (MVP!)
3. Add US1 (delta mode) → Run `--delta` harvest → Smart prioritization working
4. Add US2 (dashboard) → Admin has full visibility into URL health
5. Add US4 (promoter seeding) → End-to-end discovery → health loop closed
6. Polish → Drop ScrapeFailure, validate build

### Key Design Decisions

- **Health formula**: `(successRate × 0.40) + (yieldConsistency × 0.30) + (freshness × 0.20) + (volumeScore × 0.10)` over last 10 scrapes
- **ScrapeFailure retirement**: Kept in schema until Phase 7 to allow incremental code migration
- **Delta buckets**: 5-tier priority (stale+healthy → never-scraped → stale+moderate → stale+unhealthy → fresh)
- **Anomaly threshold**: Yield drop >50% vs rolling average triggers anomalyDetected flag
- **Staleness threshold**: 7 days since last successful scrape

---

## Notes

- [P] tasks = different files, no dependencies on each other
- [Story] label maps task to specific user story for traceability
- Each user story is independently completable and testable at its checkpoint
- Health recording is non-blocking: catch + warn, never throw (existing pipeline pattern)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
