/**
 * Cross-page deduplication of judge records.
 *
 * When the same judge appears on multiple court pages (e.g., a circuit page
 * and county pages within that circuit), this module keeps the record with
 * the most populated fields and tracks duplicates for the quality report.
 *
 * @module scripts/harvest/deduplicator
 */

import type { CsvJudgeRecord } from "./config";
import { normalizeCountyName } from "./normalizer";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DedupResult {
  /** Unique records after deduplication */
  unique: CsvJudgeRecord[];
  /** Duplicates with reference to the record they duplicate */
  duplicates: Array<{
    record: CsvJudgeRecord;
    duplicateOf: CsvJudgeRecord;
  }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Deduplicate judge records across overlapping court pages.
 *
 * Dedup key: lowercase(fullName) + courtType + normalizedCounty
 * When duplicates found, keep the record with more populated fields.
 */
export function deduplicateJudges(records: CsvJudgeRecord[]): DedupResult {
  const seen = new Map<string, CsvJudgeRecord>();
  const duplicates: DedupResult["duplicates"] = [];

  for (const record of records) {
    const key = dedupKey(record);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, record);
      continue;
    }

    // Keep the record with more populated fields
    const existingScore = fieldScore(existing);
    const newScore = fieldScore(record);

    if (newScore > existingScore) {
      // New record is richer — replace existing, mark existing as duplicate
      duplicates.push({ record: existing, duplicateOf: record });
      seen.set(key, record);
    } else {
      // Existing is richer (or equal) — mark new as duplicate
      duplicates.push({ record, duplicateOf: existing });
    }
  }

  return {
    unique: Array.from(seen.values()),
    duplicates,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dedupKey(record: CsvJudgeRecord): string {
  const name = record["Judge Name"].toLowerCase().trim();
  const court = record["Court Type"].toLowerCase().trim();
  const county = normalizeCountyName(record.County || "");
  return `${name}|${court}|${county}`;
}

/**
 * Score a record by how many of its optional fields are populated.
 * Higher score = richer record.
 */
function fieldScore(record: CsvJudgeRecord): number {
  let score = 0;
  if (record["Judge Name"]) score++;
  if (record["Court Type"]) score++;
  if (record.County) score++;
  if (record["Source URL"]) score++;
  if (record["Selection Method"]) score++;
  return score;
}
