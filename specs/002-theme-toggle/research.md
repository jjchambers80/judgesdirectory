# Research: 002-theme-toggle

**Date**: 2026-02-18 | **Status**: Complete (updated post-clarify)

---

## 1. FOUC Prevention in Next.js 14 App Router

**Decision**: Use a synchronous inline `<script dangerouslySetInnerHTML>` in the `<head>` element of `src/app/layout.tsx`.

**Rationale**: In App Router there is no `_document.tsx`. The root layout returns `<html>` and `<head>` directly. A blocking IIFE script (~220 bytes minified) reads `localStorage`, resolves the theme, and sets `document.documentElement.dataset.theme` before the browser paints the body.

**Key requirements**:

- `suppressHydrationWarning` on `<html>` — server renders no `data-theme`, but the script sets it before hydration, causing a mismatch without this prop.
- No `async`, `defer`, or `type="module"` — must be synchronous.
- Wrap in `try/catch` for rare environments where `localStorage` is disabled.

**Alternatives considered**:

- `next-themes` library: Adds a dependency and complexity. Does the same thing internally but with more code. Rejected per Constitution V (Simplicity).
- Cookie-based theme detection on server: Adds server-side logic, Set-Cookie headers, middleware changes. Overkill for a client-side preference.

**Script template** (~220 bytes minified):

```js
(function () {
  try {
    var s = localStorage.getItem("theme");
    var t;
    if (s === "dark" || s === "light") {
      t = s;
    } else {
      t = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    }
    document.documentElement.dataset.theme = t;
  } catch (e) {}
})();
```

---

## 2. CSS Custom Properties for Theming

**Decision**: Define semantic CSS custom properties in `src/app/theme-vars.css` with selectors `:root` / `[data-theme="light"]` and `[data-theme="dark"]`.

**Rationale**: CSS custom properties are live bindings — when `data-theme` changes, all elements using `var()` update instantly, including those with inline styles. This allows the project to keep its inline-style approach while gaining theming support. Zero runtime cost; works with SSR.

**Naming convention**: `--color-{category}-{variant}`

| Current Value         | Variable                 | Light     | Dark      |
| --------------------- | ------------------------ | --------- | --------- |
| `white` (bg)          | `--color-bg-primary`     | `#ffffff` | `#111827` |
| `#f9fafb`             | `--color-bg-secondary`   | `#f9fafb` | `#1f2937` |
| `#374151` (body text) | `--color-text-primary`   | `#374151` | `#f3f4f6` |
| `#4b5563`             | `--color-text-secondary` | `#4b5563` | `#d1d5db` |
| `#6b7280` (muted)     | `--color-text-muted`     | `#6b7280` | `#9ca3af` |
| `#2563eb` (links)     | `--color-link`           | `#2563eb` | `#60a5fa` |
| `#e5e7eb` (borders)   | `--color-border`         | `#e5e7eb` | `#374151` |

**WCAG AA contrast** (dark theme):

- `#f3f4f6` on `#111827` → 15.4:1 (AAA)
- `#9ca3af` on `#111827` → 5.5:1 (AA)
- `#60a5fa` on `#111827` → 4.58:1 (AA)

**No-JS fallback**: `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])` selector ensures OS-preferred theme when JS is disabled.

**Alternatives considered**:

- CSS-in-JS (styled-components, emotion): Adds large runtime dependency. Rejected.
- CSS Modules per component: Major refactor, project uses inline styles throughout. Rejected.
- Tailwind CSS `dark:` variant: Would require adding Tailwind to the project and converting all inline styles. Rejected — too large a change for a theme toggle feature.

---

## 3. Three-State Toggle Implementation

**Decision**: Cycle `light → dark → system → light` via a single button click. Each state shows a distinct inline SVG icon (Sun / Moon / Monitor).

**Rationale**: Three states match the spec requirement. Single-click cycling is the simplest interaction pattern — no dropdown, no menu, no popover. Icons use `stroke="currentColor"` to inherit theme color automatically. No icon library dependency.

