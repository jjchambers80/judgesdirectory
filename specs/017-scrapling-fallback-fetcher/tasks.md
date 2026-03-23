# Tasks: Scrapling Fallback Fetcher

**Input**: Design documents from `/specs/017-scrapling-fallback-fetcher/`
**Prerequisites**: plan.md ✓, spec.md ✓, research.md ✓, data-model.md ✓, contracts/ ✓, quickstart.md ✓

**Tests**: No test tasks — automated testing was not explicitly requested in the feature specification. Validation is via dry-run harvests and TypeScript compilation per quickstart.md.

**Organization**: Tasks grouped by user story. US1 contains the bulk of implementation. US2–US5 are refinement and validation phases.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files or independent code sections, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in descriptions

---

## Phase 1: Setup

**Purpose**: Verify environment and establish baseline before changes

- [X] T001 Verify TypeScript compilation passes with `npx tsc --noEmit` to establish baseline

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Fix existing bugs in wrapper files and extend shared types — MUST complete before any user story work

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T002 [P] Remove dead `const exec = promisify(spawn)` import (line 22) and unused `TEMP_DIR` setup (lines 25-28) in scripts/harvest/scrapling-fetcher.ts
- [X] T003 [P] Fix `SITE_CONFIGS` default entry type mismatch (`'auto'` not in `'native' | 'scrapling'` union) and remove unused `cleanHtml` import in scripts/harvest/hybrid-fetcher.ts
- [X] T004 [P] Extend `fetchMethod` enum from `["http", "browser", "manual"]` to `["http", "browser", "manual", "scrapling", "auto"]` with default `"http"` in scripts/harvest/state-config-schema.ts
- [X] T005 Update `ScraplingResult` interface: add `rawHtml: string` and `durationMs?: number` fields in scripts/harvest/scrapling-fetcher.ts

**Checkpoint**: Bug fixes applied, extended types ready — user story implementation can begin

---

## Phase 3: User Story 1 — Harvest Anti-Bot Protected Sites (Priority: P1) 🎯 MVP

**Goal**: Scrapling CLI integration fetches page content from Cloudflare-protected court websites (e.g., NY courts) via a new `getPageContent()` dispatcher

**Independent Test**: Run `npx tsx scripts/harvest/index.ts --state NY --dry-run` and verify Scrapling is invoked for NY courts, returning markdown content with judge names

### Implementation for User Story 1

- [X] T006 [P] [US1] Add `STEALTH_DOMAIN_ALLOWLIST` constant (`Set` with `nycourts.gov`, `iapps.courts.state.ny.us`) and `isAllowlistedDomain(url): boolean` function in scripts/harvest/scrapling-fetcher.ts
- [X] T007 [P] [US1] Add `DomainRateTracker` — module-level `lastFetchByDomain: Map<string, number>` with configurable delay (default 3000ms) and async `waitForDomainDelay(domain: string)` helper in scripts/harvest/scrapling-fetcher.ts
- [X] T008 [P] [US1] Implement `isScraplingAvailable(): Promise<boolean>` that executes `scrapling --version` on first call and caches the boolean result in a module-level variable for process lifetime in scripts/harvest/scrapling-fetcher.ts
- [X] T009 [US1] Rewrite `fetchWithScrapling(url, options?)` with correct file-based CLI invocation: write to temp `.md` file via `spawn('scrapling', ['extract', 'stealthy-fetch', url, tmpFile, '--solve-cloudflare', '--timeout', '30000'])`, read file contents, cleanup temp file, enforce allowlist check via `isAllowlistedDomain()`, enforce per-domain rate limiting via `waitForDomainDelay()`, implement retry-once with 15s backoff on failure (FR-014), and default timeout of 30000ms (SC-005) in scripts/harvest/scrapling-fetcher.ts
- [X] T010 [US1] Implement `getPageContent(url, fetchMethod, rateLimit?)` dispatcher: route `"http"` → `fetchPage()`, `"scrapling"` → `fetchWithScrapling()` (if available, else warn+skip), `"auto"` → `fetchPage()` first then `fetchWithScrapling()` if markdown < 200 chars, `"browser"`/`"manual"` → skip with log; adapt `ScraplingResult` to `FetchResult` return type; add basic fetch-method logging in scripts/harvest/hybrid-fetcher.ts
- [X] T011 [P] [US1] Replace direct `fetchPage()` call with `getPageContent(url, entry.fetchMethod, rateLimit)` in first harvest loop (~line 1038) in scripts/harvest/index.ts
- [X] T012 [P] [US1] Replace direct `fetchPage()` call with `getPageContent(url, entry.fetchMethod, rateLimit)` in second harvest loop (~line 1332) in scripts/harvest/index.ts
- [X] T013 [P] [US1] Replace direct `fetchPage()` call with `getPageContent(url, fetchMethod)` in `enrichWithBioPages()` function in scripts/harvest/bio-enricher.ts
- [X] T014 [US1] Update NY court config entries: change all `fetchMethod: "browser"` to `fetchMethod: "scrapling"` in scripts/harvest/legacy/new-york-courts.json

