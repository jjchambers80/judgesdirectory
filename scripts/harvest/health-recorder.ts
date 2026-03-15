/**
 * Health recorder — writes ScrapeLog entries and upserts UrlHealth records.
 *
 * Designed to be non-blocking: all DB writes are wrapped in try/catch with
 * console.warn fallback so the harvest pipeline never crashes due to health
 * recording errors.
 *
 * @module scripts/harvest/health-recorder
 */

import { PrismaClient, FailureType } from "@prisma/client";
import { computeHealthScore, type ScrapeWindow } from "./health-scorer";
import { HEALTH_WINDOW_SIZE } from "./config";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeLogInput {
  url: string;
  state: string;
  stateAbbr: string;
  success: boolean;
  judgesFound: number;
  failureType?: FailureType | null;
  httpStatusCode?: number | null;
  errorMessage?: string | null;
  retryCount?: number;
  scrapeDurationMs?: number | null;
}

export interface RecordResult {
  urlHealthId: string;
  scrapeLogId: string;
  healthScore: number;
  anomalyDetected: boolean;
  anomalyMessage: string | null;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Record a scrape attempt and update the URL's health profile.
 *
 * 1. Upserts a UrlHealth record for the URL (creates if first scrape).
 * 2. Creates a ScrapeLog entry.
 * 3. Recomputes the health score from the last N scrape logs.
 * 4. Updates UrlHealth with the new score + counters.
 *
 * Non-blocking: catches all errors and warns instead of throwing.
 */
export async function recordScrape(
  input: ScrapeLogInput,
): Promise<RecordResult | null> {
  try {
    // 1. Upsert UrlHealth
    const domain = extractDomain(input.url);
    const urlHealth = await prisma.urlHealth.upsert({
      where: { url: input.url },
      create: {
        url: input.url,
        domain,
        state: input.state,
        stateAbbr: input.stateAbbr,
        healthScore: 0.5,
        source: "MANUAL",
      },
      update: {}, // just ensure it exists
    });

    // 2. Create ScrapeLog
    const scrapeLog = await prisma.scrapeLog.create({
      data: {
        urlHealthId: urlHealth.id,
        url: input.url,
        state: input.state,
        stateAbbr: input.stateAbbr,
        success: input.success,
        judgesFound: input.judgesFound,
        failureType: input.failureType ?? null,
        httpStatusCode: input.httpStatusCode ?? null,
        errorMessage: input.errorMessage ?? null,
        retryCount: input.retryCount ?? 0,
        scrapeDurationMs: input.scrapeDurationMs ?? null,
      },
    });

    // 3. Fetch recent logs for health computation
    const recentLogs = await prisma.scrapeLog.findMany({
      where: { urlHealthId: urlHealth.id },
      orderBy: { scrapedAt: "desc" },
      take: HEALTH_WINDOW_SIZE,
      select: { success: true, judgesFound: true, scrapedAt: true },
    });

    const window: ScrapeWindow[] = recentLogs.map((l) => ({
      success: l.success,
      judgesFound: l.judgesFound,
      scrapedAt: l.scrapedAt,
    }));

    // 4. Compute new health score
    const result = computeHealthScore(window, urlHealth.avgYield);

    // 5. Update UrlHealth with new metrics
    const totalScrapes = urlHealth.totalScrapes + 1;
    const successfulScrapes =
      urlHealth.successfulScrapes + (input.success ? 1 : 0);

    await prisma.urlHealth.update({
      where: { id: urlHealth.id },
      data: {
        healthScore: result.healthScore,
        totalScrapes,
        successfulScrapes,
        lastYield: input.success ? input.judgesFound : urlHealth.lastYield,
        avgYield: result.avgYield,
        yieldTrend: result.yieldTrend,
        anomalyDetected: result.anomalyDetected,
        anomalyMessage: result.anomalyMessage,
        lastScrapedAt: new Date(),
        lastSuccessAt: input.success ? new Date() : urlHealth.lastSuccessAt,
      },
    });

    return {
      urlHealthId: urlHealth.id,
      scrapeLogId: scrapeLog.id,
      healthScore: result.healthScore,
      anomalyDetected: result.anomalyDetected,
      anomalyMessage: result.anomalyMessage,
    };
  } catch (err) {
    console.warn(
      `[Health] Failed to record scrape for ${input.url}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Batch recompute health scores for all UrlHealth records updated during this run.
 * Called after all URLs are processed to ensure consistent scoring.
 */
export async function recomputeHealthScores(
  urlHealthIds: string[],
): Promise<{ updated: number; anomalies: string[] }> {
  const anomalies: string[] = [];
  let updated = 0;

  for (const id of urlHealthIds) {
    try {
      const urlHealth = await prisma.urlHealth.findUnique({ where: { id } });
      if (!urlHealth) continue;

      const recentLogs = await prisma.scrapeLog.findMany({
        where: { urlHealthId: id },
        orderBy: { scrapedAt: "desc" },
        take: HEALTH_WINDOW_SIZE,
        select: { success: true, judgesFound: true, scrapedAt: true },
      });

      const window: ScrapeWindow[] = recentLogs.map((l) => ({
        success: l.success,
        judgesFound: l.judgesFound,
        scrapedAt: l.scrapedAt,
      }));

      const result = computeHealthScore(window, urlHealth.avgYield);

      await prisma.urlHealth.update({
        where: { id },
        data: {
          healthScore: result.healthScore,
          avgYield: result.avgYield,
          yieldTrend: result.yieldTrend,
          anomalyDetected: result.anomalyDetected,
          anomalyMessage: result.anomalyMessage,
        },
      });

      if (result.anomalyDetected && result.anomalyMessage) {
        anomalies.push(`${urlHealth.url}: ${result.anomalyMessage}`);
      }

      updated++;
    } catch (err) {
      console.warn(
        `[Health] Failed to recompute score for ${id}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return { updated, anomalies };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    // fallback: regex extraction
    const match = url.match(/:\/\/([^/]+)/);
    return match ? match[1] : url;
  }
}
