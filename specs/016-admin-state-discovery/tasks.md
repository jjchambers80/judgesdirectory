# Tasks: Admin State Discovery

**Input**: Design documents from `/specs/016-admin-state-discovery/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Not requested — test tasks are omitted.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Schema change required by the cancellation feature

- [x] T001 Add CANCELLED value to DiscoveryRunStatus enum in prisma/schema.prisma and run `npx prisma migrate dev --name add_cancelled_discovery_status`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Modify the existing discovery CLI to support API-triggered runs and cooperative cancellation. MUST be complete before any user story work begins.

**⚠️ CRITICAL**: The API routes in Phase 3 spawn `discover.ts` with `--run-id`, so these changes must land first.

- [x] T002 Add --run-id flag to scripts/discovery/discover.ts so the API can pre-create a DiscoveryRun record and pass its UUID — when --run-id is provided, skip internal record creation and use the existing record (matches harvest --job-id pattern per research.md Decision 1)
- [x] T003 Add cooperative cancellation check to scripts/discovery/discover.ts — before each search query iteration, query the DB for the run's status; if CANCELLED, set status to FAILED with errorMessage "Cancelled by user", preserve partial metrics (queriesRun, candidatesFound, candidatesNew), set completedAt, and exit gracefully (per research.md Decision 2)

**Checkpoint**: Foundation ready — discover.ts accepts --run-id and respects cancellation. User story implementation can begin.

---

## Phase 3: User Story 1 — Trigger Discovery for a State (Priority: P1) 🎯 MVP

**Goal**: Admin selects a US state, sees its summary, clicks "Run Discovery", and can cancel a running job. Eliminates CLI access requirement.

**Independent Test**: Select a state from dropdown → observe summary card with candidate counts and last run → click "Run Discovery" → verify DiscoveryRun record created with RUNNING status → click "Cancel" → verify status transitions to FAILED with "Cancelled by user" message.

### Implementation for User Story 1

- [x] T004 [P] [US1] Create runs API route with GET (list runs with pagination, state filter, hasActiveRun flag) and POST (validate stateAbbr, check 409 conflict, check env vars for 503, pre-create DiscoveryRun record, spawn `scripts/discovery/discover.ts --state {abbr} --run-id {id}` detached, return 201) in src/app/api/admin/discovery/runs/route.ts
- [x] T005 [P] [US1] Create cancel API route with PATCH (validate action="cancel", find run by id, check RUNNING status for 409, set status to CANCELLED in DB, return 200 with cancellation message) in src/app/api/admin/discovery/runs/[id]/route.ts
- [x] T006 [P] [US1] Create summary API route with GET (validate state param, query UrlCandidate.groupBy for candidate counts by status, query DiscoveryRun.findFirst for last run, check hasActiveRun for state, return StateSummary) in src/app/api/admin/discovery/summary/route.ts
- [x] T007 [US1] Create DiscoveryRunTrigger client component (US state dropdown with all 50 states, state summary card showing candidate counts and last run date fetched from GET /summary, "Run Discovery" button that POSTs to /runs and disables when hasActiveRun is true, "Cancel" button that PATCHes /runs/[id] when a run is RUNNING, error/success toast messages for 400/409/503 responses) in src/components/admin/DiscoveryRunTrigger.tsx
- [x] T008 [US1] Create DiscoveryRunHistory client component (table displaying runs with columns: state, status, started, completed, queries run, candidates found, new candidates, error message; fetch from GET /runs; reverse chronological order) in src/components/admin/DiscoveryRunHistory.tsx
- [x] T009 [US1] Integrate DiscoveryRunTrigger and DiscoveryRunHistory into the existing admin discovery page — add both components above the existing candidates DataTable section, wire up shared state so triggering a run refreshes the history table in src/app/admin/discovery/page.tsx

**Checkpoint**: US1 complete — admin can trigger discovery for any state, see summary, cancel runs. The history table shows runs but does not yet auto-refresh or support pagination/filtering.

---

## Phase 4: User Story 2 — Monitor Discovery Run Progress (Priority: P2)

**Goal**: Runs auto-refresh while active so the admin can watch metrics update in real time without manually reloading.

**Independent Test**: Trigger a discovery run → observe the history table auto-refreshing every 5 seconds → see queriesRun and candidatesFound increment → see status transition from RUNNING to COMPLETED/FAILED with final metrics and completion time.

### Implementation for User Story 2

- [x] T010 [US2] Add auto-poll mechanism to DiscoveryRunHistory — implement setInterval at 5-second intervals that re-fetches GET /runs when hasActiveRun is true in the response; stop polling when all runs reach terminal status (COMPLETED/FAILED/CANCELLED); restart polling when a new run is triggered via callback from DiscoveryRunTrigger; wrap the table or status column in an `aria-live="polite"` region so screen readers announce status changes (Constitution VI WCAG) in src/components/admin/DiscoveryRunHistory.tsx
- [x] T011 [US2] Add status transition display to DiscoveryRunHistory — render Running status with a spinner/pulse indicator, Completed with a success badge, Failed with an error badge; show errorMessage column content for failed runs with clear formatting; display completedAt as relative time (e.g., "2 min ago") in src/components/admin/DiscoveryRunHistory.tsx

**Checkpoint**: US1 + US2 complete — admin can trigger, cancel, and watch discovery runs with live-updating metrics. History table auto-refreshes during active runs.

---

## Phase 5: User Story 3 — View Discovery Run History (Priority: P3)

**Goal**: Admin can browse past runs with pagination and filter by state to understand discovery coverage across states.

**Independent Test**: After multiple runs for different states exist → verify runs display in reverse chronological order → filter by a specific state and verify only matching runs show → navigate pages → select a never-discovered state and verify empty state message appears.

### Implementation for User Story 3

- [x] T012 [US3] Add state filter dropdown and pagination controls to DiscoveryRunHistory — add a state filter select above the table that passes ?state= to GET /runs; add prev/next/page-number pagination controls below the table using the pagination response metadata (page, totalPages, total); preserve filter state across page navigation in src/components/admin/DiscoveryRunHistory.tsx
- [x] T013 [US3] Add empty state handling to DiscoveryRunHistory — when the runs list is empty and a state filter is active, display a message like "No discovery runs found for {state}. Select the state above and click Run Discovery to get started." with appropriate styling in src/components/admin/DiscoveryRunHistory.tsx

**Checkpoint**: All user stories complete — full trigger, monitor, and history browsing functionality.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Validate the complete feature against the quickstart guide and edge cases.

- [x] T014 [P] Run quickstart.md verification steps — start dev server, navigate to /admin/discovery/, trigger a run, cancel a run, verify API curl commands all return expected responses
- [x] T015 [P] Review all edge cases from spec.md — verify missing API key shows clear error (503), stale lock cleanup works, re-running a recently discovered state is allowed, navigating away doesn't interrupt background process, concurrent trigger attempts show 409 error

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (CANCELLED enum must exist for cancellation check)
- **User Stories (Phase 3–5)**: All depend on Phase 2 (discover.ts must accept --run-id)
  - User stories proceed sequentially in priority order: P1 → P2 → P3
  - US2 and US3 modify the same component file (DiscoveryRunHistory.tsx), so sequential execution avoids conflicts
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Phase 2 — no dependency on other stories
- **User Story 2 (P2)**: Depends on US1 (adds auto-poll to the DiscoveryRunHistory component created in T008)
- **User Story 3 (P3)**: Depends on US2 (adds filters/pagination to DiscoveryRunHistory which already has auto-poll)

### Within Each User Story

- API routes before client components (components call the endpoints)
- Components before page integration
- Core implementation before enhancements

### Parallel Opportunities

**Phase 3 (US1)**: T004, T005, T006 can all run in parallel (three separate API route files)
**Phase 6 (Polish)**: T014, T015 can run in parallel

---

## Parallel Example: User Story 1

```text
# Launch all API routes in parallel (three different files):
T004: "Create runs API route (GET + POST) in src/app/api/admin/discovery/runs/route.ts"
T005: "Create cancel API route (PATCH) in src/app/api/admin/discovery/runs/[id]/route.ts"
T006: "Create summary API route (GET) in src/app/api/admin/discovery/summary/route.ts"

# Then sequentially:
T007: "Create DiscoveryRunTrigger component" (needs T004 POST, T005 PATCH, T006 GET)
T008: "Create DiscoveryRunHistory component" (needs T004 GET)
T009: "Integrate into page.tsx" (needs T007, T008)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (Prisma migration)
2. Complete Phase 2: Foundational (discover.ts --run-id + cancellation)
3. Complete Phase 3: User Story 1 (trigger, cancel, summary, basic table)
4. **STOP and VALIDATE**: Trigger a discovery run from the UI, cancel it, verify metrics
5. Deploy/demo if ready — admin can now trigger discovery without CLI access

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 (US1) → Trigger, cancel, summary card, basic history table → **Deploy (MVP!)**
3. Phase 4 (US2) → Auto-poll, live metrics, status badges → Deploy
4. Phase 5 (US3) → Pagination, state filter, empty state → Deploy
5. Phase 6 → Validate all edge cases → Final release

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story builds incrementally on the DiscoveryRunHistory component
- The discover.ts changes (Phase 2) are the critical path — without --run-id, the API cannot pre-create run records
- Commit after each task or logical group
- Stop at any checkpoint to validate the story independently
