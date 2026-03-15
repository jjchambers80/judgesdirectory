/**
 * Search & Discovery
 * Feature: 009-search-discovery
 *
 * TypeScript types and query builders for judge search functionality.
 */

import { Prisma, JudgeStatus } from "@prisma/client";
import { prisma } from "./db";

// =============================================================================
// Types
// =============================================================================

/** Input parameters for search API requests */
export interface SearchParams {
  /** Text query for judge name (partial match) */
  q?: string;
  /** Filter by state abbreviation (e.g., "CA", "FL") */
  state?: string;
  /** Filter by county slug */
  county?: string;
  /** Filter by court type (e.g., "Supreme Court") */
  courtType?: string;
  /** Page number (1-indexed), default 1 */
  page?: number;
  /** Results per page, default 20, max 100 */
  limit?: number;
}

/** Individual judge result in search response */
export interface SearchResult {
  /** Judge UUID */
  id: string;
  /** Judge's full name */
  fullName: string;
  /** URL slug for judge profile */
  slug: string;
  /** Photo URL (may be null) */
  photoUrl: string | null;
  /** Term end date (may be null) */
  termEnd: Date | null;
  /** Court information for context */
  court: {
    type: string;
    slug: string;
    county: {
      name: string;
      slug: string;
      state: {
        name: string;
        abbreviation: string;
        slug: string;
      };
    };
  };
}

/** Full response envelope from search API */
export interface SearchResponse {
  /** Array of matching judges */
  results: SearchResult[];
  /** Total count of matches (for pagination) */
  total: number;
  /** Current page number */
  page: number;
  /** Results per page */
  limit: number;
  /** Total pages available */
  totalPages: number;
  /** Active filters echoed back */
  filters: {
    q?: string;
    state?: string;
    county?: string;
    courtType?: string;
  };
}

/** Available filter values for UI dropdowns */
export interface FilterOptions {
  /** All states with verified judges */
  states: Array<{
    name: string;
    abbreviation: string;
    slug: string;
  }>;
  /** Court types (distinct values from database) */
  courtTypes: string[];
  /** Counties in selected state (dynamic, only present when state param provided) */
  counties?: Array<{
    name: string;
    slug: string;
  }>;
}

// =============================================================================
// Input Normalization (T005a)
// =============================================================================

/**
 * Normalize search input: handle unicode, apostrophes, hyphens
 * per edge case specification
 */
