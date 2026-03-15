# Research: Global Footer with Disclaimer

**Feature**: `010-global-footer` | **Date**: 2026-03-14

## Research Tasks

### 1. Grey color values for disclaimer (WCAG AA compliant)

**Decision**: Use existing `--color-text-muted` for disclaimer text in both themes.

**Rationale**:
- Light mode: `--color-text-muted` is `#6b7280` (grey-500). Against `#ffffff` background, contrast ratio is 4.6:1 — passes WCAG AA for normal text (≥4.5:1).
- Dark mode: `--color-text-muted` is `#9ca3af` (grey-400). Against `#111827` background, contrast ratio is 7.2:1 — passes WCAG AA.
- Reusing existing theme tokens avoids introducing new custom properties and maintains consistency with other muted text on the site.

**Alternatives considered**:
- New custom `--color-footer-text` variable: Rejected — unnecessary when `text-muted` already achieves the desired visual weight and passes contrast requirements.
- Tailwind `text-gray-400` / `text-gray-500`: Rejected — the project uses CSS custom properties via theme-vars.css, not direct Tailwind color classes.

### 2. Sticky footer pattern (footer at viewport bottom on short pages)

**Decision**: Use CSS flexbox on `<body>` with `min-h-screen`, `flex`, `flex-col` and `flex-grow` on `<main>`.

**Rationale**:
- This is the standard modern CSS sticky footer pattern — no JavaScript required.
- `<body>` gets `min-h-screen flex flex-col`. `<main>` gets `flex-grow` (or `flex-1`).
- The header and footer naturally pin to top/bottom; main content fills remaining space.
- Next.js App Router renders directly into `<body>`, so this works without wrapper elements.

**Alternatives considered**:
- CSS Grid (`grid-template-rows: auto 1fr auto`): Equivalent approach, but flexbox is more commonly used and the layout is single-column, making flex the natural fit.
- Fixed/sticky positioning on footer: Rejected — the footer should scroll with content, not overlay it. It should only be at viewport bottom when content is short.
- JavaScript-based calculation: Rejected — unnecessary complexity; pure CSS solution is sufficient.

### 3. Disclaimer variable cleanup

**Decision**: Update `--color-disclaimer-bg`, `--color-disclaimer-border`, `--color-disclaimer-text` to grey values, then use them in the new SiteFooter component. This preserves backward compatibility if any other code references these variables.

**Rationale**:
- Light: `--color-disclaimer-bg: transparent`, `--color-disclaimer-border: #e5e7eb` (matches `--color-border`), `--color-disclaimer-text: #6b7280` (matches `--color-text-muted`).
- Dark: `--color-disclaimer-bg: transparent`, `--color-disclaimer-border: #374151` (matches `--color-border`), `--color-disclaimer-text: #9ca3af` (matches `--color-text-muted`).
- Alternatively, the SiteFooter can skip these custom properties entirely and just use `text-muted` + `border-border` Tailwind classes directly. This is simpler since the disclaimer variables would no longer serve a unique purpose.

**Alternatives considered**:
- Keep amber variables and override in component: Rejected — the spec explicitly requires grey styling.
- Delete disclaimer variables entirely: Possible but could break if anything else references them. Safer to update values to grey.

### 4. Component structure for SiteFooter

**Decision**: Single server component `SiteFooter.tsx` containing copyright line + disclaimer paragraph. No client-side interactivity needed.

**Rationale**:
- The footer has no interactive elements (no toggles, no forms, no dynamic state).
- Server component is the Next.js default and ensures SSR without hydration cost.
- Follows the same pattern as the project's other layout-level components.

**Alternatives considered**:
- Keep Disclaimer as a separate sub-component imported by SiteFooter: Rejected — unnecessary abstraction for a single paragraph of text. The spec explicitly states the Disclaimer is absorbed into the footer.

## Summary

All decisions resolved. No external research needed — this is a straightforward CSS/layout task using existing project patterns and well-established web techniques.
