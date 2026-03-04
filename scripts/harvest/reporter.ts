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
import type {
  CsvJudgeRecord,
  EnrichedJudgeRecord,
  Checkpoint,
  CourtUrlEntry,
} from "./config";
import type { DedupResult, EnrichedDedupResult } from "./deduplicator";

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
  /** State slug for per-state reporting */
  stateSlug?: string;
}

export interface EnrichedReportStats {
  /** All court URL entries that were targeted */
  courtUrls: CourtUrlEntry[];
  /** Checkpoint with per-URL results */
  checkpoint: Checkpoint;
  /** Records before deduplication */
  rawCount: number;
  /** Dedup result with unique array and duplicates */
  dedupResult: EnrichedDedupResult;
  /** Final records written to CSV */
  finalRecords: EnrichedJudgeRecord[];
  /** Timestamp of the run */
  timestamp: string;
  /** Bio page enrichment stats */
  bioStats: {
    bioPagesFetched: number;
    bioPagesSucceeded: number;
    bioPagesFailed: number;
    fieldsEnriched: Record<string, number>;
  };
  /** Ballotpedia enrichment stats (optional) */
  ballotpediaStats?: {
    totalEnriched: number;
    fieldCounts: Record<string, number>;
  } | null;
  /** State slug for per-state reporting */
  stateSlug?: string;
}

// ---------------------------------------------------------------------------
// Quality Gate (per contract: quality-gate.ts)
// ---------------------------------------------------------------------------

export type Severity = "PASS" | "WARNING" | "CRITICAL";

export interface QualityMetric {
  name: string;
  value: number;
  displayValue: string;
  severity: Severity;
  threshold: string;
}

export interface QualityGateResult {
  verdict: Severity;
  metrics: QualityMetric[];
  markdown: string;
}

export interface QualityGateInput {
  totalPages: number;
  failedPages: number;
  zeroJudgePages: number;
  totalRecords: number;
  trialRecordsMissingCounty: number;
  totalTrialRecords: number;
  recordsMissingCoreFields: number;
  zodFailures: number;
  totalRawAttempts: number;
}

const QUALITY_THRESHOLDS = {
  failedPageRate: { warning: 0.10, critical: 0.25 },
  zeroJudgePageRate: { warning: 0.15, critical: 0.30 },
  missingCountyRate: { warning: 0.20, critical: 0.40 },
  coreFieldIncompleteness: { warning: 0.02, critical: 0.05 },
  zodFailureRate: { warning: 0.10, critical: 0.20 },
} as const;

function evaluateMetric(
  name: string,
  numerator: number,
  denominator: number,
  thresholds: { warning: number; critical: number },
): QualityMetric {
  const value = denominator > 0 ? numerator / denominator : 0;
  const pct = (value * 100).toFixed(1);
  const displayValue = `${pct}% (${numerator}/${denominator})`;

  let severity: Severity = "PASS";
  if (value > thresholds.critical) {
    severity = "CRITICAL";
  } else if (value > thresholds.warning) {
    severity = "WARNING";
  }

  const threshold = `>${(thresholds.warning * 100).toFixed(0)}% warn, >${(thresholds.critical * 100).toFixed(0)}% critical`;

  return { name, value, displayValue, severity, threshold };
}

/**
 * Evaluate all quality gate metrics and produce a verdict.
 */
export function evaluateQualityGate(input: QualityGateInput): QualityGateResult {
  const metrics: QualityMetric[] = [
    evaluateMetric(
      "Failed page rate",
      input.failedPages,
      input.totalPages,
      QUALITY_THRESHOLDS.failedPageRate,
    ),
    evaluateMetric(
      "Zero-judge page rate",
      input.zeroJudgePages,
      input.totalPages,
      QUALITY_THRESHOLDS.zeroJudgePageRate,
    ),
    evaluateMetric(
      "Missing county (trial courts)",
      input.trialRecordsMissingCounty,
      input.totalTrialRecords,
      QUALITY_THRESHOLDS.missingCountyRate,
    ),
    evaluateMetric(
      "Core field incompleteness",
      input.recordsMissingCoreFields,
      input.totalRecords,
      QUALITY_THRESHOLDS.coreFieldIncompleteness,
    ),
    evaluateMetric(
      "Zod validation failure rate",
      input.zodFailures,
      input.totalRawAttempts,
      QUALITY_THRESHOLDS.zodFailureRate,
    ),
  ];

  // Overall verdict = worst severity
  const severityOrder: Record<Severity, number> = {
    PASS: 0,
    WARNING: 1,
    CRITICAL: 2,
  };
  const verdict = metrics.reduce<Severity>(
    (worst, m) =>
      severityOrder[m.severity] > severityOrder[worst] ? m.severity : worst,
    "PASS",
  );

  const markdown = formatQualityGateMarkdown(verdict, metrics);

  return { verdict, metrics, markdown };
}

