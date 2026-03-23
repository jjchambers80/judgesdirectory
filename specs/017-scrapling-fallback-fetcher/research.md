# Research: Scrapling Fallback Fetcher

**Feature**: 017-scrapling-fallback-fetcher  
**Date**: 2026-03-19  
**Status**: Complete

## Research Tasks

### R1: Scrapling CLI Interface — Actual vs. Assumed

**Decision**: Scrapling CLI writes output to **files**, not stdout. Output format is determined by file extension (`.md`, `.html`, `.txt`). There is no `--markdown` flag.

**Rationale**: The existing wrapper code (`scrapling-fetcher.ts`) assumes Scrapling outputs to stdout with a `--markdown` flag. Both assumptions are wrong. The actual CLI syntax is:

```bash
scrapling extract stealthy-fetch <URL> <OUTPUT_FILE> [OPTIONS]
```

The integration must: (1) write to a temp file with `.md` extension, (2) read the file contents, (3) clean up the temp file.

**Alternatives considered**:
- Using Scrapling's Python API directly via a Python bridge script — rejected for added complexity
- Using the MCP server mode (returns JSON) — rejected as overkill for CLI invocation

### R2: Cloudflare Turnstile Bypass

**Decision**: Scrapling `stealthy-fetch` has an explicit `--solve-cloudflare` flag that claims to solve Cloudflare Turnstile/Interstitial challenges. This must be enabled for NY courts.

**Rationale**: The `StealthyFetcher` uses Patchright (a stealth fork of Playwright) with fingerprint evasion, TLS spoofing, and canvas noise. The `--solve-cloudflare` flag adds specific Cloudflare challenge-solving logic. However, effectiveness against NY courts specifically is uncertain and requires live validation (Phase 2 of implementation plan).

**Alternatives considered**:
- `fetch` (DynamicFetcher) without stealth — does not include fingerprint evasion, won't help
- `--real-chrome` flag to use system Chrome — may improve stealth but adds dependency

### R3: Installation Requirements

**Decision**: Install with `pip install "scrapling[all]==0.4.2"` followed by `scrapling install` (downloads browser binaries).

**Rationale**: 
- Requires Python **3.10+** (not 3.9 as originally assumed — corrected)
- `scrapling[all]` includes fetchers + shell (CLI) + MCP
- `scrapling install` downloads Chromium via Playwright/Patchright plus fingerprint data
- Current stable version: **0.4.2** (Beta status, 31.3k GitHub stars, BSD-3-Clause)

**Alternatives considered**:
- `scrapling[fetchers]` only — doesn't include CLI extract command
- Docker image (`pyd4vinci/scrapling`) — adds Docker dependency, doesn't simplify integration

### R4: Error Handling & Exit Codes

**Decision**: Use exit code + output file existence as the success signal. Exit code 0 = success, non-zero = failure. Parse stderr for error messages.

**Rationale**: Scrapling uses Click framework conventions. Specific exit codes for different failure modes (timeout, network error, Cloudflare unsolved) are not differentiated. The safest check is: (1) check exit code, (2) verify output file exists, (3) verify file has content > 0 bytes.

**Alternatives considered**:
- Parsing specific error messages from stderr — fragile, not documented
- Using timeout as the only failure mode — misses network errors

### R5: Existing Code Bugs in scrapling-fetcher.ts

**Decision**: Six bugs identified that must be fixed before integration.

**Findings**:
1. **Dead import**: `const exec = promisify(spawn)` on line 22 — `promisify(spawn)` doesn't work correctly and is never used
2. **Wrong CLI invocation**: Code assumes `spawn('scrapling', ['extract', 'stealthy-fetch', url, '--markdown'])` — no `--markdown` flag exists; must write to temp file
3. **Unused TEMP_DIR**: Lines 25-28 create a temp dir but the fetcher invocation doesn't use it for output files
4. **Missing rawHtml**: `ScraplingResult` interface has no `rawHtml` field
5. **No availability guard**: No `isScraplingAvailable()` function exists
6. **No allowlist**: No domain restriction enforcement

