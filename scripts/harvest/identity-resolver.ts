/**
 * Identity Resolver — generates stable unique identifiers for judges
 * and handles cross-source record matching.
 *
 * The goal is to create a reliable primary key that:
 * 1. Is stable across data refreshes
 * 2. Can match the same judge across different sources
 * 3. Handles name variations gracefully
 * 4. Supports future bar number integration
 *
 * Identity Key Hierarchy (in order of reliability):
 * 1. Florida Bar Number (most reliable, when available)
 * 2. Composite: normalized_name + law_school + grad_year
 * 3. Composite: normalized_name + appointment_year + court_type
 * 4. Fallback: normalized_name + court_type + county (current approach)
 *
 * @module scripts/harvest/identity-resolver
 */

import crypto from "crypto";
import { EnrichedJudgeRecord } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface JudgeIdentity {
  /** Stable hash-based ID (deterministic, based on available identity fields) */
  id: string;

  /** Florida Bar number if known (most reliable identifier) */
  barNumber: string | null;

  /** Normalized full name (for display and fuzzy matching) */
  normalizedName: string;

  /** Identity confidence: how reliable is this ID? */
  identityConfidence: "high" | "medium" | "low";

  /** Which fields were used to generate the ID */
  identityBasis: string[];
}

export interface IdentityMatch {
  /** The identity that matched */
  identity: JudgeIdentity;

  /** Match confidence score (0-1) */
  confidence: number;

  /** Why this match was made */
  matchReason: string;
}

// ---------------------------------------------------------------------------
// Name Normalization
// ---------------------------------------------------------------------------

/**
 * Normalize a judge name for identity matching.
 * Handles variations like:
 * - "Hon. John D. Smith" → "john david smith"
 * - "Smith, John David" → "john david smith"
 * - "John D. Smith Jr." → "john david smith jr"
 */
export function normalizeName(name: string): string {
  let normalized = name.toLowerCase().trim();

  // Remove honorifics
  const honorifics = [
    "hon\\.",
    "honorable",
    "judge",
    "justice",
    "chief justice",
    "chief judge",
    "senior judge",
    "the",
  ];
  for (const h of honorifics) {
    normalized = normalized.replace(new RegExp(`^${h}\\s+`, "i"), "");
    normalized = normalized.replace(new RegExp(`\\s+${h}$`, "i"), "");
  }

  // Handle "Last, First Middle" format
  if (normalized.includes(",")) {
    const parts = normalized.split(",").map((p) => p.trim());
    if (parts.length === 2) {
      normalized = `${parts[1]} ${parts[0]}`;
    }
  }

  // Expand common middle initial patterns
  // "John D. Smith" - keep as is for now (D. is ambiguous)

  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, " ").trim();

  // Remove punctuation except hyphens (for hyphenated names)
  normalized = normalized.replace(/[.,'"]/g, "");

  return normalized;
}

/**
 * Extract year from various date formats.
 */
function extractYear(dateStr: string | null): string | null {
  if (!dateStr) return null;

  // Try YYYY-MM-DD format
  const isoMatch = dateStr.match(/^(\d{4})-/);
  if (isoMatch) return isoMatch[1];

  // Try just YYYY
  const yearMatch = dateStr.match(/\b(19|20)\d{2}\b/);
  if (yearMatch) return yearMatch[0];

  return null;
}

/**
 * Extract law school and graduation year from education string.
 */
function parseEducation(education: string | null): {
  lawSchool: string | null;
  gradYear: string | null;
} {
  if (!education) return { lawSchool: null, gradYear: null };

  const lower = education.toLowerCase();

  // Common law school patterns
  const lawSchoolPatterns = [
    /university of florida.*?law/i,
    /florida state.*?law/i,
    /stetson.*?law/i,
    /miami.*?law/i,
    /nova.*?law/i,
    /barry.*?law/i,
    /fiu.*?law/i,
    /harvard law/i,
    /yale law/i,
    /stanford law/i,
    /columbia law/i,
    /nyu.*?law/i,
    /georgetown.*?law/i,
    /j\.?d\.?\s*,?\s*([\w\s]+university|[\w\s]+college)/i,
    /juris doctor.*?([\w\s]+university|[\w\s]+college)/i,
  ];

  let lawSchool: string | null = null;
  for (const pattern of lawSchoolPatterns) {
    const match = education.match(pattern);
    if (match) {
      lawSchool = match[0].toLowerCase().replace(/[.,]/g, "").trim();
      break;
    }
  }

  // Extract graduation year (look for year near "law" or "j.d.")
  let gradYear: string | null = null;
  const yearMatch = education.match(
    /(?:law|j\.?d\.?|juris doctor)[^0-9]*(\d{4})/i,
  );
  if (yearMatch) {
    gradYear = yearMatch[1];
  } else {
    // Fallback: find any year in the education string
    const anyYear = education.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
    if (anyYear) gradYear = anyYear[1];
  }

  return { lawSchool, gradYear };
}

// ---------------------------------------------------------------------------
// Identity Generation
// ---------------------------------------------------------------------------

/**
 * Generate a deterministic hash from identity components.
 */
function generateHash(components: string[]): string {
  const input = components.filter(Boolean).join("|").toLowerCase();
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 16);
}

