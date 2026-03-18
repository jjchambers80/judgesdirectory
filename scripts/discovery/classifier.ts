/**
 * LLM-based classification of search results as judicial roster pages.
 *
 * Uses existing llm-provider.ts for the gpt-4o-mini call.
 *
 * @module scripts/discovery/classifier
 */

import { chatCompletion } from "../harvest/llm-provider";
import type { SearchResult } from "./search-client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassificationResult {
  url: string;
  isJudicialRoster: boolean;
  courtType: string | null;
  courtLevel: string | null;
  confidence: number | null;
  reasoning: string;
  /** null = needs human review, true = auto-approved, false = auto-rejected */
  scrapeWorthy: boolean | null;
  autoClassifiedAt: Date;
}

// ---------------------------------------------------------------------------
// Classification prompt
// ---------------------------------------------------------------------------

/**
 * Build a state-scoped system prompt so the LLM only flags URLs that belong
 * to the target state, preventing cross-state contamination (e.g. NC results
 * being classified as relevant during a South Carolina discovery run).
 */
function buildSystemPrompt(
  targetState: string,
  targetStateAbbr: string,
): string {
  return `You are a classifier that determines whether web search results point to official judicial roster pages for **${targetState} (${targetStateAbbr})** courts.

IMPORTANT: Only classify a result as isJudicialRoster=true if the page belongs to a **${targetState}** court. Pages from other states — including similarly named states like ${
    targetState.startsWith("North")
      ? targetState.replace("North", "South")
      : targetState.startsWith("South")
        ? targetState.replace("South", "North")
        : targetState === "Virginia"
          ? "West Virginia"
          : targetState === "West Virginia"
            ? "Virginia"
            : "adjacent states"
  } — must be classified as isJudicialRoster=false even if they are valid judicial roster pages.

For each search result, determine:
1. isJudicialRoster: true ONLY if the page lists judges/justices for a **${targetState}** court
2. courtType: the specific court type (e.g., "Circuit Court", "Superior Court", "Supreme Court")
3. courtLevel: one of "supreme", "appellate", "trial", or "specialized"
4. confidence: 0.0 to 1.0 indicating your confidence
5. reasoning: brief explanation including why you believe this URL belongs (or does not belong) to ${targetState}

Return JSON array. Only classify based on the title, URL, and snippet — do NOT fetch the pages.`;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a batch of search results using gpt-4o-mini.
 *
 * @param results - Search results to classify
 * @param targetState - Full state name (e.g. "South Carolina") — constrains
 *   the classifier to only flag URLs belonging to this state.
 * @param targetStateAbbr - Two-letter abbreviation (e.g. "SC")
 * @returns Classification results for each URL, or empty array if LLM is unavailable
 */
export async function classifyResults(
  results: SearchResult[],
  targetState: string,
  targetStateAbbr: string,
): Promise<ClassificationResult[]> {
  if (results.length === 0) return [];

  const systemPrompt = buildSystemPrompt(targetState, targetStateAbbr);

  const userPrompt = JSON.stringify(
    results.map((r) => ({
      url: r.link,
      title: r.title,
      snippet: r.snippet,
      domain: r.displayLink,
    })),
  );

  try {
    const response = await chatCompletion(systemPrompt, userPrompt, 4096);
    const parsed = JSON.parse(response.content);

    // Handle both array and object-with-array responses
    const items = Array.isArray(parsed)
      ? parsed
      : parsed.results || parsed.classifications || [];

    return items.map((item: Record<string, unknown>, index: number) => {
      const confidence =
        typeof item.confidence === "number" ? item.confidence : null;
      const isJudicialRoster = Boolean(item.isJudicialRoster);

      // Compute scrape-worthiness (FR-002, FR-003)
      let scrapeWorthy: boolean | null = null;
      if (confidence !== null) {
        if (confidence >= 0.7 && isJudicialRoster) {
          scrapeWorthy = true;
        } else if (confidence < 0.3 || !isJudicialRoster) {
          scrapeWorthy = false;
        }
        // else: null (needs human review)
      }

      return {
        url: String(item.url || results[index]?.link || ""),
        isJudicialRoster,
        courtType: item.courtType ? String(item.courtType) : null,
        courtLevel: item.courtLevel ? String(item.courtLevel) : null,
        confidence,
        reasoning: String(item.reasoning || ""),
        scrapeWorthy,
        autoClassifiedAt: new Date(),
      };
    });
  } catch (err) {
    console.warn(
      `[Classifier] LLM classification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return results.map((r) => ({
      url: r.link,
      isJudicialRoster: false,
      courtType: null,
      courtLevel: null,
      confidence: null,
      reasoning: "Classification failed",
      scrapeWorthy: null,
      autoClassifiedAt: new Date(),
    }));
  }
}
