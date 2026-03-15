/**
 * Health score computation — weighted composite formula over a sliding window.
 *
 * Formula: (successRate × 0.40) + (yieldConsistency × 0.30) +
 *          (freshness × 0.20) + (volumeScore × 0.10)
 *
 * All inputs come from recent ScrapeLog entries for a given URL.
 *
 * @module scripts/harvest/health-scorer
 */

import {
  HEALTH_WEIGHTS,
  HEALTH_WINDOW_SIZE,
  FRESHNESS_DECAY_DAYS,
  DEFAULT_EXPECTED_YIELD,
  ANOMALY_DROP_THRESHOLD,
} from "./config";
import type { YieldTrend } from "@prisma/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScrapeWindow {
  success: boolean;
  judgesFound: number;
  scrapedAt: Date;
}

export interface HealthScoreResult {
  healthScore: number;
  successRate: number;
  yieldConsistency: number;
  freshness: number;
  volumeScore: number;
  avgYield: number | null;
  yieldTrend: YieldTrend;
  anomalyDetected: boolean;
  anomalyMessage: string | null;
}

// ---------------------------------------------------------------------------
// Computation
// ---------------------------------------------------------------------------

/**
 * Compute the composite health score from recent scrape logs.
 *
 * @param logs  Most recent scrape logs (up to HEALTH_WINDOW_SIZE), ordered newest-first.
 * @param previousAvgYield  The rolling average from prior computation (for anomaly baseline).
 */
export function computeHealthScore(
  logs: ScrapeWindow[],
  previousAvgYield: number | null,
): HealthScoreResult {
  if (logs.length === 0) {
    return {
      healthScore: 0.5,
      successRate: 0,
      yieldConsistency: 0.5,
      freshness: 0,
      volumeScore: 0,
      avgYield: null,
      yieldTrend: "STABLE",
      anomalyDetected: false,
      anomalyMessage: null,
    };
  }

  const window = logs.slice(0, HEALTH_WINDOW_SIZE);

  // --- Success Rate (40%) ---
  const successCount = window.filter((l) => l.success).length;
  const successRate = successCount / window.length;

  // --- Yield Consistency (30%) ---
  const successfulYields = window
    .filter((l) => l.success)
    .map((l) => l.judgesFound);
  const yieldConsistency = computeYieldConsistency(successfulYields);

  // --- Freshness (20%) ---
  const lastSuccess = window.find((l) => l.success);
  const freshness = lastSuccess
    ? computeFreshness(lastSuccess.scrapedAt)
    : 0;

  // --- Volume Score (10%) ---
  const expectedYield =
    previousAvgYield && previousAvgYield > 0
      ? previousAvgYield
      : DEFAULT_EXPECTED_YIELD;
  const lastYield = successfulYields.length > 0 ? successfulYields[0] : 0;
  const volumeScore = Math.min(1, lastYield / expectedYield);

  // --- Composite Score ---
  const healthScore = clamp(
    successRate * HEALTH_WEIGHTS.successRate +
      yieldConsistency * HEALTH_WEIGHTS.yieldConsistency +
      freshness * HEALTH_WEIGHTS.freshness +
      volumeScore * HEALTH_WEIGHTS.volumeScore,
  );

  // --- Average Yield ---
  const avgYield =
    successfulYields.length > 0
      ? successfulYields.reduce((a, b) => a + b, 0) / successfulYields.length
      : null;

  // --- Yield Trend ---
  const yieldTrend = computeYieldTrend(successfulYields);

  // --- Anomaly Detection ---
  const { anomalyDetected, anomalyMessage } = detectAnomaly(
    lastYield,
    previousAvgYield,
    successfulYields.length > 0,
  );

  return {
    healthScore,
    successRate,
    yieldConsistency,
    freshness,
    volumeScore,
    avgYield,
    yieldTrend,
    anomalyDetected,
    anomalyMessage,
  };
}

// ---------------------------------------------------------------------------
// Signal helpers
// ---------------------------------------------------------------------------

/**
 * Inverted coefficient of variation: 1 - min(1, stddev/mean).
 * Returns 0.5 (neutral) if fewer than 2 data points.
 */
function computeYieldConsistency(yields: number[]): number {
  if (yields.length < 2) return 0.5;
  const mean = yields.reduce((a, b) => a + b, 0) / yields.length;
  if (mean === 0) return 0;
  const variance =
    yields.reduce((sum, y) => sum + (y - mean) ** 2, 0) / yields.length;
  const stddev = Math.sqrt(variance);
  return clamp(1 - Math.min(1, stddev / mean));
}

/**
 * Freshness decay: max(0, 1 - (daysSinceSuccess / 90)).
 */
function computeFreshness(lastSuccessDate: Date): number {
  const daysSince =
    (Date.now() - lastSuccessDate.getTime()) / (1000 * 60 * 60 * 24);
  return clamp(Math.max(0, 1 - daysSince / FRESHNESS_DECAY_DAYS));
}

/**
 * Yield trend: compare last 3 scrape yields vs previous 3.
 * Requires at least 6 data points; defaults to STABLE otherwise.
 */
function computeYieldTrend(yields: number[]): YieldTrend {
  if (yields.length < 6) return "STABLE";
  const recent = yields.slice(0, 3);
  const previous = yields.slice(3, 6);
  const recentAvg = recent.reduce((a, b) => a + b, 0) / 3;
  const previousAvg = previous.reduce((a, b) => a + b, 0) / 3;
  if (previousAvg === 0) return "STABLE";
  if (recentAvg > previousAvg * 1.2) return "IMPROVING";
  if (recentAvg < previousAvg * 0.8) return "DECLINING";
  return "STABLE";
}

/**
 * Anomaly detection: yield dropped >50% compared to rolling average.
 */
function detectAnomaly(
  lastYield: number,
  previousAvgYield: number | null,
  hadSuccess: boolean,
): { anomalyDetected: boolean; anomalyMessage: string | null } {
  if (!hadSuccess || previousAvgYield === null || previousAvgYield === 0) {
    return { anomalyDetected: false, anomalyMessage: null };
  }
  const dropRatio = 1 - lastYield / previousAvgYield;
  if (dropRatio > ANOMALY_DROP_THRESHOLD) {
    const pct = Math.round(dropRatio * 100);
    return {
      anomalyDetected: true,
      anomalyMessage: `yield dropped ${Math.round(previousAvgYield)} → ${lastYield} (${pct}% decline)`,
    };
  }
  return { anomalyDetected: false, anomalyMessage: null };
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}