**Cycle logic**:

```ts
const CYCLE: Record<ThemePreference, ThemePreference> = {
  light: "dark",
  dark: "system",
  system: "light",
};
```

**Icon specifications** (20×20 viewBox, stroke-based, no fill):

- **Sun** (light mode): Circle center + 8 ray lines
- **Moon** (dark mode): Crescent path
- **Monitor** (system mode): Rectangle + stand

**Accessibility**: `aria-label` changes per state (e.g., "Light mode — click for dark"), `title` attribute provides hover tooltip.

**Hydration safety**: Component renders a fixed-size placeholder button until `useEffect` fires and reads `localStorage`. The blocking `<head>` script handles FOUC for the _page theme_; the icon appearing after hydration is acceptable (36×36px area, no layout shift).

**Alternatives considered**:

- Dropdown/select menu: More complex UI, requires positioning logic. Rejected per spec "icon only, no text."
- Two-state toggle (no system): Spec explicitly requires three states. Rejected.
- Icon library (lucide-react, heroicons): Adds dependency for 3 icons. Rejected per Constitution V.

---

## 4. CSS Variables in Inline React Styles

**Decision**: Replace hardcoded color strings with `var()` references in existing inline styles.

**Rationale**: `style={{ color: 'var(--color-text-primary)' }}` is fully valid in React. React passes the string verbatim to the DOM. The browser resolves CSS custom properties at render time. When `data-theme` changes, all elements update instantly — even those styled inline. Confirmed to work with SSR (server renders the literal `var()` string, browser resolves after CSS loads).

**Migration pattern**:

```tsx
// Before:
<p style={{ color: '#6b7280' }}>...</p>

// After:
<p style={{ color: 'var(--color-text-muted)' }}>...</p>
```

No structural changes needed. Find-and-replace across ~10 files (6 public + 4 admin).

**Alternatives considered**: None — this is the straightforward approach given the existing inline-style architecture.

---

## 5. Admin Page Color Audit

**Decision**: Include admin pages in the CSS variable migration. Admin pages use the same semantic tokens as public pages, plus additional status/form colors that need dark variants.

**Rationale**: Per clarification, admin pages receive full theme support. The admin panel shares the root layout (and thus the FOUC prevention script and `theme-vars.css`). The additional colors are form-specific (input borders, success/error badges, button states) that need new CSS custom properties.

**Admin-specific hardcoded colors discovered**:

| Color                             | Usage                      | Proposed Variable                                        |
| --------------------------------- | -------------------------- | -------------------------------------------------------- |
| `#d1d5db`                         | Input/select borders       | `--color-input-border`                                   |
| `#dcfce7` (bg) + `#166534` (text) | Verified/success badge     | `--color-badge-success-bg`, `--color-badge-success-text` |
| `#fef3c7` (bg) + `#92400e` (text) | Unverified/warning badge   | `--color-badge-warning-bg`, `--color-badge-warning-text` |
| `#fee2e2` (bg) + `#991b1b` (text) | Error message              | `--color-error-bg`, `--color-error-text`                 |
| `#fca5a5`                         | Error input border         | `--color-input-border-error`                             |
| `#dc2626`                         | Required field asterisk    | `--color-error-text` (reuse)                             |
| `#93c5fd`                         | Disabled button background | `--color-btn-primary-disabled`                           |
| `white` (button text)             | Primary button text        | `--color-btn-primary-text`                               |

**Dark variants** (Tailwind gray/green/amber/red scale):

