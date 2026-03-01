/**
 * Cross-page deduplication of judge records.
 *
 * When the same judge appears on multiple court pages (e.g., a circuit page
 * and county pages within that circuit), this module keeps the record with
 * the most populated fields and tracks duplicates for the quality report.
 *
 * Supports two modes:
 * 1. Legacy: name + court + county (fast but less reliable)
 * 2. Identity-based: uses education/bar info for more accurate matching
 *
 * @module scripts/harvest/deduplicator
 */

import type { CsvJudgeRecord, EnrichedJudgeRecord } from "./config";
import { normalizeCountyName } from "./normalizer";
import {
  generateIdentity,
  deduplicateByIdentity,
  getIdentityStats,
  type JudgeIdentity,
} from "./identity-resolver";

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

export interface EnrichedDedupResult {
  /** Unique records after deduplication */
  unique: EnrichedJudgeRecord[];
  /** Duplicates with reference to the record they duplicate */
  duplicates: Array<{
    record: EnrichedJudgeRecord;
    duplicateOf: EnrichedJudgeRecord;
  }>;
  /** Identity map (only populated when useIdentity=true) */
  identityMap?: Map<string, JudgeIdentity>;
  /** Identity stats (only populated when useIdentity=true) */
  identityStats?: ReturnType<typeof getIdentityStats>;
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

/**
 * Deduplicate enriched judge records across overlapping court pages.
 *
 * @param records - The records to deduplicate
 * @param options - Options for deduplication
 * @param options.useIdentity - Use identity-based deduplication (more accurate)
 *
 * Dedup key (legacy): lowercase(fullName) + courtType + normalizedCounty
 * Dedup key (identity): hash of name + education/bar/appointment info
 * When duplicates found, merge the records keeping fields from the richer one.
 */
export function deduplicateEnrichedJudges(
  records: EnrichedJudgeRecord[],
  options: { useIdentity?: boolean } = {},
): EnrichedDedupResult {
  // Use new identity-based deduplication if enabled
  if (options.useIdentity) {
    const { unique, duplicates, identityMap } = deduplicateByIdentity(records);
    const identityStats = getIdentityStats(unique);

    return {
      unique,
      duplicates: duplicates.map((d) => ({
        record: d.merged,
        duplicateOf: d.kept,
      })),
      identityMap,
      identityStats,
    };
  }

  // Legacy name+court+county deduplication
  const seen = new Map<string, EnrichedJudgeRecord>();
  const duplicates: EnrichedDedupResult["duplicates"] = [];

  for (const record of records) {
    const key = enrichedDedupKey(record);
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, record);
      continue;
    }

    // Merge records, keeping the richer one as base
    const existingScore = enrichedFieldScore(existing);
    const newScore = enrichedFieldScore(record);

    if (newScore > existingScore) {
      // New record is richer — merge existing into new, mark existing as duplicate
      const merged = mergeEnrichedRecords(record, existing);
      duplicates.push({ record: existing, duplicateOf: merged });
      seen.set(key, merged);
    } else {
      // Existing is richer — merge new into existing, mark new as duplicate
      const merged = mergeEnrichedRecords(existing, record);
      duplicates.push({ record, duplicateOf: merged });
      seen.set(key, merged);
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

function enrichedDedupKey(record: EnrichedJudgeRecord): string {
  const name = record.fullName.toLowerCase().trim();
  const court = record.courtType.toLowerCase().trim();
  const county = normalizeCountyName(record.county || "");
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

/**
 * Score an enriched record by populated fields.
 */
function enrichedFieldScore(record: EnrichedJudgeRecord): number {
  let score = 0;
  const fields: (keyof EnrichedJudgeRecord)[] = [
    "fullName",
    "photoUrl",
    "courtType",
    "county",
    "division",
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

  for (const field of fields) {
    const val = record[field];
    if (val !== null && val !== undefined && val !== "") {
      score++;
    }
  }

  return score;
}

/**
 * Merge two enriched records, keeping non-null values from the secondary
 * record to fill gaps in the primary.
 */
function mergeEnrichedRecords(
  primary: EnrichedJudgeRecord,
  secondary: EnrichedJudgeRecord,
): EnrichedJudgeRecord {
  const merged = { ...primary };

  // Fill in null fields from secondary
  const fillableFields: (keyof EnrichedJudgeRecord)[] = [
    "photoUrl",
    "division",
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
    "barAdmissionState",
    "courthouseAddress",
    "courthousePhone",
    "bioPageUrl",
  ];

  for (const field of fillableFields) {
    if (
      (merged[field] === null || merged[field] === undefined) &&
      secondary[field] !== null &&
      secondary[field] !== undefined
    ) {
      (merged as Record<string, unknown>)[field] = secondary[field];
    }
  }

  // Merge source tracking arrays
  merged.fieldsFromRoster = Array.from(
    new Set([...merged.fieldsFromRoster, ...secondary.fieldsFromRoster]),
  );
  merged.fieldsFromBio = Array.from(
    new Set([...merged.fieldsFromBio, ...secondary.fieldsFromBio]),
  );
  merged.fieldsFromExternal = Array.from(
    new Set([...merged.fieldsFromExternal, ...secondary.fieldsFromExternal]),
  );

  // Take higher confidence score
  merged.confidenceScore = Math.max(
    merged.confidenceScore,
    secondary.confidenceScore,
  );

  return merged;
}
