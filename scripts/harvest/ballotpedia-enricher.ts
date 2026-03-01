/**
 * Ballotpedia enricher — fetches political and electoral data for judges
 * from Ballotpedia.org using their public pages.
 *
 * Data available on Ballotpedia:
 * - Political party affiliation
 * - Election history (retention elections, contested races)
 * - Term information
 * - Campaign finance data
 * - Professional background
 *
 * @module scripts/harvest/ballotpedia-enricher
 */

import { EnrichedJudgeRecord } from "./config";
import { chatCompletion, describeLLMConfig } from "./llm-provider";
import TurndownService from "turndown";
import * as cheerio from "cheerio";

const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BallotpediaData {
  politicalAffiliation: string | null;
  termStart: string | null;
  termEnd: string | null;
  appointingAuthority: string | null;
  appointmentDate: string | null;
  electionHistory: string | null;
  education: string | null;
  priorExperience: string | null;
}

export interface BallotpediaEnrichmentResult {
  judge: EnrichedJudgeRecord;
  ballotpediaUrl: string | null;
  fieldsEnriched: string[];
  fromCache: boolean;
}

// ---------------------------------------------------------------------------
// Search and fetch
// ---------------------------------------------------------------------------

/**
 * Map state abbreviation to full name for Ballotpedia URLs.
 */
function getFullStateName(abbrev: string): string {
  const stateMap: Record<string, string> = {
    FL: "Florida",
    CA: "California",
    TX: "Texas",
    NY: "New York",
    // Add more as needed
  };
  return stateMap[abbrev.toUpperCase()] || abbrev;
}

/**
 * Try multiple URL patterns to find a judge on Ballotpedia.
 */
