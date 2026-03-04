#!/usr/bin/env ts-node
/**
 * Judge Harvest — CLI entry point.
 *
 * Orchestrates: config → checkpoint → fetch → extract → enrich →
 * normalize → deduplicate → CSV write → quality report.
 *
 * Usage:
 *   npx ts-node scripts/harvest/index.ts [state-flags] [pipeline-flags]
 *
 * State Flags:
 *   --state <name>           Target a specific state (default: florida)
 *   --all                    Process all available state configs
 *   --list                   Print available states and exit
 *
 * Pipeline Flags:
 *   --seed-courts-only       Seed court structure only
 *   --dry-run                Fetch HTML but skip LLM API calls
 *   --reset                  Clear checkpoint and start fresh
 *   --resume                 Resume from last checkpoint (default)
 *   --skip-bio               Skip bio page enrichment (roster data only)
 *   --ballotpedia            Enrich with Ballotpedia political/electoral data
 *   --ballotpedia-max <n>    Limit Ballotpedia enrichment to n judges
 *   --output-dir <path>      Override output directory
 *
 * @module scripts/harvest/index
 */

// Load .env from project root so DATABASE_URL and ANTHROPIC_API_KEY are available
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import fs from "node:fs";
import path from "node:path";
import Papa from "papaparse";
import {
  parseFlags,
  validateEnv,
  loadStateConfig,
  buildCourtUrlEntries,
  discoverStates,
  stateSlug,
  type CliFlags,
  type CsvJudgeRecord,
  type EnrichedJudgeRecord,
  type CourtUrlEntry,
  type Checkpoint,
} from "./config";
import type { StateConfig } from "./state-config-schema";
import {
  HarvestManifestSchema,
  type HarvestManifest,
} from "./state-config-schema";
import { seedStateCourts } from "./court-seeder";
import { loadCheckpoint, saveCheckpoint, resetCheckpoint } from "./checkpoint";
import { fetchPage } from "./fetcher";
import { extractJudges, type JudgeRecord } from "./extractor";
import { enrichWithBioPages } from "./bio-enricher";
import { enrichAllWithBallotpedia } from "./ballotpedia-enricher";
import { normalizeJudgeName, canonicalizeCourtType } from "./normalizer";
import { deduplicateJudges, deduplicateEnrichedJudges } from "./deduplicator";
import {
  generateReport,
  generateEnrichedReport,
  type Severity,
} from "./reporter";
import {
  getLLMConfig,
  validateLLMConfig,
  describeLLMConfig,
} from "./llm-provider";

// ---------------------------------------------------------------------------
// File-based logging
// ---------------------------------------------------------------------------

let logStream: fs.WriteStream | null = null;

function setupLogging(outputDir: string, slug?: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const prefix = slug || "harvest";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logPath = path.join(outputDir, `${prefix}-harvest-${timestamp}.log`);
  logStream = fs.createWriteStream(logPath, { flags: "a" });

  // Intercept console methods to also write to log file
  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origLog(...args);
    writeLog("INFO", msg);
  };

  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origWarn(...args);
    writeLog("WARN", msg);
  };

  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origError(...args);
    writeLog("ERROR", msg);
  };

  origLog(`Log file: ${logPath}`);
  writeLog("INFO", "Logging initialized");
}

function writeLog(level: string, message: string): void {
  if (!logStream) return;
  const ts = new Date().toISOString();
  logStream.write(`[${ts}] ${level.padEnd(5)} ${message}\n`);
}

function closeLogging(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

// ---------------------------------------------------------------------------
// Harvest manifest — freshness tracking (per contract: freshness-tracker.ts)
// ---------------------------------------------------------------------------

/** Number of days before data is considered stale. */
const DATA_FRESHNESS_THRESHOLD_DAYS = 90;

/** Manifest filename within each state's output directory. */
const MANIFEST_FILENAME = "harvest-manifest.json";

/**
 * Read and parse a harvest manifest for a state.
 * @returns Parsed HarvestManifest or null if file doesn't exist / is invalid.
 */
function readManifest(outputDir: string, slug: string): HarvestManifest | null {
  const manifestPath = path.join(outputDir, slug, MANIFEST_FILENAME);
  if (!fs.existsSync(manifestPath)) return null;

  try {
    const raw = fs.readFileSync(manifestPath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = HarvestManifestSchema.safeParse(parsed);
    if (result.success) return result.data;
    console.warn(
      `  WARN: Invalid manifest at ${manifestPath}: ${result.error.message}`,
    );
    return null;
  } catch (err) {
    console.warn(
      `  WARN: Failed to read manifest at ${manifestPath}: ${err instanceof Error ? err.message : String(err)}`,
    );
    return null;
  }
}

/**
 * Write a harvest manifest after a successful run.
 * Uses atomic write (tmp file + rename) to prevent partial writes.
 */
function writeManifest(
  outputDir: string,
  slug: string,
  manifest: HarvestManifest,
): void {
  const dir = path.join(outputDir, slug);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const finalPath = path.join(dir, MANIFEST_FILENAME);
  const tmpPath = `${finalPath}.tmp`;

  fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), "utf-8");
  fs.renameSync(tmpPath, finalPath);
  console.log(`Manifest written: ${finalPath}`);
}

