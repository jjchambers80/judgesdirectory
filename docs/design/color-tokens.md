# Color Tokens

**Last Updated**: 2026-03-01  
**Status**: Draft

## Blue Palette (WCAG AA Compliant)

Curated blue scale optimized for both light and dark themes with WCAG AA contrast compliance.

### Primary Blues

| Token      | Hex       | Usage                          | Light BG Contrast  | Dark BG Contrast   |
| ---------- | --------- | ------------------------------ | ------------------ | ------------------ |
| `blue-50`  | `#eff6ff` | Light tint/hover bg            | N/A (bg only)      | N/A                |
| `blue-100` | `#dbeafe` | Light accent bg                | N/A (bg only)      | N/A                |
| `blue-400` | `#60a5fa` | Link/interactive (dark theme)  | 2.4:1 ❌           | **7.5:1** ✅       |
| `blue-500` | `#3b82f6` | Accent/hover                   | 3.4:1 (large only) | 5.5:1 ✅           |
| `blue-600` | `#2563eb` | Primary button                 | **4.5:1** ✅       | 4.0:1 (large only) |
| `blue-700` | `#1d4ed8` | Link/interactive (light theme) | **6.0:1** ✅       | 2.9:1 ❌           |
| `blue-800` | `#1e40af` | Dark accent                    | **8.5:1** ✅       | 2.1:1 ❌           |
| `blue-900` | `#1e3a8a` | Darkest text                   | **10.5:1** ✅      | 1.7:1 ❌           |

### Recommended Usage

```css
:root,
[data-theme="light"] {
  /* Links & interactive elements */
  --color-link: #1d4ed8; /* blue-700: 6.0:1 on white */
  --color-link-hover: #1e40af; /* blue-800: darker on hover */

  /* Primary buttons */
  --color-btn-primary: #2563eb; /* blue-600: 4.5:1 on white */
  --color-btn-primary-hover: #1d4ed8;

  /* Focus rings */
  --color-focus-ring: #3b82f6; /* blue-500: visible but not text */

  /* Accent backgrounds */
  --color-accent-bg: #eff6ff; /* blue-50 */
  --color-accent-border: #dbeafe; /* blue-100 */
}

[data-theme="dark"] {
  /* Links & interactive elements */
  --color-link: #60a5fa; /* blue-400: 7.5:1 on #111827 */
  --color-link-hover: #93c5fd; /* blue-300: lighter on hover */

  /* Primary buttons */
  --color-btn-primary: #3b82f6; /* blue-500: 5.5:1 on dark */
  --color-btn-primary-hover: #60a5fa;

  /* Focus rings */
  --color-focus-ring: #60a5fa; /* blue-400 */

  /* Accent backgrounds */
  --color-accent-bg: #1e3a8a; /* blue-900 */
  --color-accent-border: #1e40af; /* blue-800 */
}
```

### Contrast Reference

**Light theme** (against `#ffffff` white):
| Color | Ratio | AA Normal | AA Large | AAA Normal |
|-------|-------|-----------|----------|------------|
| `#1d4ed8` | 6.0:1 | ✅ | ✅ | ✅ |
| `#2563eb` | 4.5:1 | ✅ | ✅ | ❌ |
| `#3b82f6` | 3.4:1 | ❌ | ✅ | ❌ |

**Dark theme** (against `#111827` dark bg):
| Color | Ratio | AA Normal | AA Large | AAA Normal |
|-------|-------|-----------|----------|------------|
| `#60a5fa` | 7.5:1 | ✅ | ✅ | ✅ |
| `#93c5fd` | 10.1:1 | ✅ | ✅ | ✅ |
| `#3b82f6` | 5.5:1 | ✅ | ✅ | ✅ |

### Quick Reference (Copy-Paste)

```
Light theme links:  #1d4ed8
Light theme buttons: #2563eb
Dark theme links:   #60a5fa
Dark theme buttons: #3b82f6
Focus rings:        #3b82f6 (light) / #60a5fa (dark)
```

### Tailwind Mapping

These colors align with Tailwind's blue scale for easy migration:

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb", // blue-600
          light: "#60a5fa", // blue-400 (for dark mode)
          dark: "#1d4ed8", // blue-700 (for light mode links)
        },
      },
    },
  },
};
```

## Next Steps

1. Review these blues with any brand guidelines
2. Update `src/app/theme-vars.css` with new values
3. Test in Storybook once installed
4. Verify contrast with real content

## Related

- [shadcn-migration-plan.md](shadcn-migration-plan.md) — Will use these tokens
- [storybook-plan.md](storybook-plan.md) — Visual testing of colors