async function tryFetchUrl(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      redirect: "follow",
    });

    if (!response.ok) return null;

    const html = await response.text();

    // Check if this is a valid page (not "page does not exist" or redirect to search)
    if (
      html.includes("This page does not exist") ||
      html.includes("There is currently no text in this page") ||
      html.includes("Search results")
    ) {
      return null;
    }

    // Check if this seems to be about a judge
    const lowerHtml = html.toLowerCase();
    if (
      lowerHtml.includes("judge") ||
      lowerHtml.includes("justice") ||
      lowerHtml.includes("court") ||
      lowerHtml.includes("judicial")
    ) {
      return html;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch a Ballotpedia page for a judge.
 * Tries multiple URL patterns common for Florida judges.
 * Returns the page content as markdown, or null if not found.
 */
async function fetchBallotpediaPage(
  judgeName: string,
  stateAbbrev: string,
): Promise<{ content: string; url: string } | null> {
  const fullState = getFullStateName(stateAbbrev);

  // Clean the name for URL
  const cleanName = judgeName
    .replace(/\s+/g, "_")
    .replace(/[.,]/g, "")
    .replace(/Jr\./gi, "Jr")
    .replace(/Sr\./gi, "Sr")
    .replace(/III/g, "III")
    .replace(/II/g, "II");

  // Try multiple URL patterns (Ballotpedia is inconsistent)
  const urlsToTry = [
    `https://ballotpedia.org/${encodeURIComponent(cleanName)}`,
    `https://ballotpedia.org/${encodeURIComponent(cleanName)}_(${fullState})`,
    `https://ballotpedia.org/${encodeURIComponent(cleanName)}_(${fullState}_judge)`,
    `https://ballotpedia.org/${encodeURIComponent(cleanName)}_(judge)`,
  ];

  for (const url of urlsToTry) {
    const html = await tryFetchUrl(url);
    if (html) {
      const $ = cheerio.load(html);

      // Remove navigation, sidebars, footers
      $(
        "nav, .mw-jump-link, #mw-navigation, #footer, .catlinks, .references, .reflist, .mw-editsection, #toc",
      ).remove();

      // Get main content
      const mainContent = $("#mw-content-text").html() || $("body").html();
      if (!mainContent) continue;

      const markdown = turndown.turndown(mainContent);
      return { content: markdown.slice(0, 15000), url };
    }

    // Small delay between attempts
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  return null;
}

// ---------------------------------------------------------------------------
// LLM extraction
// ---------------------------------------------------------------------------

const BALLOTPEDIA_SYSTEM_PROMPT = `You are a data extraction assistant. Extract structured information about a judge from a Ballotpedia page.

Return valid JSON with these fields:
- politicalAffiliation: Political party (Republican, Democrat, Independent, Nonpartisan, or null)
- termStart: When current term began (YYYY-MM-DD or YYYY format, or null)
- termEnd: When current term ends (YYYY-MM-DD or YYYY format, or null)
- appointingAuthority: Who appointed this judge (e.g., "Governor Ron DeSantis", or null)
- appointmentDate: Date of appointment (YYYY-MM-DD or YYYY format, or null)
- electionHistory: Brief summary of election/retention history (or null)
- education: Degrees, schools, years (or null if not on page)
- priorExperience: Career before becoming judge (or null if not on page)

Extract ONLY what is explicitly stated. Do NOT hallucinate or make assumptions.
If a field is not mentioned, return null.`;

async function extractBallotpediaData(
  markdown: string,
  judgeName: string,
): Promise<BallotpediaData> {
  const userPrompt = `Extract information about judge "${judgeName}" from this Ballotpedia page:

---

${markdown}

---

Return JSON:
{
  "politicalAffiliation": "Party or null",
  "termStart": "YYYY-MM-DD or null",
  "termEnd": "YYYY-MM-DD or null",
  "appointingAuthority": "Name or null",
  "appointmentDate": "YYYY-MM-DD or null",
  "electionHistory": "Brief summary or null",
  "education": "Degrees, schools or null",
  "priorExperience": "Career summary or null"
}`;

  const response = await chatCompletion(
    BALLOTPEDIA_SYSTEM_PROMPT,
    userPrompt,
    2048,
  );

  // Extract JSON from response
  const jsonMatch = response.content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("No JSON found in Ballotpedia extraction response");
  }

  try {
    return JSON.parse(jsonMatch[0]) as BallotpediaData;
  } catch {
    throw new Error("Failed to parse Ballotpedia extraction JSON");
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Enrich a single judge record with Ballotpedia data.
 */
export async function enrichWithBallotpedia(
  judge: EnrichedJudgeRecord,
): Promise<BallotpediaEnrichmentResult> {
  const fieldsEnriched: string[] = [];

  // Skip if we already have political affiliation (likely already enriched)
  if (judge.politicalAffiliation) {
    return {
      judge,
      ballotpediaUrl: null,
      fieldsEnriched: [],
      fromCache: false,
    };
  }

  // Fetch Ballotpedia page
  const page = await fetchBallotpediaPage(judge.fullName, judge.state);

  if (!page) {
    return {
      judge,
      ballotpediaUrl: null,
      fieldsEnriched: [],
      fromCache: false,
    };
  }

  // Extract data with LLM
  const data = await extractBallotpediaData(page.content, judge.fullName);

  // Merge data into judge record (only fill empty fields)
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

  if (data.appointingAuthority && !judge.appointingAuthority) {
    judge.appointingAuthority = data.appointingAuthority;
    fieldsEnriched.push("appointingAuthority");
  }

  if (data.appointmentDate && !judge.appointmentDate) {
    judge.appointmentDate = data.appointmentDate;
    fieldsEnriched.push("appointmentDate");
  }

  if (data.education && !judge.education) {
    judge.education = data.education;
    fieldsEnriched.push("education");
  }

  if (data.priorExperience && !judge.priorExperience) {
    judge.priorExperience = data.priorExperience;
    fieldsEnriched.push("priorExperience");
  }

  return {
    judge,
    ballotpediaUrl: page.url,
    fieldsEnriched,
    fromCache: false,
  };
}

/**
 * Enrich multiple judges with Ballotpedia data.
 * Processes judges sequentially to be respectful of Ballotpedia's servers.
 */
export async function enrichAllWithBallotpedia(
  judges: EnrichedJudgeRecord[],
  options: {
    delayMs?: number;
    maxJudges?: number;
    onProgress?: (current: number, total: number, name: string) => void;
  } = {},
): Promise<{
  judges: EnrichedJudgeRecord[];
  totalEnriched: number;
  fieldCounts: Record<string, number>;
}> {
  const { delayMs = 1000, maxJudges, onProgress } = options;

  const fieldCounts: Record<string, number> = {};
  let totalEnriched = 0;

  const toProcess = maxJudges ? judges.slice(0, maxJudges) : judges;

  console.log(
    `\n[ballotpedia] Enriching ${toProcess.length} judges with Ballotpedia data...`,
  );
  console.log(`[ballotpedia] Using ${describeLLMConfig()}`);

  for (let i = 0; i < toProcess.length; i++) {
    const judge = toProcess[i];

    if (onProgress) {
      onProgress(i + 1, toProcess.length, judge.fullName);
    }

    try {
      const result = await enrichWithBallotpedia(judge);

      if (result.fieldsEnriched.length > 0) {
        totalEnriched++;
        console.log(
          `    [${i + 1}/${toProcess.length}] ${judge.fullName}: +${result.fieldsEnriched.length} fields from ${result.ballotpediaUrl}`,
        );

        for (const field of result.fieldsEnriched) {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        }
      } else if (result.ballotpediaUrl) {
        console.log(
          `    [${i + 1}/${toProcess.length}] ${judge.fullName}: found but no new data`,
        );
      } else {
        console.log(
          `    [${i + 1}/${toProcess.length}] ${judge.fullName}: not found on Ballotpedia`,
        );
      }
    } catch (error) {
      console.error(
        `    [${i + 1}/${toProcess.length}] ${judge.fullName}: error - ${error}`,
      );
    }

    // Delay between requests
    if (i < toProcess.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  console.log(
    `\n[ballotpedia] Complete: ${totalEnriched}/${toProcess.length} judges enriched`,
  );

  return {
    judges,
    totalEnriched,
    fieldCounts,
  };
}
