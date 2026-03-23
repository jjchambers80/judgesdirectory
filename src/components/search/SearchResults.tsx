"use client";

/**
 * SearchResults Component
 * Feature: 009-search-discovery (US1)
 *
 * Displays search results as a list of judge cards with:
 * - Judge name with search term highlighting
 * - Court type and location context
 * - Click to navigate to judge profile
 */

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Pagination } from "@/components/ui/pagination";
import type { SearchResult, SearchResponse } from "@/lib/search";

interface SearchResultsProps {
  /** Search response data */
  response: SearchResponse | null;
  /** Current search query for highlighting */
  query: string;
  /** Whether results are loading */
  isLoading?: boolean;
  /** Hide the result count (when displayed externally) */
  hideResultCount?: boolean;
  /** Called when page changes (T038) */
  onPageChange?: (page: number) => void;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Highlight matching text in a string (T012)
 */
function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query || query.length < 1) return text;

  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(${escapedQuery})`, "gi");
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
  query,
}: {
  result: SearchResult;
  query: string;
}) {
  const profileUrl = buildJudgeUrl(result);

  return (
    <Link
      href={profileUrl}
      className={cn(
        "group flex items-start gap-4 p-4 rounded-lg border border-border",
        "no-underline text-foreground bg-card",
        "transition-all duration-200",
        "hover:border-primary hover:shadow-md hover:no-underline",
        "hover:-translate-y-0.5",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      {/* Avatar */}
      <div className="relative w-11 h-11 shrink-0 rounded-full overflow-hidden bg-muted ring-1 ring-border">
        {result.photoUrl ? (
          <Image
            src={result.photoUrl}
            alt=""
            width={44}
            height={44}
            className="object-cover w-full h-full"
          />
        ) : (
          <svg
            viewBox="0 0 44 44"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="w-full h-full"
            aria-hidden="true"
          >
            <circle cx="22" cy="16" r="7" className="fill-muted-foreground/50" />
            <path d="M8 44 C8 33 14 27 22 27 C30 27 36 33 36 44" className="fill-muted-foreground/30" />
            <path d="M18 29 L22 33 L26 29" className="stroke-muted-foreground/40" strokeWidth="1.2" fill="none" />
          </svg>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <strong className="text-base group-hover:text-primary transition-colors duration-200">
          {highlightMatch(result.fullName, query)}
        </strong>
        <p className="mt-0.5 text-sm text-muted-foreground leading-snug truncate">
          {result.court.type} · {result.court.county.name},{" "}
          {result.court.county.state.name}
        </p>
        {result.termEnd && (
          <p className="mt-0.5 text-xs text-muted-foreground/70">
            Term ends{" "}
            {new Date(result.termEnd).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
            })}
          </p>
        )}
      </div>
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
      <h3 className="mt-4 text-lg font-medium text-foreground">
        No judges found
      </h3>
      <p className="mt-2 text-sm text-muted-foreground">
        {query ? (
          <>
            No verified judges match &ldquo;{query}&rdquo;. Try a different
            search term or{" "}
            <Link href="/judges/" className="text-primary hover:underline">
              browse by state
            </Link>
            .
          </>
        ) : (
          <>
            Enter a judge name to search or{" "}
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
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-start gap-4 p-4 rounded-lg border bg-card animate-pulse">
          <div className="w-11 h-11 rounded-full bg-muted shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-5 w-32 bg-muted rounded" />
            <div className="h-4 w-48 bg-muted rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SearchResults({
  response,
  query,
  isLoading = false,
  hideResultCount = false,
  onPageChange,
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

  const { results, total, page, totalPages, limit } = response;

  if (results.length === 0) {
    return (
      <div className={className}>
        <EmptyState query={query} />
      </div>
    );
  }

  // Calculate showing range (FR-010)
  const startResult = (page - 1) * limit + 1;
  const endResult = Math.min(page * limit, total);

  return (
    <div className={className}>
      {/* Result count (T036) */}
      {!hideResultCount && (
        <p className="text-sm text-muted-foreground mb-4">
          Showing {startResult.toLocaleString()}–{endResult.toLocaleString()} of{" "}
          {total.toLocaleString()} judges
        </p>
      )}

      {/* Results grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {results.map((result) => (
          <ResultCard key={result.id} result={result} query={query} />
        ))}
      </div>

      {/* Pagination (T037, T038) */}
      {totalPages > 1 && onPageChange && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={onPageChange}
          className="mt-6"
        />
      )}
    </div>
  );
}