/**
 * Check data freshness for a state.
 */
interface FreshnessResult {
  state: string;
  hasManifest: boolean;
  lastCompletedAt: string | null;
  daysSinceHarvest: number | null;
  isStale: boolean;
  lastJudgeCount: number | null;
}

function checkFreshness(outputDir: string, slug: string): FreshnessResult {
  const manifest = readManifest(outputDir, slug);
  if (!manifest) {
    return {
      state: slug,
      hasManifest: false,
      lastCompletedAt: null,
      daysSinceHarvest: null,
      isStale: true,
      lastJudgeCount: null,
    };
  }

  const lastDate = new Date(manifest.lastCompletedAt);
  const now = new Date();
  const daysSince = Math.floor(
    (now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return {
    state: slug,
    hasManifest: true,
    lastCompletedAt: manifest.lastCompletedAt,
    daysSinceHarvest: daysSince,
    isStale: daysSince > DATA_FRESHNESS_THRESHOLD_DAYS,
    lastJudgeCount: manifest.judgeCount,
  };
}

/**
 * Print freshness table to stdout for all discovered states.
 */
function printFreshnessTable(outputDir: string, stateSlugs: string[]): void {
  const results = stateSlugs.map((s) => checkFreshness(outputDir, s));

  console.log("\n===== Data Freshness =====\n");
  console.log("| State | Last Harvest | Days Ago | Judges | Status |");
  console.log("|-------|-------------|----------|--------|--------|");

  for (const r of results) {
    if (!r.hasManifest) {
      console.log(`| ${r.state} | — | — | — | 🆕 No prior harvest |`);
    } else {
      const date = r.lastCompletedAt
        ? new Date(r.lastCompletedAt).toISOString().slice(0, 10)
        : "—";
      const status = r.isStale
        ? `⚠️ STALE (>${DATA_FRESHNESS_THRESHOLD_DAYS}d)`
        : "✅ Fresh";
      console.log(
        `| ${r.state} | ${date} | ${r.daysSinceHarvest} | ${r.lastJudgeCount} | ${status} |`,
      );
    }
  }
  console.log("");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags();
  validateEnv(flags);

  // --list: print available states and exit
  if (flags.list) {
    const states = discoverStates();
    if (states.length === 0) {
      console.log("No state configurations found.");
    } else {
      console.log("Available states:");
      for (const s of states) {
        const config = loadStateConfig(s);
        const courtCount = config.courts.length;
        console.log(`  ${s.padEnd(16)} ${courtCount} courts`);
      }
    }
    return;
  }

  // --all: process all available states sequentially
  if (flags.all) {
    const states = discoverStates();
    if (states.length === 0) {
      console.error("Error: No state configurations found.");
      process.exit(1);
    }

    console.log(`Processing ${states.length} state(s): ${states.join(", ")}\n`);

    // Print freshness table before processing
    const slugs = states.map((s) => stateSlug(s));
    printFreshnessTable(flags.outputDir, slugs);

    const results: StateRunResult[] = [];

    for (const stateName of states) {
      try {
        const result = await runSingleState(stateName, flags);
        results.push(result);
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(
          `\nERROR: ${stateName} failed: ${errMsg}. Checkpoint saved. Continuing to next state.\n`,
        );
        results.push({
          state: stateSlug(stateName),
          success: false,
          judgeCount: 0,
          pages: { total: 0, succeeded: 0, failed: 0 },
          courtTypeCounts: {},
          duplicatesRemoved: 0,
          reportPath: "",
          qualityVerdict: "CRITICAL",
          error: errMsg,
        });
      }
    }

    // Write combined summary
    writeCombinedSummary(results, flags.outputDir);

    // Check if all states failed
    const allFailed = results.every((r) => !r.success);
    if (allFailed) {
      console.error(
        "\nError: All states failed. See combined summary for details.",
      );
      process.exit(1);
    }

    // Print results
    const succeeded = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);
    console.log(`\n===== All States Complete =====`);
    console.log(`Succeeded: ${succeeded.length} | Failed: ${failed.length}`);
    if (failed.length > 0) {
      console.log(`Failed states: ${failed.map((f) => f.state).join(", ")}`);
    }
    return;
  }

  // Single state (--state <name> or default to florida)
  const stateName = flags.state || "florida";
  const slug = stateSlug(stateName);

  // Show freshness info for single state
  const freshness = checkFreshness(flags.outputDir, slug);
  if (freshness.hasManifest) {
    const date = freshness.lastCompletedAt
      ? new Date(freshness.lastCompletedAt).toISOString().slice(0, 10)
      : "—";
    const staleTag = freshness.isStale ? " ⚠️ STALE" : "";
    console.log(
      `Data freshness: last harvest ${date} (${freshness.daysSinceHarvest}d ago, ${freshness.lastJudgeCount} judges)${staleTag}`,
    );
  } else {
    console.log("Data freshness: no previous harvest on record");
  }
  console.log("");

  await runSingleState(stateName, flags);
}

// ---------------------------------------------------------------------------
// Single-state harvest
// ---------------------------------------------------------------------------

interface StateRunResult {
  /** State slug (e.g., "texas") */
  state: string;
  /** Whether the harvest completed without fatal errors */
  success: boolean;
  /** Total judges in final CSV (0 if failed) */
  judgeCount: number;
  /** Page-level fetch statistics */
  pages: {
    total: number;
    succeeded: number;
    failed: number;
  };
  /** Judge count broken down by court type */
  courtTypeCounts: Record<string, number>;
  /** Records removed during deduplication */
  duplicatesRemoved: number;
  /** Absolute path to the per-state quality report */
  reportPath: string;
  /** Quality gate verdict from the per-state report */
  qualityVerdict: "PASS" | "WARNING" | "CRITICAL";
  /** Error message if the run failed (null on success) */
  error: string | null;
}

/**
 * Run the full harvest pipeline for a single state.
 * Returns a full StateRunResult with judge count, page stats, quality verdict, etc.
 */
async function runSingleState(
  stateName: string,
  flags: CliFlags,
): Promise<StateRunResult> {
  const stateConfig = loadStateConfig(stateName);
  const slug = stateSlug(stateName);

  // Per-state output directory
  const stateOutputDir = path.join(flags.outputDir, slug);
  const checkpointDir = path.join(stateOutputDir, "checkpoints");
  for (const dir of [stateOutputDir, checkpointDir]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Initialize file-based logging in per-state directory
  setupLogging(stateOutputDir, slug);

  console.log(`${stateConfig.state} Judge Harvest`);
  console.log("=".repeat(stateConfig.state.length + " Judge Harvest".length));
  console.log("");

  // --seed-courts-only: seed courts and exit
  if (flags.seedCourtsOnly) {
    console.log(`Seeding ${stateConfig.state} court structure...\n`);
    await seedStateCourts(stateConfig);
    return {
      state: slug,
      success: true,
      judgeCount: 0,
      pages: { total: 0, succeeded: 0, failed: 0 },
      courtTypeCounts: {},
      duplicatesRemoved: 0,
      reportPath: "",
      qualityVerdict: "PASS",
      error: null,
    };
  }

  // Validate LLM config if not dry-run
  if (!flags.dryRun) {
    const llmConfig = getLLMConfig();
    validateLLMConfig(llmConfig);
    console.log(`LLM Provider: ${describeLLMConfig()}`);
    console.log(
      "(Deterministic extraction tried first to minimize LLM costs)\n",
    );
  }

  // Load court URL configuration from state config
  const courtUrls = buildCourtUrlEntries(stateConfig);
  console.log(
    `Loaded ${courtUrls.length} court URL(s) from ${slug}-courts.json\n`,
  );

  // Handle --reset
  if (flags.reset) {
    resetCheckpoint(stateOutputDir, slug);
  }

  // Load or create checkpoint (per-state)
  const checkpoint = loadCheckpoint(stateOutputDir, slug);

  // Run extraction pipeline (with optional bio enrichment)
  const pipelineResult = await runEnrichedPipeline(
    courtUrls,
    checkpoint,
    flags,
    slug,
    stateConfig,
  );

  if (pipelineResult.records.length === 0) {
    console.log("\nNo judge records extracted. Nothing to write.");
    return {
      state: slug,
      success: true,
      judgeCount: 0,
      pages: {
        total: courtUrls.length,
        succeeded: courtUrls.length,
        failed: 0,
      },
      courtTypeCounts: {},
      duplicatesRemoved: 0,
      reportPath: "",
      qualityVerdict: "WARNING",
      error: null,
    };
  }

  const rawCount = pipelineResult.records.length;

  // Deduplicate across overlapping court pages
  const dedupResult = deduplicateEnrichedJudges(pipelineResult.records, {
    useIdentity: true,
  });
  console.log(
    `\nDeduplication: ${rawCount} raw → ${dedupResult.duplicates.length} dupes removed → ${dedupResult.unique.length} unique`,
  );

  // Log identity stats if using identity-based dedup
  if (dedupResult.identityStats) {
    const stats = dedupResult.identityStats;
    console.log(
      `  Identity confidence: ${stats.highConfidence} high, ${stats.mediumConfidence} medium, ${stats.lowConfidence} low`,
    );
  }

  // Optional: Ballotpedia enrichment for political/electoral data
  let finalRecords = dedupResult.unique;
  let ballotpediaStats: {
    totalEnriched: number;
    fieldCounts: Record<string, number>;
  } | null = null;

  if (flags.ballotpedia) {
    console.log("\n===== Ballotpedia Enrichment =====");
    const ballotResult = await enrichAllWithBallotpedia(finalRecords, {
      delayMs: stateConfig.rateLimit?.fetchDelayMs ?? 1500,
      maxJudges: flags.ballotpediaMax || undefined,
    });
    finalRecords = ballotResult.judges;
    ballotpediaStats = {
      totalEnriched: ballotResult.totalEnriched,
      fieldCounts: ballotResult.fieldCounts,
    };
  }

  // Write enriched CSV output to per-state directory
  const csvPath = writeEnrichedCsv(finalRecords, stateOutputDir, slug);
  console.log(`CSV written: ${csvPath}`);

  // Generate quality report with field coverage
  const timestamp = new Date().toISOString();
  const { filePath: reportPath, qualityVerdict } = generateEnrichedReport(
    {
      courtUrls,
      checkpoint,
      rawCount,
      dedupResult,
      finalRecords,
      timestamp,
      bioStats: pipelineResult.bioStats,
      ballotpediaStats,
      stateSlug: slug,
    },
    stateOutputDir,
  );
  console.log(`Report written: ${reportPath}`);

  // Write harvest manifest for freshness tracking
  const courtResults = Object.values(checkpoint.results);
  const failedPages = courtResults.filter((r) => r.errors.length > 0).length;
  const succeededPages = courtUrls.length - failedPages;
  writeManifest(flags.outputDir, slug, {
    lastCompletedAt: timestamp,
    judgeCount: finalRecords.length,
    reportFile: path.basename(reportPath),
    pagesTargeted: courtUrls.length,
    pagesFailed: failedPages,
    qualityVerdict,
  });

  // Compute court type counts for the result
  const courtTypeCounts: Record<string, number> = {};
  for (const rec of finalRecords) {
    const ct = rec.courtType || "Unknown";
    courtTypeCounts[ct] = (courtTypeCounts[ct] || 0) + 1;
  }

  return {
    state: slug,
    success: true,
    judgeCount: finalRecords.length,
    pages: {
      total: courtUrls.length,
      succeeded: succeededPages,
      failed: failedPages,
    },
    courtTypeCounts,
    duplicatesRemoved: dedupResult.duplicates.length,
    reportPath,
    qualityVerdict,
    error: null,
  };
}

// ---------------------------------------------------------------------------
// Combined summary (--all)
// ---------------------------------------------------------------------------

interface AggregateStats {
  statesProcessed: number;
  statesSucceeded: number;
  statesFailed: number;
  totalJudges: number;
  totalPages: number;
  totalFailedPages: number;
  totalDuplicatesRemoved: number;
  courtTypeCounts: Record<string, number>;
  overallVerdict: "PASS" | "WARNING" | "CRITICAL";
}

/**
 * Compute aggregate statistics from per-state results.
 * Overall verdict = worst individual verdict across all states.
 */
function computeAggregateStats(results: StateRunResult[]): AggregateStats {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const courtTypeCounts: Record<string, number> = {};
  for (const result of succeeded) {
    for (const [type, count] of Object.entries(result.courtTypeCounts)) {
      courtTypeCounts[type] = (courtTypeCounts[type] || 0) + count;
    }
  }

  const verdictPriority = { PASS: 0, WARNING: 1, CRITICAL: 2 } as const;
  const worstVerdict = results.reduce<"PASS" | "WARNING" | "CRITICAL">(
    (worst, r) =>
      verdictPriority[r.qualityVerdict] > verdictPriority[worst]
        ? r.qualityVerdict
        : worst,
    "PASS",
  );

  return {
    statesProcessed: results.length,
    statesSucceeded: succeeded.length,
    statesFailed: failed.length,
    totalJudges: succeeded.reduce((sum, r) => sum + r.judgeCount, 0),
    totalPages: results.reduce((sum, r) => sum + r.pages.total, 0),
    totalFailedPages: results.reduce((sum, r) => sum + r.pages.failed, 0),
    totalDuplicatesRemoved: succeeded.reduce(
      (sum, r) => sum + r.duplicatesRemoved,
      0,
    ),
    courtTypeCounts,
    overallVerdict: worstVerdict,
  };
}

/**
 * Write a combined multi-state summary report in Markdown format.
 * Includes run metadata, per-state results with quality verdicts,
 * aggregate totals, failed state details, and court type breakdown.
 */
function writeCombinedSummary(
  results: StateRunResult[],
  outputDir: string,
): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const stats = computeAggregateStats(results);
  const runTimestamp = new Date().toISOString();
  const fileTimestamp = runTimestamp.replace(/[:.]/g, "-").slice(0, 19);
  const filePath = path.join(outputDir, `combined-summary-${fileTimestamp}.md`);

  const verdictEmoji: Record<string, string> = {
    PASS: "✅",
    WARNING: "🟡",
    CRITICAL: "🔴",
  };

  const lines: string[] = [
    `# Combined Harvest Summary — ${runTimestamp}`,
    "",
    "## Overview",
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| States processed | ${stats.statesProcessed} |`,
    `| States succeeded | ${stats.statesSucceeded} |`,
    `| States failed | ${stats.statesFailed} |`,
    `| Total judges | ${stats.totalJudges} |`,
    `| Total pages | ${stats.totalPages} |`,
    `| Failed pages | ${stats.totalFailedPages} |`,
    `| Duplicates removed | ${stats.totalDuplicatesRemoved} |`,
    `| Overall verdict | ${verdictEmoji[stats.overallVerdict]} ${stats.overallVerdict} |`,
    "",
    "## Per-State Results",
    "",
    "| State | Status | Verdict | Judges | Pages (ok/fail) | Dupes Removed | Report |",
    "|-------|--------|---------|--------|------------------|---------------|--------|",
  ];

  for (const r of results) {
    const status = r.success ? "✅" : "❌";
    const verdict = `${verdictEmoji[r.qualityVerdict]} ${r.qualityVerdict}`;
    const pages = `${r.pages.succeeded}/${r.pages.failed}`;
    const report = r.reportPath ? path.basename(r.reportPath) : "—";
    lines.push(
      `| ${r.state} | ${status} | ${verdict} | ${r.judgeCount} | ${pages} | ${r.duplicatesRemoved} | ${report} |`,
    );
  }

  // Aggregate totals
  lines.push("");
  lines.push("## Aggregate Totals");
  lines.push("");
  lines.push(`- **States processed**: ${stats.statesProcessed}`);
  lines.push(`- **States succeeded**: ${stats.statesSucceeded}`);
  lines.push(`- **States failed**: ${stats.statesFailed}`);
  lines.push(`- **Total judges**: ${stats.totalJudges}`);
  lines.push(`- **Total pages**: ${stats.totalPages}`);
  lines.push(`- **Failed pages**: ${stats.totalFailedPages}`);
  lines.push(`- **Duplicates removed**: ${stats.totalDuplicatesRemoved}`);

  // Failed state details
  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    lines.push("");
    lines.push("## Failed States");
    lines.push("");
    for (const f of failures) {
      lines.push(`### ${f.state}`);
      lines.push("");
      lines.push(`**Error**: ${f.error || "Unknown"}`);
      lines.push("");
    }
  }

  // Court type breakdown
  if (Object.keys(stats.courtTypeCounts).length > 0) {
    lines.push("");
    lines.push("## Court Type Breakdown (all states)");
    lines.push("");
    lines.push("| Court Type | Judges |");
    lines.push("|------------|--------|");
    const sorted = Object.entries(stats.courtTypeCounts).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [type, count] of sorted) {
      lines.push(`| ${type} | ${count} |`);
    }
  }

  fs.writeFileSync(filePath, lines.join("\n") + "\n", "utf-8");
  console.log(`\nCombined summary: ${filePath}`);
}

