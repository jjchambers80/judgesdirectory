# Tasks: Phase 1 — Foundation

**Input**: Design documents from `/specs/001-foundation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/api-routes.md, quickstart.md

**Tests**: Not included — tests were not explicitly requested in the feature specification. Add test tasks separately if TDD is desired.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Exact file paths included in all descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Initialize the Next.js project with all Phase 1 dependencies and tooling.

- [X] T001 Create Next.js 14 project with TypeScript and install all dependencies (next, react, react-dom, prisma, @prisma/client, slugify) in package.json
- [X] T002 [P] Configure TypeScript strict mode in tsconfig.json and ESLint with Next.js recommended rules in .eslintrc.json
- [X] T003 [P] Configure Next.js settings (App Router, server components, image optimization) in next.config.js

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented. Includes database schema, seed data, shared utilities, middleware, and application shell.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T004 Create Prisma schema with all 4 models (State, County, Court, Judge) including indexes and composite unique constraints in prisma/schema.prisma
- [X] T005 [P] Create Prisma client singleton with global caching for serverless in src/lib/db.ts
- [X] T006 [P] Create site-wide constants (SITE_URL, SITE_NAME, title templates, admin paths) in src/lib/constants.ts
- [X] T007 [P] Create slug utility (lowercase ASCII, hyphen-separated, max 100 chars, numeric suffix disambiguation) in src/lib/slugify.ts
- [X] T008 [P] Create SEO utility functions (generatePageTitle templates, buildItemListJsonLd, buildPersonJsonLd, sanitizeJsonLd) in src/lib/seo.ts
- [X] T009 [P] Create reusable JSON-LD script injection component using dangerouslySetInnerHTML with XSS sanitization in src/components/seo/JsonLd.tsx
- [X] T010 [P] Create legal disclaimer component with informational-purposes-only text in src/components/Disclaimer.tsx — component is included on ALL public pages per Constitution III (not just judge profiles)
- [X] T011 Implement middleware for URL normalization (lowercase + trailing slash → 308 redirect) and admin Basic Auth (WWW-Authenticate header) in src/middleware.ts
- [X] T012 [P] Create root layout with base metadata (title.template, description, viewport), fonts, and HTML lang attribute in src/app/layout.tsx
- [X] T013 [P] Create custom 404 page with navigation back to /judges in src/app/not-found.tsx
- [X] T014 [P] Create homepage with redirect to /judges in src/app/page.tsx
- [X] T015 [P] Create environment variable template (DATABASE_URL, DIRECT_URL, ADMIN_USERNAME, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL) in .env.example
- [X] T016 Create seed script to populate 50 U.S. states (name, slug, abbreviation, FIPS code) and ~3,143 counties (name, slug, FIPS code, stateId) from Census FIPS data in prisma/seed.ts
- [X] T017 Run initial Prisma migration (`prisma migrate dev --name init`), execute seed (`prisma db seed`), and verify 50 states + ~3,143 counties in database

**Checkpoint**: Foundation ready — all shared infrastructure in place. User story implementation can begin.

---

## Phase 3: User Story 1 — Browse States Grid (Priority: P1) 🎯 MVP

**Goal**: Visitor lands on `/judges` and sees a grid of all 50 U.S. states, each linking to its county listing page. Server-rendered with Schema.org ItemList JSON-LD and SEO title template.

**Independent Test**: Navigate to `/judges`; confirm all 50 states render server-side, each links to `/judges/{state-slug}`, `<title>` is "U.S. Judges Directory — Browse by State", JSON-LD `ItemList` is present in page source.

### Implementation for User Story 1

- [X] T018 [P] [US1] Create StateGrid component (50 state tiles with name, abbreviation, county count, link to /judges/{slug}) in src/components/StateGrid.tsx
- [X] T019 [US1] Implement States Grid page with SSR data fetch, generateMetadata (title + canonical), ItemList JSON-LD, and Disclaimer component in src/app/judges/page.tsx

**Checkpoint**: `/judges` renders 50 states with full SEO markup. Entry point to the directory is functional.

---

## Phase 4: User Story 2 — Browse Counties Within a State (Priority: P1)

**Goal**: Visitor navigates to `/judges/{state}` and sees all counties in that state, each linking to its court-type breakdown. Returns 404 for invalid state slugs.

**Independent Test**: Navigate to `/judges/texas`; verify all Texas counties render with links to `/judges/texas/{county-slug}`, SSR and JSON-LD `ItemList` present. Navigate to `/judges/nonexistent`; verify 404.

### Implementation for User Story 2

- [X] T020 [US2] Implement County List page with SSR data fetch (state lookup by slug, counties with court count), generateMetadata ("Judges in {State} — County Directory"), canonical URL, ItemList JSON-LD, Disclaimer component, and notFound() for invalid state slugs in src/app/judges/[state]/page.tsx

**Checkpoint**: State → County navigation works. Two levels of the hierarchy are functional.

---

## Phase 5: User Story 3 — Browse Court Types Within a County (Priority: P1)

**Goal**: Visitor navigates to `/judges/{state}/{county}` and sees court types (e.g., District Court, Family Court) with links to judge listings. Returns 404 for invalid slugs. Shows "No court records available" for counties with zero courts.

**Independent Test**: Navigate to `/judges/texas/harris-county`; verify court types page renders (empty state expected in Phase 1). Navigate to `/judges/texas/nonexistent`; verify 404.

### Implementation for User Story 3

- [X] T021 [US3] Implement Court Types page with SSR data fetch (state + county lookup, courts with judge count), generateMetadata ("Courts in {County}, {State}"), canonical URL, ItemList JSON-LD, Disclaimer component, empty-state message, and notFound() for invalid slugs in src/app/judges/[state]/[county]/page.tsx

**Checkpoint**: Three levels of the URL hierarchy are functional. All P1 navigation pages are complete.

---

## Phase 6: User Story 7 — XML Sitemap Generation (Priority: P1)

**Goal**: System generates a valid XML sitemap at `/sitemap.xml` covering all indexable URLs (states, counties, courts, judges). Supports sitemap index splitting for >50,000 URLs. Robots.txt disallows `/admin` and `/api`, references sitemap.

**Independent Test**: Request `/sitemap.xml`; validate it returns valid XML with `<url>` entries for `/judges` + all 50 states + ~3,143 counties. Request `/robots.txt`; verify `Disallow: /admin`, `Sitemap:` reference.

### Implementation for User Story 7

- [X] T022 [P] [US7] Implement dynamic XML sitemap with generateSitemaps() for >50k URL splitting, querying all states/counties/courts/judges with proper lastmod, changefreq, and priority values in src/app/sitemap.ts
- [X] T023 [P] [US7] Implement robots.txt route (Allow /judges, Disallow /admin and /api, Sitemap reference) in src/app/robots.ts

**Checkpoint**: SEO infrastructure complete. All indexable pages are discoverable by search engines.

---

## Phase 7: User Story 8 — Deployment and Hosting (Priority: P1)

**Goal**: Application deploys to Vercel with SSR, preview deployments for PRs, secure environment variable management. No credentials exposed in client bundles.

**Independent Test**: Push to main; verify production deployment triggers. Confirm `/judges` returns server-rendered HTML. Verify no env vars in client bundle (view page source).

### Implementation for User Story 8

- [X] T024 [US8] Configure Vercel deployment: add `"postinstall": "prisma generate"` to package.json scripts, verify next.config.js output settings, and document required environment variables (DATABASE_URL, DIRECT_URL, ADMIN_USERNAME, ADMIN_PASSWORD, NEXT_PUBLIC_SITE_URL) for Vercel dashboard
- [X] T025 [US8] Verify production build succeeds (`npm run build`), SSR pages render without client-side-only fallbacks, and no environment variables or stack traces leak in public responses

**Checkpoint**: All P1 stories complete. Application is deployed, navigable (states → counties → courts), SEO-indexed, and production-ready. This is the MVP milestone.

---

## Phase 8: User Story 6 — Admin Data Ingestion (Priority: P2)

**Goal**: Internal team member accesses a protected admin panel at `/admin` to create, edit, and verify judge records. Panel validates required fields, auto-generates slugs, and writes records to the database. Access denied without Basic Auth credentials.

**Independent Test**: Access `/admin` without credentials — verify 401. Authenticate and submit a complete judge record — verify it persists. Submit with missing `fullName` — verify rejection with field-level error.

### Implementation for User Story 6

- [X] T026 [US6] Create admin layout that verifies Basic Auth credentials from middleware context in src/app/admin/layout.tsx
- [X] T027 [P] [US6] Create admin dashboard page with navigation links to judge management in src/app/admin/page.tsx
- [X] T028 [P] [US6] Implement GET /api/admin/states endpoint returning all states (id, name, slug, abbreviation) for dropdown population in src/app/api/admin/states/route.ts
- [X] T029 [P] [US6] Implement GET /api/admin/states/[stateId]/counties endpoint returning counties for a state in src/app/api/admin/states/[stateId]/counties/route.ts
- [X] T030 [P] [US6] Implement GET and POST /api/admin/counties/[countyId]/courts endpoint for listing and creating courts within a county in src/app/api/admin/counties/[countyId]/courts/route.ts
- [X] T031 [US6] Implement GET (paginated list with search/filter) and POST (create with slug generation and field validation) for /api/admin/judges in src/app/api/admin/judges/route.ts
- [X] T032 [P] [US6] Implement PUT (update, slug regeneration on name change) and DELETE for /api/admin/judges/[id] in src/app/api/admin/judges/[id]/route.ts
- [X] T033 [P] [US6] Implement PATCH /api/admin/judges/[id]/verify endpoint to toggle verified status in src/app/api/admin/judges/[id]/verify/route.ts
- [X] T034 [US6] Create admin judge listing page with search, state/county/court filters, verification status filter, and pagination in src/app/admin/judges/page.tsx
- [X] T035 [US6] Create admin judge create/edit form with cascading state → county → court dropdowns, field validation, and success/error feedback in src/app/admin/judges/new/page.tsx

**Checkpoint**: Admin panel fully operational. Team can create, edit, verify, and delete judge records. Data pipeline is ready for Phase 2 ingestion.

---

## Phase 9: User Story 4 — View Judge Listing by Court Type (Priority: P2)

**Goal**: Visitor navigates to `/judges/{state}/{county}/{court-type}` and sees all judges assigned to that court. Each name links to their profile page. Shows "No judges currently listed" for courts with zero judges. Returns 404 for invalid slugs.

**Independent Test**: Add a judge via admin panel. Navigate to the court-type page; verify the judge name renders as a link to the profile URL. JSON-LD `ItemList` and SEO title present.

### Implementation for User Story 4

- [X] T036 [US4] Implement Judge List page with SSR data fetch (state + county + court lookup, judges list filtered to `verified = true` only), generateMetadata ("{Court Type} Judges in {County}, {State}"), canonical URL, ItemList JSON-LD, Disclaimer component, empty-state message, and notFound() for invalid slugs in src/app/judges/[state]/[county]/[courtType]/page.tsx

**Checkpoint**: Four levels of the URL hierarchy are functional. Judge listings visible for courts with data.

---

## Phase 10: User Story 5 — View Individual Judge Profile (Priority: P2)

**Goal**: Visitor navigates to `/judges/{state}/{county}/{court-type}/{judge-slug}` and sees a structured profile (name, court, term dates, selection method, appointing authority, education, prior experience, political affiliation). Null fields are gracefully omitted. Informational disclaimer is displayed. JSON-LD `Person` structured data present.

**Independent Test**: Navigate to a judge profile URL; verify all populated fields render, null fields are omitted (no blank sections), disclaimer is visible, `<title>` is "Judge {Name} — {Court}, {County}, {State}", Person JSON-LD is present.

### Implementation for User Story 5

- [X] T037 [US5] Implement Judge Profile page with SSR data fetch (full judge record with court → county → state joins, filtered to `verified = true` only — return 404 for unverified), generateMetadata ("Judge {Name} — {Court Type}, {County}, {State}"), canonical URL, Person JSON-LD (name, jobTitle, worksFor, description), Disclaimer component, source attribution link, graceful null-field omission, and notFound() for invalid slugs in src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx

**Checkpoint**: All five levels of the URL hierarchy are complete. Full navigation from states → counties → courts → judges → profile is functional.

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Final validation across all stories, edge case verification, and SEO compliance audit.

- [X] T038 Run Lighthouse SEO audit on `/judges` (states grid) and a sample judge profile page — target score ≥ 90 (SC-007)
- [X] T039 Verify all edge cases: zero-record empty states at each hierarchy level, 404 responses for invalid slugs, special character handling in names, duplicate slug disambiguation, mixed-case URL redirects, trailing slash normalization
- [X] T040 [P] Verify no environment variables, database credentials, or stack traces exposed in any public page response or client-side bundle (SC-008)
- [X] T041 Run quickstart.md validation end-to-end (all 10 steps) to confirm developer onboarding path works

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1: Setup ──────────────────────► Phase 2: Foundational (BLOCKS ALL)
                                              │
                    ┌─────────────────────────┤
                    │                         │
                    ▼                         ▼
           Phase 3: US1 (States)     Phase 6: US7 (Sitemap) ─┐
                    │                         │               │
                    ▼                         ▼               │
           Phase 4: US2 (Counties)   Phase 7: US8 (Deploy) ◄─┘
                    │
                    ▼
           Phase 5: US3 (Courts)
                    │
                    ├─────────────────────────┐
                    ▼                         ▼
           Phase 8: US6 (Admin)      Phase 9: US4 (Judge List)
                    │                         │
                    ▼                         ▼
                    │                Phase 10: US5 (Profile)
                    │                         │
                    └─────────────────────────┘
                                              │
                                              ▼
                                     Phase 11: Polish
```

