#!/usr/bin/env ts-node
/**
 * Florida Judge Harvest — CLI entry point.
 *
 * Orchestrates: config → checkpoint → fetch → extract → normalize →
 * deduplicate → CSV write → quality report.
 *
 * Usage:
 *   npx ts-node scripts/harvest/index.ts [flags]
 *
 * Flags:
 *   --seed-courts-only   Seed Florida court structure only
 *   --dry-run            Fetch HTML but skip Claude API calls
 *   --reset              Clear checkpoint and start fresh
 *   --resume             Resume from last checkpoint (default)
 *   --output-dir <path>  Override output directory
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
  loadCourtConfig,
  flattenCourtUrls,
  type CliFlags,
  type CsvJudgeRecord,
  type CourtUrlEntry,
  type Checkpoint,
} from "./config";
import { seedFloridaCourts } from "./court-seeder";
import { loadCheckpoint, saveCheckpoint, resetCheckpoint } from "./checkpoint";
import { fetchPage } from "./fetcher";
import { extractJudges, type JudgeRecord } from "./extractor";
import { normalizeJudgeName, canonicalizeCourtType } from "./normalizer";
import { deduplicateJudges } from "./deduplicator";
import { generateReport } from "./reporter";

// ---------------------------------------------------------------------------
// File-based logging
// ---------------------------------------------------------------------------

let logStream: fs.WriteStream | null = null;

function setupLogging(outputDir: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logPath = path.join(outputDir, `florida-harvest-${timestamp}.log`);
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
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags();
  validateEnv(flags);

  // Initialize file-based logging
  setupLogging(flags.outputDir);

  console.log("Florida Judge Harvest");
  console.log("=====================\n");

  // --seed-courts-only: seed courts and exit
  if (flags.seedCourtsOnly) {
    console.log("Seeding Florida court structure...\n");
    await seedFloridaCourts();
    return;
  }

  // Load court URL configuration
  const config = loadCourtConfig();
  const courtUrls = flattenCourtUrls(config);
  console.log(`Loaded ${courtUrls.length} court URL(s) from config\n`);

  // Handle --reset
  if (flags.reset) {
    resetCheckpoint(flags.outputDir);
  }

  // Load or create checkpoint
  const checkpoint = loadCheckpoint(flags.outputDir);

  // Run extraction pipeline
  const allRecords = await runExtractionPipeline(courtUrls, checkpoint, flags);

  if (allRecords.length === 0) {
    console.log("\nNo judge records extracted. Nothing to write.");
    return;
  }

  const rawCount = allRecords.length;

  // Deduplicate across overlapping court pages
  const dedupResult = deduplicateJudges(allRecords);
  console.log(
    `\nDeduplication: ${rawCount} raw → ${dedupResult.duplicates.length} dupes removed → ${dedupResult.unique.length} unique`,
  );

  // Write deduplicated CSV output
  const csvPath = writeCsv(dedupResult.unique, flags.outputDir);
  console.log(`CSV written: ${csvPath}`);

  // Generate quality report
  const timestamp = new Date().toISOString();
  const reportPath = generateReport(
    {
      courtUrls,
      checkpoint,
      rawCount,
      dedupResult,
      finalRecords: dedupResult.unique,
      timestamp,
    },
    flags.outputDir,
  );
  console.log(`Report written: ${reportPath}`);
}

// ---------------------------------------------------------------------------
// Extraction pipeline
// ---------------------------------------------------------------------------

async function runExtractionPipeline(
  courtUrls: CourtUrlEntry[],
  checkpoint: Checkpoint,
  flags: CliFlags,
): Promise<CsvJudgeRecord[]> {
  const allRecords: CsvJudgeRecord[] = [];
  const completedSet = new Set(checkpoint.completedUrls);

  let processed = 0;
  let skipped = 0;
  let failed = 0;

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

    processed++;
    console.log(
      `\n[${processed}/${courtUrls.length - skipped}] Fetching: ${entry.label}`,
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

      // Extract judges via Claude
      const result = await extractJudges(fetchResult.markdown, {
        label: entry.label,
        courtType: entry.courtType,
        counties: entry.counties,
      });

      console.log(`  Extracted: ${result.judges.length} judge(s)`);

      // Normalize and expand to CSV records
      const records = expandToCsvRecords(result.judges, entry);
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
    `\nPipeline complete: ${processed} processed, ${skipped} skipped (resumed), ${failed} failed`,
  );

  return allRecords;
}

// ---------------------------------------------------------------------------
// Record expansion (per-county for multi-county courts)
// ---------------------------------------------------------------------------

function expandToCsvRecords(
  judges: JudgeRecord[],
  entry: CourtUrlEntry,
): CsvJudgeRecord[] {
  const records: CsvJudgeRecord[] = [];

  // Appellate courts (Supreme Court, DCA): judges serve the whole
  // court, NOT individual counties — do NOT expand across counties.
  const isAppellate =
    entry.courtType === "Supreme Court" ||
    entry.courtType === "District Court of Appeal";

  for (const judge of judges) {
    const normalizedName = normalizeJudgeName(judge.name);
    const courtType = canonicalizeCourtType(judge.courtType);

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