### R6: Existing Code Bugs in hybrid-fetcher.ts

**Decision**: Two bugs identified.

**Findings**:
1. **Type mismatch in SITE_CONFIGS**: The `default` entry uses `prefer: 'auto'` but the type only allows `'native' | 'scrapling'` — TypeScript strict mode error
2. **Unused import**: `cleanHtml` imported from `fetcher.ts` on line 18 but never used

### R7: Pipeline Integration Points

**Decision**: Two call sites in `index.ts` (lines 1038 and 1332) and one in `bio-enricher.ts` where `fetchPage()` is called directly. All three need to be routed through a `getPageContent()` dispatcher.

**Rationale**: The existing code has two harvest loops in `index.ts` (full harvest and delta/incremental harvest) that both call `fetchPage()` directly. The `bio-enricher.ts` also calls `fetchPage()` for bio page fetches. The dispatcher must check the court entry's `fetchMethod` and the Scrapling availability before deciding which fetcher to use.

**Integration pattern**:
- `fetchMethod: 'http'` (existing default) → `fetchPage()` (unchanged)
- `fetchMethod: 'scrapling'` → `fetchWithScrapling()` (if available, else warn + skip)
- `fetchMethod: 'auto'` → `fetchPage()` first, then `fetchWithScrapling()` if insufficient content
- `fetchMethod: 'browser'` → currently skipped; will remain skipped (legacy value)
- `fetchMethod: 'manual'` → currently skipped; will remain skipped

### R8: Court Config Schema Extension

**Decision**: Extend `CourtEntrySchema.fetchMethod` enum from `["http", "browser", "manual"]` to `["http", "browser", "manual", "scrapling", "auto"]`.

**Rationale**: The existing schema already has a `fetchMethod` field with a default of `"http"`. Adding `"scrapling"` and `"auto"` requires only a Zod enum extension. No Prisma migration needed — court configs are JSON files, not database entities.

### R9: Domain Allowlist Design

**Decision**: Add a `STEALTH_DOMAIN_ALLOWLIST` set in `scrapling-fetcher.ts`. The `fetchWithScrapling()` function validates the URL's domain against this allowlist before proceeding. Unlisted domains are rejected with a logged error.

**Rationale**: Per spec FR-015, the stealth fetcher must only run against explicitly approved domains. The allowlist approach is simpler than a config-file-based approach and keeps the security enforcement co-located with the fetcher.

**Initial allowlist**:
- `nycourts.gov` — NY Court of Appeals and Appellate Division (Cloudflare Turnstile)
- `iapps.courts.state.ny.us` — NY court applications portal

### R10: Per-Domain Rate Limiting for Stealth Fetches

**Decision**: Implement a simple `lastFetchByDomain` map in `scrapling-fetcher.ts` that tracks the last stealth fetch timestamp per domain. Before each fetch, check if the configured delay has elapsed.

**Rationale**: Per spec FR-013, configurable per-domain delay with a default of 3 seconds. The existing standard fetcher already has a global `lastFetchTime` rate limiter — the stealth fetcher needs a domain-specific equivalent since stealth fetches to `nycourts.gov` should be throttled independently of fetches to other domains.

## Corrections to Original Plan

| Item | Original Assumption | Corrected |
|------|-------------------|-----------|
| Python version | 3.9+ | **3.10+** |
| CLI output | stdout with `--markdown` flag | **File-based** output with `.md` extension |
| CLI syntax | `scrapling extract stealthy-fetch <url> --markdown` | `scrapling extract stealthy-fetch <url> <output.md> [--solve-cloudflare]` |
| Cloudflare | Stealth mode alone may bypass | **Requires explicit `--solve-cloudflare` flag** |
| Install command | `pip install scrapling` | `pip install "scrapling[all]==0.4.2"` + `scrapling install` |
