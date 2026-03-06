"use client";

/**
 * FilterChip Component
 * Feature: 009-search-discovery (US2)
 *
 * Active filter badge with remove action.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

interface FilterChipProps {
  /** Filter label (e.g., "California") */
  label: string;
  /** Called when chip is removed */
  onRemove: () => void;
  /** Additional CSS classes */
  className?: string;
}

export function FilterChip({ label, onRemove, className }: FilterChipProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm",
        "bg-primary/10 text-primary border border-primary/20",
        className,
      )}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="rounded-full hover:bg-primary/20 transition-colors p-0.5 -mr-1"
        aria-label={`Remove ${label} filter`}
      >
        <svg
          className="h-3.5 w-3.5"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </span>
  );
}
