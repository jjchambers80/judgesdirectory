# Implementation Plan: Phase 2 — Data Ingestion

**Branch**: `003-data-ingestion` | **Date**: 2026-02-18 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-data-ingestion/spec.md`

## Summary

Phase 2 adds bulk CSV import of judge records, a verification workflow (single + batch), bulk court seeding by state, import rollback, and an ingestion progress dashboard — enabling the team to reach the 1,500 verified judge pilot milestone across 3 states. All new functionality lives in the admin panel behind existing Basic Auth. The approach extends the current Prisma schema with an `ImportBatch` model, adds server-side CSV parsing via `papaparse`, and builds new admin pages/API routes following the established Next.js App Router patterns.

## Technical Context

**Language/Version**: TypeScript 5.x on Node.js 20.18.0
**Primary Dependencies**: Next.js 14.2.35 (App Router), React 18, Prisma 6.19.2, papaparse (CSV parsing — new)
**Storage**: PostgreSQL via Prisma ORM (`postgres@localhost:5432/judgesdirectory`)
**Testing**: No testing framework installed yet — manual testing via admin panel. _(Automated testing deferred to Phase 3. Manual testing via admin panel + quickstart walkthrough is the Phase 2 quality gate. See Constitution workflow note.)_
**Target Platform**: Web (server-rendered Next.js on Vercel)
**Project Type**: Web application (single Next.js project — combined frontend/backend)
**Performance Goals**: CSV import ≤30s for 5,000 rows (FR-017), batch verify 50 records <10s (SC-003)
**Constraints**: 5 MB max CSV file size (FR-001), 10,000 row limit (EC-001), sequential import processing (FR-019)
**Scale/Scope**: 1,500 verified judges across 3 pilot states; admin team of 1–3 users

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| Principle                                                  | Status  | Evidence                                                                                                                                                                                                                     |
| ---------------------------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Data Accuracy & Source Attribution** (NON-NEGOTIABLE) | ✅ PASS | FR-008: all imports `verified: false`. FR-004: `sourceUrl` required. FR-011: manual verification before publication. Soft-delete for rejected records preserves audit trail.                                                 |
| **II. SEO-First Architecture**                             | ✅ PASS | No public URL or routing changes. Verified judges appear on existing SSR pages with Schema.org JSON-LD already in place. No new public routes needed.                                                                        |
| **III. Legal Safety & Neutrality** (NON-NEGOTIABLE)        | ✅ PASS | CSV import handles only factual data fields. No ratings, comments, or editorial content introduced. Existing disclaimer infrastructure unchanged.                                                                            |
| **IV. Progressive Launch & Phased Delivery**               | ✅ PASS | This IS Phase 2. Phase 1 (Foundation) deliverables are accepted and merged to main. Feature delivers the 1,500-judge pilot milestone (SC-002).                                                                               |
| **V. Simplicity & MVP Discipline**                         | ✅ PASS | One new dependency (papaparse — lightweight CSV parser). No new services or infrastructure. All features are admin-only extensions of existing patterns. Sequential import processing chosen over complex parallel handling. |
| **VI. Accessibility & WCAG Compliance**                    | ✅ PASS | All new admin UI pages will follow existing semantic HTML patterns. Form inputs will have associated labels. Keyboard navigation will be maintained. Theme/contrast system already in place from 002-theme-toggle.           |

**Gate result: ALL PASS — proceed to Phase 0.**

### Post-Design Re-evaluation (after Phase 1)

| Principle                              | Status  | Post-Design Evidence                                                                                                                                                                                       |
| -------------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **I. Data Accuracy** (NON-NEGOTIABLE)  | ✅ PASS | `JudgeStatus` enum enforces UNVERIFIED→VERIFIED→REJECTED lifecycle. `sourceUrl` validated as required in import contract. Soft-delete preserves audit trail. Rollback blocked for verified records.        |
| **II. SEO-First**                      | ✅ PASS | No new public routes. Existing SSR pages filter by `status: 'VERIFIED'` instead of `verified: true`. JSON-LD and sitemap logic unchanged.                                                                  |
| **III. Legal Safety** (NON-NEGOTIABLE) | ✅ PASS | No editorial content, ratings, or public commentary introduced. All 11 new API endpoints are admin-only behind Basic Auth.                                                                                 |
| **IV. Progressive Delivery**           | ✅ PASS | Dashboard API explicitly tracks the 1,500 verified judge milestone (SC-002, SC-007). `ImportBatch` model provides batch-level traceability.                                                                |
| **V. Simplicity**                      | ✅ PASS | 1 new npm dependency (papaparse + types). In-memory lock (~15 LOC) over distributed lock. Prisma `createMany` over raw SQL. No new infrastructure.                                                         |
| **VI. Accessibility**                  | ✅ PASS | API contracts include semantic feedback (error arrays, status transitions). Admin pages will use proper form labels, table headers, keyboard-operable actions, and inherit existing theme/contrast system. |

**Post-design gate result: ALL PASS. No violations to justify.**

## Project Structure

### Documentation (this feature)

```text
specs/003-data-ingestion/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api-routes.md    # REST API contract definitions
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
src/
├── app/
│   ├── admin/
│   │   ├── import/              # NEW — CSV import page
│   │   │   └── page.tsx
│   │   ├── verification/        # NEW — Verification queue page
│   │   │   └── page.tsx
│   │   ├── courts/              # NEW — Bulk court creation page
│   │   │   └── page.tsx
│   │   ├── dashboard/           # NEW — Ingestion progress dashboard
│   │   │   └── page.tsx
│   │   ├── layout.tsx           # EXISTING — admin layout (add nav links)
│   │   ├── page.tsx             # EXISTING — admin home
│   │   └── judges/              # EXISTING
│   │       ├── page.tsx
│   │       └── new/
│   │           └── page.tsx
│   └── api/
│       └── admin/
│           ├── import/              # NEW — CSV upload, preview, confirm, rollback
│           │   ├── route.ts         # POST (upload+parse), GET (list batches)
│           │   ├── confirm/
│           │   │   └── route.ts     # POST (confirm and execute import)
│           │   └── [batchId]/
│           │       └── route.ts     # GET (batch detail), DELETE (rollback)
│           ├── import/status/
│           │   └── route.ts         # GET — import lock status (FR-019)
│           ├── verification/        # NEW — Verification queue + actions
│           │   ├── route.ts         # GET (queue with filters + pagination)
│           │   ├── [judgeId]/
│           │   │   └── route.ts     # PATCH (single verify/reject/unverify)
│           │   └── batch/
│           │       └── route.ts     # PATCH (batch verify/reject via action field)
│           ├── courts/
│           │   ├── bulk/
│           │   │   └── route.ts     # NEW — POST bulk court creation by state
│           │   └── [countyId]/      # EXISTING (moved structure)
│           │       └── route.ts
│           ├── dashboard/
│           │   └── route.ts         # NEW — GET ingestion stats
│           ├── judges/              # EXISTING
│           │   ├── route.ts
│           │   └── [id]/
│           │       ├── route.ts
│           │       └── verify/
│           │           └── route.ts
│           └── states/              # EXISTING
│               ├── route.ts
│               └── [stateId]/
│                   └── counties/
│                       └── route.ts
├── components/
│   ├── admin/                   # NEW — admin-specific components
│   │   ├── CsvUploader.tsx      # File upload + preview component
│   │   ├── ColumnMapper.tsx     # CSV column → judge field mapping
│   │   ├── ImportSummary.tsx    # Post-import results display
│   │   ├── VerificationQueue.tsx # Queue table with actions
│   │   ├── BulkCourtForm.tsx    # State selector + court type input
│   │   └── ProgressDashboard.tsx # Stats + progress bars
│   ├── Disclaimer.tsx           # EXISTING
│   ├── StateGrid.tsx            # EXISTING
│   ├── ThemeToggle.tsx          # EXISTING
│   └── seo/
│       └── JsonLd.tsx           # EXISTING
└── lib/
    ├── csv.ts                   # NEW — CSV parsing + validation logic
    ├── import-lock.ts           # NEW — Sequential import mutex
    ├── constants.ts             # EXISTING (extend with import limits)
    ├── db.ts                    # EXISTING
    ├── seo.ts                   # EXISTING
    ├── slugify.ts               # EXISTING
    └── theme.ts                 # EXISTING

prisma/
├── schema.prisma                # MODIFIED — add ImportBatch model, extend Judge
└── migrations/                  # NEW migration for ImportBatch + Judge.importBatchId
```

**Structure Decision**: Single Next.js project (no monorepo). All new code follows established patterns — admin pages under `src/app/admin/`, API routes under `src/app/api/admin/`, shared logic under `src/lib/`. New admin-specific components isolated in `src/components/admin/`.

## Complexity Tracking

> No constitution violations to justify. All principles pass cleanly.
