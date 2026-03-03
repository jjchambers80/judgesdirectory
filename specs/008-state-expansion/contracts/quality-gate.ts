/**
 * Contract: Quality Gate Evaluator
 *
 * Evaluates harvest quality using proxy metrics to flag potential
 * accuracy issues without manual spot-checking. Implements the
 * soft quality gate from FR-024.
 *
 * @module specs/008-state-expansion/contracts/quality-gate
 */

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Threshold configuration for quality gate metrics.
 * Each metric has a warning and critical threshold.
 */
export const QUALITY_THRESHOLDS = {
  /** Pages that failed to fetch or extract ÷ total pages */
  failedPageRate: { warning: 0.10, critical: 0.25 },
  /** Pages with 0 judges extracted (no errors) ÷ total pages */
  zeroJudgePageRate: { warning: 0.15, critical: 0.30 },
  /** Trial court records missing county ÷ total trial records */
  missingCountyRate: { warning: 0.20, critical: 0.40 },
  /** Records missing fullName or courtType ÷ total records */
  coreFieldIncompleteness: { warning: 0.02, critical: 0.05 },
  /** Zod validation failures ÷ total raw records attempted */
  zodFailureRate: { warning: 0.10, critical: 0.20 },
} as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Severity = "PASS" | "WARNING" | "CRITICAL";

/**
 * A single evaluated metric with its actual value and severity.
 */
export interface QualityMetric {
  /** Human-readable metric name */
  name: string;
  /** Actual value (0.0–1.0 scale) */
  value: number;
  /** Human-readable display value (e.g., "22.2% (6/27)") */
  displayValue: string;
  /** Evaluated severity based on thresholds */
  severity: Severity;
  /** Threshold description (e.g., ">10% warn, >25% critical") */
  threshold: string;
}

/**
 * Overall quality gate evaluation result.
 */
export interface QualityGateResult {
  /** Overall verdict = worst individual metric severity */
  verdict: Severity;
  /** All evaluated metrics (including passing ones) */
  metrics: QualityMetric[];
  /** Pre-rendered Markdown section for the quality report */
  markdown: string;
}

/**
 * Input data for quality gate evaluation.
 * Sourced from ReportStats / EnrichedReportStats and checkpoint data.
 */
export interface QualityGateInput {
  /** Total roster pages targeted */
  totalPages: number;
  /** Pages that failed to fetch (errors > 0) */
  failedPages: number;
  /** Pages that succeeded but produced 0 judges */
  zeroJudgePages: number;
  /** Total judge records after extraction (before dedup) */
  totalRecords: number;
  /** Trial-level records missing county assignment */
  trialRecordsMissingCounty: number;
  /** Total trial-level records */
  totalTrialRecords: number;
  /** Records missing fullName or courtType */
  recordsMissingCoreFields: number;
  /** Raw extraction attempts that failed Zod validation */
  zodFailures: number;
  /** Total raw extraction attempts (before Zod filtering) */
  totalRawAttempts: number;
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Evaluate a single metric against its thresholds.
 */
function evaluateMetric(
  name: string,
  numerator: number,
  denominator: number,
  thresholds: { warning: number; critical: number }
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
 *
 * @param input - Quality gate input data from harvest stats
 * @returns QualityGateResult with verdict, metrics, and Markdown
 */
export function evaluateQualityGate(
  input: QualityGateInput
): QualityGateResult {
  const metrics: QualityMetric[] = [
    evaluateMetric(
      "Failed page rate",
      input.failedPages,
      input.totalPages,
      QUALITY_THRESHOLDS.failedPageRate
    ),
    evaluateMetric(
      "Zero-judge page rate",
      input.zeroJudgePages,
      input.totalPages,
      QUALITY_THRESHOLDS.zeroJudgePageRate
    ),
    evaluateMetric(
      "Missing county (trial courts)",
      input.trialRecordsMissingCounty,
      input.totalTrialRecords,
      QUALITY_THRESHOLDS.missingCountyRate
    ),
    evaluateMetric(
      "Core field incompleteness",
      input.recordsMissingCoreFields,
      input.totalRecords,
      QUALITY_THRESHOLDS.coreFieldIncompleteness
    ),
    evaluateMetric(
      "Zod validation failure rate",
      input.zodFailures,
      input.totalRawAttempts,
      QUALITY_THRESHOLDS.zodFailureRate
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
    "PASS"
  );

  // Generate Markdown
  const markdown = formatQualityGateMarkdown(verdict, metrics);

  return { verdict, metrics, markdown };
}

/**
 * Format the quality gate result as a Markdown section for the report.
 */
function formatQualityGateMarkdown(
  verdict: Severity,
  metrics: QualityMetric[]
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
    ""
  );

  // Table of flagged metrics
  const flagged = metrics.filter((m) => m.severity !== "PASS");
  lines.push("| Metric | Value | Threshold | Severity |");
  lines.push("|--------|-------|-----------|----------|");
  for (const m of flagged) {
    const icon = m.severity === "CRITICAL" ? "🔴" : "🟡";
    lines.push(
      `| ${m.name} | ${m.displayValue} | ${m.threshold} | ${icon} ${m.severity} |`
    );
  }

  // Actionable suggestion
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
        "verify county alias map and extraction prompt county instructions"
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
