# Color Token Contract: Theme Variables

**Date**: 2026-02-18 (updated post-clarify)

---

## Token Mapping

Maps hardcoded color values used across the codebase to semantic CSS custom properties.

### Light Theme (default)

| Token          | CSS Variable             | Value     | Usage                                  |
| -------------- | ------------------------ | --------- | -------------------------------------- |
| bg-primary     | `--color-bg-primary`     | `#ffffff` | Page background, card backgrounds      |
| bg-secondary   | `--color-bg-secondary`   | `#f9fafb` | Section backgrounds, alternative rows  |
| text-primary   | `--color-text-primary`   | `#374151` | Body text, headings                    |
| text-secondary | `--color-text-secondary` | `#4b5563` | Subheadings, secondary content         |
| text-muted     | `--color-text-muted`     | `#6b7280` | Timestamps, captions, placeholder text |
| link           | `--color-link`           | `#2563eb` | Clickable links                        |
| border         | `--color-border`         | `#e5e7eb` | Borders, dividers, grid lines          |
| surface        | `--color-surface`        | `#ffffff` | Card/tile surfaces                     |

### Dark Theme

| Token          | CSS Variable             | Value     | Contrast on #111827 |
| -------------- | ------------------------ | --------- | ------------------- |
| bg-primary     | `--color-bg-primary`     | `#111827` | — (background)      |
| bg-secondary   | `--color-bg-secondary`   | `#1f2937` | — (background)      |
| text-primary   | `--color-text-primary`   | `#f3f4f6` | 15.4:1 (AAA)        |
| text-secondary | `--color-text-secondary` | `#d1d5db` | 10.3:1 (AAA)        |
| text-muted     | `--color-text-muted`     | `#9ca3af` | 5.5:1 (AA)          |
| link           | `--color-link`           | `#60a5fa` | 4.58:1 (AA)         |
| border         | `--color-border`         | `#374151` | — (decorative)      |
| surface        | `--color-surface`        | `#1f2937` | — (background)      |

### File-by-File Migration

#### Public Pages

| File                                                               | Hardcoded Values to Replace                                      |
| ------------------------------------------------------------------ | ---------------------------------------------------------------- |
| `src/app/layout.tsx`                                               | `#e5e7eb` → `var(--color-border)`, `white` → (use CSS body rule) |
| `src/app/judges/page.tsx`                                          | `#374151`, `#6b7280`, `#2563eb`, `#e5e7eb`                       |
| `src/app/judges/[state]/page.tsx`                                  | `#374151`, `#6b7280`, `#2563eb`, `#e5e7eb`                       |
| `src/app/judges/[state]/[county]/page.tsx`                         | `#374151`, `#6b7280`, `#2563eb`, `#e5e7eb`                       |
| `src/app/judges/[state]/[county]/[courtType]/page.tsx`             | `#374151`, `#6b7280`, `#2563eb`, `#e5e7eb`, `#4b5563`            |
| `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` | `#374151`, `#6b7280`, `#2563eb`, `#e5e7eb`, `#4b5563`, `#f9fafb` |
| `src/app/not-found.tsx`                                            | `#374151`, `#6b7280`, `#2563eb`                                  |
| `src/components/StateGrid.tsx`                                     | `#e5e7eb`, `#4b5563`, `white`, `#f9fafb`                         |
| `src/components/Disclaimer.tsx`                                    | `#92400e`, `#fffbeb`, `#fef3c7`                                  |

#### Admin Pages

| File                                | Hardcoded Values to Replace                                                                                                                                                                                                         |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/admin/layout.tsx`          | `#2563eb` (links, nav border)                                                                                                                                                                                                       |
| `src/app/admin/page.tsx`            | `#6b7280` (text), `#e5e7eb` (card border), `white` (card bg)                                                                                                                                                                        |
| `src/app/admin/judges/page.tsx`     | `#2563eb` (button bg, links), `#d1d5db` (input borders), `#e5e7eb` (table borders), `#6b7280` (muted text), `#dcfce7`/`#166534` (success badge), `#fef3c7`/`#92400e` (warning badge), `#fca5a5` (delete border)                     |
| `src/app/admin/judges/new/page.tsx` | `#d1d5db`/`#fca5a5` (input borders), `#dcfce7`/`#166534` (success msg), `#fee2e2`/`#991b1b` (error msg), `#e5e7eb` (fieldset borders), `#dc2626` (required asterisk), `#2563eb`/`#93c5fd` (button/disabled), `#6b7280` (muted text) |

### Disclaimer Component — Special Colors

The Disclaimer uses amber/warning colors that also need dark variants:

| Light              | Dark      | Variable                    |
| ------------------ | --------- | --------------------------- |
| `#fffbeb` (bg)     | `#451a03` | `--color-disclaimer-bg`     |
| `#fef3c7` (border) | `#78350f` | `--color-disclaimer-border` |
| `#92400e` (text)   | `#fde68a` | `--color-disclaimer-text`   |

### Admin / Form Component Tokens

| Light     | Dark      | Variable                       | Usage                                 |
| --------- | --------- | ------------------------------ | ------------------------------------- |
| `#d1d5db` | `#4b5563` | `--color-input-border`         | Input/select borders                  |
| `#fca5a5` | `#f87171` | `--color-input-border-error`   | Input border on validation error      |
| `#dcfce7` | `#14532d` | `--color-badge-success-bg`     | Verified badge background             |
| `#166534` | `#86efac` | `--color-badge-success-text`   | Verified badge text                   |
| `#fef3c7` | `#451a03` | `--color-badge-warning-bg`     | Unverified badge background           |
| `#92400e` | `#fde68a` | `--color-badge-warning-text`   | Unverified badge text                 |
| `#fee2e2` | `#450a0a` | `--color-error-bg`             | Error message background              |
| `#991b1b` | `#fca5a5` | `--color-error-text`           | Error message text, required asterisk |
| `#2563eb` | `#3b82f6` | `--color-btn-primary`          | Primary button background             |
| `#93c5fd` | `#1e40af` | `--color-btn-primary-disabled` | Disabled button background            |
| `#ffffff` | `#ffffff` | `--color-btn-primary-text`     | Button text (white in both themes)    |

### Toggle Button Interaction Tokens

| Light                 | Dark                       | Variable               | Usage                          |
| --------------------- | -------------------------- | ---------------------- | ------------------------------ |
| `rgba(0, 0, 0, 0.06)` | `rgba(255, 255, 255, 0.1)` | `--color-toggle-hover` | Toggle button hover background |