// ---------------------------------------------------------------------------
// Enriched extraction pipeline (roster + bio pages)
// ---------------------------------------------------------------------------

interface EnrichedPipelineResult {
  records: EnrichedJudgeRecord[];
  bioStats: {
    bioPagesFetched: number;
    bioPagesSucceeded: number;
    bioPagesFailed: number;
    fieldsEnriched: Record<string, number>;
  };
}

async function runEnrichedPipeline(
  courtUrls: CourtUrlEntry[],
  checkpoint: Checkpoint,
  flags: CliFlags,
  slug: string,
  stateConfig: StateConfig,
): Promise<EnrichedPipelineResult> {
  const allRecords: EnrichedJudgeRecord[] = [];
  const completedSet = new Set(checkpoint.completedUrls);
  const stateOutputDir = path.join(flags.outputDir, slug);

  const bioStats = {
    bioPagesFetched: 0,
    bioPagesSucceeded: 0,
    bioPagesFailed: 0,
    fieldsEnriched: {} as Record<string, number>,
  };

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let skippedFetchMethod = 0;

  for (const entry of courtUrls) {
    // Resume support: skip already-completed URLs
    if (completedSet.has(entry.url)) {
      skipped++;
      console.log(`[skip] ${entry.label} — already completed`);
      continue;
    }

    // Skip entries requiring unsupported fetch methods (browser, manual)
    if (entry.fetchMethod === "browser" || entry.fetchMethod === "manual") {
      skippedFetchMethod++;
      console.warn(
        `\n[skip:${entry.fetchMethod}] ${entry.label} — requires ${entry.fetchMethod}-based fetching (not yet supported)`,
      );
      console.warn(`  URL: ${entry.url}`);
      continue;
    }

    processed++;
    console.log(
      `\n[${processed}/${courtUrls.length - skipped - skippedFetchMethod}] Fetching: ${entry.label}`,
    );
    console.log(`  URL: ${entry.url}`);

    try {
      // Fetch and clean HTML
      const fetchResult = await fetchPage(entry.url);
      console.log(
        `  Fetched: ${formatBytes(fetchResult.htmlSize)} HTML → ${formatBytes(fetchResult.markdownSize)} Markdown`,
      );

      // Dry run: log sizes but skip extraction
      if (flags.dryRun) {
        console.log("  [dry-run] Skipping extraction");
        updateCheckpoint(checkpoint, entry.url, 0, [], stateOutputDir);
        continue;
      }

      // Extract judges (tries deterministic first, falls back to LLM)
      const result = await extractJudges(fetchResult.markdown, {
        label: entry.label,
        courtType: entry.courtType,
        counties: entry.counties,
        rawHtml: fetchResult.rawHtml,
        url: entry.url,
        deterministic: entry.deterministic,
        selectorHint: entry.selectorHint,
        extractionPromptFile: stateConfig.extractionPromptFile,
        stateAbbreviation: stateConfig.abbreviation,
      });

      console.log(`  Extracted: ${result.judges.length} judge(s)`);

      // Phase 2: Enrich with bio page data (unless --skip-bio)
      const enrichResult = await enrichWithBioPages(result.judges, entry, {
        skipBioFetch: flags.skipBio,
        stateAbbreviation: stateConfig.abbreviation,
        onProgress: (current, total, name) => {
          if (!flags.skipBio) {
            console.log(`  [${current}/${total}] Enriching: ${name}`);
          }
        },
      });

      // Accumulate bio stats
      bioStats.bioPagesFetched += enrichResult.stats.bioPagesFetched;
      bioStats.bioPagesSucceeded += enrichResult.stats.bioPagesSucceeded;
      bioStats.bioPagesFailed += enrichResult.stats.bioPagesFailed;
      for (const [field, count] of Object.entries(
        enrichResult.stats.fieldsEnriched,
      )) {
        bioStats.fieldsEnriched[field] =
          (bioStats.fieldsEnriched[field] ?? 0) + count;
      }

      // Expand multi-county records
      const expandedRecords = expandEnrichedRecords(
        enrichResult.enriched,
        entry,
        stateConfig.abbreviation,
      );
      allRecords.push(...expandedRecords);

      // Update checkpoint
      updateCheckpoint(
        checkpoint,
        entry.url,
        result.judges.length,
        [],
        stateOutputDir,
      );

      if (!flags.skipBio && enrichResult.stats.bioPagesFetched > 0) {
        console.log(
          `  Bio enrichment: ${enrichResult.stats.bioPagesSucceeded}/${enrichResult.stats.bioPagesFetched} pages`,
        );
      }
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${errMsg}`);

      // Record failure in checkpoint but continue with next URL
      updateCheckpoint(checkpoint, entry.url, 0, [errMsg], stateOutputDir);
    }
  }

  console.log(
    `\nPipeline complete: ${processed} processed, ${skipped} skipped (resumed), ${failed} failed` +
      (skippedFetchMethod > 0
        ? `, ${skippedFetchMethod} skipped (unsupported fetch method)`
        : ""),
  );

  return { records: allRecords, bioStats };
}

// ---------------------------------------------------------------------------
// Enriched record expansion (per-county for multi-county courts)
// ---------------------------------------------------------------------------

function expandEnrichedRecords(
  records: EnrichedJudgeRecord[],
  entry: CourtUrlEntry,
  stateAbbreviation?: string,
): EnrichedJudgeRecord[] {
  const expanded: EnrichedJudgeRecord[] = [];

  // Use the level field from the court entry to determine expansion behavior
  const isAppellateOrSupreme =
    entry.level === "supreme" || entry.level === "appellate";

  for (const record of records) {
    const normalizedName = normalizeJudgeName(record.fullName);
    const courtType = canonicalizeCourtType(
      record.courtType,
      stateAbbreviation,
    );

    // Create normalized base record
    const baseRecord: EnrichedJudgeRecord = {
      ...record,
      fullName: normalizedName,
      courtType,
    };

    // If record has a specific county, use it
    if (record.county) {
      expanded.push(baseRecord);
      continue;
    }

    // Appellate/supreme judges: single record, no county expansion
    if (isAppellateOrSupreme) {
      expanded.push(baseRecord);
      continue;
    }

    // Trial/specialized judges without specific county:
    // - Deterministic entries already handled county assignment during extraction,
    //   so a null county means the judge genuinely has no county — don't expand.
    // - LLM-extracted entries may lack county info; expand to all counties.
    if (entry.deterministic) {
      // Deterministic extraction assigned counties directly; skip expansion
      expanded.push(baseRecord);
    } else if (entry.counties.length > 0) {
      for (const county of entry.counties) {
        expanded.push({ ...baseRecord, county });
      }
    } else {
      expanded.push(baseRecord);
    }
  }

  return expanded;
}

// ---------------------------------------------------------------------------
// Legacy extraction pipeline (for backward compatibility)
// ---------------------------------------------------------------------------

async function runExtractionPipeline(
  courtUrls: CourtUrlEntry[],
  checkpoint: Checkpoint,
  flags: CliFlags,
  stateConfig?: StateConfig,
): Promise<CsvJudgeRecord[]> {
  const allRecords: CsvJudgeRecord[] = [];
  const completedSet = new Set(checkpoint.completedUrls);

  let processed = 0;
  let skipped = 0;
  let failed = 0;
  let skippedFetchMethod = 0;

  for (const entry of courtUrls) {
    // Resume support: skip already-completed URLs
    if (completedSet.has(entry.url)) {
      skipped++;
      console.log(`[skip] ${entry.label} — already completed`);

      // Collect previously extracted records from checkpoint results
      // (they are counted in totalJudges but not re-added to allRecords
      // since the CSV will be freshly generated)
      continue;
    }

    // Skip entries requiring unsupported fetch methods (browser, manual)
    if (entry.fetchMethod === "browser" || entry.fetchMethod === "manual") {
      skippedFetchMethod++;
      console.warn(
        `\n[skip:${entry.fetchMethod}] ${entry.label} — requires ${entry.fetchMethod}-based fetching (not yet supported)`,
      );
      console.warn(`  URL: ${entry.url}`);
      continue;
    }

    processed++;
    console.log(
      `\n[${processed}/${courtUrls.length - skipped - skippedFetchMethod}] Fetching: ${entry.label}`,
    );
    console.log(`  URL: ${entry.url}`);

    try {
      // Fetch and clean HTML
      const fetchResult = await fetchPage(entry.url);
      console.log(
        `  Fetched: ${formatBytes(fetchResult.htmlSize)} HTML → ${formatBytes(fetchResult.markdownSize)} Markdown`,
      );

      // Dry run: log sizes but skip extraction
      if (flags.dryRun) {
        console.log("  [dry-run] Skipping Claude extraction");
        updateCheckpoint(checkpoint, entry.url, 0, [], flags.outputDir);
        continue;
      }

      // Extract judges via LLM (or deterministic)
      const result = await extractJudges(fetchResult.markdown, {
        label: entry.label,
        courtType: entry.courtType,
        counties: entry.counties,
        rawHtml: fetchResult.rawHtml,
        url: entry.url,
        deterministic: entry.deterministic,
        selectorHint: entry.selectorHint,
        stateAbbreviation: stateConfig?.abbreviation,
      });

      console.log(`  Extracted: ${result.judges.length} judge(s)`);

      // Normalize and expand to CSV records
      const records = expandToCsvRecords(
        result.judges,
        entry,
        stateConfig?.abbreviation,
      );
      allRecords.push(...records);

      // Update checkpoint
      updateCheckpoint(
        checkpoint,
        entry.url,
        result.judges.length,
        [],
        flags.outputDir,
      );
    } catch (err) {
      failed++;
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR: ${errMsg}`);

      // Record failure in checkpoint but continue with next URL
      updateCheckpoint(checkpoint, entry.url, 0, [errMsg], flags.outputDir);
    }
  }

  console.log(
    `\nPipeline complete: ${processed} processed, ${skipped} skipped (resumed), ${failed} failed` +
      (skippedFetchMethod > 0
        ? `, ${skippedFetchMethod} skipped (unsupported fetch method)`
        : ""),
  );

  return allRecords;
}

