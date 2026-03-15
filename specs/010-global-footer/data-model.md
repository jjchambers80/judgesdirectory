# Data Model: Global Footer with Disclaimer

**Feature**: `010-global-footer` | **Date**: 2026-03-14

## Entities

No new data entities. This feature is a pure UI/layout change with no database interaction.

## CSS Custom Properties (updated)

The following existing CSS custom properties are updated from amber to grey:

| Variable | Light (current) | Light (new) | Dark (current) | Dark (new) |
|----------|-----------------|-------------|-----------------|------------|
| `--color-disclaimer-bg` | `#fffbeb` | `transparent` | `#451a03` | `transparent` |
| `--color-disclaimer-border` | `#fef3c7` | `#e5e7eb` | `#78350f` | `#374151` |
| `--color-disclaimer-text` | `#92400e` | `#6b7280` | `#fde68a` | `#9ca3af` |

New border and text values align with existing `--color-border` and `--color-text-muted` tokens respectively.

## State Transitions

N/A — no stateful behavior.

## Validation Rules

- Copyright year: dynamically computed, always valid
- Disclaimer text: static string, no user input
