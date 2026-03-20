# Implementation Plan: Admin State Discovery

**Branch**: `016-admin-state-discovery` | **Date**: 2026-03-17 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/016-admin-state-discovery/spec.md`

## Summary

Add an admin UI page and API endpoint to trigger URL discovery runs for individual US states, monitor progress via auto-polling, view run history, and cancel running jobs. The implementation wraps the existing CLI discovery pipeline (`scripts/discovery/discover.ts`) in a background `child_process.spawn`, following the same pattern established by the harvest admin page. One minor schema change: adding `CANCELLED` to the `DiscoveryRunStatus` enum for cooperative cancellation. All other data model entities (`DiscoveryRun`, `UrlCandidate`) already exist.

## Technical Context

**Language/Version**: TypeScript 5.x (strict mode), Node.js 20+  
**Primary Dependencies**: Next.js 15 (App Router), React 19, TanStack Table, shadcn/ui, Prisma ORM  
**Storage**: PostgreSQL via Prisma (`DiscoveryRun`, `UrlCandidate` tables — already exist)  
**Testing**: Manual verification via admin UI; existing Prisma schema validates data integrity  
**Target Platform**: Web (admin panel at `/admin/discovery/`)  
**Project Type**: Web application (Next.js full-stack)  
**Performance Goals**: Admin UI interactive within 1s; auto-poll interval ~5s; discovery runs are long-running background processes  
**Constraints**: Single concurrent discovery run (advisory lock); runs take minutes per state due to external API limits  
**Scale/Scope**: 50 US states, ~20 runs visible per page, single admin user expected at a time

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                              | Status   | Notes                                                                                                                                  |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| I. Data Accuracy & Source Attribution  | **N/A**  | Feature triggers discovery but doesn't modify data accuracy workflow                                                                   |
| II. SEO-First Architecture             | **N/A**  | Admin-only page, no public-facing routes                                                                                               |
| III. Legal Safety & Neutrality         | **N/A**  | Admin tooling, no public content                                                                                                       |
| IV. State-by-State Expansion           | **PASS** | Supports expansion by enabling per-state discovery from UI                                                                             |
| V. Simplicity & Incremental Discipline | **PASS** | Reuses existing discovery pipeline, follows harvest page pattern, no new dependencies                                                  |
| VI. Accessibility & WCAG Compliance    | **PASS** | Admin page will use existing shadcn/ui components which follow WCAG patterns; semantic HTML, keyboard navigation, ARIA labels required |
| VII. Data Pipeline Integrity           | **PASS** | Discovery pipeline logic is unchanged; UI is a thin wrapper around existing CLI                                                        |

**Gate result**: PASS — no violations.

## Project Structure

### Documentation (this feature)

```text
specs/016-admin-state-discovery/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── discovery-run-api.md
└── tasks.md             # Phase 2 output (/speckit.tasks)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── admin/
│   │   └── discovery/
│   │       └── page.tsx              # MODIFY — add run trigger, state summary, run history sections
│   └── api/
│       └── admin/
│           └── discovery/
│               ├── route.ts          # EXISTING — GET candidates list
│               ├── runs/
│               │   └── route.ts      # NEW — GET runs list, POST trigger run
│               ├── runs/
│               │   └── [id]/
│               │       └── route.ts  # NEW — PATCH cancel run
│               └── summary/
│                   └── route.ts      # NEW — GET state summary (candidate counts + last run)
├── components/
│   └── admin/
│       ├── DiscoveryRunTrigger.tsx    # NEW — state selector + run button + state summary
│       └── DiscoveryRunHistory.tsx    # NEW — runs table with auto-poll
scripts/
└── discovery/
    └── discover.ts                   # MODIFY — add --run-id flag and cooperative cancellation check
```

**Structure Decision**: Follows the established Next.js App Router pattern. New API routes are added under `/api/admin/discovery/runs/` to avoid collision with the existing candidate management routes. The UI extends the existing admin discovery page with new client components, mirroring how the harvest page (`/admin/harvest/`) is structured.