/**
 * Generate a stable identity for a judge record.
 */
export function generateIdentity(judge: EnrichedJudgeRecord): JudgeIdentity {
  const normalizedName = normalizeName(judge.fullName);
  const { lawSchool, gradYear } = parseEducation(judge.education);
  const appointmentYear = extractYear(judge.appointmentDate);
  const barYear = extractYear(judge.barAdmissionDate);

  // Try identity strategies in order of reliability

  // Strategy 1: Bar number (if we ever get it)
  // TODO: Integrate Florida Bar lookup when available
  const barNumber: string | null = null;

  if (barNumber) {
    return {
      id: `bar:${barNumber}`,
      barNumber,
      normalizedName,
      identityConfidence: "high",
      identityBasis: ["barNumber"],
    };
  }

  // Strategy 2: Name + law school + grad year (very reliable)
  if (lawSchool && gradYear) {
    const id = generateHash([normalizedName, lawSchool, gradYear]);
    return {
      id: `edu:${id}`,
      barNumber: null,
      normalizedName,
      identityConfidence: "high",
      identityBasis: ["normalizedName", "lawSchool", "gradYear"],
    };
  }

  // Strategy 3: Name + bar admission year + state (reliable)
  if (barYear && judge.state) {
    const id = generateHash([normalizedName, barYear, judge.state]);
    return {
      id: `bar-year:${id}`,
      barNumber: null,
      normalizedName,
      identityConfidence: "high",
      identityBasis: ["normalizedName", "barYear", "state"],
    };
  }

  // Strategy 4: Name + appointment year + court (medium reliability)
  if (appointmentYear && judge.courtType) {
    const id = generateHash([normalizedName, appointmentYear, judge.courtType]);
    return {
      id: `appt:${id}`,
      barNumber: null,
      normalizedName,
      identityConfidence: "medium",
      identityBasis: ["normalizedName", "appointmentYear", "courtType"],
    };
  }

  // Strategy 5: Fallback - name + court + county (current approach, less reliable)
  const id = generateHash([
    normalizedName,
    judge.courtType,
    judge.county || "",
  ]);
  return {
    id: `name:${id}`,
    barNumber: null,
    normalizedName,
    identityConfidence: "low",
    identityBasis: ["normalizedName", "courtType", "county"],
  };
}

// ---------------------------------------------------------------------------
// Identity Matching
// ---------------------------------------------------------------------------

/**
 * Calculate name similarity using Levenshtein distance.
 */
function nameSimilarity(name1: string, name2: string): number {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);

  if (n1 === n2) return 1.0;

  // Simple Levenshtein-based similarity
  const maxLen = Math.max(n1.length, n2.length);
  if (maxLen === 0) return 1.0;

  const distance = levenshteinDistance(n1, n2);
  return 1 - distance / maxLen;
}

function levenshteinDistance(s1: string, s2: string): number {
  const m = s1.length;
  const n = s2.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  return dp[m][n];
}

/**
 * Check if two judges are likely the same person.
 */
