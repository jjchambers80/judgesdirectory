/**
 * Florida Bar Enricher — lookup judges in the Florida Bar member directory.
 *
 * The Florida Bar website uses Cloudflare bot protection and JS rendering,
 * so we use Playwright to automate a real browser session.
 *
 * Data extracted:
 * - barNumber: Florida Bar member number (primary key for identity)
 * - barAdmissionDate: Date admitted to the Florida Bar
 * - lawSchool: Law school attended
 *
 * @module scripts/harvest/florida-bar-enricher
 */

import { chromium, type Browser, type Page, type BrowserContext } from "playwright";
import type { EnrichedJudgeRecord } from "./config";
import { normalizeName } from "./identity-resolver";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FloridaBarResult {
  barNumber: string;
  barAdmissionDate: string | null;
  lawSchool: string | null;
  fullName: string;
  status: string; // "Member in Good Standing", etc.
}

export interface FloridaBarEnrichmentResult {
  judges: EnrichedJudgeRecord[];
  stats: {
    searched: number;
    found: number;
    notFound: number;
    errors: number;
  };
}

// ---------------------------------------------------------------------------
// Browser Management
// ---------------------------------------------------------------------------

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--disable-blink-features=AutomationControlled",
        "--disable-features=IsolateOrigins,site-per-process",
      ],
    });
  }
  return browser;
}

async function getContext(): Promise<BrowserContext> {
  if (!context) {
    const b = await getBrowser();
    context = await b.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      locale: "en-US",
    });
  }
  return context;
}

