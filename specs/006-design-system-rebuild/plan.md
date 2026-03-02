# Implementation Plan: Design System Rebuild — Mobile-First, ADA-Compliant Layouts

**Feature Branch**: `006-design-system-rebuild`
**Spec**: `specs/006-design-system-rebuild/spec.md`
**Created**: 2026-03-01

## Overview

Migrate all 21 component and page files from inline `style={{}}` objects to Tailwind utility classes with design system semantic tokens. Add mobile-first responsive layouts across all pages and WCAG 2.1 AA accessibility features (skip nav, breadcrumb ARIA, focus indicators, form error associations). Adopt the 5 existing shadcn/ui components (`Badge`, `Button`, `Card`, `Input`, `Table`) where they replace raw HTML equivalents.

## Technical Context

| Technology               | Version   | Status                                   |
| ------------------------ | --------- | ---------------------------------------- |
| Next.js                  | 14.2.35   | Installed, working                       |
| Tailwind CSS             | 4.2.1     | Configured via globals.css (feature 005) |
| shadcn/ui                | new-york  | 5 components present and functional      |
| class-variance-authority | installed | Used by Badge, Button                    |
| clsx + tailwind-merge    | installed | `cn()` utility in `src/lib/utils.ts`     |
| radix-ui                 | 1.4.3     | Installed (used by Button, Badge)        |

### Current State

- **21 files** use 100% inline `style={{}}` objects with `var(--color-*)` CSS variables
- **Zero Tailwind classes** in any existing component (only in the 5 shadcn/ui primitives)
- **No responsive layouts** — fixed pixel values, no breakpoint adaptations
- **Accessibility gaps**: no skip nav, no breadcrumb ARIA, no `aria-describedby` on form errors, no `aria-current="page"` on breadcrumbs
- **Hardcoded hex colors** in judge profile page (~7 values)
- **Bridge layer** in globals.css covers 15 semantic tokens — needs extension for badge/warning/success/disclaimer/link tokens

## Architecture

### CSS Strategy

```
src/app/globals.css (EDIT — extend)
  ├── @theme inline { ... }      ← Add ~13 new bridge tokens (FR-029)
  ├── @layer base { ... }        ← Add typography base styles (FR-028)
  └── (existing content unchanged)
```

### New Bridge Tokens (FR-029)

| Tailwind token                 | Maps to existing CSS variable       |
| ------------------------------ | ----------------------------------- |
| `--color-link`                 | `var(--color-link)`                 |
| `--color-disclaimer-bg`        | `var(--color-disclaimer-bg)`        |
| `--color-disclaimer-border`    | `var(--color-disclaimer-border)`    |
| `--color-disclaimer-text`      | `var(--color-disclaimer-text)`      |
| `--color-badge-success-bg`     | `var(--color-badge-success-bg)`     |
| `--color-badge-success-text`   | `var(--color-badge-success-text)`   |
| `--color-badge-warning-bg`     | `var(--color-badge-warning-bg)`     |
| `--color-badge-warning-text`   | `var(--color-badge-warning-text)`   |
| `--color-error-bg`             | `var(--color-error-bg)`             |
| `--color-error-text`           | `var(--color-error-text)`           |
| `--color-btn-primary-disabled` | `var(--color-btn-primary-disabled)` |
| `--color-toggle-hover`         | `var(--color-toggle-hover)`         |
| `--color-input-border-error`   | `var(--color-input-border-error)`   |

### Typography Base Layer (FR-028)

```css
@layer base {
  h1 {
    @apply text-2xl font-bold tracking-tight md:text-3xl;
  }
  h2 {
    @apply text-xl font-semibold tracking-tight md:text-2xl;
  }
  h3 {
    @apply text-lg font-semibold;
  }
  h4 {
    @apply text-base font-semibold;
  }
  h5 {
    @apply text-sm font-semibold;
  }
  h6 {
    @apply text-xs font-semibold;
  }
  p {
    @apply leading-relaxed;
  }
  a {
    @apply text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2;
  }
}
```

### Skip Navigation Pattern (FR-009)

Added to `src/app/layout.tsx` as the first child of `<body>`:

```tsx
<a
  href="#main-content"
  className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
>
  Skip to main content
</a>
```

### Responsive Grid Pattern

All card grids use the same mobile-first pattern:

```
grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4
```

### Breadcrumb Pattern (FR-010)

```tsx
<nav aria-label="Breadcrumb">
  <ol className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
    <li>
      <Link href="..." className="hover:text-foreground transition-colors">
        ...
      </Link>
    </li>
    <li aria-hidden="true">/</li>
    <li>
      <span aria-current="page" className="text-foreground font-medium">
        Current
      </span>
    </li>
  </ol>
</nav>
```