export function normalizeSearchQuery(query: string): string {
  if (!query) return "";

  return (
    query
      // Normalize unicode characters (e.g., accented characters)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      // Preserve apostrophes but normalize different quote styles (O'Brien)
      .replace(/[''`]/g, "'")
      // Preserve hyphens for hyphenated names (Mary-Ann)
      .replace(/–|—/g, "-")
      // Remove other special characters but keep letters, numbers, spaces, apostrophes, hyphens
      .replace(/[^\w\s'-]/g, "")
      // Collapse multiple spaces
      .replace(/\s+/g, " ")
      .trim()
  );
}

// =============================================================================
// Query Builder (T005, T006, T005b)
// =============================================================================

/** Prisma select clause for SearchResult shape */
const searchResultSelect = {
  id: true,
  fullName: true,
  slug: true,
  photoUrl: true,
  termEnd: true,
  court: {
    select: {
      type: true,
      slug: true,
      county: {
        select: {
          name: true,
          slug: true,
          state: {
            select: {
              name: true,
              abbreviation: true,
              slug: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.JudgeSelect;

/**
 * Build Prisma where clause from search parameters.
 * Always filters to VERIFIED judges only (Constitution Principle I).
 */
export function buildSearchWhereClause(
  params: SearchParams,
): Prisma.JudgeWhereInput {
  const { q, state, county, courtType } = params;
  const normalizedQuery = q ? normalizeSearchQuery(q) : undefined;

  const where: Prisma.JudgeWhereInput = {
    // Constitution Principle I: Only VERIFIED judges in public results
    status: JudgeStatus.VERIFIED,
  };

  // Name search filter (case-insensitive partial match)
  if (normalizedQuery) {
    where.fullName = {
      contains: normalizedQuery,
      mode: "insensitive",
    };
  }

  // Court type filter
  if (courtType) {
    where.court = {
      type: courtType,
    };
  }

  // County filter (requires joining through court)
  if (county) {
    where.court = {
      ...(where.court as object),
      county: {
        slug: county,
      },
    };
  }

  // State filter (requires joining through court -> county)
  if (state) {
    where.court = {
      ...(where.court as object),
      county: {
        ...((where.court as { county?: object })?.county as object),
        state: {
          abbreviation: state.toUpperCase(),
        },
      },
    };
  }

  return where;
}

/**
 * Execute search query with pagination.
 * Uses pg_trgm similarity for relevance ranking when query is present.
 */
export async function executeSearch(
  params: SearchParams,
): Promise<SearchResponse> {
  const page = Math.max(1, params.page || 1);
  const limit = Math.min(100, Math.max(1, params.limit || 20));
  const skip = (page - 1) * limit;

  const where = buildSearchWhereClause(params);
  const normalizedQuery = params.q ? normalizeSearchQuery(params.q) : undefined;

  // Execute count and search in parallel
  const [total, judges] = await Promise.all([
    prisma.judge.count({ where }),
    prisma.judge.findMany({
      where,
      select: searchResultSelect,
      skip,
      take: limit,
      // Order by name for consistent results (similarity ordering done via raw query when needed)
      orderBy: { fullName: "asc" },
    }),
  ]);

  // If we have a search query and results, re-order by similarity
  // Note: For better performance with large datasets, consider raw SQL with ORDER BY similarity()
  let results = judges as SearchResult[];
  if (normalizedQuery && results.length > 0) {
    // Client-side similarity sorting for now (pg_trgm similarity requires raw SQL)
    // This provides reasonable ordering for partial matches
    const queryLower = normalizedQuery.toLowerCase();
    results = results.sort((a, b) => {
      const aName = a.fullName.toLowerCase();
      const bName = b.fullName.toLowerCase();

      // Prioritize exact matches at start of name
      const aStartsWith = aName.startsWith(queryLower);
      const bStartsWith = bName.startsWith(queryLower);
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;

      // Then prioritize word boundaries
      const aWordMatch = aName.split(" ").some((w) => w.startsWith(queryLower));
      const bWordMatch = bName.split(" ").some((w) => w.startsWith(queryLower));
      if (aWordMatch && !bWordMatch) return -1;
      if (!aWordMatch && bWordMatch) return 1;

      // Fall back to alphabetical
      return aName.localeCompare(bName);
    });
  }

  return {
    results,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    filters: {
      q: params.q,
      state: params.state,
      county: params.county,
      courtType: params.courtType,
    },
  };
}

// =============================================================================
// Filter Options Query (T007)
// =============================================================================

/**
 * Get available filter options (states, court types, and optionally counties).
 * Only returns values that have at least one VERIFIED judge.
 */
export async function getFilterOptions(
  stateAbbr?: string,
): Promise<FilterOptions> {
  // Get states with verified judges
  const statesPromise = prisma.state.findMany({
    where: {
      counties: {
        some: {
          courts: {
            some: {
              judges: {
                some: { status: JudgeStatus.VERIFIED },
              },
            },
          },
        },
      },
    },
    select: {
      name: true,
      abbreviation: true,
      slug: true,
    },
    orderBy: { name: "asc" },
  });

  // Get distinct court types with verified judges
  const courtTypesPromise = prisma.court.findMany({
    where: {
      judges: {
        some: { status: JudgeStatus.VERIFIED },
      },
    },
    select: { type: true },
    distinct: ["type"],
    orderBy: { type: "asc" },
  });

  // Get counties if state specified
  const countiesPromise = stateAbbr
    ? prisma.county.findMany({
        where: {
          state: { abbreviation: stateAbbr.toUpperCase() },
          courts: {
            some: {
              judges: {
                some: { status: JudgeStatus.VERIFIED },
              },
            },
          },
        },
        select: {
          name: true,
          slug: true,
        },
        orderBy: { name: "asc" },
      })
    : Promise.resolve(undefined);

  const [states, courtTypesRaw, counties] = await Promise.all([
    statesPromise,
    courtTypesPromise,
    countiesPromise,
  ]);

  return {
    states,
    courtTypes: courtTypesRaw.map((c: { type: string }) => c.type),
    ...(counties && { counties }),
  };
}

// =============================================================================
// Validation (T004a)
// =============================================================================

/** Validation result for search parameters */
export interface ValidationResult {
  valid: boolean;
  params: SearchParams;
  errors: string[];
}

/**
 * Validate and sanitize search parameters.
 * Returns cleaned params with validation errors.
 */
export function validateSearchParams(
  raw: Record<string, string | undefined>,
): ValidationResult {
  const errors: string[] = [];
  const params: SearchParams = {};

  // Query string: min 1, max 100 chars
  if (raw.q !== undefined) {
    const q = raw.q.trim();
    if (q.length > 100) {
      errors.push("Query too long (max 100 characters)");
    } else if (q.length > 0) {
      params.q = q;
    }
  }

  // State: must be 2-letter abbreviation
  if (raw.state !== undefined) {
    const state = raw.state.trim().toUpperCase();
    if (state.length === 2 && /^[A-Z]{2}$/.test(state)) {
      params.state = state;
    } else if (state.length > 0) {
      errors.push("Invalid state abbreviation");
    }
  }

  // County: slug format
  if (raw.county !== undefined) {
    const county = raw.county.trim().toLowerCase();
    if (county.length > 0) {
      params.county = county;
    }
  }

  // Court type: any non-empty string
  if (raw.courtType !== undefined) {
    const courtType = raw.courtType.trim();
    if (courtType.length > 0) {
      params.courtType = courtType;
    }
  }

  // Page: positive integer, default 1
  if (raw.page !== undefined) {
    const page = parseInt(raw.page, 10);
    if (isNaN(page) || page < 1) {
      params.page = 1;
    } else {
      params.page = page;
    }
  } else {
    params.page = 1;
  }

  // Limit: 1-100, default 20
  if (raw.limit !== undefined) {
    const limit = parseInt(raw.limit, 10);
    if (isNaN(limit) || limit < 1) {
      params.limit = 20;
    } else {
      params.limit = Math.min(100, limit);
    }
  } else {
    params.limit = 20;
  }

  return {
    valid: errors.length === 0,
    params,
    errors,
  };
}