// ---------------------------------------------------------------------------
// Record expansion (per-county for multi-county courts)
// ---------------------------------------------------------------------------

function expandToCsvRecords(
  judges: JudgeRecord[],
  entry: CourtUrlEntry,
  stateAbbreviation?: string,
): CsvJudgeRecord[] {
  const records: CsvJudgeRecord[] = [];

  // Appellate courts (Supreme Court, DCA): judges serve the whole
  // court, NOT individual counties — do NOT expand across counties.
  const isAppellate =
    entry.courtType === "Supreme Court" ||
    entry.courtType === "District Court of Appeal";

  for (const judge of judges) {
    const normalizedName = normalizeJudgeName(judge.name);
    const courtType = canonicalizeCourtType(judge.courtType, stateAbbreviation);

    // If judge has a specific county, use it
    if (judge.county) {
      records.push({
        "Judge Name": normalizedName,
        "Court Type": courtType,
        County: judge.county,
        State: "FL",
        "Source URL": entry.url,
        "Selection Method": judge.selectionMethod ?? "",
      });
      continue;
    }

    // Appellate judges OR County Court judges: single record, no county expansion
    // - Appellate judges serve the whole court, not individual counties
    // - County Court judges serve ONE county, not all counties in the circuit
    //   (if Claude didn't extract the specific county, we leave it blank)
    const isCountyCourt = courtType === "County Court";
    if (isAppellate || isCountyCourt) {
      records.push({
        "Judge Name": normalizedName,
        "Court Type": courtType,
        County: "",
        State: "FL",
        "Source URL": entry.url,
        "Selection Method": judge.selectionMethod ?? "",
      });
      continue;
    }

    // Circuit Court judges without a specific county:
    // expand to one record per county in the circuit (they serve the whole circuit)
    if (entry.counties.length > 0) {
      for (const county of entry.counties) {
        records.push({
          "Judge Name": normalizedName,
          "Court Type": courtType,
          County: county,
          State: "FL",
          "Source URL": entry.url,
          "Selection Method": judge.selectionMethod ?? "",
        });
      }
    } else {
      // Fallback: single record with empty county
      records.push({
        "Judge Name": normalizedName,
        "Court Type": courtType,
        County: "",
        State: "FL",
        "Source URL": entry.url,
        "Selection Method": judge.selectionMethod ?? "",
      });
    }
  }

  return records;
}

