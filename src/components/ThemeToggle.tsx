"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  type ThemePreference,
  CYCLE,
  LABELS,
  THEME_STORAGE_KEY,
  getStoredPreference,
  applyTheme,
} from "@/lib/theme";

/* ── Inline SVG Icons (20×20, stroke-based) ── */

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="4" />
      <line x1="10" y1="1" x2="10" y2="3" />
      <line x1="10" y1="17" x2="10" y2="19" />
      <line x1="3.64" y1="3.64" x2="5.05" y2="5.05" />
      <line x1="14.95" y1="14.95" x2="16.36" y2="16.36" />
      <line x1="1" y1="10" x2="3" y2="10" />
      <line x1="17" y1="10" x2="19" y2="10" />
      <line x1="3.64" y1="16.36" x2="5.05" y2="14.95" />
      <line x1="14.95" y1="5.05" x2="16.36" y2="3.64" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17.39 12.24A8 8 0 0 1 7.76 2.61a8 8 0 1 0 9.63 9.63z" />
    </svg>
  );
}

function MonitorIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="3" width="16" height="11" rx="1" />
      <line x1="7" y1="17" x2="13" y2="17" />
      <line x1="10" y1="14" x2="10" y2="17" />
    </svg>
  );
}

const ICONS: Record<ThemePreference, () => JSX.Element> = {
  light: SunIcon,
  dark: MoonIcon,
  system: MonitorIcon,
};

/* ── ThemeToggle Component ── */

export default function ThemeToggle() {
  const [preference, setPreference] = useState<ThemePreference>("system");
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Initialize from localStorage after mount
  useEffect(() => {
    setPreference(getStoredPreference());
    setMounted(true);
  }, []);

  // Apply theme whenever preference changes (after mount)
  useEffect(() => {
    if (!mounted) return;
    applyTheme(preference);
  }, [preference, mounted]);

  // Listen for OS theme changes when in system mode
  useEffect(() => {
    if (!mounted || preference !== "system") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      document.documentElement.dataset.theme = mql.matches ? "dark" : "light";
    };
    handler(); // Apply immediately
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [preference, mounted]);

  const handleClick = useCallback(() => {
    const next = CYCLE[preference];
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
    setPreference(next);
  }, [preference]);

  const label = LABELS[preference];
  const Icon = mounted ? ICONS[preference] : null;

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={label}
      title={label}
      className={cn(
        "flex items-center justify-center w-11 h-11 p-2 border-none rounded-md",
        "text-foreground cursor-pointer transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        hovered ? "bg-toggle-hover" : "bg-transparent",
      )}
    >
      {Icon ? <Icon /> : null}
    </button>
  );
}