### User Story Dependencies

- **US1 (States Grid)**: Depends on Foundational only. No cross-story dependencies. **MVP entry point.**
- **US2 (Counties)**: Depends on Foundational. Logically follows US1 (same navigation flow) but no code dependency.
- **US3 (Court Types)**: Depends on Foundational. Logically follows US2 but no code dependency.
- **US7 (Sitemap)**: Depends on Foundational. Can run in parallel with US1–US3.
- **US8 (Deployment)**: Depends on Foundational. Can start once any page exists.
- **US6 (Admin Ingestion)**: Depends on Foundational. Independent of US1–US3. Enables testing of US4/US5 with real data.
- **US4 (Judge List)**: Depends on Foundational. Benefits from US6 for test data but handles empty state.
- **US5 (Judge Profile)**: Depends on Foundational. Benefits from US6 for test data but handles missing record as 404.

### Within Each User Story

1. Components/utilities before pages
2. Data-fetching logic before presentation
3. Core page implementation before edge case handling
4. Each story is independently testable at its checkpoint

### Parallel Opportunities

- **Setup**: T002 and T003 can run in parallel
- **Foundational**: T005, T006, T007, T008, T009, T010, T012, T013, T014, T015 can all run in parallel (independent files)
- **Cross-story (after Foundational)**: US1, US7, and US8 can all start simultaneously
- **US6 internals**: T027, T028, T029, T030 can run in parallel; T032 and T033 can run in parallel
- **US7 internals**: T022 and T023 can run in parallel