// ---------------------------------------------------------------------------
// Checkpoint update
// ---------------------------------------------------------------------------

function updateCheckpoint(
  checkpoint: Checkpoint,
  url: string,
  judgesFound: number,
  errors: string[],
  outputDir: string,
): void {
  if (!checkpoint.completedUrls.includes(url)) {
    checkpoint.completedUrls.push(url);
  }
  checkpoint.results[url] = { url, judgesFound, errors };
  checkpoint.totalJudges += judgesFound;
  checkpoint.lastUpdated = new Date().toISOString();
  saveCheckpoint(outputDir, checkpoint);
}

// ---------------------------------------------------------------------------
// CSV writing
// ---------------------------------------------------------------------------

function writeCsv(records: CsvJudgeRecord[], outputDir: string): string {
  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19); // YYYY-MM-DDTHH-MM-SS

  const filename = `florida-judges-${timestamp}.csv`;
  const filePath = path.join(outputDir, filename);

  const csv = Papa.unparse(records, {
    columns: [
      "Judge Name",
      "Court Type",
      "County",
      "State",
      "Source URL",
      "Selection Method",
    ],
  });

  fs.writeFileSync(filePath, csv, "utf-8");
  return filePath;
}

/**
 * Write enriched records to CSV with all available fields.
 */
