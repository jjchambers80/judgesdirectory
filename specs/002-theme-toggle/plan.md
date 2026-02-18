# Implementation Plan: Theme Toggle

**Branch**: `002-theme-toggle` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-theme-toggle/spec.md`

**Note**: Updated after `/speckit.clarify` — admin pages included in scope, hover/focus styling added.

## Summary

Add a three-state (light / dark / system) theme toggle to judgesdirectory.org. The toggle is rendered as an icon-only button flush-right in the site header with subtle hover highlight and visible keyboard focus ring. Theme preference is persisted in `localStorage` and applied before first paint via an inline `<script>` to prevent flash of incorrect theme. CSS custom properties control all theme-aware colors across both public and admin pages. No new npm dependencies required.

## Technical Context

**Language/Version**: TypeScript 5.x / Next.js 14 App Router
**Primary Dependencies**: None new — inline SVG icons, CSS custom properties, vanilla JS for localStorage
**Storage**: Browser `localStorage` only (key: `theme`, values: `light` | `dark` | `system`)
**Testing**: Manual visual inspection + Lighthouse accessibility audit (no test framework in project yet)
**Target Platform**: Vercel (SSR + static pages), all modern browsers (Chrome, Firefox, Safari, Edge)
**Project Type**: Web application (existing Next.js App Router project)
**Performance Goals**: Zero additional network requests; inline script < 250 bytes; no measurable impact on LCP/FID
**Constraints**: Must work with existing inline-style approach (project uses no CSS files); FOUC prevention requires blocking script before `</head>`; must not break SSR or hydration
**Scale/Scope**: 1 component (ThemeToggle), 1 CSS file (theme variables), 1 inline script (FOUC prevention), 1 layout modification (header), ~13 page/component files updated for theme-aware colors (7 public pages + 2 components + 4 admin)

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                               | Status  | Justification                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| I — Data Accuracy & Source Attribution (NON-NEGOTIABLE) | ✅ N/A  | Feature is UI-only; no judge data, source URLs, or verification status affected.                                                                                                                                                                                                                                        |
| II — SEO-First Architecture                             | ✅ PASS | Theme toggle is client-side only; SSR HTML content is unchanged. JSON-LD, canonical URLs, sitemap, and crawlable content are unaffected. The `<html>` element gets a `data-theme` attribute but no content changes. CSS custom properties do not affect search engine indexing.                                         |
| III — Legal Safety & Neutrality (NON-NEGOTIABLE)        | ✅ N/A  | No content, tone, or data changes. Disclaimer component remains on all public pages regardless of theme with WCAG AA+ contrast.                                                                                                                                                                                         |
| IV — Progressive Launch & Phased Delivery               | ✅ PASS | Small, self-contained UI enhancement that does not interfere with any Phase 1–4 deliverables. Ships independently on its own branch.                                                                                                                                                                                    |
| V — Simplicity & MVP Discipline                         | ✅ PASS | Zero new npm dependencies. Uses CSS custom properties (native), localStorage (native), and inline SVG (no icon library). Simplest possible implementation. Theme toggle is foundational UI infrastructure — it does not expand the enumerated MVP feature set, adds no data model changes, and uses only platform APIs. |
| — Development Workflow                                  | ✅ PASS | Delivered via feature branch `002-theme-toggle` with PR. No schema changes, no migrations, no environment variables.                                                                                                                                                                                                    |

**Gate Result**: ✅ ALL PASS — Proceed to Phase 0 research.

## Project Structure

### Documentation (this feature)

```text
specs/002-theme-toggle/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — no DB entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── component-contracts.md
│   └── color-tokens.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                    # MODIFY — add ThemeToggle to header, add inline FOUC script
│   ├── theme-vars.css                # NEW — CSS custom properties for light/dark themes
│   ├── not-found.tsx                 # MODIFY — replace hardcoded colors with CSS variables
│   ├── judges/
│   │   ├── page.tsx                  # MODIFY — replace hardcoded colors
│   │   ├── [state]/page.tsx          # MODIFY — replace hardcoded colors
│   │   ├── [state]/[county]/page.tsx # MODIFY — replace hardcoded colors
│   │   ├── [state]/[county]/[courtType]/page.tsx          # MODIFY — replace hardcoded colors
│   │   └── [state]/[county]/[courtType]/[judgeSlug]/page.tsx  # MODIFY — replace hardcoded colors
│   └── admin/
│       ├── layout.tsx                # MODIFY — replace hardcoded colors (nav border, links)
│       ├── page.tsx                  # MODIFY — replace hardcoded colors (cards, text)
│       └── judges/
│           ├── page.tsx              # MODIFY — replace hardcoded colors (table, badges, buttons)
│           └── new/page.tsx          # MODIFY — replace hardcoded colors (form, inputs, badges)
├── components/
│   ├── ThemeToggle.tsx               # NEW — client component with 3-state icon toggle
│   ├── Disclaimer.tsx                # MODIFY — replace hardcoded colors
│   ├── StateGrid.tsx                 # MODIFY — replace hardcoded colors
│   └── seo/
│       └── JsonLd.tsx                # NO CHANGE
└── lib/
    ├── theme.ts                      # NEW — theme constants, types, localStorage helpers
    ├── db.ts                         # NO CHANGE
    ├── constants.ts                  # NO CHANGE
    ├── seo.ts                        # NO CHANGE
    └── slugify.ts                    # NO CHANGE
```

**Structure Decision**: Extends the existing Next.js App Router structure. The theme toggle is a client component (`'use client'`) placed in `src/components/`. Theme CSS variables live in a new `theme-vars.css` imported by the root layout. A `theme.ts` utility provides type-safe constants. No new directories needed. Admin pages receive the same CSS variable migration as public pages per clarification.

## Post-Design Constitution Re-evaluation

_GATE: Re-checked after Phase 1 design artifacts are complete._

| Principle                           | Status  | Post-Design Justification                                                                                                                                                                  |
| ----------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| I — Data Accuracy (NON-NEGOTIABLE)  | ✅ N/A  | No data entities, no judge records, no source attribution. Pure UI feature.                                                                                                                |
| II — SEO-First Architecture         | ✅ PASS | SSR HTML content unchanged. CSS variables resolve in browser. `data-theme` is cosmetic. JSON-LD, canonical URLs, sitemap unaffected. Inline script <250 bytes — no LCP impact.             |
| III — Legal Safety (NON-NEGOTIABLE) | ✅ N/A  | No content changes. Disclaimer renders in both themes with WCAG AA+ contrast ratios (amber text `#fde68a` on dark bg `#451a03` = 8.1:1).                                                   |
| IV — Progressive Launch             | ✅ PASS | Self-contained on own branch. No schema/migration/API changes. Ships independently.                                                                                                        |
| V — Simplicity & MVP                | ✅ PASS | Zero new npm dependencies. 4 new files, ~13 files modified (color token replacement). Platform APIs only. Does not expand the enumerated MVP feature set — foundational UI infrastructure. |

**Gate Result**: ✅ ALL PASS — No violations requiring justification.

## Complexity Tracking

No violations found. Table intentionally left empty.

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| —         | —          | —                                    |