**Checkpoint**: Scrapling integration complete — NY courts can be harvested via stealth fetcher. FL/CA/TX/SC still use standard `fetchPage()` path unchanged.

---

## Phase 4: User Story 2 — Zero Regressions (Priority: P1)

**Goal**: Existing harvest behavior for FL, CA, TX, SC is completely unchanged after integration

**Independent Test**: Run dry-run harvests for FL and verify all pages use standard fetcher with identical output, zero `[Scrapling]` log lines

### Validation for User Story 2

- [X] T015 [P] [US2] Load all existing court config JSON files (FL, CA, TX, SC) through extended `CourtEntrySchema` and confirm they validate without errors — run via `npx tsx -e` one-liner or small script
- [X] T016 [US2] Run `npx tsc --noEmit` to confirm zero TypeScript errors after all Phase 2+3 changes
- [X] T017 [US2] Run `npx tsx scripts/harvest/index.ts --state FL --dry-run` and verify: (a) all courts use `fetchPage()`, (b) zero `[Scrapling]` log lines, (c) output is identical to pre-change baseline

**Checkpoint**: Regression-free — standard fetcher path unchanged for all existing states

---

## Phase 5: User Story 3 — Graceful Degradation (Priority: P2)

**Goal**: Pipeline completes without errors when Scrapling CLI is not installed

**Independent Test**: With Scrapling uninstalled, run NY harvest dry-run and verify a single warning is logged and pipeline continues without crashing

### Implementation for User Story 3

- [X] T018 [US3] Add once-per-run warning deduplication in `getPageContent()` — when `isScraplingAvailable()` returns false and a scrapling-configured court is encountered, log `"[Scrapling] CLI not available — skipping stealth fetch"` only on the first occurrence, not per court in scripts/harvest/hybrid-fetcher.ts
- [X] T019 [US3] Ensure `getPageContent()` with `fetchMethod: "auto"` falls back to returning the standard `fetchPage()` result (even if < 200 chars) when Scrapling is unavailable, instead of skipping in scripts/harvest/hybrid-fetcher.ts

**Checkpoint**: Pipeline is resilient to missing Scrapling installation — no crashes, single warning

---

## Phase 6: User Story 4 — Per-Court Fetch Method Configuration (Priority: P2)

**Goal**: Operators can set `fetchMethod` per court entry to `"http"`, `"scrapling"`, or `"auto"` and the dispatcher routes correctly

**Independent Test**: Set one court to each fetchMethod value and verify correct routing via log output

### Validation for User Story 4

- [X] T020 [US4] Verify `getPageContent()` correctly dispatches all 5 fetchMethod enum values (`http`, `browser`, `manual`, `scrapling`, `auto`) with appropriate behavior — trace each code path in scripts/harvest/hybrid-fetcher.ts
- [X] T021 [US4] Verify auto-detect fallback in `getPageContent()` triggers Scrapling only when standard fetch markdown < 200 chars, and does NOT trigger when standard fetch returns sufficient content in scripts/harvest/hybrid-fetcher.ts

**Checkpoint**: Per-court fetch method configuration works for all enum values with correct routing

---

## Phase 7: User Story 5 — Observability (Priority: P3)

**Goal**: Harvest logs clearly identify which fetch method was used for every page, including fallback attempts

**Independent Test**: Run harvest with mixed standard/stealth courts and verify each log entry shows fetch method, URL, and result

### Implementation for User Story 5

