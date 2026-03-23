---
goal: Fix, validate, and integrate Scrapling into the harvest pipeline as a fallback fetcher for anti-bot and JS-heavy court sites
version: 1.0
date_created: 2026-03-19
last_updated: 2026-03-19
owner: jjchambers
status: 'Planned'
tags: [feature, infrastructure, scraping, state-expansion]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

The harvest pipeline currently uses native `fetch` + Cheerio + Turndown for court website scraping. This works for static HTML and known SPA patterns (Next.js/Gatsby) but fails on sites with anti-bot protection (NY Cloudflare Turnstile) or heavy JS rendering. Commit `3ec8ccf` added two Scrapling wrapper files (`scrapling-fetcher.ts`, `hybrid-fetcher.ts`) but they contain bugs, are not installed, and have zero integration with the pipeline. This plan fixes the existing code, installs Scrapling, validates it against a real blocked site (NY courts), and wires it into the harvest pipeline as a transparent fallback.

## 1. Requirements & Constraints

- **REQ-001**: Scrapling CLI must be installed and available on the system PATH
- **REQ-002**: Existing `fetchPage()` behavior must remain unchanged for sites that work today (FL, CA, TX)
- **REQ-003**: Hybrid fetcher must transparently fall back to Scrapling only when native fetch returns insufficient content or fails
- **REQ-004**: No new Node.js dependencies — Scrapling is a Python CLI tool invoked via `child_process.spawn`
- **REQ-005**: NY courts (`nycourts.gov`, `iapps.courts.state.ny.us`) must return usable content via Scrapling stealth mode
- **SEC-001**: Scrapling must not be used to bypass authentication — only public court websites with anti-bot challenges
- **CON-001**: Scrapling is a Python dependency — requires Python 3.9+ and `pip install scrapling`
- **CON-002**: Scrapling stealth mode is slower than native fetch (~5-15s per page vs ~1-2s)
- **CON-003**: Must not break existing harvest runs for FL, CA, TX, SC states
- **GUD-001**: Follow established fetcher pattern — return `FetchResult`-compatible objects
- **GUD-002**: Log fetcher source (native vs scrapling) for observability
- **PAT-001**: Match existing `fetchPage()` export signature where possible

## 2. Implementation Steps

### Phase 1: Bug Fixes & Code Cleanup

- GOAL-001: Fix all known bugs in the existing Scrapling wrapper files so they compile and run correctly

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Remove dead `const exec = promisify(spawn)` import from `scripts/harvest/scrapling-fetcher.ts` line 22 | | |
| TASK-002 | Remove unused `cleanHtml` import from `scripts/harvest/hybrid-fetcher.ts` line 18 | | |
| TASK-003 | Remove unused `TEMP_DIR` creation block from `scripts/harvest/scrapling-fetcher.ts` lines 25-28 | | |
| TASK-004 | Fix `SITE_CONFIGS` type in `hybrid-fetcher.ts` — add `'auto'` to the `prefer` union type so the `default` entry compiles under strict mode | | |
| TASK-005 | Add `rawHtml` field to `ScraplingResult` interface and populate it from stdout when `--html` flag is used (currently always empty string) | | |

### Phase 2: Install & Verify Scrapling

- GOAL-002: Install Scrapling on the development machine and verify the CLI works end-to-end

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Install Scrapling: `pip install scrapling` (requires Python 3.9+) and verify `scrapling --version` works | | |
| TASK-007 | Run Scrapling stealth fetch against a known working URL: `scrapling extract stealthy-fetch https://flcourts.gov --markdown` and verify markdown output | | |
| TASK-008 | Run Scrapling against NY Cloudflare-blocked URL: `scrapling extract stealthy-fetch https://www.nycourts.gov/ctapps/Judges.shtml --markdown` and document result | | |
| TASK-009 | If TASK-008 fails, test browser mode: `scrapling extract fetch https://www.nycourts.gov/ctapps/Judges.shtml --markdown` and document result | | |
| TASK-010 | Document Scrapling setup in a `scripts/harvest/README-scrapling.md` with install steps, CLI usage, and test results | | |

### Phase 3: Add Scrapling Availability Guard

- GOAL-003: Ensure the harvest pipeline degrades gracefully when Scrapling is not installed

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-011 | Add `isScraplingAvailable()` function to `scrapling-fetcher.ts` that runs `scrapling --version` and returns boolean. Cache result for process lifetime | | |
| TASK-012 | In `fetchWithScrapling()`, check `isScraplingAvailable()` first — if false, return `{ success: false, error: 'Scrapling CLI not installed' }` immediately | | |
| TASK-013 | In `hybridFetch()` auto mode, skip Scrapling fallback entirely when `isScraplingAvailable()` returns false (log warning once) | | |

### Phase 4: Pipeline Integration

- GOAL-004: Wire `hybridFetch` into the harvest pipeline so it's used automatically for sites that need it, without changing the default path

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-014 | Add `fetchMethod` field to court config schema (`state-config-schema.ts`) with values: `'native' \| 'browser' \| 'scrapling' \| 'auto'`. Default: `'native'` | | |
| TASK-015 | In `scripts/harvest/index.ts`, replace direct `fetchPage()` calls with a `getPageContent()` wrapper that checks `courtEntry.fetchMethod` and dispatches to `fetchPage()`, `hybridFetch()`, or `fetchWithScrapling()` accordingly | | |
| TASK-016 | In `scripts/harvest/bio-enricher.ts`, apply the same `getPageContent()` wrapper for bio page fetches | | |
| TASK-017 | Update `SITE_CONFIGS` in `hybrid-fetcher.ts` with known problem domains from research: `nycourts.gov` → scrapling, `iapps.courts.state.ny.us` → scrapling | | |
| TASK-018 | Update NY court config (`new-york-courts.json`) entries to use `fetchMethod: 'scrapling'` instead of `fetchMethod: 'browser'` (which currently causes skips) | | |

