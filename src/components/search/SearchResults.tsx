'use client';

/**
 * SearchResults Component
 * Feature: 009-search-discovery (US1)
 * 
 * Displays search results as a list of judge cards with:
 * - Judge name with search term highlighting
 * - Court type and location context
 * - Click to navigate to judge profile
 */

import * as React from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { SearchResult, SearchResponse } from '@/lib/search';

interface SearchResultsProps {
  /** Search response data */
  response: SearchResponse | null;
  /** Current search query for highlighting */
  query: string;
  /** Whether results are loading */
  isLoading?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Highlight matching text in a string (T012)
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 1) return text;
  
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedQuery})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, index) => {
    if (part.toLowerCase() === query.toLowerCase()) {
      return (
        <mark
          key={index}
          className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5"
        >
          {part}
        </mark>
      );
    }
    return part;
  });
}

/**
 * Build the judge profile URL path
 */
function buildJudgeUrl(result: SearchResult): string {
  const { court } = result;
  return `/judges/${court.county.state.slug}/${court.county.slug}/${court.slug}/${result.slug}/`;
}

/**
 * Individual result card component (T011)
 */
function ResultCard({ 
  result, 
  query 
}: { 
  result: SearchResult; 
  query: string; 
}) {
  const profileUrl = buildJudgeUrl(result);
  
  return (
    <Link
      href={profileUrl}
      className={cn(
        'block p-4 rounded-lg border',
        'bg-card hover:bg-accent transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      )}
    >
      {/* Judge name with highlighting */}
      <h3 className="font-semibold text-foreground">
        {highlightMatch(result.fullName, query)}
      </h3>
      
      {/* Court and location context (FR-015) */}
      <p className="text-sm text-muted-foreground mt-1">
        {result.court.type} · {result.court.county.name}, {result.court.county.state.name}
      </p>
    </Link>
  );
}

/**
 * Empty state component (T015 / FR-017)
 */
function EmptyState({ query }: { query: string }) {
  return (
    <div className="text-center py-12 px-4">
      <svg
        className="mx-auto h-12 w-12 text-muted-foreground/50"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M15.75 15.75l-2.489-2.489m0 0a3.375 3.375 0 10-4.773-4.773 3.375 3.375 0 004.773 4.773zM21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <h3 className="mt-4 text-lg font-medium text-foreground">No judges found</h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {query ? (
          <>
            No verified judges match &ldquo;{query}&rdquo;. Try a different search term or{' '}
            <Link href="/judges/" className="text-primary hover:underline">
              browse by state
            </Link>
            .
          </>
        ) : (
          <>
            Enter a judge name to search or{' '}
            <Link href="/judges/" className="text-primary hover:underline">
              browse by state
            </Link>
            .
          </>
        )}
      </p>
    </div>
  );
}

/**
 * Loading skeleton component
 */
function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="p-4 rounded-lg border bg-card animate-pulse">
          <div className="h-5 w-48 bg-muted rounded" />
          <div className="h-4 w-64 bg-muted rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

export function SearchResults({
  response,
  query,
  isLoading = false,
  className,
}: SearchResultsProps) {
  if (isLoading) {
    return (
      <div className={className}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (!response) {
    return null;
  }

  const { results, total } = response;

  if (results.length === 0) {
    return (
      <div className={className}>
        <EmptyState query={query} />
      </div>
    );
  }

  return (
    <div className={className}>
      {/* Result count */}
      <p className="text-sm text-muted-foreground mb-4">
        {total === 1 ? '1 judge found' : `${total.toLocaleString()} judges found`}
      </p>
      
      {/* Results list */}
      <div className="space-y-3">
        {results.map((result) => (
          <ResultCard key={result.id} result={result} query={query} />
        ))}
      </div>
    </div>
  );
}