async function closeBrowser(): Promise<void> {
  if (context) {
    await context.close();
    context = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

// ---------------------------------------------------------------------------
// Florida Bar Search
// ---------------------------------------------------------------------------

const FLORIDA_BAR_SEARCH_URL = "https://www.floridabar.org/directories/find-mbr/";

/**
 * Search for a judge in the Florida Bar directory.
 * Returns bar info if found, null if not found.
 */
export async function searchFloridaBar(
  judgeName: string,
): Promise<FloridaBarResult | null> {
  const ctx = await getContext();
  const page = await ctx.newPage();

  try {
    // Navigate to the search page
    await page.goto(FLORIDA_BAR_SEARCH_URL, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Wait for the search form to load (uses IDs not name attributes)
    await page.waitForSelector('#last-name-input', { timeout: 10000 });

    // Parse the name into first/last
    const { firstName, lastName } = parseJudgeName(judgeName);

    // Fill in the search form
    await page.fill('#last-name-input', lastName);
    if (firstName) {
      await page.fill('#first-name-input', firstName);
    }

    // Submit the search - look for submit button
    const submitButton = await page.$('button.find-mbr-submit, button[type="submit"], .search-submit');
    if (submitButton) {
      await submitButton.click();
    } else {
      // Try pressing Enter in the last name field
      await page.press('#last-name-input', 'Enter');
    }

    // Wait for results to load
    await page.waitForLoadState("networkidle", { timeout: 15000 });
    
    // Give extra time for dynamic content
    await page.waitForTimeout(2000);

    // Check if we got results
    const results = await extractSearchResults(page);

    if (results.length === 0) {
      return null;
    }

    // If multiple results, try to find the best match
    const bestMatch = findBestMatch(results, judgeName);

    if (!bestMatch) {
      return null;
    }

    // Click through to the member detail page if needed
    if (bestMatch.detailUrl) {
      await page.goto(bestMatch.detailUrl, {
        waitUntil: "networkidle",
        timeout: 15000,
      });
      return await extractMemberDetails(page, bestMatch);
    }

    return bestMatch;
  } catch (error) {
    console.error(`    [Florida Bar] Error searching for ${judgeName}:`, error);
    return null;
  } finally {
    await page.close();
  }
}

/**
 * Parse a judge name into first and last name components.
 */
function parseJudgeName(name: string): { firstName: string; lastName: string } {
  // Remove honorifics and normalize
  let cleaned = name
    .replace(/^(Hon\.|Honorable|Judge|Justice|Chief Judge|Chief Justice)\s+/i, "")
    .replace(/\s+(Jr\.|Sr\.|III|IV|II)$/i, "")
    .trim();

  // Handle "Last, First" format
  if (cleaned.includes(",")) {
    const [last, first] = cleaned.split(",").map((s) => s.trim());
    return { firstName: first.split(" ")[0], lastName: last };
  }

  // Handle "First Middle Last" format
  const parts = cleaned.split(/\s+/);
  if (parts.length >= 2) {
    return {
      firstName: parts[0],
      lastName: parts[parts.length - 1],
    };
  }

  return { firstName: "", lastName: cleaned };
}

interface SearchResult {
  fullName: string;
  barNumber: string;
  status: string;
  barAdmissionDate: string | null;
  lawSchool: string | null;
  detailUrl: string | null;
}

/**
 * Extract search results from the Florida Bar search results page.
 */
async function extractSearchResults(page: Page): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Try to find result rows
  const rows = await page.$$(".member-search-results tr, .search-results .member-row");

  for (const row of rows) {
    try {
      const nameEl = await row.$("td:first-child a, .member-name a");
      const barNumEl = await row.$("td:nth-child(2), .bar-number");
      const statusEl = await row.$("td:nth-child(3), .member-status");

      if (nameEl) {
        const fullName = (await nameEl.textContent()) || "";
        const detailUrl = await nameEl.getAttribute("href");
        const barNumber = barNumEl ? (await barNumEl.textContent()) || "" : "";
        const status = statusEl ? (await statusEl.textContent()) || "" : "";

        if (fullName.trim()) {
          results.push({
            fullName: fullName.trim(),
            barNumber: barNumber.trim(),
            status: status.trim(),
            barAdmissionDate: null,
            lawSchool: null,
            detailUrl: detailUrl
              ? new URL(detailUrl, FLORIDA_BAR_SEARCH_URL).href
              : null,
          });
        }
      }
    } catch {
      // Skip malformed rows
    }
  }

  // Also try a different selector pattern (some pages use different layouts)
  if (results.length === 0) {
    const altRows = await page.$$(".member-listing, .attorney-result");
    for (const row of altRows) {
      try {
        const text = await row.textContent();
        if (text) {
          // Try to parse bar number from text
          const barMatch = text.match(/Bar\s*#?\s*:?\s*(\d+)/i);
          const nameMatch = text.match(/^([A-Za-z,.\s-]+)/);

          if (barMatch && nameMatch) {
            results.push({
              fullName: nameMatch[1].trim(),
              barNumber: barMatch[1],
              status: "",
              barAdmissionDate: null,
              lawSchool: null,
              detailUrl: null,
            });
          }
        }
      } catch {
        // Skip
      }
    }
  }

  return results;
}

/**
 * Find the best matching result for a given judge name.
 */
function findBestMatch(
  results: SearchResult[],
  targetName: string,
): SearchResult | null {
  if (results.length === 0) return null;
  if (results.length === 1) return results[0];

  const normalizedTarget = normalizeName(targetName);

  // Score each result by name similarity
  let bestScore = 0;
  let bestMatch: SearchResult | null = null;

  for (const result of results) {
    const normalizedResult = normalizeName(result.fullName);
    const score = nameSimilarityScore(normalizedTarget, normalizedResult);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = result;
    }
  }

  // Only return if reasonably confident
  return bestScore > 0.8 ? bestMatch : null;
}

/**
 * Simple name similarity score (0-1).
 */
function nameSimilarityScore(name1: string, name2: string): number {
  if (name1 === name2) return 1.0;

  const words1 = new Set(name1.split(/\s+/));
  const words2 = new Set(name2.split(/\s+/));

  let matches = 0;
  for (const word of Array.from(words1)) {
    if (words2.has(word)) matches++;
  }

  const total = Math.max(words1.size, words2.size);
  return total > 0 ? matches / total : 0;
}

/**
 * Extract detailed member information from a detail page.
 */
async function extractMemberDetails(
  page: Page,
  partial: SearchResult,
): Promise<FloridaBarResult> {
  const result: FloridaBarResult = {
    barNumber: partial.barNumber,
    barAdmissionDate: partial.barAdmissionDate,
    lawSchool: partial.lawSchool,
    fullName: partial.fullName,
    status: partial.status,
  };

  // Try to extract admission date
  const admissionEl = await page.$(".admission-date, [data-field='admission']");
  if (admissionEl) {
    const text = await admissionEl.textContent();
    if (text) {
      const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4})/);
      if (dateMatch) {
        result.barAdmissionDate = dateMatch[1];
      }
    }
  }

  // Try to extract law school
  const schoolEl = await page.$(".law-school, [data-field='lawschool']");
  if (schoolEl) {
    result.lawSchool = (await schoolEl.textContent())?.trim() || null;
  }

  // Try generic text extraction if specific selectors fail
  const pageText = await page.textContent("body");
  if (pageText) {
    // Look for admission date patterns
    if (!result.barAdmissionDate) {
      const admitMatch = pageText.match(
        /(?:Admitted|Admission|Member Since)[:\s]+(\d{1,2}\/\d{1,2}\/\d{4})/i,
      );
      if (admitMatch) {
        result.barAdmissionDate = admitMatch[1];
      }
    }

    // Look for law school patterns
    if (!result.lawSchool) {
      const schoolMatch = pageText.match(
        /(?:Law School|J\.D\.|Juris Doctor)[:\s]+([A-Za-z\s]+(?:University|College|School of Law))/i,
      );
      if (schoolMatch) {
        result.lawSchool = schoolMatch[1].trim();
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Batch Enrichment
// ---------------------------------------------------------------------------

/**
 * Enrich judges with Florida Bar data.
 * Updates barNumber, barAdmissionDate fields.
 */
export async function enrichWithFloridaBar(
  judges: EnrichedJudgeRecord[],
  options: {
    delayMs?: number;
    maxJudges?: number;
  } = {},
): Promise<FloridaBarEnrichmentResult> {
  const { delayMs = 3000, maxJudges } = options;

  const stats = {
    searched: 0,
    found: 0,
    notFound: 0,
    errors: 0,
  };

  const toProcess = maxJudges ? judges.slice(0, maxJudges) : judges;

  console.log(`\n  Searching Florida Bar for ${toProcess.length} judges...`);

  for (let i = 0; i < toProcess.length; i++) {
    const judge = toProcess[i];

    // Skip if we already have a bar number
    if ((judge as unknown as { barNumber?: string }).barNumber) {
      continue;
    }

    stats.searched++;
    console.log(`    [${i + 1}/${toProcess.length}] Searching: ${judge.fullName}`);

    try {
      const result = await searchFloridaBar(judge.fullName);

      if (result) {
        stats.found++;
        console.log(`      Found: Bar #${result.barNumber}`);

        // Update the judge record
        // We'll add barNumber to the record (even though it's not in the type yet)
        (judge as unknown as { barNumber: string }).barNumber = result.barNumber;

        if (result.barAdmissionDate && !judge.barAdmissionDate) {
          judge.barAdmissionDate = result.barAdmissionDate;
          if (!judge.fieldsFromExternal.includes("barAdmissionDate")) {
            judge.fieldsFromExternal.push("barAdmissionDate");
          }
        }

        if (result.lawSchool && !judge.education) {
          judge.education = `J.D., ${result.lawSchool}`;
          if (!judge.fieldsFromExternal.includes("education")) {
            judge.fieldsFromExternal.push("education");
          }
        }
      } else {
        stats.notFound++;
        console.log(`      Not found`);
      }
    } catch (error) {
      stats.errors++;
      console.error(`      Error:`, error);
    }

    // Rate limiting
    if (i < toProcess.length - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  // Clean up browser
  await closeBrowser();

  console.log(
    `\n  Florida Bar: ${stats.found} found, ${stats.notFound} not found, ${stats.errors} errors`,
  );

  return { judges, stats };
}

// ---------------------------------------------------------------------------
// CLI for Testing
// ---------------------------------------------------------------------------

if (require.main === module) {
  const testName = process.argv[2] || "Jorge Labarga";
  console.log(`Testing Florida Bar search for: ${testName}`);

  searchFloridaBar(testName)
    .then((result) => {
      if (result) {
        console.log("Found:", JSON.stringify(result, null, 2));
      } else {
        console.log("Not found");
      }
    })
    .catch(console.error)
    .finally(() => closeBrowser());
}
