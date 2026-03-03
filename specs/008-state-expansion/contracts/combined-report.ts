/**
 * Contract: Combined Multi-State Summary Report
 *
 * Aggregates per-state harvest results into a combined summary report
 * when --all is used. Includes per-state quality gate verdicts and
 * aggregate totals.
 *
 * @module specs/008-state-expansion/contracts/combined-report
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Result from a single state's harvest run.
 * Returned by runSingleState() and accumulated by the --all orchestrator.
 */
export interface StateRunResult {
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
 * Aggregate statistics across all states.
 */
export interface AggregateStats {
  /** Total states processed */
  statesProcessed: number;
  /** States that completed successfully */
  statesSucceeded: number;
  /** States that failed */
  statesFailed: number;
  /** Total judges across all states */
  totalJudges: number;
  /** Total pages across all states */
  totalPages: number;
  /** Total failed pages across all states */
  totalFailedPages: number;
  /** Total duplicates removed across all states */
  totalDuplicatesRemoved: number;
  /** Combined court type counts across all states */
  courtTypeCounts: Record<string, number>;
  /** Worst quality verdict across all states */
  overallVerdict: "PASS" | "WARNING" | "CRITICAL";
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Compute aggregate statistics from per-state results.
 *
 * @param results - Array of StateRunResult from each state
 * @returns AggregateStats with combined totals
 */
export function computeAggregateStats(
  results: StateRunResult[]
): AggregateStats {
  const succeeded = results.filter((r) => r.success);
  const failed = results.filter((r) => !r.success);

  const courtTypeCounts: Record<string, number> = {};
  for (const result of succeeded) {
    for (const [type, count] of Object.entries(result.courtTypeCounts)) {
      courtTypeCounts[type] = (courtTypeCounts[type] || 0) + count;
    }
  }

  // Overall verdict = worst individual verdict
  const verdictPriority = { PASS: 0, WARNING: 1, CRITICAL: 2 } as const;
  const worstVerdict = results.reduce<"PASS" | "WARNING" | "CRITICAL">(
    (worst, r) =>
      verdictPriority[r.qualityVerdict] > verdictPriority[worst]
        ? r.qualityVerdict
        : worst,
    "PASS"
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
      0
    ),
    courtTypeCounts,
    overallVerdict: worstVerdict,
  };
}

/**
 * Generate a combined multi-state summary report in Markdown format.
 *
 * Report includes:
 * 1. Run metadata (timestamp, CLI flags)
 * 2. Per-state results table with quality verdict
 * 3. Aggregate totals
 * 4. Failed state details (if any)
 *
 * @param results - Array of StateRunResult from each state
 * @param timestamp - ISO timestamp of the combined run
 * @returns Markdown string for the combined report
 */
export function generateCombinedReport(
  results: StateRunResult[],
  timestamp: string
): string {
  const stats = computeAggregateStats(results);
  const verdictEmoji = {
    PASS: "✅",
    WARNING: "🟡",
    CRITICAL: "🔴",
  };

  const lines: string[] = [
    `# Combined Harvest Summary — ${timestamp}`,
    "",
    `## Overview`,
    "",
    `| Metric | Value |`,
    `|--------|-------|`,
    `| States processed | ${stats.statesProcessed} |`,
    `| States succeeded | ${stats.statesSucceeded} |`,
    `| States failed | ${stats.statesFailed} |`,
    `| Total judges | ${stats.totalJudges} |`,
    `| Total pages | ${stats.totalPages} |`,
    `| Failed pages | ${stats.totalFailedPages} |`,
    `| Duplicates removed | ${stats.totalDuplicatesRemoved} |`,
    `| Overall verdict | ${verdictEmoji[stats.overallVerdict]} ${stats.overallVerdict} |`,
    "",
    `## Per-State Results`,
    "",
    `| State | Status | Verdict | Judges | Pages (ok/fail) | Report |`,
    `|-------|--------|---------|--------|------------------|--------|`,
  ];

  for (const r of results) {
    const status = r.success ? "✅" : "❌";
    const verdict = `${verdictEmoji[r.qualityVerdict]} ${r.qualityVerdict}`;
    const pages = `${r.pages.succeeded}/${r.pages.failed}`;
    const report = r.reportPath ? `[report](${r.reportPath})` : "—";
    lines.push(
      `| ${r.state} | ${status} | ${verdict} | ${r.judgeCount} | ${pages} | ${report} |`
    );
  }

  // Failed state details
  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    lines.push("", "## Failed States", "");
    for (const f of failures) {
      lines.push(`### ${f.state}`, "", `**Error**: ${f.error || "Unknown"}`, "");
    }
  }

  // Court type breakdown
  if (Object.keys(stats.courtTypeCounts).length > 0) {
    lines.push("", "## Court Type Breakdown (all states)", "");
    lines.push("| Court Type | Judges |");
    lines.push("|------------|--------|");
    const sorted = Object.entries(stats.courtTypeCounts).sort(
      ([, a], [, b]) => b - a
    );
    for (const [type, count] of sorted) {
      lines.push(`| ${type} | ${count} |`);
    }
  }

  return lines.join("\n") + "\n";
}

/**
 * Write the combined summary report to disk.
 *
 * @param outputDir - Root output directory (e.g., "output/")
 * @param results - Array of StateRunResult from each state
 * @param timestamp - ISO timestamp of the combined run
 * @returns Path to the written report file
 */
export function writeCombinedSummary(
  outputDir: string,
  results: StateRunResult[],
  timestamp: string
): string {
  // Implementation: generate report → write to output/combined-summary-{timestamp}.md
  throw new Error("Contract stub — implement in scripts/harvest/index.ts");
}