export function areJudgesSamePerson(
  judge1: EnrichedJudgeRecord,
  judge2: EnrichedJudgeRecord,
): IdentityMatch | null {
  const id1 = generateIdentity(judge1);
  const id2 = generateIdentity(judge2);

  // Same identity hash = definitely same person
  if (id1.id === id2.id) {
    return {
      identity: id1,
      confidence: 1.0,
      matchReason: "Identical identity hash",
    };
  }

  // Check name similarity
  const similarity = nameSimilarity(judge1.fullName, judge2.fullName);

  // High name similarity + same education = very likely same person
  if (similarity > 0.9) {
    const edu1 = parseEducation(judge1.education);
    const edu2 = parseEducation(judge2.education);

    if (edu1.lawSchool && edu2.lawSchool && edu1.lawSchool === edu2.lawSchool) {
      if (edu1.gradYear && edu2.gradYear && edu1.gradYear === edu2.gradYear) {
        return {
          identity: id1,
          confidence: 0.95,
          matchReason: "Same name + law school + grad year",
        };
      }
      return {
        identity: id1,
        confidence: 0.85,
        matchReason: "Same name + law school",
      };
    }

    // Same name + court type
    if (judge1.courtType === judge2.courtType) {
      return {
        identity: id1,
        confidence: 0.75,
        matchReason: "Similar name + same court type",
      };
    }
  }

  // Medium similarity + multiple matching fields
  if (similarity > 0.8) {
    let matchingFields = 0;
    const reasons: string[] = [];

    if (
      judge1.courtType === judge2.courtType &&
      judge1.county === judge2.county
    ) {
      matchingFields++;
      reasons.push("same court+county");
    }
    if (judge1.barAdmissionDate && judge1.barAdmissionDate === judge2.barAdmissionDate) {
      matchingFields++;
      reasons.push("same bar admission");
    }
    if (judge1.appointmentDate && judge1.appointmentDate === judge2.appointmentDate) {
      matchingFields++;
      reasons.push("same appointment date");
    }

    if (matchingFields >= 1) {
      return {
        identity: id1,
        confidence: 0.6 + matchingFields * 0.1,
        matchReason: `Similar name (${(similarity * 100).toFixed(0)}%) + ${reasons.join(", ")}`,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Batch Operations
// ---------------------------------------------------------------------------

/**
 * Deduplicate judges using identity resolution.
 * Returns unique judges with merged data.
 */
export function deduplicateByIdentity(
  judges: EnrichedJudgeRecord[],
): {
  unique: EnrichedJudgeRecord[];
  duplicates: { kept: EnrichedJudgeRecord; merged: EnrichedJudgeRecord }[];
  identityMap: Map<string, JudgeIdentity>;
} {
  const identityMap = new Map<string, JudgeIdentity>();
  const recordsByIdentity = new Map<string, EnrichedJudgeRecord[]>();
  const duplicates: { kept: EnrichedJudgeRecord; merged: EnrichedJudgeRecord }[] = [];

  // Group by identity
  for (const judge of judges) {
    const identity = generateIdentity(judge);
    identityMap.set(identity.id, identity);

    const existing = recordsByIdentity.get(identity.id) || [];
    existing.push(judge);
    recordsByIdentity.set(identity.id, existing);
  }

  // Merge duplicates, keeping the most complete record
  const unique: EnrichedJudgeRecord[] = [];

  for (const [_identityId, records] of Array.from(recordsByIdentity.entries())) {
    if (records.length === 1) {
      unique.push(records[0]);
    } else {
      // Sort by completeness (more non-null fields = better)
      records.sort((a: EnrichedJudgeRecord, b: EnrichedJudgeRecord) => {
        const countFields = (r: EnrichedJudgeRecord) =>
          Object.values(r).filter(
            (v) => v !== null && v !== "" && v !== false,
          ).length;
        return countFields(b) - countFields(a);
      });

      // Keep the most complete record
      const kept = records[0];

      // Merge fields from other records
      for (let i = 1; i < records.length; i++) {
        const other = records[i];
        duplicates.push({ kept, merged: other });

        // Fill in any missing fields from the duplicate
        for (const key of Object.keys(other) as (keyof EnrichedJudgeRecord)[]) {
          if (
            (kept[key] === null || kept[key] === "") &&
            other[key] !== null &&
            other[key] !== ""
          ) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (kept as any)[key] = other[key];
          }
        }
      }

      unique.push(kept);
    }
  }

  return { unique, duplicates, identityMap };
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

/**
 * Get identity quality statistics for a set of judges.
 */
export function getIdentityStats(judges: EnrichedJudgeRecord[]): {
  total: number;
  highConfidence: number;
  mediumConfidence: number;
  lowConfidence: number;
  byBasis: Record<string, number>;
} {
  const stats = {
    total: judges.length,
    highConfidence: 0,
    mediumConfidence: 0,
    lowConfidence: 0,
    byBasis: {} as Record<string, number>,
  };

  for (const judge of judges) {
    const identity = generateIdentity(judge);

    if (identity.identityConfidence === "high") stats.highConfidence++;
    else if (identity.identityConfidence === "medium") stats.mediumConfidence++;
    else stats.lowConfidence++;

    const basisKey = identity.identityBasis.sort().join("+");
    stats.byBasis[basisKey] = (stats.byBasis[basisKey] || 0) + 1;
  }

  return stats;
}
