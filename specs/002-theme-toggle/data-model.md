# Data Model: 002-theme-toggle

**Date**: 2025-02-18 | **Status**: Complete

---

## Overview

This feature has **no database entities**. All state is client-side only.

## Client-Side State

### localStorage

| Key     | Type     | Values                              | Default                          |
| ------- | -------- | ----------------------------------- | -------------------------------- |
| `theme` | `string` | `'light'` \| `'dark'` \| `'system'` | (absent — treated as `'system'`) |

### DOM State

| Attribute    | Element  | Values                | Set By                                                                   |
| ------------ | -------- | --------------------- | ------------------------------------------------------------------------ |
| `data-theme` | `<html>` | `'light'` \| `'dark'` | Inline `<head>` script (before paint), ThemeToggle component (on toggle) |

### Component State (ThemeToggle)

| State        | Type              | Purpose                                                      |
| ------------ | ----------------- | ------------------------------------------------------------ |
| `preference` | `ThemePreference` | Current user preference: `'light'` \| `'dark'` \| `'system'` |
| `mounted`    | `boolean`         | Whether component has hydrated (false during SSR)            |

## State Transitions

```
Initial load:
  <head> script → reads localStorage → resolves theme → sets data-theme

User clicks toggle:
  light → dark → system → light (cycle)

  On each click:
    1. Update React state (preference)
    2. Write to localStorage
    3. Set data-theme on <html>

System preference change (when preference === 'system'):
  matchMedia 'change' event → resolve 'system' → update data-theme
```

## Types

```ts
type ThemePreference = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";
```

## Validation Rules

- localStorage value must be one of `'light'`, `'dark'`, `'system'`, or absent
- Any other stored value is treated as `'system'` (graceful fallback)
- `data-theme` on `<html>` is always resolved to `'light'` or `'dark'` (never `'system'`)

## No Database Changes

- No Prisma schema changes
- No migrations
- No new tables, columns, or relations