### shadcn/ui Adoption Map

| Current raw element                              | Replace with shadcn        | Where used                                             |
| ------------------------------------------------ | -------------------------- | ------------------------------------------------------ |
| `<button style={{...}}>`                         | `<Button>`                 | Admin forms, pagination, actions                       |
| `<input style={{...}}>`                          | `<Input>`                  | Admin forms, search fields                             |
| `<table style={{...}}>`                          | `<Table>` + sub-components | Admin judges list, verification queue, import          |
| Card-like `<div>` / `<Link>` with border+padding | `<Card>` + sub-components  | State grid, county cards, court cards, admin dashboard |
| Status `<span>` with colored bg                  | `<Badge>`                  | Judge status indicators                                |

## File Changes Summary

| Action   | File                                                               | Notes                                            |
| -------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| **Edit** | `src/app/globals.css`                                              | Extend bridge layer + add typography base layer  |
| **Edit** | `src/app/layout.tsx`                                               | Skip nav, responsive header, Tailwind classes    |
| **Edit** | `src/app/not-found.tsx`                                            | Tailwind classes, centered layout                |
| **Edit** | `src/app/judges/page.tsx`                                          | Tailwind classes, responsive layout              |
| **Edit** | `src/app/judges/[state]/page.tsx`                                  | Tailwind, breadcrumb ARIA, responsive grid       |
| **Edit** | `src/app/judges/[state]/[county]/page.tsx`                         | Tailwind, breadcrumb ARIA, responsive grid       |
| **Edit** | `src/app/judges/[state]/[county]/[courtType]/page.tsx`             | Tailwind, breadcrumb ARIA, responsive grid       |
| **Edit** | `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` | Tailwind, hex→tokens, responsive profile         |
| **Edit** | `src/app/admin/layout.tsx`                                         | Tailwind nav with flex-wrap                      |
| **Edit** | `src/app/admin/page.tsx`                                           | Tailwind classes, Card components                |
| **Edit** | `src/app/admin/dashboard/page.tsx`                                 | Tailwind classes                                 |
| **Edit** | `src/app/admin/courts/page.tsx`                                    | Tailwind classes                                 |
| **Edit** | `src/app/admin/import/page.tsx`                                    | Tailwind classes, form layout                    |
| **Edit** | `src/app/admin/verification/page.tsx`                              | Tailwind classes                                 |
| **Edit** | `src/app/admin/judges/page.tsx`                                    | Tailwind, Table component, responsive            |
| **Edit** | `src/app/admin/judges/new/page.tsx`                                | Tailwind, Input/Button, form layout, ARIA errors |
| **Edit** | `src/components/StateGrid.tsx`                                     | Card component, responsive grid                  |
| **Edit** | `src/components/Disclaimer.tsx`                                    | Tailwind classes, preserve ARIA                  |
| **Edit** | `src/components/ThemeToggle.tsx`                                   | Tailwind classes, preserve functionality         |
| **Edit** | `src/components/admin/ProgressDashboard.tsx`                       | Tailwind, responsive grid, Table component       |
| **Edit** | `src/components/admin/BulkCourtForm.tsx`                           | Tailwind, Input/Button, form ARIA                |
| **Edit** | `src/components/admin/CsvUploader.tsx`                             | Tailwind, responsive drop zone                   |
| **Edit** | `src/components/admin/ColumnMapper.tsx`                            | Tailwind, Table component                        |
| **Edit** | `src/components/admin/ImportSummary.tsx`                           | Tailwind, Card/Badge, responsive grid            |
| **Edit** | `src/components/admin/VerificationQueue.tsx`                       | Tailwind, Table/Button/Badge, responsive         |

## Risks

| Risk                                                                       | Mitigation                                                                   |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| New bridge tokens may conflict with Tailwind's internal names              | Use unique names matching existing CSS variables (all start with `--color-`) |
| Typography base layer may change existing heading sizes                    | Test each page for visual regressions after adding `@layer base`             |
| shadcn Card adoption may change spacing/borders subtly                     | Compare before/after screenshots of key pages                                |
| Large components (VerificationQueue 544 lines) may have many inline styles | Migrate methodically — each `style={{}}` block becomes Tailwind classes      |
| Form ARIA additions may break existing test selectors                      | No automated tests exist — low risk                                          |

## Out of Scope

- New pages or features
- Data model changes or API endpoint changes
- Storybook integration
- Installing additional shadcn/ui components beyond the existing 5
- Color palette redesign (existing tokens are preserved)
- Server/client component boundary changes
