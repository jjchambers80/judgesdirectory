"use client";

/**
 * JudgeSearch Component
 * Feature: 009-search-discovery (US1-US4)
 *
 * Client component that manages search state and API calls.
 * Handles URL state persistence for shareable searches (FR-009).
 * Includes filters for state, court type, and county.
 */

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { SearchInput } from "./SearchInput";
import { SearchResults } from "./SearchResults";
import { SearchFilters } from "./SearchFilters";
import { FilterChip } from "./FilterChip";
import type { SearchResponse, FilterOptions } from "@/lib/search";

interface FilterState {
  state?: string;
  courtType?: string;
  county?: string;
}

interface JudgeSearchProps {
  /** Initial search results from server (for SSR) */
  initialResults?: SearchResponse;
  /** Hide the search input (when rendered in header instead) */
  hideSearchInput?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function JudgeSearch({
  initialResults,
  hideSearchInput,
  className,
}: JudgeSearchProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Initialize state from URL (FR-009)
  const initialQuery = searchParams.get("q") || "";
  const initialPage = parseInt(searchParams.get("page") || "1", 10);
  const initialFilters: FilterState = {
    state: searchParams.get("state") || undefined,
    courtType: searchParams.get("courtType") || undefined,
    county: searchParams.get("county") || undefined,
  };

  const [query, setQuery] = React.useState(initialQuery);
  const [, setPage] = React.useState(initialPage); // page tracked via URL, setPage for re-renders
  const [filters, setFilters] = React.useState<FilterState>(initialFilters);
  const [response, setResponse] = React.useState<SearchResponse | null>(
    initialResults || null,
  );
  const [filterOptions, setFilterOptions] =
    React.useState<FilterOptions | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [hasSearched, setHasSearched] = React.useState(true);

  // Fetch filter options
  const fetchFilterOptions = React.useCallback(async (stateAbbr?: string) => {
    try {
      const params = stateAbbr
        ? new URLSearchParams({ state: stateAbbr })
        : undefined;
      const url = params
        ? `/api/search/filters?${params}`
        : "/api/search/filters";
      const res = await fetch(url);

      if (res.ok) {
        const data: FilterOptions = await res.json();
        setFilterOptions(data);
      }
    } catch (error) {
      console.error("Failed to fetch filter options:", error);
    }
  }, []);

  // Fetch search results
  const fetchResults = React.useCallback(
    async (
      searchQuery: string,
      searchFilters: FilterState,
      searchPage: number = 1,
    ) => {
      setIsLoading(true);
      setHasSearched(true);

      try {
        const params = new URLSearchParams();
        if (searchQuery.trim()) params.set("q", searchQuery.trim());
        if (searchFilters.state) params.set("state", searchFilters.state);
        if (searchFilters.courtType)
          params.set("courtType", searchFilters.courtType);
        if (searchFilters.county) params.set("county", searchFilters.county);
        if (searchPage > 1) params.set("page", searchPage.toString());

        const res = await fetch(`/api/search?${params.toString()}`);

        if (!res.ok) {
          throw new Error("Search failed");
        }

        const data: SearchResponse = await res.json();
        setResponse(data);
      } catch (error) {
        console.error("Search error:", error);
        setResponse(null);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  // Track internal URL changes to avoid double-fetching on URL sync
  const internalNavRef = React.useRef(false);

  // Update URL with current state (FR-009)
  const updateUrl = React.useCallback(
    (q: string, f: FilterState, p: number = 1) => {
      internalNavRef.current = true;
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (f.state) params.set("state", f.state);
      if (f.courtType) params.set("courtType", f.courtType);
      if (f.county) params.set("county", f.county);
      if (p > 1) params.set("page", p.toString());

      const newPath = params.toString()
        ? `/judges/?${params.toString()}`
        : "/judges/";

      router.push(newPath, { scroll: false });
    },
    [router],
  );

  // Handle page change (T035-T040)
  const handlePageChange = React.useCallback(
    (newPage: number) => {
      setPage(newPage);
      updateUrl(query, filters, newPage);
      fetchResults(query, filters, newPage);
      // Scroll to top of results
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [query, filters, updateUrl, fetchResults],
  );

  // Handle search submission (T040: reset to page 1)
  const handleSubmit = React.useCallback(() => {
    setPage(1);
    updateUrl(query, filters, 1);
    fetchResults(query, filters, 1);
  }, [query, filters, updateUrl, fetchResults]);

  // Handle input change
  const handleQueryChange = (value: string) => {
    setQuery(value);

    // Re-fetch all results when input is cleared
    if (
      !value.trim() &&
      !filters.state &&
      !filters.courtType &&
      !filters.county
    ) {
      setPage(1);
      updateUrl("", {});
      fetchResults("", {}, 1);
    }
  };

  // Handle filter changes (T020-T034, T040: reset to page 1)
  const handleFiltersChange = React.useCallback(
    (newFilters: FilterState) => {
      setFilters(newFilters);
      setPage(1); // Reset pagination on filter change

      // Fetch counties if state changed
      if (newFilters.state !== filters.state) {
        fetchFilterOptions(newFilters.state);
      }

      // Execute search with new filters (page 1)
      updateUrl(query, newFilters, 1);
      fetchResults(query, newFilters, 1);
    },
    [filters.state, query, updateUrl, fetchResults, fetchFilterOptions],
  );

  // Sync state from URL changes (handles mount + header search navigation)
  const searchParamsKey = searchParams.toString();
  React.useEffect(() => {
    if (internalNavRef.current) {
      internalNavRef.current = false;
      return;
    }
    const urlQuery = searchParams.get("q") || "";
    const urlPage = parseInt(searchParams.get("page") || "1", 10);
    const urlFilters: FilterState = {
      state: searchParams.get("state") || undefined,
      courtType: searchParams.get("courtType") || undefined,
      county: searchParams.get("county") || undefined,
    };
    setQuery(urlQuery);
    setPage(urlPage);
    setFilters(urlFilters);
    fetchResults(urlQuery, urlFilters, urlPage);
    fetchFilterOptions(urlFilters.state);
  }, [searchParamsKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Compute result count text for inline display
  const resultCountText = React.useMemo(() => {
    if (!response) return null;
    const { total, page: p, limit } = response;
    if (total === 0) return null;
    const start = (p - 1) * limit + 1;
    const end = Math.min(p * limit, total);
    return `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} judges`;
  }, [response]);

  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-6">
        {!hideSearchInput && (
          <SearchInput
            value={query}
            onChange={handleQueryChange}
            onSubmit={handleSubmit}
            placeholder="Search judges by name..."
            className="flex-1 min-w-0"
          />
        )}

        <SearchFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          options={filterOptions}
          isLoading={isLoading}
        />

        {resultCountText && (
          <p className="text-sm text-muted-foreground whitespace-nowrap sm:ml-auto">
            {resultCountText}
          </p>
        )}
      </div>

      {(filters.state || filters.courtType || filters.county) && (
        <div className="flex flex-wrap gap-2 mb-4">
          {filters.state &&
            filterOptions?.states &&
            (() => {
              const s = filterOptions.states.find(
                (st) => st.abbreviation === filters.state,
              );
              return s ? (
                <FilterChip
                  label={s.name}
                  onRemove={() =>
                    handleFiltersChange({
                      ...filters,
                      state: undefined,
                      county: undefined,
                    })
                  }
                />
              ) : null;
            })()}
          {filters.courtType && (
            <FilterChip
              label={filters.courtType}
              onRemove={() =>
                handleFiltersChange({ ...filters, courtType: undefined })
              }
            />
          )}
          {filters.county &&
            filterOptions?.counties &&
            (() => {
              const c = filterOptions.counties.find(
                (co) => co.slug === filters.county,
              );
              return c ? (
                <FilterChip
                  label={c.name}
                  onRemove={() =>
                    handleFiltersChange({ ...filters, county: undefined })
                  }
                />
              ) : null;
            })()}
        </div>
      )}

      {hasSearched && (
        <SearchResults
          response={response}
          query={query}
          isLoading={isLoading}
          hideResultCount
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