| Variable                       | Light     | Dark      |
| ------------------------------ | --------- | --------- |
| `--color-input-border`         | `#d1d5db` | `#4b5563` |
| `--color-badge-success-bg`     | `#dcfce7` | `#14532d` |
| `--color-badge-success-text`   | `#166534` | `#86efac` |
| `--color-badge-warning-bg`     | `#fef3c7` | `#451a03` |
| `--color-badge-warning-text`   | `#92400e` | `#fde68a` |
| `--color-error-bg`             | `#fee2e2` | `#450a0a` |
| `--color-error-text`           | `#991b1b` | `#fca5a5` |
| `--color-input-border-error`   | `#fca5a5` | `#f87171` |
| `--color-btn-primary`          | `#2563eb` | `#3b82f6` |
| `--color-btn-primary-disabled` | `#93c5fd` | `#1e40af` |
| `--color-btn-primary-text`     | `#ffffff` | `#ffffff` |

**Alternatives considered**:

- Exclude admin pages: Rejected per user clarification — admin pages must receive the same migration.

---

## 6. Toggle Button Hover & Focus Styling

**Decision**: Add subtle background highlight on hover (`background-color` with low-opacity) and a visible 2px focus ring on keyboard focus (`:focus-visible` equivalent via inline styles + `onFocus`/`onBlur`).

**Rationale**: Per clarification, the toggle needs hover/focus visual feedback. A rounded-rect background change on hover signals interactivity. A visible focus ring is required for WCAG 2.1 SC 2.4.7 (Focus Visible). Using `:focus-visible` semantics ensures the ring only shows on keyboard navigation, not mouse clicks.

**Implementation pattern**:

```tsx
// Hover: managed via onMouseEnter/onMouseLeave + state
// Focus: managed via onFocus/onBlur + state, only for keyboard (using :focus-visible behavior)

const [hovered, setHovered] = useState(false);
const [focused, setFocused] = useState(false);

<button
  onMouseEnter={() => setHovered(true)}
  onMouseLeave={() => setHovered(false)}
  onFocus={(e) => {
    if (e.target.matches(":focus-visible")) setFocused(true);
  }}
  onBlur={() => setFocused(false)}
  style={{
    background: hovered ? "var(--color-toggle-hover)" : "none",
    outline: focused ? "2px solid var(--color-link)" : "none",
    outlineOffset: "2px",
    borderRadius: "0.375rem",
    // ... rest of styles
  }}
/>;
```

**CSS variables needed**:
| Variable | Light | Dark |
|---|---|---|
| `--color-toggle-hover` | `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.1)` |

**Alternatives considered**:

- CSS-only hover (add a small CSS rule): Would work but project convention is inline styles. Keeping consistency.
- No hover feedback: Rejected per clarification — user explicitly requested it.
- Color-shift on hover: More complex, less standard than background highlight. Rejected.

---

## 7. System Theme Change Listener

**Decision**: Use `window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', handler)` in a `useEffect` that only activates when preference is `'system'`.

**Rationale**: Modern API, supported by all target browsers (Chrome 56+, Firefox 59+, Safari 14+, Edge 79+). Fires when the user changes OS appearance settings. Cleanup removes listener when preference changes away from 'system' or component unmounts.

**Pattern**:

```ts
useEffect(() => {
  if (preference !== "system") return;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const handler = () => {
    document.documentElement.dataset.theme = mql.matches ? "dark" : "light";
  };
  handler(); // Apply immediately
  mql.addEventListener("change", handler);
  return () => mql.removeEventListener("change", handler);
}, [preference]);
```

**Alternatives considered**:

- Polling `matchMedia` on interval: Wasteful, unnecessary when event-based API exists. Rejected.
- `addListener()` (deprecated): Was needed for Safari <14, no longer in support matrix. Rejected.

---

## Architecture Summary

```
1. Inline <script> in <head>       → Sets data-theme before first paint (FOUC prevention)
2. theme-vars.css                   → CSS custom properties keyed to [data-theme]
3. Inline styles: var(--color-*)    → All components use CSS vars in style={{}}
4. ThemeToggle client component     → Cycles preference, localStorage, data-theme, matchMedia
```

**Zero new npm dependencies.** Platform APIs only: `localStorage`, `matchMedia`, CSS custom properties, inline SVG.
