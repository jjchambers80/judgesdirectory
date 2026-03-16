import { useState, useCallback } from "react";
import type { VisibilityState } from "@tanstack/react-table";

/**
 * Column visibility state persisted to sessionStorage.
 * Reads initial state from sessionStorage on mount, writes on every change.
 */
export function useColumnVisibility(
  tableKey: string,
  defaultVisibility: VisibilityState = {},
): [VisibilityState, React.Dispatch<React.SetStateAction<VisibilityState>>] {
  const [visibility, setVisibilityRaw] = useState<VisibilityState>(() => {
    if (typeof window === "undefined") return defaultVisibility;
    try {
      const stored = sessionStorage.getItem(`col-vis:${tableKey}`);
      if (stored) return JSON.parse(stored) as VisibilityState;
    } catch {
      // ignore parse errors
    }
    return defaultVisibility;
  });

  const setVisibility: React.Dispatch<React.SetStateAction<VisibilityState>> =
    useCallback(
      (action) => {
        setVisibilityRaw((prev) => {
          const next = typeof action === "function" ? action(prev) : action;
          try {
            sessionStorage.setItem(`col-vis:${tableKey}`, JSON.stringify(next));
          } catch {
            // ignore quota errors
          }
          return next;
        });
      },
      [tableKey],
    );

  return [visibility, setVisibility];
}