function writeEnrichedCsv(
  records: EnrichedJudgeRecord[],
  outputDir: string,
  slug?: string,
): string {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const prefix = slug || "florida";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${prefix}-judges-enriched-${timestamp}.csv`;
  const filePath = path.join(outputDir, filename);

  // Transform enriched records to flat CSV format
  const csvRecords = records.map((r) => ({
    "Judge Name": r.fullName,
    "Court Type": r.courtType,
    County: r.county ?? "",
    State: r.state,
    Division: r.division ?? "",
    "Is Chief Judge": r.isChiefJudge ? "Yes" : "No",
    "Photo URL": r.photoUrl ?? "",
    "Term Start": r.termStart ?? "",
    "Term End": r.termEnd ?? "",
    "Selection Method": r.selectionMethod ?? "",
    "Appointing Authority": r.appointingAuthority ?? "",
    "Appointment Date": r.appointmentDate ?? "",
    "Birth Date": r.birthDate ?? "",
    Education: r.education ?? "",
    "Prior Experience": r.priorExperience ?? "",
    "Political Affiliation": r.politicalAffiliation ?? "",
    "Bar Admission Date": r.barAdmissionDate ?? "",
    "Bar Admission State": r.barAdmissionState ?? "",
    "Courthouse Address": r.courthouseAddress ?? "",
    "Courthouse Phone": r.courthousePhone ?? "",
    "Roster URL": r.rosterUrl,
    "Bio Page URL": r.bioPageUrl ?? "",
    "Confidence Score": r.confidenceScore.toFixed(2),
  }));

  const csv = Papa.unparse(csvRecords, {
    columns: [
      "Judge Name",
      "Court Type",
      "County",
      "State",
      "Division",
      "Is Chief Judge",
      "Photo URL",
      "Term Start",
      "Term End",
      "Selection Method",
      "Appointing Authority",
      "Appointment Date",
      "Birth Date",
      "Education",
      "Prior Experience",
      "Political Affiliation",
      "Bar Admission Date",
      "Bar Admission State",
      "Courthouse Address",
      "Courthouse Phone",
      "Roster URL",
      "Bio Page URL",
      "Confidence Score",
    ],
  });

  fs.writeFileSync(filePath, csv, "utf-8");
  return filePath;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)}KB`;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

main()
  .then(() => {
    closeLogging();
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    closeLogging();
    process.exit(1);
  });
