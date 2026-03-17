/**
 * Bio page enrichment — fetches individual judge profile pages and extracts
 * detailed biographical data to supplement roster data.
 *
 * @module scripts/harvest/bio-enricher
 */

import { fetchPage } from "./fetcher";
import {
  extractBioPage,
  type BioPageData,
  type JudgeRecord,
} from "./extractor";
import type { EnrichedJudgeRecord, CourtUrlEntry } from "./config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichmentResult {
  enriched: EnrichedJudgeRecord[];
  stats: {
    totalJudges: number;
    bioPagesFetched: number;
    bioPagesSucceeded: number;
    bioPagesFailed: number;
    fieldsEnriched: Record<string, number>;
  };
  errors: Array<{ judgeName: string; url: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enrich roster judge records with data from their individual bio pages.
 *
 * @param judges - Basic judge records from roster extraction
 * @param courtEntry - Court URL entry with metadata
 * @param options - Enrichment options
 */
export async function enrichWithBioPages(
  judges: JudgeRecord[],
  courtEntry: CourtUrlEntry,
  options: {
    skipBioFetch?: boolean;
    stateAbbreviation?: string;
    onProgress?: (current: number, total: number, name: string) => void;
  } = {},
): Promise<EnrichmentResult> {
  const enriched: EnrichedJudgeRecord[] = [];
  const errors: EnrichmentResult["errors"] = [];
  const fieldsEnriched: Record<string, number> = {};

  let bioPagesFetched = 0;
  let bioPagesSucceeded = 0;
  let bioPagesFailed = 0;

  for (let i = 0; i < judges.length; i++) {
    const judge = judges[i];
    options.onProgress?.(i + 1, judges.length, judge.name);

    // Start with base record from roster data
    const record = createBaseRecord(
      judge,
      courtEntry,
      options.stateAbbreviation,
    );

    // If judge has a bio page URL and we're not skipping, fetch and enrich
    if (judge.bioPageUrl && !options.skipBioFetch) {
      bioPagesFetched++;

      try {
        const bioUrl = resolveUrl(judge.bioPageUrl, courtEntry.url);
        console.log(`    Fetching bio: ${bioUrl}`);

        const fetchResult = await fetchPage(bioUrl);
        const bioData = await extractBioPage(
          fetchResult.markdown,
          judge.name,
          bioUrl,
        );

        // Merge bio data into record
        mergeAndTrackBioData(record, bioData, fieldsEnriched);
        record.bioPageUrl = bioUrl;
        bioPagesSucceeded++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.warn(`    Bio fetch failed: ${errMsg}`);
        errors.push({
          judgeName: judge.name,
          url: judge.bioPageUrl,
          error: errMsg,
        });
        bioPagesFailed++;
      }
    }

    enriched.push(record);
  }

  return {
    enriched,
    stats: {
      totalJudges: judges.length,
      bioPagesFetched,
      bioPagesSucceeded,
      bioPagesFailed,
      fieldsEnriched,
    },
    errors,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create base enriched record from roster data.
 */
function createBaseRecord(
  judge: JudgeRecord,
  courtEntry: CourtUrlEntry,
  stateAbbreviation?: string,
): EnrichedJudgeRecord {
  return {
    // Identity
    fullName: judge.name,
    photoUrl: null,

    // Court Assignment
    courtType: judge.courtType,
    county: judge.county,
    state: stateAbbreviation || "FL",
    division: judge.division,
    isChiefJudge: judge.isChiefJudge ?? false,

    // Term & Selection
    termStart: null,
    termEnd: null,
    selectionMethod: judge.selectionMethod,
    appointingAuthority: null,
    appointmentDate: null,

    // Biographical
    birthDate: null,
    education: null,
    priorExperience: null,
    politicalAffiliation: null,
    barAdmissionDate: null,
    barAdmissionState: null,

    // Contact
    courthouseAddress: null,
    courthousePhone: null,

    // Source Attribution
    rosterUrl: courtEntry.url,
    bioPageUrl: null,
    sourceAuthority: null,
    extractionMethod: null,

    // Data Quality
    confidenceScore: 0.5, // Base confidence — overridden by orchestrator with source-authority-aware base
    fieldsFromRoster: [
      "fullName",
      "courtType",
      "county",
      "division",
      "isChiefJudge",
      "selectionMethod",
    ].filter((f) => {
      const val = (judge as Record<string, unknown>)[
        f === "fullName" ? "name" : f
      ];
      return val !== null && val !== undefined;
    }),
    fieldsFromBio: [],
    fieldsFromExternal: [],
  };
}

/**
 * Merge bio page data into enriched record, tracking which fields were enriched.
 */
function mergeAndTrackBioData(
  record: EnrichedJudgeRecord,
  bioData: BioPageData,
  fieldsEnriched: Record<string, number>,
): void {
  const bioFields: Array<{
    bioKey: keyof BioPageData;
    recordKey: keyof EnrichedJudgeRecord;
    transform?: (val: unknown) => unknown;
  }> = [
    { bioKey: "photoUrl", recordKey: "photoUrl" },
    { bioKey: "termStart", recordKey: "termStart" },
    { bioKey: "termEnd", recordKey: "termEnd" },
    { bioKey: "appointingAuthority", recordKey: "appointingAuthority" },
    { bioKey: "appointmentDate", recordKey: "appointmentDate" },
    { bioKey: "birthDate", recordKey: "birthDate" },
    { bioKey: "education", recordKey: "education" },
    { bioKey: "priorExperience", recordKey: "priorExperience" },
    {
      bioKey: "barAdmissionYear",
      recordKey: "barAdmissionDate",
      transform: (y) => (y ? `${y}-01-01` : null),
    },
    { bioKey: "courthouseAddress", recordKey: "courthouseAddress" },
    { bioKey: "courthousePhone", recordKey: "courthousePhone" },
  ];

  for (const { bioKey, recordKey, transform } of bioFields) {
    const rawVal = bioData[bioKey];
    if (rawVal !== null && rawVal !== undefined && rawVal !== "") {
      const val = transform ? transform(rawVal) : rawVal;
      (record as unknown as Record<string, unknown>)[recordKey] = val;
      record.fieldsFromBio.push(recordKey);
      fieldsEnriched[recordKey] = (fieldsEnriched[recordKey] ?? 0) + 1;
    }
  }

  // Handle divisions array → single division string
  if (bioData.divisions && bioData.divisions.length > 0) {
    if (!record.division) {
      record.division = bioData.divisions.join(", ");
      record.fieldsFromBio.push("division");
      fieldsEnriched["division"] = (fieldsEnriched["division"] ?? 0) + 1;
    }
  }

  // Increase confidence score based on bio data availability
  // New formula: source-authority-aware base (set on record.confidenceScore),
  // plus +0.05 per bio field, capped at 0.95
  const bioFieldCount = record.fieldsFromBio.length;
  if (bioFieldCount > 0) {
    const baseScore = record.confidenceScore; // Already set by orchestrator with source-authority base + extraction bonus
    record.confidenceScore = Math.min(0.95, baseScore + bioFieldCount * 0.05);
  }
}

/**
 * Resolve potentially relative URL against base URL.
 */
function resolveUrl(url: string, baseUrl: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  try {
    return new URL(url, baseUrl).href;
  } catch {
    // If URL parsing fails, try simple concatenation
    const base = baseUrl.replace(/\/[^/]*$/, "");
    return `${base}/${url.replace(/^\//, "")}`;
  }
}