- [X] T022 [P] [US5] Add structured log output to `getPageContent()` with format `[Fetch] method=<method> url=<url> result=<success|failure|fallback> contentSize=<bytes>` in scripts/harvest/hybrid-fetcher.ts
- [X] T023 [P] [US5] Add timing (`durationMs`), attempt count (1 or 2), and error details to `fetchWithScrapling()` log output with format `[Scrapling] url=<url> attempt=<n> duration=<ms> result=<success|failure> error=<msg?>` in scripts/harvest/scrapling-fetcher.ts

**Checkpoint**: Full observability — every fetch is traceable in harvest logs with method, timing, and result

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup across all stories

- [X] T024 Run all quickstart.md validation steps: (1) standalone Scrapling test, (2) FL dry-run regression, (3) NY harvest dry-run, (4) graceful degradation with Scrapling uninstalled
- [X] T025 Final `npx tsc --noEmit` compilation check and manual code review for security: allowlist enforcement in all paths, no auth bypass, temp file cleanup, no credential leaks

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — core implementation
- **US2 (Phase 4)**: Depends on US1 (Phase 3) — validates no regressions after integration
- **US3 (Phase 5)**: Depends on US1 (Phase 3) — refines degradation path in `getPageContent()`
- **US4 (Phase 6)**: Depends on US1 (Phase 3) — validates per-court routing in `getPageContent()`
- **US5 (Phase 7)**: Depends on US1 (Phase 3) — adds structured logging to dispatchers
- **Polish (Phase 8)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational — no dependencies on other stories
- **US2 (P1)**: Depends on US1 — cannot validate regressions until integration exists
- **US3 (P2)**: Depends on US1 — refines the availability guard in `getPageContent()`
- **US4 (P2)**: Depends on US1 — validates routing logic in `getPageContent()`
- **US5 (P3)**: Depends on US1 — adds structured logging to existing functions

> US3, US4, and US5 can all run **in parallel** after US1 is complete

### Within User Story 1

- T006, T007, T008 → parallel (independent helper functions in same file, different sections)
- T009 → depends on T006+T007+T008 (uses allowlist, rate tracker, availability check)
- T010 → depends on T009 (dispatcher calls `fetchWithScrapling()`)
- T011, T012, T013, T014 → parallel (different files, all depend on T010)

### Parallel Opportunities

**Foundational Phase** (all different files):
```
T002 (scrapling-fetcher.ts) ─┐
T003 (hybrid-fetcher.ts)     ├── All in parallel
T004 (state-config-schema.ts)─┘
T005 (scrapling-fetcher.ts)  → after T002 (same file)
```

**US1 helpers** (same file, independent sections):
```
T006 (allowlist)      ─┐
T007 (rate tracker)   ─┼── In parallel
T008 (availability)   ─┘
```

**US1 integration** (different files):
```
T011 (index.ts loop 1)          ─┐
T012 (index.ts loop 2)          ─┼── All in parallel
T013 (bio-enricher.ts)          ─┤
T014 (new-york-courts.json)     ─┘
```

**After US1** (independent stories):
```
US2: T015-T017  ─┐
US3: T018-T019  ─┼── All stories in parallel
US4: T020-T021  ─┤
US5: T022-T023  ─┘
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (verify baseline)
2. Complete Phase 2: Foundational (bug fixes + schema extension)
3. Complete Phase 3: User Story 1 (full Scrapling integration)
4. **STOP and VALIDATE**: Run NY dry-run + FL regression check
5. This is the MVP — Scrapling integration works for NY courts

### Incremental Delivery

1. Foundation + US1 → Scrapling integration works → **MVP!**
2. Add US2 validation → Confirmed zero regressions → **Production-safe**
3. Add US3 → Graceful degradation verified → **CI/CD safe**
4. Add US4 → Per-court config validated → **Operator-ready**
5. Add US5 → Full observability → **Operationally mature**
6. Polish → Quickstart complete → **Feature done**

Each story adds operational confidence without breaking previous stories.

---

## Notes

- Scrapling CLI corrections from research.md are **critical**: file-based output (not stdout), no `--markdown` flag, `--solve-cloudflare` required, Python 3.10+
- 6 bugs in scrapling-fetcher.ts and 2 in hybrid-fetcher.ts are fixed in Foundational phase before any feature work
- `getPageContent()` is the single dispatch point — all pipeline fetch calls route through it after US1
- Domain allowlist (`STEALTH_DOMAIN_ALLOWLIST`) enforces security — stealth fetcher only runs against explicitly approved government domains
- No Prisma migrations needed — court configs are JSON files, not database entities
- Commit after each phase or logical task group
