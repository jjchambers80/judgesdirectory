export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export const CYCLE: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export const LABELS: Record<ThemePreference, string> = {
  light: "Light mode \u2014 click for dark",
  dark: "Dark mode \u2014 click for system",
  system: "System mode \u2014 click for light",
};

const VALID_PREFERENCES: ReadonlySet<string> = new Set([
  "light",
  "dark",
  "system",
]);

/**
 * Read the stored theme preference from localStorage.
 * Returns 'system' if nothing stored, invalid value, or SSR.
 */
export function getStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored && VALID_PREFERENCES.has(stored)) {
      return stored as ThemePreference;
    }
  } catch {
    // localStorage disabled or unavailable
  }
  return "system";
}

/**
 * Resolve a preference to an actual light/dark value.
 * For 'system', checks OS preference via matchMedia.
 * Client-only — do not call during SSR.
 */
export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === "light" || pref === "dark") return pref;
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

/**
 * Apply the resolved theme to the document root element.
 * Sets data-theme attribute which triggers CSS variable switching.
 * Client-only — do not call during SSR.
 */
export function applyTheme(pref: ThemePreference): void {
  document.documentElement.dataset.theme = resolveTheme(pref);
}