/**
 * Format the quality gate result as a Markdown section.
 */
function formatQualityGateMarkdown(
  verdict: Severity,
  metrics: QualityMetric[],
): string {
  const lines: string[] = [];

  if (verdict === "PASS") {
    lines.push("## ✅ Quality Gate — PASS", "");
    lines.push("All proxy metrics are within acceptable thresholds.", "");
    return lines.join("\n");
  }

  const emoji = verdict === "CRITICAL" ? "🔴" : "⚠️";
  lines.push(`## ${emoji} Quality Gate — ${verdict}`, "");
  lines.push(
    "This harvest has potential data quality concerns that may indicate accuracy below the 90% spot-check threshold.",
    "",
  );

  const flagged = metrics.filter((m) => m.severity !== "PASS");
  lines.push("| Metric | Value | Threshold | Severity |");
  lines.push("|--------|-------|-----------|----------|");
  for (const m of flagged) {
    const icon = m.severity === "CRITICAL" ? "🔴" : "🟡";
    lines.push(
      `| ${m.name} | ${m.displayValue} | ${m.threshold} | ${icon} ${m.severity} |`,
    );
  }

  lines.push("");
  const actions: string[] = [];
  for (const m of flagged) {
    if (m.name.includes("Failed page")) {
      actions.push("check failed page URLs for site structure changes");
    }
    if (m.name.includes("Zero-judge")) {
      actions.push("review zero-judge pages for extraction prompt issues");
    }
    if (m.name.includes("county")) {
      actions.push(
        "verify county alias map and extraction prompt county instructions",
      );
    }
    if (m.name.includes("Core field")) {
      actions.push("review extraction prompt for name/court type parsing");
    }
    if (m.name.includes("Zod")) {
      actions.push("check LLM output format against Zod schema expectations");
    }
  }
  if (actions.length > 0) {
    lines.push(`**Action**: ${actions.join("; ")}.`, "");
  }

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Freshness formatting (per contract: freshness-tracker.ts)
// ---------------------------------------------------------------------------

/**
 * Format a freshness result as a quality report Markdown section.
 */
export function formatFreshnessSection(result: {
  hasManifest: boolean;
  lastCompletedAt: string | null;
  daysSinceHarvest: number | null;
  isStale: boolean;
  lastJudgeCount: number | null;
}): string {
  const lines: string[] = [];
  lines.push("## Data Freshness", "");

  if (!result.hasManifest) {
    lines.push("No previous harvest on record.", "");
    return lines.join("\n");
  }

  const date = result.lastCompletedAt
    ? new Date(result.lastCompletedAt).toISOString().slice(0, 10)
    : "unknown";
  const days = result.daysSinceHarvest ?? 0;

  if (result.isStale) {
    lines.push(
      `⚠️ Last harvest: ${date} (${days} days ago — exceeds 90-day threshold)`,
      "",
    );
  } else {
    lines.push(`Last harvest: ${date} (${days} days ago)`, "");
  }

  if (result.lastJudgeCount !== null) {
    lines.push(`Previous judge count: ${result.lastJudgeCount}`, "");
  }

  return lines.join("\n");
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

  const slug = stats.stateSlug || "florida";
  const timestamp = stats.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${slug}-quality-report-${timestamp}.md`;
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
  const stateName = stats.stateSlug
    ? stats.stateSlug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Florida";
  lines.push(`# ${stateName} Judge Harvest Report — ${timestamp}`);
  lines.push("");

  // Quality gate evaluation
  const zeroJudgePages = successful.filter((r) => r.judgesFound === 0).length;
  const trialRecords = finalRecords.filter(
    (r) => !["Supreme Court", "District Court of Appeal", "Court of Appeal", "Court of Appeals", "Appellate Division", "Court of Criminal Appeals"].includes(r["Court Type"]),
  );
  const trialMissingCounty = trialRecords.filter((r) => !r.County || r.County === "").length;
  const missingCore = finalRecords.filter(
    (r) => !r["Judge Name"] || !r["Court Type"],
  ).length;
  const qualityGateResult = evaluateQualityGate({
    totalPages: courtUrls.length,
    failedPages: failed.length,
    zeroJudgePages,
    totalRecords: finalRecords.length,
    trialRecordsMissingCounty: trialMissingCounty,
    totalTrialRecords: trialRecords.length,
    recordsMissingCoreFields: missingCore,
    zodFailures: 0, // Basic pipeline doesn't track Zod failures
    totalRawAttempts: rawCount,
  });
  lines.push(qualityGateResult.markdown);
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
    "Court of Criminal Appeals",
    "Court of Appeals",
    "District Court of Appeal",
    "Appellate Division",
    "Circuit Court",
    "Superior Court",
    "County Court",
    "District Court",
    "Family Court",
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

/**
 * Generate an enriched report with field coverage statistics.
 * Returns file path and quality gate verdict.
 */
export function generateEnrichedReport(
  stats: EnrichedReportStats,
  outputDir: string,
): { filePath: string; qualityVerdict: Severity } {
  const { report, qualityVerdict } = buildEnrichedReport(stats);

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const slug = stats.stateSlug || "florida";
  const timestamp = stats.timestamp.replace(/[:.]/g, "-").slice(0, 19);
  const filename = `${slug}-enriched-report-${timestamp}.md`;
  const filePath = path.join(outputDir, filename);

  fs.writeFileSync(filePath, report, "utf-8");
  printEnrichedSummary(stats);

  return { filePath, qualityVerdict };
}

// ---------------------------------------------------------------------------
// Enriched report builder
// ---------------------------------------------------------------------------

function buildEnrichedReport(stats: EnrichedReportStats): { report: string; qualityVerdict: Severity } {
  const {
    courtUrls,
    checkpoint,
    rawCount,
    dedupResult,
    finalRecords,
    timestamp,
    bioStats,
  } = stats;

  const results = Object.values(checkpoint.results);
  const successful = results.filter((r) => r.errors.length === 0);
  const failed = results.filter((r) => r.errors.length > 0);

  const lines: string[] = [];

  // Header
  const stateName = stats.stateSlug
    ? stats.stateSlug
        .replace(/-/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
    : "Florida";
  lines.push(`# ${stateName} Judge Enriched Harvest Report — ${timestamp}`);
  lines.push("");

  // Quality gate evaluation
  const zeroJudgePages = successful.filter((r) => r.judgesFound === 0).length;
  const appellateCourtTypes = [
    "Supreme Court", "District Court of Appeal", "Court of Appeal",
    "Court of Appeals", "Appellate Division", "Court of Criminal Appeals",
  ];
  const trialRecords = finalRecords.filter(
    (r) => !appellateCourtTypes.includes(r.courtType),
  );
  const trialMissingCounty = trialRecords.filter(
    (r) => !r.county || r.county === "",
  ).length;
  const missingCore = finalRecords.filter(
    (r) => !r.fullName || !r.courtType,
  ).length;
  const qualityGateResult = evaluateQualityGate({
    totalPages: courtUrls.length,
    failedPages: failed.length,
    zeroJudgePages,
    totalRecords: finalRecords.length,
    trialRecordsMissingCounty: trialMissingCounty,
    totalTrialRecords: trialRecords.length,
    recordsMissingCoreFields: missingCore,
    zodFailures: 0, // Zod failures tracked at extraction level
    totalRawAttempts: rawCount,
  });
  lines.push(qualityGateResult.markdown);
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

  // Identity resolution stats (if using identity-based dedup)
  if (dedupResult.identityStats) {
    const idStats = dedupResult.identityStats;
    lines.push("## Identity Resolution");
    lines.push("");
    lines.push(`- High confidence: ${idStats.highConfidence} judges`);
    lines.push(`- Medium confidence: ${idStats.mediumConfidence} judges`);
    lines.push(`- Low confidence: ${idStats.lowConfidence} judges`);
    lines.push("");
    lines.push("### Identity Basis Breakdown");
    lines.push("");
    lines.push("| Basis | Count |");
    lines.push("| --- | --- |");
    const sortedBasis = Object.entries(idStats.byBasis).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [basis, count] of sortedBasis) {
      lines.push(`| ${basis} | ${count} |`);
    }
    lines.push("");
  }

  // Bio page enrichment stats
  lines.push("## Bio Page Enrichment");
  lines.push("");
  lines.push(`- Bio pages fetched: ${bioStats.bioPagesFetched}`);
  lines.push(`- Bio pages succeeded: ${bioStats.bioPagesSucceeded}`);
  lines.push(`- Bio pages failed: ${bioStats.bioPagesFailed}`);
  lines.push(
    `- Success rate: ${bioStats.bioPagesFetched > 0 ? ((bioStats.bioPagesSucceeded / bioStats.bioPagesFetched) * 100).toFixed(1) : 0}%`,
  );
  lines.push("");

  // Field coverage statistics
  lines.push("## Field Coverage");
  lines.push("");
  lines.push("| Field | Populated | Coverage |");
  lines.push("| --- | --- | --- |");

  const allFields: (keyof EnrichedJudgeRecord)[] = [
    "fullName",
    "photoUrl",
    "courtType",
    "county",
    "division",
    "isChiefJudge",
    "termStart",
    "termEnd",
    "selectionMethod",
    "appointingAuthority",
    "appointmentDate",
    "birthDate",
    "education",
    "priorExperience",
    "politicalAffiliation",
    "barAdmissionDate",
    "courthouseAddress",
    "courthousePhone",
    "bioPageUrl",
  ];

  for (const field of allFields) {
    let count = 0;
    for (const record of finalRecords) {
      const val = record[field];
      if (val !== null && val !== undefined && val !== "" && val !== false) {
        count++;
      }
    }
    const pct =
      finalRecords.length > 0
        ? ((count / finalRecords.length) * 100).toFixed(1)
        : "0";
    lines.push(`| ${field} | ${count} | ${pct}% |`);
  }
  lines.push("");

  // Court type breakdown
  lines.push("## Court Type Breakdown");
  lines.push("");
  lines.push("| Court Type | Count |");
  lines.push("| --- | --- |");

  const courtTypeCounts = new Map<string, number>();
  for (const record of finalRecords) {
    const ct = record.courtType;
    courtTypeCounts.set(ct, (courtTypeCounts.get(ct) ?? 0) + 1);
  }

  const sortOrder = [
    "Supreme Court",
    "Court of Criminal Appeals",
    "Court of Appeals",
    "District Court of Appeal",
    "Appellate Division",
    "Circuit Court",
    "Superior Court",
    "County Court",
    "District Court",
    "Family Court",
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
    if (record.county) {
      countiesWithJudges.add(record.county.toLowerCase());
    }
  }

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

  // Fields enriched from bio pages
  if (Object.keys(bioStats.fieldsEnriched).length > 0) {
    lines.push("## Fields Enriched from Bio Pages");
    lines.push("");
    lines.push("| Field | Records Enriched |");
    lines.push("| --- | --- |");
    const sorted = Object.entries(bioStats.fieldsEnriched).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [field, count] of sorted) {
      lines.push(`| ${field} | ${count} |`);
    }
    lines.push("");
  }

  // Ballotpedia enrichment stats (if run)
  if (stats.ballotpediaStats && stats.ballotpediaStats.totalEnriched > 0) {
    lines.push("## Ballotpedia Enrichment");
    lines.push("");
    lines.push(`- Judges enriched: ${stats.ballotpediaStats.totalEnriched}`);
    lines.push("");
    lines.push("| Field | Records Enriched |");
    lines.push("| --- | --- |");
    const sorted = Object.entries(stats.ballotpediaStats.fieldCounts).sort(
      ([, a], [, b]) => b - a,
    );
    for (const [field, count] of sorted) {
      lines.push(`| ${field} | ${count} |`);
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

  return { report: lines.join("\n"), qualityVerdict: qualityGateResult.verdict };
}

function printEnrichedSummary(stats: EnrichedReportStats): void {
  const results = Object.values(stats.checkpoint.results);
  const successful = results.filter((r) => r.errors.length === 0);
  const failed = results.filter((r) => r.errors.length > 0);

  console.log("\n===== Enriched Harvest Summary =====");
  console.log(
    `Roster pages: ${successful.length} OK / ${failed.length} failed`,
  );
  console.log(
    `Bio pages: ${stats.bioStats.bioPagesSucceeded} OK / ${stats.bioStats.bioPagesFailed} failed`,
  );
  if (stats.ballotpediaStats) {
    console.log(
      `Ballotpedia: ${stats.ballotpediaStats.totalEnriched} judges enriched`,
    );
  }
  console.log(
    `Judges: ${stats.rawCount} extracted → ${stats.dedupResult.duplicates.length} dupes removed → ${stats.finalRecords.length} final`,
  );

  // Field coverage highlights
  const keyFields = [
    "photoUrl",
    "education",
    "priorExperience",
    "termStart",
    "politicalAffiliation",
  ];
  for (const field of keyFields) {
    let count = 0;
    for (const record of stats.finalRecords) {
      const val = record[field as keyof EnrichedJudgeRecord];
      if (val !== null && val !== undefined && val !== "") {
        count++;
      }
    }
    const pct =
      stats.finalRecords.length > 0
        ? ((count / stats.finalRecords.length) * 100).toFixed(0)
        : "0";
    console.log(`  ${field}: ${count} (${pct}%)`);
  }
}
