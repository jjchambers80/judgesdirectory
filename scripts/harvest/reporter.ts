/**
 * Quality report generator — produces a Markdown summary of the harvest run.
 *
 * Report includes: run timestamp, pages fetched/successful/failed,
 * total judges extracted, duplicates removed, final judge count,
 * court type breakdown, counties with zero judges, and failed pages.
 *
 * @module scripts/harvest/reporter
 */

import fs from "node:fs";
import path from "node:path";
import type { CsvJudgeRecord, Checkpoint, CourtUrlEntry } from "./config";
import type { DedupResult } from "./deduplicator";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ReportStats {
  /** All court URL entries that were targeted */
  courtUrls: CourtUrlEntry[];
  /** Checkpoint with per-URL results */
  checkpoint: Checkpoint;
  /** Records before deduplication */
  rawCount: number;
  /** Dedup result with unique array and duplicates */
  dedupResult: DedupResult;
  /** Final records written to CSV */
  finalRecords: CsvJudgeRecord[];
  /** Timestamp of the run */
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Generate a Markdown quality report and write it to the output directory.
 * Also prints a summary to stdout.
 */
export function generateReport(stats: ReportStats, outputDir: string): string {
  const report = buildReport(stats);

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const timestamp = stats.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  const filename = `florida-report-${timestamp}.md`;
  const filePath = path.join(outputDir, filename);

  fs.writeFileSync(filePath, report, "utf-8");

  // Print summary to stdout
  printSummary(stats);

  return filePath;
}

// ---------------------------------------------------------------------------
// Report builder
// ---------------------------------------------------------------------------

function buildReport(stats: ReportStats): string {
  const {
    courtUrls,
    checkpoint,
    rawCount,
    dedupResult,
    finalRecords,
    timestamp,
  } = stats;

  const results = Object.values(checkpoint.results);
  const successful = results.filter((r) => r.errors.length === 0);
  const failed = results.filter((r) => r.errors.length > 0);

  const lines: string[] = [];

  // Header
  lines.push(`# Florida Judge Harvest Report — ${timestamp}`);
  lines.push("");

  // Summary section
  lines.push("## Summary");
  lines.push("");
  lines.push(`- Pages targeted: ${courtUrls.length}`);
  lines.push(`- Pages fetched: ${results.length}`);
  lines.push(`- Pages successful: ${successful.length}`);
  lines.push(`- Pages failed: ${failed.length}`);
  lines.push(`- Judges extracted: ${rawCount}`);
  lines.push(`- Duplicates removed: ${dedupResult.duplicates.length}`);
  lines.push(`- Final judge count: ${finalRecords.length}`);
  lines.push("");

  // Court type breakdown
  lines.push("## Court Type Breakdown");
  lines.push("");
  lines.push("| Court Type | Count |");
  lines.push("| --- | --- |");

  const courtTypeCounts = new Map<string, number>();
  for (const record of finalRecords) {
    const ct = record["Court Type"];
    courtTypeCounts.set(ct, (courtTypeCounts.get(ct) ?? 0) + 1);
  }

  const sortOrder = [
    "Supreme Court",
    "District Court of Appeal",
    "Circuit Court",
    "County Court",
  ];
  for (const ct of sortOrder) {
    const count = courtTypeCounts.get(ct) ?? 0;
    if (count > 0) {
      lines.push(`| ${ct} | ${count} |`);
    }
  }
  // Any other court types not in sort order
  for (const [ct, count] of Array.from(courtTypeCounts)) {
    if (!sortOrder.includes(ct)) {
      lines.push(`| ${ct} | ${count} |`);
    }
  }
  lines.push("");

  // Counties with zero judges
  const countiesWithJudges = new Set<string>();
  for (const record of finalRecords) {
    if (record.County) {
      countiesWithJudges.add(record.County.toLowerCase());
    }
  }

  // Collect all expected counties from court URLs
  const allCounties = new Set<string>();
  for (const entry of courtUrls) {
    for (const county of entry.counties) {
      allCounties.add(county);
    }
  }

  const zeroCounties: string[] = [];
  for (const county of Array.from(allCounties)) {
    if (!countiesWithJudges.has(county.toLowerCase())) {
      zeroCounties.push(county);
    }
  }

  if (zeroCounties.length > 0) {
    lines.push("## Counties with Zero Judges");
    lines.push("");
    for (const county of zeroCounties.sort()) {
      // Find associated circuit
      const circuit = courtUrls.find(
        (e) =>
          e.courtType === "Circuit Court" &&
          e.counties.some((c) => c.toLowerCase() === county.toLowerCase()),
      );
      const circuitLabel = circuit ? ` (${circuit.label})` : "";
      lines.push(`- ${county}${circuitLabel}`);
    }
    lines.push("");
  }

  // Failed pages
  if (failed.length > 0) {
    lines.push("## Failed Pages");
    lines.push("");
    lines.push("| URL | Error |");
    lines.push("| --- | --- |");
    for (const result of failed) {
      const errText = result.errors.join("; ");
      lines.push(`| ${result.url} | ${errText} |`);
    }
    lines.push("");
  }

  // Duplicates detail
  if (dedupResult.duplicates.length > 0) {
    lines.push("## Duplicate Records");
    lines.push("");
    lines.push(
      `Found ${dedupResult.duplicates.length} duplicate(s) across overlapping court pages.`,
    );
    lines.push("");

    // Show up to 20 examples
    const examples = dedupResult.duplicates.slice(0, 20);
    lines.push(
      "| Judge Name | Court Type | County | Duplicate Source | Kept Source |",
    );
    lines.push("| --- | --- | --- | --- | --- |");
    for (const dup of examples) {
      lines.push(
        `| ${dup.record["Judge Name"]} | ${dup.record["Court Type"]} | ${dup.record.County} | ${dup.record["Source URL"]} | ${dup.duplicateOf["Source URL"]} |`,
      );
    }
    if (dedupResult.duplicates.length > 20) {
      lines.push(
        `\n*...and ${dedupResult.duplicates.length - 20} more duplicate(s)*`,
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Stdout summary
// ---------------------------------------------------------------------------

function printSummary(stats: ReportStats): void {
  const results = Object.values(stats.checkpoint.results);
  const successful = results.filter((r) => r.errors.length === 0);
  const failed = results.filter((r) => r.errors.length > 0);

  console.log("\n===== Harvest Summary =====");
  console.log(`Pages: ${successful.length} OK / ${failed.length} failed`);
  console.log(
    `Judges: ${stats.rawCount} extracted → ${stats.dedupResult.duplicates.length} dupes removed → ${stats.finalRecords.length} final`,
  );

  // Court type counts
  const courtTypeCounts = new Map<string, number>();
  for (const record of stats.finalRecords) {
    const ct = record["Court Type"];
    courtTypeCounts.set(ct, (courtTypeCounts.get(ct) ?? 0) + 1);
  }
  for (const [ct, count] of Array.from(courtTypeCounts)) {
    console.log(`  ${ct}: ${count}`);
  }
}