### Phase 5: Validation & Testing

- GOAL-005: Validate that the integration works correctly for both native and Scrapling paths without regression

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-019 | Run FL harvest in `--dry-run` mode — verify all pages still use native fetcher, no Scrapling invocations, same output | | |
| TASK-020 | Run CA harvest in `--dry-run` mode — verify same behavior as FL (no regression) | | |
| TASK-021 | If Scrapling bypasses NY Cloudflare (TASK-008): run NY harvest for Court of Appeals roster URL, verify judge names are extracted | | |
| TASK-022 | If Scrapling fails on NY (TASK-008/009): document limitation, keep NY as `fetchMethod: 'browser'` (skipped), close this plan as partial success | | |
| TASK-023 | Run `npx tsc --noEmit` to verify no TypeScript errors across all modified files | | |

## 3. Alternatives

- **ALT-001**: **Firecrawl** — SaaS product ranked ⭐⭐⭐⭐ in research. Handles anti-bot and JS rendering. Rejected because: paid service ($16/mo+), adds external dependency, not open source. Scrapling is free and local.
- **ALT-002**: **Crawl4AI** — Open source, ranked ⭐⭐⭐⭐ in research. Python-based async crawler with Playwright. Rejected for now because: heavier setup (full Playwright + Python async), more complex integration. Scrapling CLI is simpler to shell out to. Crawl4AI remains a strong option if Scrapling proves insufficient.
- **ALT-003**: **Playwright directly in fetcher.ts** — Recommended in web-scraping-tools.md research. Rejected because: doesn't solve anti-bot (Cloudflare detects headless Playwright per NY research), and Scrapling's stealth mode adds fingerprint evasion on top of browser rendering.
- **ALT-004**: **Do nothing** — Keep native fetch only, skip blocked sites. Rejected because NY has ~1,000+ judges we can't access, and more states will have similar protections as we expand.

## 4. Dependencies

- **DEP-001**: Python 3.9+ installed on the system
- **DEP-002**: Scrapling Python package (`pip install scrapling`)
- **DEP-003**: Existing `scripts/harvest/fetcher.ts` — `fetchPage()` and `cleanHtml()` exports
- **DEP-004**: Existing court config JSON files per state (e.g., `new-york-courts.json`)
- **DEP-005**: Existing `state-config-schema.ts` for court config validation

## 5. Files

- **FILE-001**: `scripts/harvest/scrapling-fetcher.ts` — Fix bugs, add availability guard, remove dead code
- **FILE-002**: `scripts/harvest/hybrid-fetcher.ts` — Fix types, remove unused imports, add domain configs
- **FILE-003**: `scripts/harvest/index.ts` — Add `getPageContent()` dispatch wrapper
- **FILE-004**: `scripts/harvest/bio-enricher.ts` — Use `getPageContent()` wrapper for bio page fetches
- **FILE-005**: `scripts/harvest/state-config-schema.ts` — Add `fetchMethod` field to schema
- **FILE-006**: `scripts/harvest/new-york-courts.json` — Update `fetchMethod` values from `'browser'` to `'scrapling'`
- **FILE-007**: `scripts/harvest/README-scrapling.md` — New file documenting Scrapling setup and usage

## 6. Testing

- **TEST-001**: FL dry-run harvest — verify zero regression, all pages use native fetch
- **TEST-002**: CA dry-run harvest — verify zero regression, all pages use native fetch
- **TEST-003**: NY Court of Appeals roster URL via Scrapling CLI — verify markdown content returned
- **TEST-004**: `npx tsc --noEmit` — all modified files pass strict TypeScript checking
- **TEST-005**: `isScraplingAvailable()` returns false when Scrapling is uninstalled — verify graceful degradation

## 7. Risks & Assumptions

- **RISK-001**: Scrapling stealth mode may not bypass Cloudflare Turnstile on NY courts — Turnstile is specifically designed to defeat automated tools. Mitigation: Phase 2 validates this before any pipeline integration work.
- **RISK-002**: Scrapling CLI interface may change between versions — we shell out to a Python CLI. Mitigation: pin version in install docs, add output format validation.
- **RISK-003**: Scrapling adds ~5-15s latency per page — harvest runs for Scrapling-dependent states will be significantly slower. Mitigation: only use Scrapling for sites that explicitly need it via `fetchMethod` config.
- **ASSUMPTION-001**: Python 3.9+ is available on the development and deployment machines
- **ASSUMPTION-002**: Scrapling's `stealthy-fetch` mode produces markdown output compatible with our Claude extraction prompts
- **ASSUMPTION-003**: The Scrapling CLI `scrapling extract stealthy-fetch <url> --markdown` interface is stable

## 8. Related Specifications / Further Reading

- [docs/research/web-scraping-tools.md](../docs/research/web-scraping-tools.md) — Tool comparison matrix and expansion roadmap
- [docs/research/new-york-cloudflare-block.md](../docs/research/new-york-cloudflare-block.md) — NY Cloudflare Turnstile investigation and bypass attempts
- [Scrapling GitHub](https://github.com/D4Vinci/Scrapling) — Scrapling project and documentation
- [specs/008-state-expansion/](../specs/008-state-expansion/) — State expansion feature that first identified the NY blocker
