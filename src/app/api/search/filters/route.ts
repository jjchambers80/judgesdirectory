/**
 * Search Filters API Route
 * Feature: 009-search-discovery
 * 
 * GET /api/search/filters - Get available filter options
 * 
 * Query Parameters:
 *   - state: Optional state abbreviation to get counties for cascading filter
 * 
 * Response: FilterOptions (see src/lib/search.ts)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getFilterOptions, type FilterOptions } from '@/lib/search';

export async function GET(request: NextRequest): Promise<NextResponse<FilterOptions | { error: string }>> {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state') ?? undefined;
    
    // Validate state if provided
    if (state && (state.length !== 2 || !/^[A-Z]{2}$/i.test(state))) {
      return NextResponse.json(
        { error: 'Invalid state abbreviation' },
        { status: 400 }
      );
    }
    
    // Get filter options (with optional state for counties)
    const filters = await getFilterOptions(state);
    
    return NextResponse.json(filters);
  } catch (error) {
    console.error('Filters API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
