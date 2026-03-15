/**
 * Failure classification, recording, and auto-resolution for the harvest pipeline.
 *
 * Designed to be non-blocking: all DB writes are wrapped in try/catch with
 * console.warn fallback so the harvest pipeline never crashes due to failure
 * tracking errors.
 *
 * @module scripts/harvest/failure-tracker
 */

import { PrismaClient, FailureType } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CAPTCHA detection keywords (from research.md)
// ---------------------------------------------------------------------------

export const CAPTCHA_INDICATORS = [
  "captcha",
  "verify you are human",
  "challenge-platform",
  "cf-browser-verification",
  "cf-chl-bypass",
  "hcaptcha",
  "recaptcha",
  "g-recaptcha",
  "turnstile",
  "just a moment",
  "checking your browser",
  "bot detection",
  "access denied",
];

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------

/**
 * Classify a failure based on error details and HTTP response info.
 */
export function classifyFailure(
  error: Error | string,
  httpStatus?: number,
  responseBody?: string,
): FailureType {
  const errorMsg = typeof error === "string" ? error : error.message;
  const lowerMsg = errorMsg.toLowerCase();
  const lowerBody = responseBody?.toLowerCase() ?? "";

  // Check HTTP status codes first
  if (httpStatus === 403) return "HTTP_403";
  if (httpStatus === 429) return "HTTP_429";

  // Check error message patterns
  if (lowerMsg.includes("http 403") || lowerMsg.includes("403 forbidden")) {
    return "HTTP_403";
  }
  if (lowerMsg.includes("http 429") || lowerMsg.includes("429 too many")) {
    return "HTTP_429";
  }
  if (
    lowerMsg.includes("timeouterror") ||
    lowerMsg.includes("aborterror") ||
    lowerMsg.includes("timed out") ||
    lowerMsg.includes("timeout")
  ) {
    return "TIMEOUT";
  }
  if (
    lowerMsg.includes("cert_") ||
    lowerMsg.includes("ssl") ||
    lowerMsg.includes("certificate") ||
    lowerMsg.includes("unable_to_verify")
  ) {
    return "SSL_ERROR";
  }
  if (
    lowerMsg.includes("enotfound") ||
    lowerMsg.includes("eai_again") ||
    lowerMsg.includes("getaddrinfo")
  ) {
    return "DNS_FAILURE";
  }

  // CAPTCHA detection in response body
  if (responseBody) {
    for (const indicator of CAPTCHA_INDICATORS) {
      if (lowerBody.includes(indicator)) {
        return "CAPTCHA_DETECTED";
      }
    }
  }

  // Parse/extraction errors
  if (
    lowerMsg.includes("parse") ||
    lowerMsg.includes("zod") ||
    lowerMsg.includes("validation")
  ) {
    return "PARSE_ERROR";
  }

  return "UNKNOWN";
}

// ---------------------------------------------------------------------------
// Recording (non-blocking)
// ---------------------------------------------------------------------------

/**
 * Record a scrape failure in the database.
 * Non-blocking: swallows DB errors and logs a warning.
 */
export async function recordFailure(
  url: string,
  state: string,
  stateAbbr: string,
  failureType: FailureType,
  httpStatusCode?: number,
  errorMessage?: string,
  retryCount?: number,
): Promise<void> {
  try {
    await prisma.scrapeFailure.create({
      data: {
        url,
        state,
        stateAbbr: stateAbbr.toUpperCase(),
        failureType,
        httpStatusCode: httpStatusCode ?? null,
        errorMessage: errorMessage ?? null,
        retryCount: retryCount ?? 0,
      },
    });
  } catch (err) {
    console.warn(
      `[FailureTracker] Failed to record failure for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

// ---------------------------------------------------------------------------
// Auto-resolution (non-blocking)
// ---------------------------------------------------------------------------

/**
 * Resolve all unresolved failures for a URL (called after successful fetch+extract).
 * Non-blocking: swallows DB errors and logs a warning.
 */
export async function resolveFailuresForUrl(url: string): Promise<void> {
  try {
    await prisma.scrapeFailure.updateMany({
      where: {
        url,
        resolvedAt: null,
      },
      data: {
        resolvedAt: new Date(),
        resolvedBy: "auto",
      },
    });
  } catch (err) {
    console.warn(
      `[FailureTracker] Failed to resolve failures for ${url}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Check if a response body contains CAPTCHA indicators.
 */
export function hasCaptcha(html: string): boolean {
  const lower = html.toLowerCase();
  return CAPTCHA_INDICATORS.some((indicator) => lower.includes(indicator));
}

/**
 * Disconnect the Prisma client. Call when done.
 */
export async function disconnect() {
  await prisma.$disconnect();
}
