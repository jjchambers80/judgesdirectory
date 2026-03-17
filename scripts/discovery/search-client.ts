/**
 * Brave Search API wrapper for court roster URL discovery.
 *
 * Uses native fetch — no SDK dependencies.
 *
 * @module scripts/discovery/search-client
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  displayLink: string;
}

interface BraveSearchResponse {
  web?: {
    results?: Array<{
      title: string;
      url: string;
      description: string;
    }>;
  };
  query?: {
    original: string;
  };
}

// ---------------------------------------------------------------------------
// Query builders
// ---------------------------------------------------------------------------

/**
 * States that share a directional prefix with another state, making unquoted
 * searches ambiguous (e.g. "Carolina" matches both North and South Carolina).
 * Maps the full state name to a sibling state name to explicitly exclude.
 */
const AMBIGUOUS_STATE_EXCLUSIONS: Record<string, string> = {
  "South Carolina": "North Carolina",
  "North Carolina": "South Carolina",
  "South Dakota": "North Dakota",
  "North Dakota": "South Dakota",
  "West Virginia": "Virginia",
  Virginia: "West Virginia",
};

/**
 * Build search queries for the three court levels of a given state.
 *
 * State names are quoted to force exact-match matching and avoid cross-state
 * contamination (e.g. "South Carolina" searches returning nccourts.gov results).
 * For directional-prefix pairs (NC/SC, ND/SD, VA/WV) an explicit exclusion
 * term is appended to the query.
 */
export function buildQueries(
  stateName: string,
): { level: string; query: string }[] {
  // Wrap state name in quotes to force exact-match — prevents "South Carolina"
  // queries from matching North Carolina pages on .gov domains.
  const quotedState = `"${stateName}"`;

  // For ambiguous state name pairs, add an explicit -"OtherState" exclusion.
  const sibling = AMBIGUOUS_STATE_EXCLUSIONS[stateName];
  const exclusion = sibling ? ` -"${sibling}"` : "";

  return [
    {
      level: "supreme",
      query: `${quotedState} supreme court justices roster site:gov${exclusion}`,
    },
    {
      level: "appellate",
      query: `${quotedState} court of appeal judges roster site:gov${exclusion}`,
    },
    {
      level: "trial",
      query: `${quotedState} circuit OR superior OR district court judges roster site:gov${exclusion}`,
    },
  ];
}

// ---------------------------------------------------------------------------
// API client
// ---------------------------------------------------------------------------

/**
 * Validate that required env vars for Brave Search are set.
 * Throws with a clear message if missing.
 */
export function validateSearchEnv(): { apiKey: string } {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY;

  if (!apiKey) {
    throw new Error(
      "BRAVE_SEARCH_API_KEY is required. Set it in .env or export it.",
    );
  }

  return { apiKey };
}

/** @deprecated Use validateSearchEnv instead */
export const validateCSEEnv = validateSearchEnv;

/**
 * Execute a Brave Search query and return parsed results.
 *
 * @param query - The search query string
 * @returns Array of SearchResult (max 20 per query)
 * @throws Error with "RATE_LIMIT" message when quota is exceeded (HTTP 429)
 */
export async function search(query: string): Promise<SearchResult[]> {
  const { apiKey } = validateSearchEnv();

  const params = new URLSearchParams({
    q: query,
    count: "20",
    search_lang: "en",
    country: "US",
  });

  const url = `https://api.search.brave.com/res/v1/web/search?${params.toString()}`;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Encoding": "gzip",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (response.status === 429) {
    throw new Error(`RATE_LIMIT: Brave Search rate limit exceeded (HTTP 429)`);
  }

  if (response.status === 403) {
    throw new Error(`RATE_LIMIT: Brave Search quota exceeded (HTTP 403)`);
  }

  if (!response.ok) {
    throw new Error(
      `Brave Search error: HTTP ${response.status} ${response.statusText}`,
    );
  }

  const data = (await response.json()) as BraveSearchResponse;

  const results = data.web?.results;
  if (!results || results.length === 0) {
    return [];
  }

  return results.map((item) => {
    let displayLink = "";
    try {
      displayLink = new URL(item.url).hostname;
    } catch {
      displayLink = item.url;
    }
    return {
      title: item.title,
      link: item.url,
      snippet: item.description,
      displayLink,
    };
  });
}
