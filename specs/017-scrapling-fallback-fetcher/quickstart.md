# Quickstart: Scrapling Fallback Fetcher

**Feature**: 017-scrapling-fallback-fetcher  
**Date**: 2026-03-19

## Prerequisites

1. **Node.js 18+** and project dependencies installed (`npm install`)
2. **Python 3.10+** installed (`python3 --version`)
3. **Scrapling** installed:
   ```bash
   pip install "scrapling[all]==0.4.2"
   scrapling install  # downloads browser binaries
   ```
4. Verify installation:
   ```bash
   scrapling --version
   # → scrapling, version 0.4.2
   ```

## Quick Validation

### 1. Verify Scrapling works standalone

```bash
# Test against a non-protected site first
scrapling extract stealthy-fetch "https://flcourts.gov" /tmp/test-fl.md
cat /tmp/test-fl.md | head -20

# Test Cloudflare bypass against NY courts
scrapling extract stealthy-fetch "https://www.nycourts.gov/ctapps/" /tmp/test-ny.md --solve-cloudflare --timeout 30000
cat /tmp/test-ny.md | head -20
```

### 2. Run harvest with standard fetcher (regression check)

```bash
# FL dry-run — should use standard fetcher for all courts
npx tsx scripts/harvest/index.ts --state FL --dry-run

# Verify no Scrapling invocations in output
# Expected: all courts use fetchPage(), zero "[Scrapling]" log lines
```

### 3. Run harvest with Scrapling fetcher (NY)

```bash
# NY harvest — should use Scrapling for all courts (fetchMethod: 'scrapling')
npx tsx scripts/harvest/index.ts --state NY --dry-run

# Expected: courts use fetchWithScrapling(), "[Scrapling]" log lines appear
# If Scrapling bypasses Cloudflare: markdown content with judge names
# If Scrapling fails: retry once, then mark as failed, continue
```

### 4. Verify graceful degradation (no Scrapling installed)

```bash
# Temporarily remove Scrapling
pip uninstall scrapling -y

# Run NY harvest — should warn and skip Scrapling courts
npx tsx scripts/harvest/index.ts --state NY --dry-run

# Expected: single warning "Scrapling CLI not available", courts skipped
# Reinstall after testing
pip install "scrapling[all]==0.4.2" && scrapling install
```

## Key Files

| File | Role |
|------|------|
| `scripts/harvest/scrapling-fetcher.ts` | Scrapling CLI wrapper — `fetchWithScrapling()`, `isScraplingAvailable()`, `isAllowlistedDomain()` |
| `scripts/harvest/hybrid-fetcher.ts` | Dispatch layer — `getPageContent()` routes to correct fetcher |
| `scripts/harvest/state-config-schema.ts` | Zod schema — `fetchMethod` enum with new values |
| `scripts/harvest/index.ts` | Main harvest loop — calls `getPageContent()` instead of `fetchPage()` |
| `scripts/harvest/bio-enricher.ts` | Bio page fetches — calls `getPageContent()` instead of `fetchPage()` |
| `scripts/harvest/legacy/new-york-courts.json` | NY court config — `fetchMethod: "scrapling"` |

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `Scrapling CLI not available` warning | Scrapling not installed or not on PATH | `pip install "scrapling[all]==0.4.2" && scrapling install` |
| `Domain not on stealth allowlist` error | URL's domain not in `STEALTH_DOMAIN_ALLOWLIST` | Add domain to allowlist in `scrapling-fetcher.ts` |
| Scrapling timeout (30s) | Anti-bot challenge took too long | Increase `--timeout` or try `--solve-cloudflare` flag |
| Empty markdown from Scrapling | Content behind challenge that wasn't solved | Add `--solve-cloudflare` flag; check if site uses non-Cloudflare protection |
| No regression expected but output differs | Standard fetcher path changed | Verify `fetchMethod: "http"` (default) routes to `fetchPage()` unchanged |
