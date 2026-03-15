# Implementation Plan: Global Footer with Disclaimer

**Branch**: `010-global-footer` | **Date**: 2026-03-14 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/010-global-footer/spec.md`

## Summary

Add a global `SiteFooter` component to the root layout containing copyright text and the legal disclaimer. Restyle the disclaimer from amber/yellow callout to subdued grey text. Remove per-page Disclaimer imports from 5 page files. Ensure sticky footer behavior on short pages via flexbox on `<body>`.

## Technical Context

**Language/Version**: TypeScript 5.x (Next.js 14+ App Router)  
**Primary Dependencies**: Next.js, Tailwind CSS, existing theme-vars.css custom properties  
**Storage**: N/A — pure UI component, no database interaction  
**Testing**: Visual inspection + accessibility audit (Lighthouse, axe)  
**Target Platform**: Web (Vercel deployment), SSR  
**Project Type**: Web application (Next.js)  
**Performance Goals**: Zero client-side JS for footer (server component only)  
**Constraints**: WCAG AA 4.5:1 contrast for grey text; server-rendered HTML  
**Scale/Scope**: 1 new component, 1 layout edit, 5 page cleanups, 1 CSS variable update

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
|-----------|--------|-------|
| I. Data Accuracy & Source Attribution | N/A | No data changes |
| II. SEO-First Architecture | PASS | Footer is server-rendered, no impact on SEO structure |
| III. Legal Safety & Neutrality | PASS | Disclaimer text preserved verbatim; moves to global footer guaranteeing 100% page coverage (improvement over per-page pattern) |
| IV. State-by-State Expansion | N/A | UI-only change, no state expansion impact |
| V. Simplicity & Incremental Discipline | PASS | Minimal component; no new dependencies; removes complexity (5 per-page imports → 1 global) |
| VI. Accessibility & WCAG Compliance | PASS | Grey text must meet 4.5:1 contrast; `role="note"` and `aria-label` preserved; semantic `<footer>` element used |
| VII. Data Pipeline Integrity | N/A | No pipeline changes |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/010-global-footer/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output (minimal — no data entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output (empty — no API contracts)
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── layout.tsx                                    # MODIFY — add SiteFooter, flex body
│   ├── theme-vars.css                                # MODIFY — update disclaimer color vars to grey
│   ├── judges/
│   │   ├── page.tsx                                  # MODIFY — remove Disclaimer import/usage
│   │   ├── [state]/
│   │   │   ├── page.tsx                              # MODIFY — remove Disclaimer import/usage
│   │   │   ├── [county]/
│   │   │   │   ├── page.tsx                          # MODIFY — remove Disclaimer import/usage
│   │   │   │   ├── [courtType]/
│   │   │   │   │   ├── page.tsx                      # MODIFY — remove Disclaimer import/usage
│   │   │   │   │   ├── [judgeSlug]/
│   │   │   │   │   │   └── page.tsx                  # MODIFY — remove Disclaimer import/usage
├── components/
│   ├── SiteFooter.tsx                                # CREATE — new global footer component
│   ├── Disclaimer.tsx                                # DELETE — absorbed into SiteFooter
```

**Structure Decision**: Existing Next.js App Router web application structure. New `SiteFooter.tsx` component follows the same pattern as the existing `SiteHeader.tsx` — a layout-level component imported in the root `layout.tsx`.

## Complexity Tracking

> No constitution violations. Table not needed.
