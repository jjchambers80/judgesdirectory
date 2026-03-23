/**
 * Hybrid Fetcher – `getPageContent()` dispatcher
 *
 * Routes each court entry to the correct fetcher based on its `fetchMethod`:
 *   - "http"      → native fetchPage()
 *   - "scrapling" → Scrapling CLI (stealth mode)
 *   - "auto"      → native first, Scrapling fallback on failure / thin content
 *   - "browser"   → skip (logged once per run)
 *   - "manual"    → skip (logged once per run)
 *
 * Returns a standard FetchResult so callers don't need to know which fetcher
 * ran underneath.
 *
 * @module scripts/harvest/hybrid-fetcher
 */

import { fetchPage } from "./fetcher";
import type { FetchResult } from "./fetcher";
import type { RateLimitConfig } from "./state-config-schema";
import {
  fetchWithScrapling,
  isScraplingAvailable,
} from "./scrapling-fetcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The fetchMethod values the dispatcher handles. */
export type FetchMethod = "http" | "scrapling" | "auto" | "browser" | "manual";

// ---------------------------------------------------------------------------
// Once-per-run warning deduplication
// ---------------------------------------------------------------------------

const warnedSkips = new Set<string>();
const warnedScraplingMissing = { emitted: false };

function logSkipOnce(fetchMethod: string, url: string): void {
  const key = `${fetchMethod}:${url}`;
  if (!warnedSkips.has(key)) {
    warnedSkips.add(key);
    console.log(
      `  [Hybrid] fetchMethod="${fetchMethod}" — skipping url=${url}`,
    );
  }
}

function logScraplingMissingOnce(): void {
  if (!warnedScraplingMissing.emitted) {
    warnedScraplingMissing.emitted = true;
    console.warn(
      `  [Hybrid] Scrapling CLI is not installed — scrapling/auto entries will fall back to http`,
    );
  }
}

// ---------------------------------------------------------------------------
// Public dispatcher (FR-002, FR-003, FR-004)
// ---------------------------------------------------------------------------

/**
 * Fetch a court page using the method specified in the court config.
 *
 * @param url          The URL to fetch
 * @param fetchMethod  Routing key from the court entry's fetchMethod field
 * @param rateLimit    Optional per-state rate-limit config (forwarded to fetchPage)
 * @returns A standard FetchResult, or `null` when the entry should be skipped
 */
export async function getPageContent(
  url: string,
  fetchMethod: FetchMethod = "http",
  rateLimit?: RateLimitConfig,
): Promise<FetchResult | null> {
  switch (fetchMethod) {
    case "http":
      return fetchPage(url, rateLimit);

    case "scrapling":
      return handleScrapling(url, rateLimit);

    case "auto":
      return handleAuto(url, rateLimit);

    case "browser":
    case "manual":
      logSkipOnce(fetchMethod, url);
      return null;

    default:
      console.warn(`  [Hybrid] Unknown fetchMethod="${fetchMethod}" — defaulting to http`);
      return fetchPage(url, rateLimit);
  }
}

// ---------------------------------------------------------------------------
// Adapters
// ---------------------------------------------------------------------------

/** Convert a ScraplingResult to a FetchResult. */
function scraplingToFetchResult(
  sr: Awaited<ReturnType<typeof fetchWithScrapling>>,
): FetchResult | null {
  if (!sr.success) return null;
  return {
    markdown: sr.markdown,
    rawHtml: sr.rawHtml,
    htmlSize: Buffer.byteLength(sr.rawHtml, "utf-8"),
    markdownSize: Buffer.byteLength(sr.markdown, "utf-8"),
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleScrapling(
  url: string,
  rateLimit?: RateLimitConfig,
): Promise<FetchResult | null> {
  if (!(await isScraplingAvailable())) {
    logScraplingMissingOnce();
    console.log(`  [Hybrid] Falling back to http for ${url}`);
    return fetchPage(url, rateLimit);
  }

  const result = await fetchWithScrapling(url);
  return scraplingToFetchResult(result);
}

async function handleAuto(
  url: string,
  rateLimit?: RateLimitConfig,
): Promise<FetchResult | null> {
  // Try native first
  let nativeResult: FetchResult | null = null;
  try {
    nativeResult = await fetchPage(url, rateLimit);
    if (nativeResult.markdown.length >= 200) {
      return nativeResult;
    }
    console.log(
      `  [Hybrid] Native returned ${nativeResult.markdown.length} chars — trying Scrapling fallback`,
    );
  } catch (err) {
    console.log(
      `  [Hybrid] Native fetch failed: ${err instanceof Error ? err.message : err} — trying Scrapling fallback`,
    );
  }

  // Fallback to Scrapling
  if (!(await isScraplingAvailable())) {
    logScraplingMissingOnce();
    // Return the thin native result rather than null (FR-004 graceful degradation)
    return nativeResult;
  }

  const scrapResult = await fetchWithScrapling(url);
  const converted = scraplingToFetchResult(scrapResult);
  // Return Scrapling result if it succeeded, otherwise fall back to native
  return converted ?? nativeResult;
}
