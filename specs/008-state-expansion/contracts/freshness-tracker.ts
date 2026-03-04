/**
 * Contract: Freshness Tracker
 *
 * Manages harvest manifest files that track when each state was last
 * successfully harvested. Provides data age calculation and freshness
 * warnings.
 *
 * @module specs/008-state-expansion/contracts/freshness-tracker
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Number of days before data is considered stale and a re-harvest is recommended. */
export const DATA_FRESHNESS_THRESHOLD_DAYS = 90;

/** Manifest filename within each state's output directory. */
export const MANIFEST_FILENAME = "harvest-manifest.json";

// ---------------------------------------------------------------------------
// Schema & Types
// ---------------------------------------------------------------------------

/**
 * Zod schema for the harvest manifest file.
 * Written to output/{state-slug}/harvest-manifest.json after each successful run.
 */
export const HarvestManifestSchema = z.object({
  /** ISO 8601 timestamp of last successful run completion */
  lastCompletedAt: z.string().datetime(),
  /** Total judges in the final output CSV */
  judgeCount: z.number().int().min(0),
  /** Filename of the quality report generated */
  reportFile: z.string().min(1),
  /** Total roster pages targeted */
  pagesTargeted: z.number().int().min(1),
  /** Pages that failed to fetch or extract */
  pagesFailed: z.number().int().min(0),
  /** Quality gate verdict from the run */
  qualityVerdict: z.enum(["PASS", "WARNING", "CRITICAL"]),
});

export type HarvestManifest = z.infer<typeof HarvestManifestSchema>;

/**
 * Freshness check result for a single state.
 */
export interface FreshnessResult {
  /** State slug (e.g., "texas") */
  state: string;
  /** Whether a manifest file exists */
  hasManifest: boolean;
  /** Last completed harvest timestamp (null if no manifest) */
  lastCompletedAt: string | null;
  /** Number of days since last harvest (null if no manifest) */
  daysSinceHarvest: number | null;
  /** Whether data exceeds the freshness threshold */
  isStale: boolean;
  /** Judge count from last harvest (null if no manifest) */
  lastJudgeCount: number | null;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Read and parse a harvest manifest for a state.
 *
 * @param outputDir - Root output directory (e.g., "output/")
 * @param stateSlug - State slug (e.g., "texas")
 * @returns Parsed HarvestManifest or null if file doesn't exist
 */
export function readManifest(
  outputDir: string,
  stateSlug: string,
): HarvestManifest | null {
  // Implementation: fs.readFileSync → JSON.parse → HarvestManifestSchema.safeParse
  throw new Error("Contract stub — implement in scripts/harvest/index.ts");
}

/**
 * Write a harvest manifest after a successful run.
 * Uses atomic write (tmp file + rename) to prevent partial writes.
 *
 * @param outputDir - Root output directory
 * @param stateSlug - State slug
 * @param manifest - The manifest data to write
 */
export function writeManifest(
  outputDir: string,
  stateSlug: string,
  manifest: HarvestManifest,
): void {
  // Implementation: JSON.stringify → write to tmp → rename to final path
  throw new Error("Contract stub — implement in scripts/harvest/index.ts");
}

/**
 * Check data freshness for a state.
 *
 * @param outputDir - Root output directory
 * @param stateSlug - State slug
 * @returns FreshnessResult with staleness assessment
 */
export function checkFreshness(
  outputDir: string,
  stateSlug: string,
): FreshnessResult {
  // Implementation:
  // 1. Read manifest (may be null)
  // 2. Calculate days since lastCompletedAt
  // 3. Compare against DATA_FRESHNESS_THRESHOLD_DAYS
  throw new Error("Contract stub — implement in scripts/harvest/index.ts");
}

/**
 * Check data freshness for all discovered states.
 * Used at startup of --all runs to print freshness table.
 *
 * @param outputDir - Root output directory
 * @param stateSlugs - Array of discovered state slugs
 * @returns Array of FreshnessResult, one per state
 */
export function checkAllFreshness(
  outputDir: string,
  stateSlugs: string[],
): FreshnessResult[] {
  return stateSlugs.map((slug) => checkFreshness(outputDir, slug));
}

/**
 * Format a freshness result as a quality report Markdown section.
 *
 * @param result - FreshnessResult for a single state
 * @returns Markdown string for the "## Data Freshness" section
 */
export function formatFreshnessSection(result: FreshnessResult): string {
  // Implementation:
  // - If no manifest: "No previous harvest on record."
  // - If stale: "⚠️ Last harvest: {date} ({N} days ago — exceeds 90-day threshold)"
  // - If fresh: "Last harvest: {date} ({N} days ago)"
  throw new Error("Contract stub — implement in scripts/harvest/reporter.ts");
}
