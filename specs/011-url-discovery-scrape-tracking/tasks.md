# Tasks: URL Discovery & Scrape Failure Tracking

**Input**: Design documents from `/specs/011-url-discovery-scrape-tracking/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1–US5)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Database schema, new directories, env config, shared types

- [X] T001 Add CandidateStatus, FailureType, DiscoveryRunStatus enums and UrlCandidate, ScrapeFailure, DiscoveryRun models to prisma/schema.prisma per data-model.md
- [X] T002 Run `npx prisma migrate dev --name url_discovery_scrape_tracking` to generate and apply migration
- [X] T003 [P] Create scripts/discovery/ directory and add tsconfig.json extending scripts/harvest/tsconfig.json
- [X] T004 [P] Create scripts/maintenance/ directory for purge script
- [X] T005 [P] Add GOOGLE_CSE_API_KEY and GOOGLE_CSE_CX to .env.example with placeholder values
- [X] T006 Update fetchDelayMs in scripts/harvest/state-config-schema.ts RateLimitConfigSchema: change `.min(500)` to `.min(2000)` and `.default(1500)` to `.default(2000)` to enforce FR-011b minimum 2-second delay

**Checkpoint**: Database has new tables, directory structure is ready, rate limit default updated.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core modules that multiple user stories depend on — MUST complete before any story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 [P] Create scripts/discovery/search-client.ts — Google CSE API wrapper using native fetch with types for SearchResult (title, link, snippet, displayLink), query builder for 3 court levels (supreme/appellate/trial), env var validation (GOOGLE_CSE_API_KEY, GOOGLE_CSE_CX), and rate limit error handling (403 detection)
- [X] T008 [P] Create scripts/discovery/classifier.ts — LLM classification module using existing scripts/harvest/llm-provider.ts that accepts a batch of SearchResults, prompts gpt-4o-mini to classify each as judicial roster (true/false) with courtType, courtLevel, and confidence score (0.0–1.0), returns ClassificationResult[] with reasoning, handles LLM unavailability by returning null confidence
- [X] T009 [P] Create scripts/discovery/candidate-store.ts — Prisma DB operations for UrlCandidate: upsertCandidate (skip duplicates by URL unique constraint), getByState, getByStatus, updateStatus (approve/reject with timestamp), bulkUpdateStatus, and staleness computation helper (status=DISCOVERED AND age>30 days returns isStale=true)
- [X] T010 [P] Create scripts/harvest/failure-tracker.ts — failure classification module with classifyFailure(error, httpStatus?, responseBody?) returning FailureType enum, CAPTCHA_INDICATORS keyword array per research.md, recordFailure(url, state, stateAbbr, failureType, httpStatusCode?, errorMessage?, retryCount) Prisma insert, resolveFailuresForUrl(url) that sets resolvedAt+resolvedBy="auto" on unresolved records, all wrapped in try/catch with console.warn on DB errors (FR-011: non-blocking)

**Checkpoint**: All four foundational modules exist with typed interfaces. Discovery and failure tracking can now be wired into user stories.

---

## Phase 3: User Story 1 — Discover Court Roster URLs for a New State (Priority: P1) 🎯 MVP

**Goal**: Admin runs `npx tsx scripts/discovery/discover.ts --state FL` and candidates appear in the database with confidence scores.

**Independent Test**: Run discovery CLI for Florida, verify candidates in DB with `npx prisma studio`, compare against known florida-courts.json URLs.

### Implementation for User Story 1

- [X] T011 Create scripts/discovery/discover.ts — CLI entry point with --state (required), --dry-run, and --all flags using process.argv parsing; validate env vars on startup (exit with clear error if missing); check advisory lock (query DiscoveryRun WHERE status=RUNNING AND startedAt > 1 hour ago — abort if found, mark stale locks as FAILED); create DiscoveryRun record with status=RUNNING
- [X] T012 Wire discovery pipeline in scripts/discovery/discover.ts — for each court level (supreme, appellate, trial): call search-client.ts to query Google CSE, pass results to classifier.ts for batch LLM classification, call candidate-store.ts to upsert candidates with discoveryRunId, increment queriesRun/candidatesFound/candidatesNew counters on DiscoveryRun
- [X] T013 Implement dry-run mode in scripts/discovery/discover.ts — when --dry-run flag is set, display classified candidates as formatted table in terminal (confidence, URL, suggestedType) without any DB writes except the DiscoveryRun record (which should also be skipped in dry-run)
- [X] T014 Implement completion handling in scripts/discovery/discover.ts — update DiscoveryRun status to COMPLETED with completedAt timestamp on success, FAILED with errorMessage on error, log summary (queries run, candidates found, new vs duplicates), handle rate limit (403 from Google CSE) by stopping gracefully and reporting partial results
- [X] T015 Implement --all flag in scripts/discovery/discover.ts — iterate all 50 US states using a hardcoded STATES array (abbreviation + name), call discovery for each sequentially, stop if Google CSE rate limit hit, report per-state and overall summary

**Checkpoint**: `npx tsx scripts/discovery/discover.ts --state FL` discovers URLs, classifies them, stores candidates in DB. Dry-run works. Advisory lock prevents concurrent runs.

---

## Phase 4: User Story 2 — Track Scrape Failures During Harvest Runs (Priority: P1)

**Goal**: When harvest pipeline encounters fetch/extraction errors, failure records automatically appear in scrape_failures table with correct classification.

**Independent Test**: Run `npx tsx scripts/harvest/index.ts --state FL`, check scrape_failures table for any URLs that failed. Verify failure types match error conditions.

### Implementation for User Story 2

- [X] T016 Modify scripts/harvest/fetcher.ts — add CAPTCHA detection: after successful HTTP 200 response but before returning, scan rawHtml for CAPTCHA_INDICATORS (import from failure-tracker.ts); if detected, throw a new CaptchaDetectedError with the matched indicator keyword in the message
- [X] T017 Modify scripts/harvest/index.ts — import failure-tracker.ts; wrap each court URL's fetch+extract pipeline call in try/catch that calls recordFailure() with classified failure type, state info from the state config, HTTP status code, error message, and retry count from the fetcher
- [X] T018 Add Empty Page detection in scripts/harvest/index.ts — after successful fetch+extract, if zero judges were extracted from a URL, call recordFailure() with failureType=EMPTY_PAGE, httpStatusCode=200, and errorMessage describing zero extraction
- [X] T019 Add auto-resolution in scripts/harvest/index.ts — after successful fetch+extract that yields judges, call resolveFailuresForUrl(url) from failure-tracker.ts to mark any previous unresolved failures for that URL as resolved with resolvedBy="auto"
- [X] T020 Verify non-blocking behavior in scripts/harvest/failure-tracker.ts — ensure all recordFailure() and resolveFailuresForUrl() calls are wrapped in try/catch with console.warn fallback so harvest pipeline never crashes due to failure tracking DB errors

**Checkpoint**: Harvest runs automatically record failures and auto-resolve on success. Pipeline behavior unchanged for successful URLs.

---

## Phase 5: User Story 3 — Review and Approve Discovered URL Candidates (Priority: P2)

**Goal**: Admin opens `/admin/discovery/` page, sees candidates table, can filter/approve/reject/bulk-approve, and promote approved candidates to state config.

**Independent Test**: Insert sample UrlCandidate rows via Prisma Studio, load admin page, verify table renders, approve/reject actions persist, promote generates valid JSON config file.

### API Routes for User Story 3

- [X] T021 [P] [US3] Create src/app/api/admin/discovery/route.ts — GET handler: accept query params (state, status, sort, order, page, limit per contracts/api.md), query UrlCandidate with Prisma (compute isStale boolean, handle STALE status filter as status=DISCOVERED AND age>30d), return paginated response matching contract schema
- [X] T022 [P] [US3] Create src/app/api/admin/discovery/[id]/route.ts — PATCH handler: accept {action, rejectionReason} body, validate rejection reason required when action=reject, update UrlCandidate status and reviewedAt timestamp, return updated record; handle 404 for missing ID
- [X] T023 [P] [US3] Create src/app/api/admin/discovery/bulk/route.ts — PATCH handler: accept {ids[], action, rejectionReason} body, validate ids array non-empty, bulk update UrlCandidate records using Prisma updateMany, return {updated: count, action}
- [X] T024 [P] [US3] Create scripts/discovery/config-promoter.ts — promoteToConfig(stateAbbr) function: query approved+unpromoted UrlCandidates for state, load existing {state}-courts.json if present, merge new entries (skip duplicate URLs), fill CourtEntry defaults (empty counties array, fetchMethod="http", deterministic=false, notes="Promoted from discovery — needs manual enrichment"), validate output with StateConfigSchema, write to scripts/harvest/{state}-courts.json, update promotedAt on promoted candidates
- [X] T025 [US3] Create src/app/api/admin/discovery/promote/route.ts — POST handler: accept {stateAbbr} body, call config-promoter.ts promoteToConfig(), return {state, configPath, entriesAdded, entriesExisting, entriesTotal, candidatesPromoted}; return 400 if no approved candidates exist

### Admin UI for User Story 3

- [X] T026 [US3] Create src/app/admin/discovery/page.tsx — client component with: table displaying UrlCandidate fields (URL truncated, domain, state, suggestedType, suggestedLevel, confidenceScore as badge 0-1, status with color coding, discoveredAt formatted); state filter dropdown (fetch states from /api/admin/states); status filter dropdown (Discovered, Stale, Approved, Rejected); sort toggle (confidence/date); pagination controls matching existing admin patterns
- [X] T027 [US3] Add approve/reject actions to src/app/admin/discovery/page.tsx — Approve button per row calls PATCH /api/admin/discovery/:id with action=approve; Reject button opens inline input for rejection reason then calls PATCH with action=reject; update table row state optimistically; show error toast on failure
- [X] T028 [US3] Add bulk selection and bulk actions to src/app/admin/discovery/page.tsx — checkbox per row, select-all checkbox in header, "Bulk Approve" and "Bulk Reject" buttons (reject shows reason input modal), calls PATCH /api/admin/discovery/bulk, refresh table after completion
- [X] T029 [US3] Add "Promote to Config" button to src/app/admin/discovery/page.tsx — button visible when approved candidates exist for selected state, calls POST /api/admin/discovery/promote with stateAbbr, displays result summary (entries added, total), disables button during request

**Checkpoint**: Full candidate review workflow — list, filter, approve, reject, bulk actions, promote to config — all working through admin UI.

---

## Phase 6: User Story 4 — View and Manage Scrape Failures (Priority: P2)

**Goal**: Admin opens `/admin/failures/` page, sees failure records table, can filter by state/type/date, and mark failures as resolved with notes.

**Independent Test**: Insert sample ScrapeFailure rows via Prisma Studio, load admin page, verify table renders with correct failure types, filters work, mark resolved persists.

### API Routes for User Story 4

- [X] T030 [P] [US4] Create src/app/api/admin/failures/route.ts — GET handler: accept query params (state, failureType, resolved, dateFrom, dateTo, page, limit per contracts/api.md), query ScrapeFailure with Prisma; default view (no date filter) returns most recent failure per URL using DISTINCT ON or orderBy+take pattern with occurrence count (count of all records for same URL); when date filters are applied, return all matching records; return paginated response with summary object (totalUnresolved, byType counts)
- [X] T031 [P] [US4] Create src/app/api/admin/failures/[id]/route.ts — PATCH handler: accept {resolutionNotes} body, validate failure exists and is not already resolved (return 409 if resolved), set resolvedAt=now(), resolvedBy="manual", resolutionNotes, return updated record; handle 404

### Admin UI for User Story 4

- [X] T032 [US4] Create src/app/admin/failures/page.tsx — client component with: summary cards at top (total unresolved, breakdown by failure type from response.summary); table displaying ScrapeFailure fields (URL truncated, state, failureType as colored badge, httpStatusCode, errorMessage truncated with tooltip, retryCount, attemptedAt formatted, resolution status); filters: state dropdown, failureType dropdown (all FailureType enum values), resolved/unresolved toggle, date range inputs (dateFrom, dateTo); pagination matching existing admin patterns
- [X] T033 [US4] Add "Mark Resolved" action to src/app/admin/failures/page.tsx — button per unresolved row opens inline textarea for resolution notes, calls PATCH /api/admin/failures/:id, updates row to show resolved state with green indicator, hides resolve button for already-resolved rows

**Checkpoint**: Failure management workflow — list, filter, view details, mark resolved — all working through admin UI.

---

## Phase 7: User Story 5 — Navigate to Discovery and Failures from Admin Dashboard (Priority: P3)

**Goal**: Admin dashboard shows new cards and nav bar includes links to both new pages.

**Independent Test**: Load `/admin/`, verify two new cards appear and link to `/admin/discovery/` and `/admin/failures/`. Verify nav bar links on all admin pages.

### Implementation for User Story 5

- [X] T034 [P] [US5] Add "Discovery" and "Scrape Failures" nav links to src/app/admin/layout.tsx — add two Link elements after existing "Courts" link: "Discovery" pointing to /admin/discovery/ and "Failures" pointing to /admin/failures/, using same linkClasses pattern
- [X] T035 [P] [US5] Add AdminCard entries to src/app/admin/page.tsx — add two cards to the grid: "URL Discovery" with description "Discover and review court roster URLs for new states" linking to /admin/discovery/, and "Scrape Failures" with description "Track and manage harvest scraping failures" linking to /admin/failures/

**Checkpoint**: Both new pages are discoverable from the admin dashboard and nav bar.

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Maintenance script, env documentation, final validation

- [X] T036 [P] Create scripts/maintenance/purge-failures.ts — standalone CLI script: query and delete ScrapeFailure records WHERE resolvedAt IS NOT NULL AND resolvedAt < NOW() - 90 days, support --dry-run flag to report count without deleting, log count of purged records
- [X] T037 [P] Update quickstart.md verification checklist with actual commands and expected outputs based on implementation
- [X] T038 Run quickstart.md verification checklist end-to-end: migrate DB, run discovery CLI for FL, verify candidates in DB, test admin discovery page, test admin failures page, test nav links, run purge script in dry-run mode

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Foundational)**: Depends on Phase 1 (T001-T002 must complete for Prisma client types)
- **Phase 3 (US1 — Discovery CLI)**: Depends on Phase 2 (T007, T008, T009)
- **Phase 4 (US2 — Failure Tracking)**: Depends on Phase 2 (T010); independent of Phase 3
- **Phase 5 (US3 — Discovery Admin UI)**: Depends on Phase 2 (T009) and Phase 3 (T011-T014 for data to review)
- **Phase 6 (US4 — Failures Admin UI)**: Depends on Phase 2 (T010) and Phase 4 (T016-T020 for data to view)
- **Phase 7 (US5 — Dashboard Nav)**: Depends on Phase 5 (T026) and Phase 6 (T032) for pages to link to
- **Phase 8 (Polish)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Phase 2 → can start immediately after foundational
- **US2 (P1)**: Phase 2 → can start **in parallel** with US1 (different files entirely)
- **US3 (P2)**: Phase 2 + ideally after US1 (needs candidates in DB to review)
- **US4 (P2)**: Phase 2 + ideally after US2 (needs failures in DB to view)
- **US5 (P3)**: After US3 + US4 (needs pages to link to)

### Parallel Opportunities

**Phase 1**: T003, T004, T005 can run in parallel (different directories/files)
**Phase 2**: T007, T008, T009, T010 can ALL run in parallel (four independent files)
**Phase 3 + Phase 4**: US1 and US2 can run in parallel — zero file overlap
**Phase 5**: T021, T022, T023, T024 can run in parallel (four independent route/script files)
**Phase 6**: T030, T031 can run in parallel (two independent route files)
**Phase 7**: T034, T035 can run in parallel (different files)

---

## Parallel Example: Foundational Phase

```text
# All four foundational modules can be created simultaneously:
T007: scripts/discovery/search-client.ts    (Google CSE wrapper)
T008: scripts/discovery/classifier.ts       (LLM classification)
T009: scripts/discovery/candidate-store.ts  (DB operations)
T010: scripts/harvest/failure-tracker.ts    (Failure classification + recording)
```

## Parallel Example: US1 + US2 Simultaneously

```text
# Developer A: Discovery CLI (US1)
T011 → T012 → T013 → T014 → T015

# Developer B: Failure Tracking (US2)  
T016 → T017 → T018 → T019 → T020

# Zero file conflicts — completely independent
```

---

## Implementation Strategy

### MVP First (US1 Only)

1. Complete Phase 1: Setup (T001–T006)
2. Complete Phase 2: Foundational — T007, T008, T009 only (skip T010)
3. Complete Phase 3: US1 — Discovery CLI (T011–T015)
4. **STOP and VALIDATE**: Run discovery for FL, verify candidates in DB
5. This alone delivers the core value: automated URL discovery

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. US1 (Discovery CLI) → MVP! Validate with FL discovery
3. US2 (Failure Tracking) → Harvest runs now track failures
4. US3 (Discovery Admin UI) → Review workflow operational
5. US4 (Failures Admin UI) → Failure management operational
6. US5 (Dashboard Nav) → Navigation polish
7. Polish → Purge script, final validation
