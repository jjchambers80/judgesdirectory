# Implementation Plan: Design System — shadcn/ui + Tailwind CSS

**Feature Branch**: `005-design-system`
**Spec**: `specs/005-design-system/spec.md`
**Created**: 2026-03-01

## Overview

Wire up Tailwind CSS v4 and shadcn/ui so the 5 existing component files (`badge`, `button`, `card`, `input`, `table`) compile and render correctly. This is infrastructure-only — no existing component modifications, no new UI. The build must pass and dark mode must keep working.

## Technical Context

| Technology               | Version        | Status                                                                        |
| ------------------------ | -------------- | ----------------------------------------------------------------------------- |
| Next.js                  | 14.2.35        | Installed, working                                                            |
| Tailwind CSS             | 4.2.1          | In `package.json` — NOT configured (no PostCSS, no globals.css)               |
| @tailwindcss/postcss     | 4.2.1          | In `devDependencies` — NOT configured (no postcss config file)                |
| shadcn/ui                | new-york style | `components.json` present, 5 component files exist — BROKEN (missing imports) |
| clsx                     | 2.1.1          | Installed                                                                     |
| tailwind-merge           | 3.5.0          | Installed                                                                     |
| class-variance-authority | —              | **NOT INSTALLED** (imported by badge.tsx, button.tsx)                         |
| radix-ui                 | 1.4.3          | Installed                                                                     |

### Current Breakage Chain

```
src/components/ui/badge.tsx  ─┐
src/components/ui/button.tsx ─┤── import { cn } from "@/lib/utils"  ──→  FILE DOES NOT EXIST
src/components/ui/card.tsx   ─┤
src/components/ui/input.tsx  ─┤
src/components/ui/table.tsx  ─┘

src/components/ui/badge.tsx  ─┬── import { cva } from "class-variance-authority"  ──→  NOT IN package.json
src/components/ui/button.tsx ─┘
```

## Architecture

### CSS Entry Point (Single-File Strategy)

Per spec clarification: `globals.css` is the single CSS entry point. It imports `theme-vars.css` internally. The root layout imports only `globals.css`.

```
src/app/globals.css          ← Root layout imports this (replaces direct theme-vars.css import)
  ├── @import "tailwindcss/theme"     (Tailwind v4 theme layer)
  ├── @import "tailwindcss/utilities" (Tailwind v4 utility layer — NO preflight)
  ├── @import "./theme-vars.css"      (existing light/dark CSS custom properties)
  ├── @custom-variant dark ...        (wire [data-theme="dark"] to Tailwind dark: variant)
  ├── @theme inline { ... }           (bridge: Tailwind token names → existing --color-* vars)
  └── body { ... }                    (base body styles, moved from theme-vars.css)
```

### Preflight: Disabled

Per spec clarification: Tailwind's preflight CSS reset is **disabled** to prevent regressions on existing pages using browser defaults and inline styles. This is achieved by importing only `tailwindcss/theme` and `tailwindcss/utilities`, omitting `tailwindcss/preflight`.

### Dark Mode: data-theme Attribute

The existing `data-theme="dark"` attribute is preserved. Tailwind v4's `@custom-variant` directive wires the `dark:` utility prefix to this attribute:

```css
@custom-variant dark (&:where([data-theme="dark"], [data-theme="dark"] *));
```

### Bridge Layer: theme-vars → Tailwind Semantic Tokens

The 5 shadcn/ui components use these Tailwind color utilities (extracted via grep):

| Tailwind class prefix | Tokens used                                                                          |
| --------------------- | ------------------------------------------------------------------------------------ |
| `bg-*`                | background, card, primary, secondary, muted, accent, destructive, input, transparent |
| `text-*`              | foreground, primary, secondary, muted, accent, card, white                           |
| `border-*`            | border, input, ring, destructive, transparent                                        |
| `ring-*`              | ring, destructive                                                                    |

