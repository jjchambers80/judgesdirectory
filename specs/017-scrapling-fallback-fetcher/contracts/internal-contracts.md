# Internal Contracts: Scrapling Fallback Fetcher

**Feature**: 017-scrapling-fallback-fetcher  
**Date**: 2026-03-19

> This feature has no external API endpoints. All contracts are internal TypeScript function signatures and type definitions within the harvest pipeline.

## Contract 1: getPageContent()

**Location**: `scripts/harvest/hybrid-fetcher.ts` (new export)  
**Purpose**: Dispatch layer that routes page fetches based on court config `fetchMethod`

```typescript
/**
 * Fetch page content using the appropriate method based on court config.
 * This is the single entry point for all page fetches in the harvest pipeline.
 *
 * @param url - The URL to fetch
 * @param fetchMethod - The configured fetch method for this court entry
 * @param rateLimit - Optional rate limit config for standard fetcher
 * @returns FetchResult-compatible object with content and metadata
 */
export async function getPageContent(
  url: string,
  fetchMethod: 'http' | 'browser' | 'manual' | 'scrapling' | 'auto',
  rateLimit?: RateLimitConfig,
): Promise<FetchResult>
```

**Behavior by fetchMethod**:

| fetchMethod | Behavior | Returns |
|-------------|----------|---------|
| `http` | Calls `fetchPage(url, rateLimit)` directly | `FetchResult` |
| `scrapling` | Checks allowlist + availability, then calls `fetchWithScrapling(url)` | `FetchResult` (adapted from `ScraplingResult`) |
| `auto` | Calls `fetchPage()` first; if markdown < 200 chars AND Scrapling available, retries with `fetchWithScrapling()` | `FetchResult` |
| `browser` | Logs warning and skips (unsupported legacy value) | `null` — caller checks for null and skips |
| `manual` | Logs warning and skips (unsupported legacy value) | `null` — caller checks for null and skips |

**Error contract**: Returns `null` for unsupported fetch methods (`browser`, `manual`). Throws on unrecoverable errors (network failure after retry). Caller is responsible for null-checking the result.

## Contract 2: fetchWithScrapling() (Revised)

**Location**: `scripts/harvest/scrapling-fetcher.ts` (existing, to be fixed)  
**Purpose**: Execute Scrapling CLI to fetch a URL with stealth mode

```typescript
/**
 * Fetch a URL using Scrapling CLI with stealth or browser mode.
 * Validates URL against domain allowlist before proceeding.
 * Writes output to a temp file and reads it back.
 *
 * @param url - The URL to fetch (must be on allowlist)
 * @param options - Fetch options
 * @returns ScraplingResult with content and metadata
 */
export async function fetchWithScrapling(
  url: string,
  options?: {
    mode?: 'stealthy' | 'browser' | 'auto';
    timeout?: number;
    solveCloudflare?: boolean;
  },
): Promise<ScraplingResult>
```

**Changes from existing signature**: Added `solveCloudflare` option (defaults to `true` for stealthy mode). Temp file output pattern replaces stdout assumption.

## Contract 3: isScraplingAvailable()

**Location**: `scripts/harvest/scrapling-fetcher.ts` (new export)  
**Purpose**: Check if Scrapling CLI is installed and executable

```typescript
/**
 * Check if the Scrapling CLI is available on the system.
 * Result is cached for the lifetime of the process.
 *
 * @returns true if `scrapling --version` succeeds
 */
export async function isScraplingAvailable(): Promise<boolean>
```

**Caching**: First call executes `scrapling --version`. Result is stored in a module-level variable. Subsequent calls return the cached value.

## Contract 4: isAllowlistedDomain()

**Location**: `scripts/harvest/scrapling-fetcher.ts` (new export)  
**Purpose**: Check if a URL's domain is on the stealth fetch domain allowlist

```typescript
/**
 * Check if a URL's domain is in the stealth fetch allowlist.
 *
 * @param url - The URL to check
 * @returns true if the domain (or a parent domain) is in STEALTH_DOMAIN_ALLOWLIST
 */
export function isAllowlistedDomain(url: string): boolean
```

## Contract 5: CourtEntrySchema.fetchMethod (Extended Enum)

**Location**: `scripts/harvest/state-config-schema.ts`  
**Purpose**: Validate court config JSON files

```typescript
// Before:
fetchMethod: z.enum(["http", "browser", "manual"]).default("http")

// After:
fetchMethod: z.enum(["http", "browser", "manual", "scrapling", "auto"]).default("http")
```

**Impact**: All existing court config JSON files remain valid (they use `"http"` or `"browser"`, both still in the enum). Only NY config changes to `"scrapling"`.
