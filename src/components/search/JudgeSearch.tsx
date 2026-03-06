'use client';

/**
 * JudgeSearch Component
 * Feature: 009-search-discovery (US1-US4)
 * 
 * Client component that manages search state and API calls.
 * Handles URL state persistence for shareable searches (FR-009).
 * Includes filters for state, court type, and county.
 */

import * as React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SearchInput } from './SearchInput';
import { SearchResults } from './SearchResults';
import { SearchFilters } from './SearchFilters';
import type { SearchResponse, FilterOptions } from '@/lib/search';

interface FilterState {
  state?: string;
  courtType?: string;
  county?: string;
}

interface JudgeSearchProps {
  /** Initial search results from server (for SSR) */
  initialResults?: SearchResponse;
  /** Additional CSS classes */
  className?: string;
}

export function JudgeSearch({ initialResults, className }: JudgeSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // Initialize state from URL (FR-009)
  const initialQuery = searchParams.get('q') || '';
  const initialFilters: FilterState = {
    state: searchParams.get('state') || undefined,
    courtType: searchParams.get('courtType') || undefined,
    county: searchParams.get('county') || undefined,
  };
  
  const [query, setQuery] = React.useState(initialQuery);
  const [filters, setFilters] = React.useState<FilterState>(initialFilters);
  const [response, setResponse] = React.useState<SearchResponse | null>(initialResults || null);
  const [filterOptions, setFilterOptions] = React.useState<FilterOptions | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(
    !!initialQuery || !!initialFilters.state || !!initialFilters.courtType
  );

  // Fetch filter options
  const fetchFilterOptions = React.useCallback(async (stateAbbr?: string) => {
    try {
      const params = stateAbbr ? new URLSearchParams({ state: stateAbbr }) : undefined;
      const url = params ? `/api/search/filters?${params}` : '/api/search/filters';
      const res = await fetch(url);
      
      if (res.ok) {
        const data: FilterOptions = await res.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error('Failed to fetch filter options:', error);
    }
  }, []);

  // Fetch search results
  const fetchResults = React.useCallback(async (
    searchQuery: string,
    searchFilters: FilterState
  ) => {
    const hasFiltersOrQuery = searchQuery.trim() || 
      searchFilters.state || 
      searchFilters.courtType || 
      searchFilters.county;

    if (!hasFiltersOrQuery) {
      setResponse(null);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (searchFilters.state) params.set('state', searchFilters.state);
      if (searchFilters.courtType) params.set('courtType', searchFilters.courtType);
      if (searchFilters.county) params.set('county', searchFilters.county);

      const res = await fetch(`/api/search?${params.toString()}`);
      
      if (!res.ok) {
        throw new Error('Search failed');
      }
      
      const data: SearchResponse = await res.json();
      setResponse(data);
    } catch (error) {
      console.error('Search error:', error);
      setResponse(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Update URL with current state (FR-009)
  const updateUrl = React.useCallback((q: string, f: FilterState) => {
    const params = new URLSearchParams();
    if (q.trim()) params.set('q', q.trim());
    if (f.state) params.set('state', f.state);
    if (f.courtType) params.set('courtType', f.courtType);
    if (f.county) params.set('county', f.county);

    const newPath = params.toString() 
      ? `/judges/?${params.toString()}` 
      : '/judges/';
    
    router.push(newPath, { scroll: false });
  }, [router]);

  // Handle search submission
  const handleSubmit = React.useCallback(() => {
    updateUrl(query, filters);
    fetchResults(query, filters);
  }, [query, filters, updateUrl, fetchResults]);

  // Handle input change
  const handleQueryChange = (value: string) => {
    setQuery(value);
    
    // Clear results when input is cleared and no filters
    if (!value.trim() && !filters.state && !filters.courtType && !filters.county) {
      setResponse(null);
      setHasSearched(false);
      updateUrl('', {});
    }
  };

  // Handle filter changes (T020-T034)
  const handleFiltersChange = React.useCallback((newFilters: FilterState) => {
    setFilters(newFilters);
    
    // Fetch counties if state changed
    if (newFilters.state !== filters.state) {
      fetchFilterOptions(newFilters.state);
    }
    
    // Execute search with new filters
    updateUrl(query, newFilters);
    fetchResults(query, newFilters);
  }, [filters.state, query, updateUrl, fetchResults, fetchFilterOptions]);

  // Load filter options on mount
  React.useEffect(() => {
    fetchFilterOptions(initialFilters.state);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch results on mount if query/filters exist in URL
  React.useEffect(() => {
    if (initialQuery || initialFilters.state || initialFilters.courtType) {
      fetchResults(initialQuery, initialFilters);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={className}>
      <SearchInput
        value={query}
        onChange={handleQueryChange}
        onSubmit={handleSubmit}
        placeholder="Search judges by name..."
        className="mb-4"
      />
      
      <SearchFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        options={filterOptions}
        isLoading={isLoading}
        className="mb-6"
      />
      
      {hasSearched && (
        <SearchResults
          response={response}
          query={query}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}
