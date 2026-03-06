'use client';

/**
 * SearchFilters Component
 * Feature: 009-search-discovery (US2, US3, US4)
 * 
 * Filter dropdowns for state, court type, and county.
 * County filter is cascaded (enabled only when state is selected).
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { FilterChip } from './FilterChip';
import type { FilterOptions } from '@/lib/search';

interface FilterState {
  state?: string;
  courtType?: string;
  county?: string;
}

interface SearchFiltersProps {
  /** Current filter values */
  filters: FilterState;
  /** Called when filters change */
  onFiltersChange: (filters: FilterState) => void;
  /** Filter options loaded from API */
  options: FilterOptions | null;
  /** Loading state */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

export function SearchFilters({
  filters,
  onFiltersChange,
  options,
  isLoading = false,
  className,
}: SearchFiltersProps) {
  // Handle state filter change
  const handleStateChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    onFiltersChange({
      ...filters,
      state: value,
      // Reset county when state changes (US4 acceptance scenario 3)
      county: undefined,
    });
  };

  // Handle court type change
  const handleCourtTypeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    onFiltersChange({
      ...filters,
      courtType: value,
    });
  };

  // Handle county change
  const handleCountyChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value || undefined;
    onFiltersChange({
      ...filters,
      county: value,
    });
  };

  // Clear all filters (FR-016)
  const handleClearAll = () => {
    onFiltersChange({});
  };

  // Remove individual filter
  const removeFilter = (key: keyof FilterState) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    // If removing state, also remove county
    if (key === 'state') {
      delete newFilters.county;
    }
    onFiltersChange(newFilters);
  };

  const hasActiveFilters = filters.state || filters.courtType || filters.county;

  // Find labels for active filters
  const getStateLabel = () => {
    if (!filters.state || !options) return null;
    const state = options.states.find(s => s.abbreviation === filters.state);
    return state?.name;
  };

  const getCountyLabel = () => {
    if (!filters.county || !options?.counties) return null;
    const county = options.counties.find(c => c.slug === filters.county);
    return county?.name;
  };

  return (
    <div className={cn('space-y-4', className)}>
      {/* Filter dropdowns */}
      <div className="flex flex-wrap gap-3">
        {/* State filter (US2) */}
        <select
          value={filters.state || ''}
          onChange={handleStateChange}
          disabled={isLoading || !options}
          className={cn(
            'h-9 px-3 rounded-md border border-input bg-background text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          aria-label="Filter by state"
        >
          <option value="">All States</option>
          {options?.states.map((state) => (
            <option key={state.abbreviation} value={state.abbreviation}>
              {state.name}
            </option>
          ))}
        </select>

        {/* Court type filter (US3) */}
        <select
          value={filters.courtType || ''}
          onChange={handleCourtTypeChange}
          disabled={isLoading || !options}
          className={cn(
            'h-9 px-3 rounded-md border border-input bg-background text-sm',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          aria-label="Filter by court type"
        >
          <option value="">All Court Types</option>
          {options?.courtTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        {/* County filter (US4) - only enabled when state is selected */}
        <div className="relative">
          <select
            value={filters.county || ''}
            onChange={handleCountyChange}
            disabled={isLoading || !filters.state || !options?.counties}
            className={cn(
              'h-9 px-3 rounded-md border border-input bg-background text-sm',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
            aria-label="Filter by county"
            title={!filters.state ? 'Select a state first' : undefined}
          >
            <option value="">
              {!filters.state ? 'Select state first' : 'All Counties'}
            </option>
            {options?.counties?.map((county) => (
              <option key={county.slug} value={county.slug}>
                {county.name}
              </option>
            ))}
          </select>
        </div>

        {/* Clear all button (FR-016) */}
        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearAll}
            className={cn(
              'h-9 px-3 rounded-md text-sm',
              'text-muted-foreground hover:text-foreground',
              'hover:bg-accent transition-colors',
            )}
          >
            Clear all
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2">
          {filters.state && getStateLabel() && (
            <FilterChip
              label={getStateLabel()!}
              onRemove={() => removeFilter('state')}
            />
          )}
          {filters.courtType && (
            <FilterChip
              label={filters.courtType}
              onRemove={() => removeFilter('courtType')}
            />
          )}
          {filters.county && getCountyLabel() && (
            <FilterChip
              label={getCountyLabel()!}
              onRemove={() => removeFilter('county')}
            />
          )}
        </div>
      )}
    </div>
  );
}