---

## Parallel Example: After Foundational Phase

```
# These can all launch simultaneously after Phase 2 completes:

Stream A (Navigation):
  T018 → T019 (US1: States Grid)
  → T020 (US2: Counties)
  → T021 (US3: Court Types)

Stream B (SEO Infrastructure):
  T022 + T023 in parallel (US7: Sitemap + Robots)

Stream C (Deployment):
  T024 → T025 (US8: Vercel config + verify)
```

## Parallel Example: Admin API Build-Out (Phase 8)

```
# After T026 (admin layout):

Parallel batch 1:
  T027 (dashboard) + T028 (states API) + T029 (counties API) + T030 (courts API)

Parallel batch 2 (after T031 judge CRUD):
  T032 (update/delete) + T033 (verify endpoint)

Sequential (depends on APIs):
  T034 (judge listing page) → T035 (judge form page)
```

---

## Implementation Strategy

### MVP First (P1 Stories Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks all stories)
3. Complete Phase 3: US1 — States Grid
4. Complete Phase 4: US2 — Counties
5. Complete Phase 5: US3 — Court Types
6. Complete Phase 6: US7 — Sitemap + Robots
7. Complete Phase 7: US8 — Deploy to Vercel
8. **STOP AND VALIDATE**: All P1 stories are live. Directory is navigable (states → counties → courts), SEO-indexed, and deployed. This is the foundation MVP.

