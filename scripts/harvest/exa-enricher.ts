/**
 * Exa enricher — uses the Exa neural search API to fill gaps in judge records
 * when bio pages and Ballotpedia enrichment leave fields empty.
 *
 * Targets judges below the confidence threshold with missing bio fields.
 * Searches for education, prior experience, appointment info, and
 * political affiliation from public web sources.
 *
 * All discovered data is tagged with SECONDARY source authority and tracked
 * in fieldsFromExternal for provenance.
 *
 * @module scripts/harvest/exa-enricher
 */

import type { EnrichedJudgeRecord } from "./config";
import { chatCompletion, describeLLMConfig } from "./llm-provider";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExaSearchResult {
  title: string;
  url: string;
  publishedDate?: string;
  highlights?: string[];
  text?: string;
}

export interface ExaSearchResponse {
  results: ExaSearchResult[];
}

export interface ExaEnrichmentResult {
  judge: EnrichedJudgeRecord;
  searchUrl: string | null;
  fieldsEnriched: string[];
  searchHits: number;
}

export interface ExaEnrichmentStats {
  judges: EnrichedJudgeRecord[];
  totalEnriched: number;
  totalSearched: number;
  totalSkipped: number;
  fieldCounts: Record<string, number>;
  errors: Array<{ judgeName: string; error: string }>;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const EXA_API_BASE = "https://api.exa.ai";

/** Fields to target for enrichment — ordered by confidence-score impact */
const ENRICHABLE_FIELDS: Array<{
  key: keyof EnrichedJudgeRecord;
  label: string;
}> = [
  { key: "education", label: "education" },
  { key: "priorExperience", label: "priorExperience" },
  { key: "appointingAuthority", label: "appointingAuthority" },
  { key: "appointmentDate", label: "appointmentDate" },
  { key: "politicalAffiliation", label: "politicalAffiliation" },
  { key: "termStart", label: "termStart" },
  { key: "termEnd", label: "termEnd" },
];

/** Minimum number of empty enrichable fields to justify an Exa search call */
const MIN_MISSING_FIELDS = 2;

/** Default confidence threshold — only search judges below this */
const DEFAULT_CONFIDENCE_THRESHOLD = 0.75;

// ---------------------------------------------------------------------------
// Exa API client
// ---------------------------------------------------------------------------

function getExaApiKey(): string | null {
  return process.env.EXA_API_KEY || null;
}

/**
 * Search Exa for pages about a judge. Uses the /search endpoint with
 * highlights for token efficiency.
 */
async function searchExa(
  query: string,
  options: {
    numResults?: number;
    includeDomains?: string[];
    category?: string;
  } = {},
): Promise<ExaSearchResponse> {
  const apiKey = getExaApiKey();
  if (!apiKey) {
    throw new Error(
      "EXA_API_KEY is required for Exa enrichment. Get one at https://dashboard.exa.ai/api-keys",
    );
  }

  const body: Record<string, unknown> = {
    query,
    numResults: options.numResults ?? 5,
    type: "auto",
    contents: {
      highlights: {
        numSentences: 5,
        highlightsPerUrl: 3,
      },
    },
  };

  if (options.includeDomains?.length) {
    body.includeDomains = options.includeDomains;
  }
  if (options.category) {
    body.category = options.category;
  }

  const response = await fetch(`${EXA_API_BASE}/search`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Exa API error ${response.status}: ${text}`);
  }

  return (await response.json()) as ExaSearchResponse;
}

// ---------------------------------------------------------------------------
// LLM extraction from Exa results
// ---------------------------------------------------------------------------

const EXA_EXTRACTION_PROMPT = `You are a data extraction assistant. Given search result highlights about a judge, extract structured biographical information.

Return valid JSON with these fields:
- education: Degrees, schools, years (or null if not mentioned)
- priorExperience: Career before becoming judge (or null)
- appointingAuthority: Who appointed this judge (e.g., "Governor Ron DeSantis", or null)
- appointmentDate: Date of appointment (YYYY-MM-DD or YYYY format, or null)
- politicalAffiliation: Political party (Republican, Democrat, Independent, Nonpartisan, or null)
- termStart: When current term began (YYYY-MM-DD or YYYY format, or null)
- termEnd: When current term ends (YYYY-MM-DD or YYYY format, or null)

CRITICAL RULES:
- Extract ONLY what is explicitly stated in the text. Do NOT hallucinate.
- If a field is not clearly stated, return null.
- If information looks uncertain or ambiguous, return null.
- Return null for every field rather than guess.`;

interface ExaExtractedData {
  education: string | null;
  priorExperience: string | null;
  appointingAuthority: string | null;
  appointmentDate: string | null;
  politicalAffiliation: string | null;
  termStart: string | null;
  termEnd: string | null;
}

async function extractFromExaResults(
  highlights: string[],
  judgeName: string,
): Promise<ExaExtractedData> {
  const combinedText = highlights.join("\n\n---\n\n");

  const userPrompt = `Extract information about judge "${judgeName}" from these search result highlights:

---

${combinedText}

---

Return JSON:
{
  "education": "Degrees, schools or null",
  "priorExperience": "Career summary or null",
  "appointingAuthority": "Name or null",
  "appointmentDate": "YYYY-MM-DD or null",
  "politicalAffiliation": "Party or null",
  "termStart": "YYYY-MM-DD or null",
  "termEnd": "YYYY-MM-DD or null"
}`;

  const response = await chatCompletion(
    EXA_EXTRACTION_PROMPT,
    userPrompt,
    1024,
  );

  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Exa extraction response");
  }

  try {
    return JSON.parse(jsonMatch[0]) as ExaExtractedData;
  } catch {
    throw new Error("Failed to parse Exa extraction JSON");
  }
}

// ---------------------------------------------------------------------------
// Eligibility check
// ---------------------------------------------------------------------------

/**
 * Determine if a judge record should be enriched via Exa search.
 * Only targets judges with enough missing fields to justify the API call.
 */
function shouldEnrichWithExa(
  judge: EnrichedJudgeRecord,
  confidenceThreshold: number,
): { eligible: boolean; missingFields: string[] } {
  // Already at or above threshold — no need
  if (judge.confidenceScore >= confidenceThreshold) {
    return { eligible: false, missingFields: [] };
  }

  // Count missing enrichable fields
  const missingFields = ENRICHABLE_FIELDS.filter(
    ({ key }) =>
      judge[key] === null || judge[key] === undefined || judge[key] === "",
  ).map(({ label }) => label);

  return {
    eligible: missingFields.length >= MIN_MISSING_FIELDS,
    missingFields,
  };
}

// ---------------------------------------------------------------------------
// Single-judge enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich a single judge record with Exa web search data.
 */
export async function enrichWithExa(
  judge: EnrichedJudgeRecord,
): Promise<ExaEnrichmentResult> {
  const fieldsEnriched: string[] = [];

  // Build a descriptive neural query
  const courtInfo = [judge.courtType, judge.county, judge.state]
    .filter(Boolean)
    .join(" ");
  const query = `Judge ${judge.fullName} ${courtInfo} biography education career background`;

  const searchResponse = await searchExa(query, { numResults: 5 });

  if (!searchResponse.results || searchResponse.results.length === 0) {
    return { judge, searchUrl: null, fieldsEnriched: [], searchHits: 0 };
  }

  // Collect all highlights from search results
  const allHighlights = searchResponse.results.flatMap(
    (r) => r.highlights ?? [],
  );

  if (allHighlights.length === 0) {
    return {
      judge,
      searchUrl: searchResponse.results[0]?.url ?? null,
      fieldsEnriched: [],
      searchHits: searchResponse.results.length,
    };
  }

  // Extract structured data from highlights using LLM
  const data = await extractFromExaResults(allHighlights, judge.fullName);

  // Merge extracted data into judge record — only fill empty fields
  if (data.education && !judge.education) {
    judge.education = data.education;
    fieldsEnriched.push("education");
  }

  if (data.priorExperience && !judge.priorExperience) {
    judge.priorExperience = data.priorExperience;
    fieldsEnriched.push("priorExperience");
  }

  if (data.appointingAuthority && !judge.appointingAuthority) {
    judge.appointingAuthority = data.appointingAuthority;
    fieldsEnriched.push("appointingAuthority");
  }

  if (data.appointmentDate && !judge.appointmentDate) {
    judge.appointmentDate = data.appointmentDate;
    fieldsEnriched.push("appointmentDate");
  }

  if (data.politicalAffiliation && !judge.politicalAffiliation) {
    judge.politicalAffiliation = data.politicalAffiliation;
    fieldsEnriched.push("politicalAffiliation");
  }

  if (data.termStart && !judge.termStart) {
    judge.termStart = data.termStart;
    fieldsEnriched.push("termStart");
  }

  if (data.termEnd && !judge.termEnd) {
    judge.termEnd = data.termEnd;
    fieldsEnriched.push("termEnd");
  }

  // Track provenance
  if (fieldsEnriched.length > 0) {
    judge.fieldsFromExternal = [
      ...new Set([...judge.fieldsFromExternal, ...fieldsEnriched]),
    ];
  }

  return {
    judge,
    searchUrl: searchResponse.results[0]?.url ?? null,
    fieldsEnriched,
    searchHits: searchResponse.results.length,
  };
}

// ---------------------------------------------------------------------------
// Batch enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich multiple judges with Exa web search data.
 * Processes judges sequentially with rate limiting.
 * Only targets judges below the confidence threshold with missing fields.
 */
export async function enrichAllWithExa(
  judges: EnrichedJudgeRecord[],
  options: {
    delayMs?: number;
    maxJudges?: number;
    confidenceThreshold?: number;
    onProgress?: (current: number, total: number, name: string) => void;
  } = {},
): Promise<ExaEnrichmentStats> {
  const {
    delayMs = 1000,
    maxJudges,
    confidenceThreshold = DEFAULT_CONFIDENCE_THRESHOLD,
    onProgress,
  } = options;

  const fieldCounts: Record<string, number> = {};
  const errors: ExaEnrichmentStats["errors"] = [];
  let totalEnriched = 0;
  let totalSearched = 0;
  let totalSkipped = 0;

  // Filter to eligible judges
  const eligible = judges.filter(
    (j) => shouldEnrichWithExa(j, confidenceThreshold).eligible,
  );

  const toProcess = maxJudges ? eligible.slice(0, maxJudges) : eligible;
  const skipped = judges.length - eligible.length;
  totalSkipped = skipped;

  console.log(
    `\n[exa] Enriching ${toProcess.length} judges with Exa web search...`,
  );
  console.log(
    `[exa] ${skipped} judges skipped (at/above threshold or insufficient missing fields)`,
  );
  console.log(`[exa] Using ${describeLLMConfig()} for extraction`);

  for (let i = 0; i < toProcess.length; i++) {
    const judge = toProcess[i];

    onProgress?.(i + 1, toProcess.length, judge.fullName);

    try {
      const result = await enrichWithExa(judge);
      totalSearched++;

      if (result.fieldsEnriched.length > 0) {
        totalEnriched++;
        console.log(
          `    [${i + 1}/${toProcess.length}] ${judge.fullName}: +${result.fieldsEnriched.length} fields (${result.fieldsEnriched.join(", ")})`,
        );

        for (const field of result.fieldsEnriched) {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        }
      } else if (result.searchHits > 0) {
        console.log(
          `    [${i + 1}/${toProcess.length}] ${judge.fullName}: ${result.searchHits} results but no new data`,
        );
      } else {
        console.log(
          `    [${i + 1}/${toProcess.length}] ${judge.fullName}: no results found`,
        );
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `    [${i + 1}/${toProcess.length}] ${judge.fullName}: error - ${errMsg}`,
      );
      errors.push({ judgeName: judge.fullName, error: errMsg });
    }

    // Rate limit between requests
    if (i < toProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(
    `\n[exa] Complete: ${totalEnriched}/${totalSearched} judges enriched, ${totalSkipped} skipped`,
  );
  if (errors.length > 0) {
    console.log(`[exa] ${errors.length} errors encountered`);
  }

  return {
    judges,
    totalEnriched,
    totalSearched,
    totalSkipped,
    fieldCounts,
    errors,
  };
}
