# Component Contract: ThemeToggle

**Date**: 2026-02-18 | **File**: `src/components/ThemeToggle.tsx`

---

## Interface

```tsx
// No props — self-contained client component
export default function ThemeToggle(): JSX.Element;
```

## Behavior Contract

### Rendering

| Condition                        | Renders                                                      |
| -------------------------------- | ------------------------------------------------------------ |
| SSR / pre-hydration              | Empty `<button>` placeholder (36×36px, transparent, no icon) |
| Mounted, preference = `'light'`  | Sun icon (☀)                                                 |
| Mounted, preference = `'dark'`   | Moon icon (☽)                                                |
| Mounted, preference = `'system'` | Monitor icon (🖥)                                            |
| Hovered (any state)              | Subtle background highlight via `--color-toggle-hover`       |
| Keyboard-focused (any state)     | 2px solid outline in `--color-link` color, 2px offset        |

### Click Handler

```
Input:  current preference
Output: next preference (via CYCLE map)

Side effects:
  1. localStorage.setItem('theme', nextPreference)
  2. document.documentElement.dataset.theme = resolveTheme(nextPreference)
  3. React state update → re-render with new icon
```

### Accessibility

| Attribute    | Value                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------- |
| `role`       | implicit `button` (native `<button>` element)                                                                     |
| `aria-label` | Dynamic per state: "Light mode — click for dark", "Dark mode — click for system", "System mode — click for light" |
| `title`      | Same as `aria-label` (hover tooltip)                                                                              |
| Keyboard     | Focusable via Tab, activatable via Enter/Space (native button behavior)                                           |

### Layout

| Property | Value                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------- |
| Position | Flush-right in header (parent uses `display: flex; justify-content: space-between`)               |
| Size     | `36px × 36px` (padding `0.5rem` around `20×20` icon)                                              |
| Cursor   | `pointer`                                                                                         |
| Hover    | `background: var(--color-toggle-hover)`, `borderRadius: 0.375rem`                                 |
| Focus    | `outline: 2px solid var(--color-link)`, `outlineOffset: 2px` (keyboard only via `:focus-visible`) |

---

## Utility Contract: `src/lib/theme.ts`

### Exports

```ts
export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

export const THEME_STORAGE_KEY = "theme";

export const CYCLE: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};

export const LABELS: Record<ThemePreference, string> = {
  light: "Light mode — click for dark",
  dark: "Dark mode — click for system",
  system: "System mode — click for light",
};

export function getStoredPreference(): ThemePreference;
export function resolveTheme(pref: ThemePreference): ResolvedTheme;
export function applyTheme(pref: ThemePreference): void;
```

### Function Contracts

#### `getStoredPreference()`

- **Input**: None (reads `localStorage`)
- **Output**: `ThemePreference` — returns stored value if valid, `'system'` otherwise
- **Side effects**: None
- **SSR safe**: Returns `'system'` when `window` is undefined

#### `resolveTheme(pref)`

- **Input**: `ThemePreference`
- **Output**: `ResolvedTheme` (`'light'` or `'dark'`)
- **Logic**: If `'light'` or `'dark'`, return as-is. If `'system'`, check `matchMedia`.
- **SSR safe**: No — only call on client

#### `applyTheme(pref)`

- **Input**: `ThemePreference`
- **Output**: `void`
- **Side effects**: Sets `document.documentElement.dataset.theme`
- **SSR safe**: No — only call on client

---

## CSS Contract: `src/app/theme-vars.css`

### Custom Properties

```css
/* Available on all elements via inheritance */
--color-bg-primary      /* Page background */
--color-bg-secondary    /* Card/section background */
--color-text-primary    /* Body text */
--color-text-secondary  /* Secondary text */
--color-text-muted      /* Tertiary/muted text */
--color-link            /* Anchor text */
--color-border          /* Borders, dividers */
--color-surface         /* Elevated surface (cards, tiles) */
--color-toggle-hover    /* Toggle button hover background */

/* Admin / form tokens */
--color-input-border          /* Input/select borders */
--color-input-border-error    /* Input border on validation error */
--color-badge-success-bg      /* Verified badge background */
--color-badge-success-text    /* Verified badge text */
--color-badge-warning-bg      /* Unverified badge background */
--color-badge-warning-text    /* Unverified badge text */
--color-error-bg              /* Error message background */
--color-error-text            /* Error message text, required asterisk */
--color-btn-primary           /* Primary button background */
--color-btn-primary-disabled  /* Disabled button background */
--color-btn-primary-text      /* Button text */
```

### Selectors

| Selector                                                                  | Purpose            |
| ------------------------------------------------------------------------- | ------------------ |
| `:root, [data-theme="light"]`                                             | Light theme values |
| `[data-theme="dark"]`                                                     | Dark theme values  |
| `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) }` | No-JS fallback     |

### Body Styles

```css
body {
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  transition:
    background-color 0.2s ease,
    color 0.2s ease;
}
```

---

## Inline Script Contract: FOUC Prevention

**Location**: `<head>` in `src/app/layout.tsx`
**Execution**: Synchronous, blocking, before body paint
**Size**: < 250 bytes
**Logic**:

1. Read `localStorage.getItem('theme')`
2. If `'dark'` or `'light'` → use directly
3. Else → check `matchMedia('(prefers-color-scheme: dark)')` → `'dark'` if matches, `'light'` otherwise
4. Set `document.documentElement.dataset.theme = resolved`
5. Wrapped in `try/catch` for safety