### Incremental Delivery (Add P2 Stories)

9. Complete Phase 8: US6 — Admin Ingestion Panel
10. Enter pilot judge data via admin panel
11. Complete Phase 9: US4 — Judge Listing pages now show real data
12. Complete Phase 10: US5 — Judge Profile pages now show real data
13. Complete Phase 11: Polish — full audit and edge case sweep
14. **Foundation complete** — ready for Phase 2 (Data Ingestion at scale)

### Suggested MVP Scope

**P1 stories only** (Phases 1–7, tasks T001–T025): Delivers a deployed, navigable, SEO-indexed directory of 50 states and ~3,143 counties. No judge data yet, but the entire URL hierarchy and sitemap infrastructure are live.

---

## Summary

| Metric | Count |
|--------|-------|
| **Total tasks** | 41 |
| **Setup tasks** | 3 |
| **Foundational tasks** | 14 |
| **US1 (States Grid) tasks** | 2 |
| **US2 (Counties) tasks** | 1 |
| **US3 (Court Types) tasks** | 1 |
| **US7 (Sitemap) tasks** | 2 |
| **US8 (Deployment) tasks** | 2 |
| **US6 (Admin Ingestion) tasks** | 10 |
| **US4 (Judge List) tasks** | 1 |
| **US5 (Judge Profile) tasks** | 1 |
| **Polish tasks** | 4 |
| **Parallelizable tasks** | 22 (54%) |
| **User stories** | 8 |

---

## Notes

- All public pages use Server Components (SSR) — no `'use client'` on indexable pages
- `params` in Next.js 14 App Router is a `Promise` — must be awaited in page components
- JSON-LD uses `dangerouslySetInnerHTML` with `.replace(/</g, '\\u003c')` for XSS safety
- Prisma client uses singleton pattern with `globalThis` caching for serverless hot reload
- Dual DATABASE_URL (pooled) / DIRECT_URL (direct) pattern required for Neon on Vercel
- Admin auth is middleware-level HTTP Basic Auth — no user accounts or sessions needed
- Slug disambiguation appends `-2`, `-3` suffixes for collisions within the same parent
