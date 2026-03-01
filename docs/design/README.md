# Design System Documentation

**Last Updated**: 2026-03-01  
**Status**: Planning

This folder contains design system documentation for judgesdirectory.org.

## Contents

- [storybook-plan.md](storybook-plan.md) — Plan for adding Storybook component documentation
- [shadcn-migration-plan.md](shadcn-migration-plan.md) — Plan for migrating to shadcn/ui + Tailwind CSS
- [color-tokens.md](color-tokens.md) — Blue palette and design tokens (WCAG AA compliant)

## Current State

The application currently uses:

- **Inline styles** with CSS custom properties
- **CSS variables** defined in `src/app/theme-vars.css`
- **No UI framework** (no Tailwind, no component library)
- **9 custom components** across public and admin sections

## Planned Changes

1. **Storybook** — Interactive component documentation and playground
2. **shadcn/ui + Tailwind** — Component library migration for consistency and maintainability
3. **New color palette** — ✅ Documented in [color-tokens.md](color-tokens.md)

## Migration Sequence

```
1. Finalize new color palette → document in color-tokens.md
2. Install Storybook → document existing components
3. Install Tailwind CSS → update build config
4. Install shadcn/ui → migrate components incrementally
5. Update Storybook stories with new components
```
