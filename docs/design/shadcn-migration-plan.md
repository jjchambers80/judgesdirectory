# shadcn/ui Migration Plan

**Last Updated**: 2026-03-01  
**Status**: Planning  
**Estimated Effort**: 3-5 days for full migration

## Overview

Migrate judgesdirectory.org from inline styles + CSS variables to shadcn/ui + Tailwind CSS for a more maintainable, consistent, and extensible design system.

## Why shadcn/ui

- **Not a component library**: Copy/paste components you own and can customize
- **Tailwind-native**: Uses Tailwind CSS for styling (utility-first)
- **Radix primitives**: Accessible, unstyled components as foundation
- **Theming built-in**: CSS variables for colors, dark mode support out of the box
- **Next.js optimized**: First-class support, tree-shaking, RSC compatible
- **Active ecosystem**: Popular choice for Next.js projects (2024-2026)

## Current State vs Target State

| Aspect            | Current                         | Target                           |
| ----------------- | ------------------------------- | -------------------------------- |
| Styling           | Inline styles + CSS vars        | Tailwind utility classes         |
| Component library | None (custom)                   | shadcn/ui                        |
| Theme system      | `theme-vars.css` + `data-theme` | Tailwind + CSS vars (compatible) |
| Dark mode         | Manual `data-theme` attribute   | Tailwind `dark:` variant         |
| Typography        | Inline font sizes               | Tailwind typography plugin       |

## Installation Steps

### Phase 1: Install Tailwind CSS

```bash
# 1. Install Tailwind and dependencies
npm install -D tailwindcss postcss autoprefixer

# 2. Initialize Tailwind config
npx tailwindcss init -p

# 3. Configure content paths in tailwind.config.js
```

**tailwind.config.js**:

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class", '[data-theme="dark"]'], // Support existing data-theme
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Map existing CSS vars to Tailwind (pending new palette)
        border: "var(--color-border)",
        background: "var(--color-bg-primary)",
        foreground: "var(--color-text-primary)",
        muted: {
          DEFAULT: "var(--color-bg-secondary)",
          foreground: "var(--color-text-muted)",
        },
        // ... additional mappings
      },
    },
  },
  plugins: [],
};
```

**src/app/globals.css** (create or update):

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Import existing theme variables */
@import "./theme-vars.css";
```

### Phase 2: Install shadcn/ui

```bash
# 1. Initialize shadcn/ui
npx shadcn@latest init

# Prompts:
# - TypeScript: Yes
# - Style: Default
# - Base color: Slate (or custom)
# - CSS variables: Yes
# - tailwind.config location: tailwind.config.js
# - Components location: src/components/ui
# - Utils location: src/lib/utils

# 2. Install individual components as needed
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add select
npx shadcn@latest add table
npx shadcn@latest add badge
npx shadcn@latest add card
npx shadcn@latest add dialog
npx shadcn@latest add dropdown-menu
npx shadcn@latest add checkbox
npx shadcn@latest add toast
```

### Phase 3: Migrate Components

## Component Migration Map

### Public Components

| Current Component | shadcn Components Needed | Migration Notes                       |
| ----------------- | ------------------------ | ------------------------------------- |
| `ThemeToggle`     | `Button` (icon variant)  | Keep custom logic, use Button styling |
| `Disclaimer`      | `Alert`                  | Map to warning variant                |
| `StateGrid`       | `Card`                   | Grid of cards with hover states       |

### Admin Components

| Current Component   | shadcn Components Needed               | Migration Notes          |
| ------------------- | -------------------------------------- | ------------------------ |
| `CsvUploader`       | `Input` (file), `Card`, `Progress`     | Drag-drop zone custom    |
| `ColumnMapper`      | `Select`, `Table`                      | Dropdown for each column |
| `ImportSummary`     | `Card`, `Badge`, `Table`               | Success/error badges     |
| `VerificationQueue` | `Table`, `Badge`, `Button`, `Checkbox` | Bulk selection           |
| `ProgressDashboard` | `Card`, `Progress`, `Badge`            | Stats cards              |
| `BulkCourtForm`     | `Select`, `Input`, `Button`            | Multi-select for courts  |

### SEO Components

| Current Component | Migration Notes         |
| ----------------- | ----------------------- |
| `JsonLd`          | No styling — keep as-is |

## shadcn Components to Install

Based on migration map, install these components:

```bash
npx shadcn@latest add alert badge button card checkbox \
  dialog dropdown-menu input progress select table toast
```

## Migration Strategy

### Option A: Big Bang (Not Recommended)

Migrate all components at once. High risk, hard to review.

### Option B: Incremental (Recommended)

