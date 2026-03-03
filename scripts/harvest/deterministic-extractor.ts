/**
 * Deterministic extractors for known Florida court site patterns.
 *
 * These run BEFORE LLM extraction. If they succeed, we skip the LLM call entirely.
 * This dramatically reduces costs for sites with predictable HTML structures.
 *
 * @module scripts/harvest/deterministic-extractor
 */

import * as cheerio from "cheerio";
import type { JudgeRecord, ExtractionResult } from "./extractor";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DeterministicResult {
  success: boolean;
  result?: ExtractionResult;
  confidence: number; // 0-1, how confident we are in the extraction
  method?: string; // which pattern matched
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Attempt deterministic extraction before falling back to LLM.
 * Returns success: true if we extracted data with high confidence.
 */
export function tryDeterministicExtraction(
  html: string,
  url: string,
  courtType: string,
): DeterministicResult {
  const $ = cheerio.load(html);

  // Try each pattern in order of specificity
  const patterns: Array<{
    name: string;
    match: (url: string) => boolean;
    extract: (
      $: cheerio.CheerioAPI,
      courtType: string,
    ) => ExtractionResult | null;
  }> = [
    {
      name: "flcourts-next-data",
      match: (u) => u.includes("flcourts.gov") || u.includes("flcourts.org"),
      extract: extractFromNextData,
    },
    {
      name: "table-roster",
      match: () => true, // generic fallback
      extract: extractFromTable,
    },
    {
      name: "list-roster",
      match: () => true,
      extract: extractFromList,
    },
  ];

  for (const pattern of patterns) {
    if (!pattern.match(url)) continue;

    try {
      const result = pattern.extract($, courtType);
      if (result && result.judges.length > 0) {
        // Sanity check: if we extracted way too many "judges", it's probably garbage
        // A typical circuit has 20-50 judges, DCAs have 10-15, Supreme Court has 7-9
        // If we get 80+, the pattern probably matched nav items or other noise
        const maxReasonable = courtType.includes("Circuit") ? 70 : 20;
        if (result.judges.length > maxReasonable) {
          // Too many results - probably false positives, skip this pattern
          continue;
        }

        return {
          success: true,
          result,
          confidence: 0.8,
          method: pattern.name,
        };
      }
    } catch {
      // Pattern failed, try next
    }
  }

  return { success: false, confidence: 0 };
}

// ---------------------------------------------------------------------------
// Selector-hint extraction (for deterministic: true entries)
// ---------------------------------------------------------------------------

/**
 * Extract judges using a CSS selector hint.
 * Designed for structured HTML pages (e.g., California's central roster table
 * where <th> = county name and <td> = "Hon. {Name}").
 *
 * Falls back to generic table/list extraction if selector doesn't match.
 */
export function extractWithSelectorHint(
  html: string,
  courtType: string,
  selectorHint?: string,
): DeterministicResult {
  const $ = cheerio.load(html);
  const judges: JudgeRecord[] = [];

  // If a CSS selector is provided, narrow the scope
  const $scope = selectorHint ? $(selectorHint) : $.root();

  if (selectorHint && $scope.length === 0) {
    return { success: false, confidence: 0 };
  }

  // Strategy 1: County-header table format (th=county, td=judge names)
  // This matches California's central roster page
  let currentCounty: string | null = null;

  $scope.find("table").each((_, table) => {
    const $table = $(table);

    $table.find("tr").each((_, row) => {
      const $row = $(row);

      // Check for county header in <th>
      const th = $row.find("th");
      if (th.length > 0) {
        const headerText = th.text().trim();
        // County headers are typically just the county name
        if (
          headerText &&
          !headerText.toLowerCase().includes("judge") &&
          headerText.length < 60
        ) {
          currentCounty = headerText.replace(/\s*county$/i, "").trim();
        }
      }

      // Extract judge names from <td>
      $row.find("td").each((_, cell) => {
        const text = $(cell).text().trim();
        if (!text) return;

        // Match "Hon. First Last" or similar patterns
        const honMatch = text.match(/^(?:Hon\.\s*|Honorable\s+)(.+)$/i);
        if (honMatch) {
          const name = normalizeName(honMatch[1]);
          const link = $(cell).find("a").attr("href") || null;
          const isChief = /\b(?:chief|presiding)\b/i.test(text);

          judges.push({
            name,
            courtType: courtType as JudgeRecord["courtType"],
            county: currentCounty,
            division: null,
            selectionMethod: null,
            bioPageUrl: link,
            isChiefJudge: isChief,
          });
        } else if (looksLikeJudgeName(text)) {
          // Fallback: raw judge name without "Hon." prefix
          const name = normalizeName(text);
          const link = $(cell).find("a").attr("href") || null;
          const isChief = /\b(?:chief|presiding)\b/i.test(text);

          judges.push({
            name,
            courtType: courtType as JudgeRecord["courtType"],
            county: currentCounty,
            division: null,
            selectionMethod: null,
            bioPageUrl: link,
            isChiefJudge: isChief,
          });
        }
      });
    });
  });

  // Strategy 2: If no table matches, try general name patterns in scoped area
  if (judges.length === 0) {
    $scope.find("*").each((_, el) => {
      const text = $(el).text().trim();
      const honMatch = text.match(/^(?:Hon\.\s*|Honorable\s+)(.+)$/i);
      if (honMatch && !$(el).children().length) {
        const name = normalizeName(honMatch[1]);
        const link =
          $(el).closest("a").attr("href") ||
          $(el).find("a").attr("href") ||
          null;
        judges.push({
          name,
          courtType: courtType as JudgeRecord["courtType"],
          county: null,
          division: null,
          selectionMethod: null,
          bioPageUrl: link,
          isChiefJudge: /\b(?:chief|presiding)\b/i.test(text),
        });
      }
    });
  }

  if (judges.length >= 1) {
    return {
      success: true,
      result: {
        judges,
        pageTitle: $("title").text() || null,
        courtLevel: courtType,
      },
      confidence: 0.9,
      method: "selector-hint",
    };
  }

  return { success: false, confidence: 0 };
}

// ---------------------------------------------------------------------------
// Pattern: Next.js __NEXT_DATA__ (flcourts.gov sites)
// ---------------------------------------------------------------------------

function extractFromNextData(
  $: cheerio.CheerioAPI,
  courtType: string,
): ExtractionResult | null {
  const scriptContent = $("#__NEXT_DATA__").html();
  if (!scriptContent) return null;

  try {
    const data = JSON.parse(scriptContent);
    const pageProps = data.props?.pageProps;
    if (!pageProps) return null;

    const judges: JudgeRecord[] = [];

    // Strategy 1: childrenInfos (Supreme Court, DCAs)
    const children = pageProps.childrenInfos;
    if (Array.isArray(children)) {
      for (const child of children) {
        const content = child?.props?.content;
        if (!content) continue;

        const name = (content.name || "").trim();
        const type = content.typeIdentifier || "";
        const url = content.url || "";

        // Filter for judge/justice entries
        const looksLikePerson =
          /^(chief\s+)?justice\s/i.test(name) ||
          /^(chief\s+)?judge\s/i.test(name);
        const isJudgeType = type === "judge";

        if (looksLikePerson || isJudgeType) {
          // Skip folders/categories
          if (
            /^(previous|former|current|retired|biograph)/i.test(name) ||
            /transition|chronological|merit|news/i.test(name)
          ) {
            continue;
          }

          const normalizedName = normalizeName(name);
          const isChief = /^chief\s/i.test(name);

          judges.push({
            name: normalizedName,
            courtType: courtType as JudgeRecord["courtType"],
            county: null,
            division: null,
            selectionMethod: null,
            bioPageUrl: url ? `https://supremecourt.flcourts.gov${url}` : null,
            isChiefJudge: isChief,
          });
        }
      }
    }

    if (judges.length > 0) {
      return {
        judges,
        pageTitle: pageProps.pageData?.name || null,
        courtLevel: courtType,
      };
    }
  } catch {
    return null;
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pattern: HTML table with judge names
// ---------------------------------------------------------------------------

function extractFromTable(
  $: cheerio.CheerioAPI,
  courtType: string,
): ExtractionResult | null {
  const judges: JudgeRecord[] = [];

  // Look for tables that might contain judge rosters
  $("table").each((_, table) => {
    const $table = $(table);
    const tableText = $table.text().toLowerCase();

    // Skip if table doesn't look like a judge roster
    if (
      !tableText.includes("judge") &&
      !tableText.includes("justice") &&
      !tableText.includes("hon.")
    ) {
      return;
    }

    $table.find("tr").each((_, row) => {
      const $row = $(row);
      const cells = $row.find("td, th");

      if (cells.length === 0) return;

      // Try to find a name in the first cell
      const firstCell = cells.first();
      const cellText = firstCell.text().trim();

      // Check if it looks like a judge name
      if (looksLikeJudgeName(cellText)) {
        const normalizedName = normalizeName(cellText);
        const link = firstCell.find("a").attr("href") || null;
        const isChief = /chief/i.test(cellText);

        // Try to extract county from other cells
        let county: string | null = null;
        cells.each((i, cell) => {
          if (i === 0) return;
          const text = $(cell).text().trim();
          if (isCountyName(text)) {
            county = text;
          }
        });

        judges.push({
          name: normalizedName,
          courtType: courtType as JudgeRecord["courtType"],
          county,
          division: null,
          selectionMethod: null,
          bioPageUrl: link,
          isChiefJudge: isChief,
        });
      }
    });
  });

  if (judges.length >= 3) {
    // Require at least 3 judges to consider this a valid extraction
    return {
      judges,
      pageTitle: $("title").text() || null,
      courtLevel: courtType,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pattern: List (ul/ol) with judge names
// ---------------------------------------------------------------------------

function extractFromList(
  $: cheerio.CheerioAPI,
  courtType: string,
): ExtractionResult | null {
  const judges: JudgeRecord[] = [];

  // Look for lists that might contain judge names
  $("ul, ol").each((_, list) => {
    const $list = $(list);
    const listText = $list.text().toLowerCase();

    // Skip if list doesn't look like a judge roster
    if (
      !listText.includes("judge") &&
      !listText.includes("justice") &&
      !listText.includes("hon.")
    ) {
      return;
    }

    $list.find("li").each((_, item) => {
      const $item = $(item);
      const itemText = $item.text().trim();

      if (looksLikeJudgeName(itemText)) {
        const normalizedName = normalizeName(itemText);
        const link = $item.find("a").attr("href") || null;
        const isChief = /chief/i.test(itemText);

        judges.push({
          name: normalizedName,
          courtType: courtType as JudgeRecord["courtType"],
          county: null,
          division: null,
          selectionMethod: null,
          bioPageUrl: link,
          isChiefJudge: isChief,
        });
      }
    });
  });

  if (judges.length >= 3) {
    return {
      judges,
      pageTitle: $("title").text() || null,
      courtLevel: courtType,
    };
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Common non-name words that should disqualify a match
const NON_NAME_WORDS = new Set([
  "county",
  "circuit",
  "court",
  "district",
  "division",
  "judicial",
  "magistrate",
  "officer",
  "hearing",
  "support",
  "child",
  "general",
  "overview",
  "directory",
  "biographies",
  "calendars",
  "forms",
  "procedures",
  "manuals",
  "approved",
  "quasi",
  "judges",
  "justices",
  "about",
  "contact",
  "home",
  "menu",
  "navigation",
  "search",
  "login",
  "register",
  // Additional nav/page items seen in circuit court sites
  "civil",
  "criminal",
  "family",
  "probate",
  "traffic",
  "juvenile",
  "employment",
  "opportunities",
  "expert",
  "witness",
  "jury",
  "service",
  "process",
  "servers",
  "case",
  "management",
  "program",
  "proposed",
  "orders",
  "efiling",
  "remote",
  "selection",
  "pilot",
  "law",
]);

/**
 * Check if text looks like a judge name.
 */
function looksLikeJudgeName(text: string): boolean {
  // Skip empty or very short text
  if (!text || text.length < 5) return false;

  // Skip very long text (likely a description or nav item)
  if (text.length > 60) return false;

  // Skip if it's just a header/label
  if (/^(judge|justice|chief|hon\.?|name|county|division)$/i.test(text)) {
    return false;
  }

  // Skip if text contains common non-name words
  const lowerText = text.toLowerCase();
  const nonNameWordsArray = Array.from(NON_NAME_WORDS);
  for (const word of nonNameWordsArray) {
    if (lowerText.includes(word)) {
      return false;
    }
  }

  // Has honorific prefix - high confidence this is a judge name
  if (/^(hon\.?|judge|justice|chief\s+judge|chief\s+justice)\s+/i.test(text)) {
    return true;
  }

  // Looks like "First Last" or "Last, First" pattern (2-4 words typical for names)
  const words = text.split(/\s+/);
  if (words.length < 2 || words.length > 6) return false;

  const namePattern = /^[A-Z][a-z]+(\s+[A-Z]\.?)?\s+[A-Z][a-z]+/;
  const lastFirstPattern = /^[A-Z][a-z]+,\s*[A-Z][a-z]+/;

  return namePattern.test(text) || lastFirstPattern.test(text);
}

/**
 * Normalize a judge name to "First Last" format.
 */
function normalizeName(text: string): string {
  let name = text.trim();

  // Remove honorifics
  name = name.replace(
    /^(hon\.?|judge|justice|chief\s+judge|chief\s+justice)\s+/i,
    "",
  );

  // Handle "Last, First" format
  if (/^[A-Za-z]+,\s*[A-Za-z]/.test(name)) {
    const parts = name.split(/,\s*/);
    if (parts.length >= 2) {
      name = `${parts[1]} ${parts[0]}`;
    }
  }

  // Clean up extra whitespace
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

/**
 * Check if text looks like a Florida county name.
 */
function isCountyName(text: string): boolean {
  const floridaCounties = new Set([
    "alachua",
    "baker",
    "bay",
    "bradford",
    "brevard",
    "broward",
    "calhoun",
    "charlotte",
    "citrus",
    "clay",
    "collier",
    "columbia",
    "desoto",
    "dixie",
    "duval",
    "escambia",
    "flagler",
    "franklin",
    "gadsden",
    "gilchrist",
    "glades",
    "gulf",
    "hamilton",
    "hardee",
    "hendry",
    "hernando",
    "highlands",
    "hillsborough",
    "holmes",
    "indian river",
    "jackson",
    "jefferson",
    "lafayette",
    "lake",
    "lee",
    "leon",
    "levy",
    "liberty",
    "madison",
    "manatee",
    "marion",
    "martin",
    "miami-dade",
    "monroe",
    "nassau",
    "okaloosa",
    "okeechobee",
    "orange",
    "osceola",
    "palm beach",
    "pasco",
    "pinellas",
    "polk",
    "putnam",
    "santa rosa",
    "sarasota",
    "seminole",
    "st. johns",
    "st. lucie",
    "sumter",
    "suwannee",
    "taylor",
    "union",
    "volusia",
    "wakulla",
    "walton",
    "washington",
  ]);

  return floridaCounties.has(text.toLowerCase().replace(" county", "").trim());
}
