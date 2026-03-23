"use client";

/**
 * SearchInput Component
 * Feature: 009-search-discovery (US1, US6)
 *
 * Search input field with search icon and autocomplete dropdown.
 * Implements WAI-ARIA combobox pattern for accessibility.
 * T041-T047: Autocomplete with debounce, keyboard nav, and highlighting.
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import JudgeAvatar from "@/components/JudgeAvatar";
import type { SearchResult, SearchResponse } from "@/lib/search";

interface SearchInputProps {
  /** Current search query value */
  value: string;
  /** Called when search value changes */
  onChange: (value: string) => void;
  /** Called when user submits search (Enter key) */
  onSubmit?: () => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional CSS classes */
  className?: string;
  /** Auto-focus on mount */
  autoFocus?: boolean;
}

// T044: Keyboard navigation constants
const KEYS = {
  ArrowDown: "ArrowDown",
  ArrowUp: "ArrowUp",
  Enter: "Enter",
  Escape: "Escape",
} as const;

export function SearchInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Search judges by name...",
  className,
  autoFocus = false,
}: SearchInputProps) {
  const router = useRouter();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listboxRef = React.useRef<HTMLUListElement>(null);

  // T041: Autocomplete state
  const [suggestions, setSuggestions] = React.useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const [selectedIndex, setSelectedIndex] = React.useState(-1);
  const [isLoading, setIsLoading] = React.useState(false);

  // T046: AbortController for canceling pending requests
  const abortControllerRef = React.useRef<AbortController | null>(null);

  // Generate unique IDs for ARIA
  const listboxId = React.useId();
  const inputId = React.useId();

  // T042: Debounced fetch with 150ms delay
  const fetchSuggestions = React.useCallback(async (query: string) => {
    // T043: Only trigger after 2+ characters
    if (query.length < 2) {
      setSuggestions([]);
      setIsOpen(false);
      return;
    }

    // T046: Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    abortControllerRef.current = new AbortController();
    setIsLoading(true);

    try {
      // Use same endpoint with limit=5 for autocomplete per research.md
      const params = new URLSearchParams({ q: query, limit: "5" });
      const res = await fetch(`/api/search?${params}`, {
        signal: abortControllerRef.current.signal,
      });

      if (res.ok) {
        const data: SearchResponse = await res.json();
        setSuggestions(data.results);
        setIsOpen(data.results.length > 0);
        setSelectedIndex(-1);
      }
    } catch (error) {
      // Ignore abort errors
      if (error instanceof Error && error.name !== "AbortError") {
        console.error("Autocomplete error:", error);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // T042: Debounce timer ref
  const debounceRef = React.useRef<NodeJS.Timeout | null>(null);

  // Handle input change with debouncing
  const handleChange = React.useCallback(
    (newValue: string) => {
      onChange(newValue);

      // Clear previous debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // T042: 150ms debounce per FR-014
      debounceRef.current = setTimeout(() => {
        fetchSuggestions(newValue);
      }, 150);
    },
    [onChange, fetchSuggestions],
  );

  // T044: Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && e.key !== KEYS.ArrowDown) {
      if (e.key === KEYS.Enter) {
        e.preventDefault();
        onSubmit?.();
      }
      return;
    }

    switch (e.key) {
      case KEYS.ArrowDown:
        e.preventDefault();
        if (isOpen) {
          setSelectedIndex((prev) =>
            prev < suggestions.length - 1 ? prev + 1 : prev,
          );
        } else if (value.length >= 2) {
          // Open dropdown on ArrowDown if query exists
          fetchSuggestions(value);
        }
        break;

      case KEYS.ArrowUp:
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;

      case KEYS.Enter:
        e.preventDefault();
        if (selectedIndex >= 0 && suggestions[selectedIndex]) {
          // Navigate to selected judge profile
          const judge = suggestions[selectedIndex];
          const url = buildJudgeUrl(judge);
          router.push(url);
          setIsOpen(false);
        } else {
          // Submit full search
          onSubmit?.();
          setIsOpen(false);
        }
        break;

      case KEYS.Escape:
        e.preventDefault();
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  // Build judge profile URL
  const buildJudgeUrl = (judge: SearchResult): string => {
    const stateSlug = judge.court.county.state.slug;
    const countySlug = judge.court.county.slug;
    const courtSlug = judge.court.slug;
    return `/judges/${stateSlug}/${countySlug}/${courtSlug}/${judge.slug}/`;
  };

  // T047: Highlight matching text in suggestion
  const highlightMatch = (text: string, query: string): React.ReactNode => {
    if (!query.trim()) return text;

    const regex = new RegExp(
      `(${query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`,
      "gi",
    );
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark
          key={i}
          className="bg-yellow-200 dark:bg-yellow-800 rounded px-0.5"
        >
          {part}
        </mark>
      ) : (
        part
      ),
    );
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current &&
        !inputRef.current.contains(e.target as Node) &&
        listboxRef.current &&
        !listboxRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, []);

  // T045: WAI-ARIA combobox pattern
  return (
    <div className={cn("relative", className)}>
      {/* Search Icon */}
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10"
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2}
        stroke="currentColor"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
        />
      </svg>

      {/* T045: Input with combobox role */}
      <input
        ref={inputRef}
        id={inputId}
        type="search"
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={() => {
          if (value.length >= 2 && suggestions.length > 0) {
            setIsOpen(true);
          }
        }}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-activedescendant={
          selectedIndex >= 0 ? `suggestion-${selectedIndex}` : undefined
        }
        aria-label="Search judges by name"
        className={cn(
          // Base input styles
          "h-10 w-full rounded-md border border-input bg-background text-foreground pl-10 pr-10 text-sm",
          // Focus states
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // Placeholder
          "placeholder:text-muted-foreground",
          // Transitions
          "transition-colors",
        )}
      />

      {/* Loading indicator */}
      {isLoading && (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      )}

      {/* Clear button when value exists */}
      {value && !isLoading && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setSuggestions([]);
            setIsOpen(false);
            inputRef.current?.focus();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Clear search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18 18 6M6 6l12 12"
            />
          </svg>
        </button>
      )}

      {/* T041, T045: Autocomplete dropdown with listbox role */}
      {isOpen && suggestions.length > 0 && (
        <ul
          ref={listboxRef}
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          className={cn(
            "absolute z-50 mt-1 w-full rounded-md border border-input bg-background shadow-lg",
            "max-h-60 overflow-auto list-none p-0 m-0",
          )}
        >
          {suggestions.map((judge, index) => (
            <li
              key={judge.id}
              id={`suggestion-${index}`}
              role="option"
              aria-selected={index === selectedIndex}
              onClick={() => {
                const url = buildJudgeUrl(judge);
                router.push(url);
                setIsOpen(false);
              }}
              onMouseEnter={() => setSelectedIndex(index)}
              className={cn(
                "flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm",
                "hover:bg-accent hover:text-accent-foreground",
                index === selectedIndex && "bg-accent text-accent-foreground",
                index !== suggestions.length - 1 && "border-b border-input/50",
              )}
            >
              <JudgeAvatar photoUrl={judge.photoUrl} fullName={judge.fullName} size="xs" />
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">
                  {highlightMatch(judge.fullName, value)}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 truncate">
                  {judge.court.type} · {judge.court.county.state.abbreviation}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
