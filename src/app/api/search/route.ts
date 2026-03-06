/**
 * Search API Route
 * Feature: 009-search-discovery
 *
 * GET /api/search - Search judges by name and filters
 *
 * Query Parameters:
 *   - q: Search query for judge name (partial match)
 *   - state: Filter by state abbreviation (e.g., "CA")
 *   - county: Filter by county slug
 *   - courtType: Filter by court type
 *   - page: Page number (1-indexed, default 1)
 *   - limit: Results per page (1-100, default 20)
 *
 * Response: SearchResponse (see src/lib/search.ts)
 */

import { NextRequest, NextResponse } from "next/server";
import {
  validateSearchParams,
  executeSearch,
  type SearchResponse,
} from "@/lib/search";

export async function GET(
  request: NextRequest,
): Promise<
  NextResponse<SearchResponse | { error: string; errors?: string[] }>
> {
  try {
    const { searchParams } = new URL(request.url);

    // Extract raw params from URL
    const rawParams: Record<string, string | undefined> = {
      q: searchParams.get("q") ?? undefined,
      state: searchParams.get("state") ?? undefined,
      county: searchParams.get("county") ?? undefined,
      courtType: searchParams.get("courtType") ?? undefined,
      page: searchParams.get("page") ?? undefined,
      limit: searchParams.get("limit") ?? undefined,
    };

    // Validate and sanitize params (T004a)
    const validation = validateSearchParams(rawParams);

    if (!validation.valid) {
      return NextResponse.json(
        { error: "Invalid parameters", errors: validation.errors },
        { status: 400 },
      );
    }

    // Execute search with validated params
    const response = await executeSearch(validation.params);

    return NextResponse.json(response);
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
