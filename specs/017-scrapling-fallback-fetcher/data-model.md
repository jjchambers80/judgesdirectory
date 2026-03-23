# Data Model: Scrapling Fallback Fetcher

**Feature**: 017-scrapling-fallback-fetcher  
**Date**: 2026-03-19

## Entities

### FetchMethod (Enum Extension)

Extends the existing `CourtEntrySchema.fetchMethod` enum.

| Value | Description | Behavior |
|-------|-------------|----------|
| `http` | Standard fetch (existing default) | Uses `fetchPage()` — no change |
| `browser` | Browser-based fetch (legacy, unsupported) | Skipped with warning — no change |
| `manual` | Manual data entry (unsupported) | Skipped with warning — no change |
| `scrapling` | **NEW** — Force stealth fetcher | Uses `fetchWithScrapling()` directly. Requires domain on allowlist. |
| `auto` | **NEW** — Auto-detect with fallback | Tries `fetchPage()` first; falls back to `fetchWithScrapling()` if content < 200 chars |

**Default**: `http` (preserves existing behavior for all courts without config changes)

### ScraplingResult (Interface — Revised)

The output of a Scrapling CLI invocation, returned by `fetchWithScrapling()`.

| Field | Type | Description |
|-------|------|-------------|
| `markdown` | `string` | Extracted markdown content from the page |
| `rawHtml` | `string` | Raw HTML if available (from `.html` temp file), empty string otherwise |
| `url` | `string` | The URL that was fetched |
| `success` | `boolean` | Whether the fetch succeeded |
| `method` | `'stealthy' \| 'browser'` | Which Scrapling mode produced the result |
| `error` | `string` (optional) | Error message if success is false |
| `durationMs` | `number` (optional) | Time taken for the fetch in milliseconds |

### FetchResult (Existing — No Changes)

The existing standard fetcher output. No modifications needed.

| Field | Type | Description |
|-------|------|-------------|
| `markdown` | `string` | Cleaned markdown content |
| `rawHtml` | `string` | Raw HTML of the page |
| `htmlSize` | `number` | Size of the raw HTML in bytes |
| `markdownSize` | `number` | Size of the markdown in bytes |

### CourtEntry (Schema Extension)

Extends the existing `CourtEntrySchema` Zod schema.

**Changed field**:
```
fetchMethod: z.enum(["http", "browser", "manual", "scrapling", "auto"]).default("http")
```

**No new fields added** — only the enum is extended.

### StealthDomainAllowlist (New Constant)

A `Set<string>` of approved domains for stealth fetching, defined in `scrapling-fetcher.ts`.

| Domain | Reason |
|--------|--------|
| `nycourts.gov` | NY Court of Appeals + Appellate Division — Cloudflare Turnstile |
| `iapps.courts.state.ny.us` | NY court applications portal — Cloudflare |

New domains are added by editing this constant (configuration change, per FR-012/FR-015).

### DomainRateTracker (Internal State)

In-memory map tracking the last stealth fetch timestamp per domain.

| Field | Type | Description |
|-------|------|-------------|
| key | `string` | Domain name (e.g., `nycourts.gov`) |
| value | `number` | `Date.now()` timestamp of last stealth fetch to this domain |

**Default delay**: 3000ms between requests to the same domain (configurable).

## Relationships

```
CourtEntry.fetchMethod ──determines──> which fetcher is used
    │
    ├── "http"      → fetchPage()       → FetchResult
    ├── "scrapling" → fetchWithScrapling() → ScraplingResult
    ├── "auto"      → fetchPage() first → FetchResult
    │                  └── if insufficient → fetchWithScrapling() → ScraplingResult
    ├── "browser"   → SKIP (unsupported)
    └── "manual"    → SKIP (unsupported)
```

## State Transitions

No state machine — fetching is a one-shot operation per court entry per harvest run. The retry logic (one retry with 10-30s backoff per FR-014) is internal to `fetchWithScrapling()`.

## Validation Rules

- `fetchMethod` must be one of the 5 enum values (Zod enforced at config load time)
- Stealth fetch URLs must have their domain in `STEALTH_DOMAIN_ALLOWLIST` (runtime check in `fetchWithScrapling()`)
- Auto-detect fallback threshold: 200 characters of extracted markdown (FR-004)
- Per-domain delay: minimum 3000ms between stealth fetches to the same domain (FR-013)
