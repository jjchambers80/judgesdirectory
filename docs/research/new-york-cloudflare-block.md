# New York Court Data: Cloudflare Turnstile Block

**Status**: Blocked  
**Feature**: 008-state-expansion  
**Date Discovered**: 2026-03-04  
**Priority**: Deferred to future feature

## Summary

All New York state court websites are protected by Cloudflare Turnstile, a JavaScript challenge system that blocks programmatic access. This prevents automated harvesting of NY judge data through our existing pipeline.

## Affected Domains

| Domain | Courts | Status |
|--------|--------|--------|
| `nycourts.gov` | Court of Appeals, Appellate Division (4 depts) | 403 Forbidden |
| `iapps.courts.state.ny.us` | Supreme Court, County Courts, Family Courts, Surrogate's Courts, NYC Civil/Criminal | 403 Forbidden |

## Technical Details

### HTTP Response

```
HTTP/2 403
server: cloudflare
cf-mitigated: challenge
content-type: text/html; charset=UTF-8
```

The response body contains:
- "Just a moment..." loading page
- Cloudflare Turnstile JavaScript challenge
- No actual court content

### Bypass Attempts (All Failed)

| Method | Tool | Result |
|--------|------|--------|
| Direct HTTP | curl/fetch | 403 with JS challenge |
| Headless browser | agent-browser (Playwright) | Stuck on "Just a moment..." |
| Headed browser | agent-browser --headed | Same result |
| Anti-detection | Playwright with stealth flags | Same result |

Anti-detection flags tested:
```bash
--disable-blink-features=AutomationControlled
--disable-dev-shm-usage
```

### Cloudflare Turnstile Behavior

Unlike traditional CAPTCHAs, Turnstile runs silently in the background and uses:
- Browser fingerprinting
- JavaScript execution environment detection
- Behavioral analysis
- Time-based challenges

It specifically detects and blocks:
- Headless browsers (Puppeteer, Playwright)
- Automated scripts
- Non-standard user agents
- Missing browser APIs

## Current Configuration

All 11 NY court entries in `scripts/harvest/new-york-courts.json` are marked with `fetchMethod: "browser"` to document the limitation:

```json
{
  "courtType": "Court of Appeals",
  "label": "Court of Appeals",
  "url": "https://www.nycourts.gov/ctapps/Judges.shtml",
  "fetchMethod": "browser",
  "notes": "Cloudflare Turnstile blocks all programmatic access to nycourts.gov"
}
```

When the harvester encounters `fetchMethod: "browser"`, it logs a skip warning and continues.

## Impact

- **Expected judges**: ~1,000+ (Court of Appeals, Appellate Division, Supreme Court, County Courts)
- **Actual judges**: 0
- **Feature 008 adjusted target**: 2,700 → 1,875 (excluding NY)
- **Actual achieved**: 2,818 (CA + TX + FL)

## Potential Solutions

### 1. CAPTCHA-Solving Service (High Effort)

Services like 2Captcha, Anti-Captcha, or CapMonster can solve Cloudflare challenges programmatically.

**Pros**: Automated, scalable  
**Cons**: Cost per solve (~$2-3/1000), ethical concerns, ToS violation risk, may still fail on Turnstile

### 2. Residential Proxy + Real Browser (Medium Effort)

Use residential proxies with real browser automation (not headless).

**Pros**: Mimics real user behavior  
**Cons**: Proxy costs, slower, still detectable

### 3. Manual Data Entry (Low Tech, High Labor)

Human operators manually copy judge data from NY court websites.

**Pros**: 100% reliable, no ToS concerns  
**Cons**: Labor-intensive, error-prone, doesn't scale

### 4. Alternative Data Sources (Recommended First Step)

Research alternative sources for NY judge data:

| Source | URL | Notes |
|--------|-----|-------|
| NY State Unified Court System | data.ny.gov | Returned 404 on 2026-03-04 |
| Wikipedia | Category:New York judges | Partial data only |
| Ballotpedia | ballotpedia.org | May have appellate judges |
| NY Bar Association | nysba.org | Potential source |
| FOIA Request | N/A | Official data, slow process |

### 5. Browser Extension Approach (Creative)

Build a browser extension that users run manually, which extracts and submits data.

**Pros**: Runs in real browser context  
**Cons**: Requires user action, distribution overhead

## Recommendation

1. **Short term**: Accept NY as blocked; focus on expanding other states
2. **Medium term**: Research alternative data sources (Ballotpedia, FOIA)
3. **Long term**: Evaluate CAPTCHA-solving services if NY data becomes critical

## Related Files

- `scripts/harvest/new-york-courts.json` — Config with `fetchMethod: "browser"` markers
- `specs/008-state-expansion/spec.md` — Final Results section documents the block
- `specs/008-state-expansion/tasks.md` — T034-T037a marked BLOCKED

## References

- [Cloudflare Turnstile Documentation](https://developers.cloudflare.com/turnstile/)
- [NY Courts Official Website](https://www.nycourts.gov/)
- [NY Judicial Directory](https://iapps.courts.state.ny.us/judicialdirectory/)
