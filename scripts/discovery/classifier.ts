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
}

// ---------------------------------------------------------------------------
// Classification prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a classifier that determines whether web search results point to official judicial roster pages — pages that list judges serving on a court.

For each search result, determine:
1. isJudicialRoster: true if the page likely lists judges/justices on a court
2. courtType: the specific court type (e.g., "Circuit Court", "Superior Court", "Supreme Court")
3. courtLevel: one of "supreme", "appellate", "trial", or "specialized"
4. confidence: 0.0 to 1.0 indicating your confidence
5. reasoning: brief explanation of your classification

Return JSON array. Only classify based on the title, URL, and snippet — do NOT fetch the pages.`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Classify a batch of search results using gpt-4o-mini.
 *
 * @param results - Search results to classify
 * @returns Classification results for each URL, or empty array if LLM is unavailable
 */
export async function classifyResults(
  results: SearchResult[],
): Promise<ClassificationResult[]> {
  if (results.length === 0) return [];

  const userPrompt = JSON.stringify(
    results.map((r) => ({
      url: r.link,
      title: r.title,
      snippet: r.snippet,
      domain: r.displayLink,
    })),
  );

  try {
    const response = await chatCompletion(SYSTEM_PROMPT, userPrompt, 4096);
    const parsed = JSON.parse(response.content);

    // Handle both array and object-with-array responses
    const items = Array.isArray(parsed)
      ? parsed
      : parsed.results || parsed.classifications || [];

    return items.map((item: Record<string, unknown>, index: number) => ({
      url: String(item.url || results[index]?.link || ""),
      isJudicialRoster: Boolean(item.isJudicialRoster),
      courtType: item.courtType ? String(item.courtType) : null,
      courtLevel: item.courtLevel ? String(item.courtLevel) : null,
      confidence: typeof item.confidence === "number" ? item.confidence : null,
      reasoning: String(item.reasoning || ""),
    }));
  } catch (err) {
    console.warn(
      `[Classifier] LLM classification failed: ${err instanceof Error ? err.message : String(err)}`,
    );
    return [];
  }
}