```
Week 1: Foundation
├── Install Tailwind + shadcn/ui
├── Create globals.css with Tailwind directives
├── Verify existing pages still work (CSS vars still apply)
└── No component changes yet

Week 2: New Components Only
├── Use shadcn for any NEW components
├── Existing components unchanged
└── Establish patterns

Week 3-4: Migrate Existing
├── Migrate one component at a time
├── Start with low-risk: Disclaimer → Alert
├── Then cards: StateGrid
├── Then forms: admin components
└── Finally: ThemeToggle (most custom)
```

## File Structure After Migration

```
src/
├── components/
│   ├── ui/                    # shadcn components (auto-generated)
│   │   ├── alert.tsx
│   │   ├── badge.tsx
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── checkbox.tsx
│   │   ├── input.tsx
│   │   ├── progress.tsx
│   │   ├── select.tsx
│   │   ├── table.tsx
│   │   └── toast.tsx
│   ├── admin/                 # Migrated admin components
│   │   ├── csv-uploader.tsx   # Uses ui/input, ui/card
│   │   ├── column-mapper.tsx  # Uses ui/select, ui/table
│   │   └── ...
│   ├── theme-toggle.tsx       # Uses ui/button
│   ├── disclaimer.tsx         # Uses ui/alert
│   └── state-grid.tsx         # Uses ui/card
├── lib/
│   └── utils.ts               # cn() utility from shadcn
└── app/
    ├── globals.css            # Tailwind directives
    └── theme-vars.css         # Keep for CSS var definitions
```

## Theme Integration

### Preserve Existing Theme Variables

shadcn/ui uses CSS variables by default. We can map our existing `theme-vars.css` variables:

```css
/* src/app/globals.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* Map shadcn expected vars to our existing vars */
    --background: var(--color-bg-primary);
    --foreground: var(--color-text-primary);
    --muted: var(--color-bg-secondary);
    --muted-foreground: var(--color-text-muted);
    --border: var(--color-border);
    --input: var(--color-input-border);
    --primary: var(--color-btn-primary);
    --primary-foreground: var(--color-btn-primary-text);
    /* ... etc */
  }

  [data-theme="dark"] {
    /* Dark mode overrides already in theme-vars.css */
  }
}
```

### Dark Mode Strategy

shadcn/ui typically uses Tailwind's `dark:` variant with a `.dark` class. Our app uses `data-theme="dark"`. Two options:

**Option 1**: Keep `data-theme` (less disruption)

```javascript
// tailwind.config.js
darkMode: ["class", '[data-theme="dark"]'],
```

**Option 2**: Migrate to `class="dark"` (more conventional)

```javascript
// tailwind.config.js
darkMode: "class",
// Update ThemeToggle to toggle className instead of data-theme
```

**Recommendation**: Option 1 for minimal disruption.

## Dependencies Added

```json
{
  "dependencies": {
    "class-variance-authority": "^0.7.x",
    "clsx": "^2.x",
    "tailwind-merge": "^2.x",
    "@radix-ui/react-alert-dialog": "^1.x",
    "@radix-ui/react-checkbox": "^1.x",
    "@radix-ui/react-dialog": "^1.x",
    "@radix-ui/react-dropdown-menu": "^2.x",
    "@radix-ui/react-progress": "^1.x",
    "@radix-ui/react-select": "^2.x",
    "@radix-ui/react-slot": "^1.x"
  },
  "devDependencies": {
    "tailwindcss": "^3.4.x",
    "postcss": "^8.x",
    "autoprefixer": "^10.x",
    "tailwindcss-animate": "^1.x"
  }
}
```

## Success Criteria

- [ ] Tailwind CSS compiles without errors
- [ ] Existing pages render identically (visual regression)
- [ ] Dark mode continues to work via `data-theme`
- [ ] All shadcn components render correctly
- [ ] No inline `style={}` props remain in migrated components
- [ ] Bundle size does not increase significantly (tree-shaking works)

## Risks & Mitigations

| Risk                 | Mitigation                                           |
| -------------------- | ---------------------------------------------------- |
| Visual regressions   | Take before/after screenshots; use Storybook         |
| Bundle size increase | Monitor with `npm run build`; Tailwind purges unused |
| Dark mode breaks     | Test both themes after each component migration      |
| Learning curve       | Start with simple components (Disclaimer, Badge)     |

## Blockers / Prerequisites

- **New color palette**: Must be finalized before configuring Tailwind theme
- **Storybook**: Helpful for visual regression testing during migration

## Related Documents

- [storybook-plan.md](storybook-plan.md)
- `color-tokens.md` (pending)
- [theme-vars.css](../../src/app/theme-vars.css) — Current theme implementation