These map to Tailwind v4's `--color-*` namespace via `@theme inline`:

| Tailwind token                 | Maps to existing CSS variable   |
| ------------------------------ | ------------------------------- |
| `--color-background`           | `var(--color-bg-primary)`       |
| `--color-foreground`           | `var(--color-text-primary)`     |
| `--color-card`                 | `var(--color-surface)`          |
| `--color-card-foreground`      | `var(--color-text-primary)`     |
| `--color-primary`              | `var(--color-btn-primary)`      |
| `--color-primary-foreground`   | `var(--color-btn-primary-text)` |
| `--color-secondary`            | `var(--color-bg-secondary)`     |
| `--color-secondary-foreground` | `var(--color-text-secondary)`   |
| `--color-muted`                | `var(--color-bg-secondary)`     |
| `--color-muted-foreground`     | `var(--color-text-muted)`       |
| `--color-accent`               | `var(--color-bg-secondary)`     |
| `--color-accent-foreground`    | `var(--color-text-primary)`     |
| `--color-destructive`          | `var(--color-error-text)`       |
| `--color-input`                | `var(--color-input-border)`     |
| `--color-ring`                 | `var(--color-btn-primary)`      |

**Note on `--color-border`**: Our `theme-vars.css` already defines `--color-border` — the exact variable name Tailwind v4 expects for the `border-border` utility. Since `theme-vars.css` is imported after Tailwind's defaults, our value overrides Tailwind's default via CSS cascade. No bridge entry is needed.

### PostCSS Configuration

Tailwind CSS v4 uses `@tailwindcss/postcss` (already in `devDependencies`). A `postcss.config.mjs` is required:

```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

No separate `autoprefixer` entry is needed — Tailwind v4 includes vendor prefixing internally.

### cn() Utility

Standard shadcn/ui pattern. All 5 component files import `cn` from `@/lib/utils`:

```ts
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

## File Changes Summary

| Action        | File                       | Notes                                                         |
| ------------- | -------------------------- | ------------------------------------------------------------- |
| **Install**   | `class-variance-authority` | `npm install class-variance-authority`                        |
| **Create**    | `postcss.config.mjs`       | PostCSS config with `@tailwindcss/postcss`                    |
| **Create**    | `src/lib/utils.ts`         | `cn()` utility (clsx + tailwind-merge)                        |
| **Create**    | `src/app/globals.css`      | Tailwind imports, bridge layer, preflight disabled            |
| **Edit**      | `src/app/layout.tsx`       | Change `import "./theme-vars.css"` → `import "./globals.css"` |
| **Edit**      | `src/app/theme-vars.css`   | Remove `body {}` block (moved to globals.css)                 |
| **No change** | `src/components/ui/*.tsx`  | 5 component files stay as-is                                  |
| **No change** | All other components       | Existing inline-styled components untouched                   |

## Constitution Alignment

- **Principle V** (Simplicity): Minimal change set — only what's needed to unblock the 5 existing components.
- **Principle VI** (Explicit over Clever): Bridge layer uses direct `var()` references, no magic.
- **Principle III** (Ship Publicly): Build must pass (`npm run build`) — no broken deploys.

## Risks

| Risk                                                                  | Mitigation                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Tailwind v4 `@theme inline` with `var()` may not work as expected     | Test immediately after creating globals.css (T008)                                          |
| `--color-border` naming overlap between theme-vars and Tailwind       | CSS cascade handles it — theme-vars loaded after Tailwind defaults                          |
| Preflight removal may cause shadcn components to rely on reset styles | Check component rendering after build; components use utility classes, not browser defaults |
| Existing inline styles might conflict with Tailwind utilities         | Inline styles have higher specificity — no conflict expected                                |

## Out of Scope

- Migrating existing components from inline styles to Tailwind classes
- Storybook integration
- New UI components or pages
- Color palette redesign
- Typography plugin
