# Tasks: Design System Rebuild — Mobile-First, ADA-Compliant Layouts

**Input**: Design documents from `specs/006-design-system-rebuild/`
**Prerequisites**: plan.md, spec.md (with clarifications)

**Tests**: No automated tests requested. Validation is via build check, codebase search for inline styles, and manual Lighthouse audits.

**Organization**: Tasks are grouped into setup (bridge/typography), then by component group (layouts → shared components → public pages → admin pages → admin components), then polish. US1 (responsive), US2 (accessibility), and US3 (migration) are addressed simultaneously per-file since they are inseparable at the implementation level. US4 (admin mobile) is achieved through US1/US3 work on admin files.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[US1/2]**: Mobile-first responsive + ADA compliance (co-P1)
- **[US3]**: Design system class migration (P2)
- **[US4]**: Admin mobile usability (P3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Extend the design system bridge layer and add typography base styles so all migrated components have the tokens they need.

- [x] T001 Extend bridge layer with ~13 new semantic tokens (link, disclaimer, badge, warning, success, error, toggle) in `src/app/globals.css` `@theme inline` block
- [x] T002 Add typography base layer (`@layer base`) with h1–h6, p, a styles using `@apply` in `src/app/globals.css`
- [x] T003 Verify build passes after globals.css changes — run `npm run build`

**Checkpoint**: Bridge tokens and typography base ready. All subsequent migrations can reference the full token set.

---

## Phase 2: Foundational — Layouts & Shared Components

**Purpose**: Migrate the root layout (skip nav, responsive header), admin layout (flex-wrap nav), shared components (StateGrid, Disclaimer, ThemeToggle), and not-found page. These are blocking because every page inherits from layouts, and shared components appear on multiple pages.

**⚠️ CRITICAL**: Layout migration must be complete before public/admin page migrations to avoid style conflicts.

- [x] T004 [US1/2] Migrate root layout: add skip-nav link, responsive header with Tailwind flex/padding, `id="main-content"` on `<main>`, responsive padding in `src/app/layout.tsx`
- [x] T005 [P] [US1/2] Migrate admin layout: replace inline nav styles with flex-wrap Tailwind classes, add responsive spacing in `src/app/admin/layout.tsx`
- [x] T006 [P] [US3] Migrate StateGrid component: replace inline grid/card styles with responsive Tailwind grid classes and Card component adoption in `src/components/StateGrid.tsx`
- [x] T007 [P] [US3] Migrate Disclaimer component: replace inline styles with Tailwind classes, preserve `role="note"` and `aria-label` in `src/components/Disclaimer.tsx`
- [x] T008 [P] [US3] Migrate ThemeToggle component: replace inline styles with Tailwind classes, preserve theme-cycling functionality in `src/components/ThemeToggle.tsx`
- [x] T009 [P] [US3] Migrate not-found page: replace inline styles with Tailwind centered layout in `src/app/not-found.tsx`
- [x] T010 Verify build passes and theme toggle works in both light/dark modes — run `npm run build`

**Checkpoint**: All layouts and shared components use design system classes. Skip nav, responsive header, and flex-wrap admin nav are in place.

---

## Phase 3: Public Pages — Directory Hierarchy (US1/US2/US3) 🎯 MVP

**Goal**: All 5 public-facing pages are mobile-first, ADA-compliant, and use design system classes. This is the MVP because public pages are what visitors and search engines see.

**Independent Test**: Open each page at 375px / 768px / 1280px — no overflow. Run Lighthouse accessibility audit — score 90+. Search for `style={{` in these files — zero results.

- [x] T011 [US1/2/3] Migrate states grid page: replace inline styles with Tailwind, responsive layout in `src/app/judges/page.tsx`
- [x] T012 [P] [US1/2/3] Migrate county list page: replace inline styles, add breadcrumb with `aria-label="Breadcrumb"` and `aria-current="page"`, responsive card grid in `src/app/judges/[state]/page.tsx`
- [x] T013 [P] [US1/2/3] Migrate court types page: replace inline styles, add breadcrumb ARIA, responsive card grid in `src/app/judges/[state]/[county]/page.tsx`
- [x] T014 [P] [US1/2/3] Migrate judge list page: replace inline styles, add breadcrumb ARIA, responsive card grid in `src/app/judges/[state]/[county]/[courtType]/page.tsx`
- [x] T015 [US1/2/3] Migrate judge profile page: replace all inline styles + hardcoded hex colors with design system tokens, add breadcrumb ARIA, responsive photo/info layout (stacked on mobile, side-by-side on desktop), replace status spans with Badge component in `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx`
- [x] T016 Verify build passes and zero `style={{` in public page files — run `npm run build` and `grep -r 'style={{' src/app/judges/`

**Checkpoint**: All public pages are fully migrated. Mobile-first layouts, breadcrumb ARIA, design system tokens. MVP is deliverable.

---

## Phase 4: Admin Pages (US1/US2/US3/US4)

**Goal**: All 7 admin page files are migrated to design system classes with responsive layouts and accessibility improvements. Admin mobile usability (US4) is achieved through this work.

**Independent Test**: Open each admin page at 375px — all actions reachable, tables scroll horizontally, forms stack vertically. Search for `style={{` in these files — zero results.

- [x] T017 [US3/4] Migrate admin dashboard page: replace inline styles, adopt Card components for dashboard cards, responsive grid in `src/app/admin/page.tsx`
- [x] T018 [P] [US3] Migrate admin progress dashboard page: replace inline heading/paragraph styles with Tailwind classes in `src/app/admin/dashboard/page.tsx`
- [x] T019 [P] [US3] Migrate admin courts page: replace inline heading/paragraph styles with Tailwind classes in `src/app/admin/courts/page.tsx`
- [x] T020 [P] [US3/4] Migrate admin import page: replace inline styles, responsive form layout, style state selector and step indicators with Tailwind in `src/app/admin/import/page.tsx`
- [x] T021 [P] [US3] Migrate admin verification page: replace inline heading/paragraph styles with Tailwind classes in `src/app/admin/verification/page.tsx`
- [x] T022 [US3/4] Migrate admin judges list page: replace inline styles, adopt Table component for judge list, responsive filters/pagination, add `aria-label` to search input in `src/app/admin/judges/page.tsx`
- [x] T023 [US2/3/4] Migrate admin judge creation form: replace inline styles with Tailwind, adopt Input/Button components, responsive stacked form layout, add `aria-describedby` for validation errors, `aria-invalid` on errored fields in `src/app/admin/judges/new/page.tsx`
- [x] T024 Verify build passes and zero `style={{` in admin page files — run `npm run build` and `grep -r 'style={{' src/app/admin/`

**Checkpoint**: All admin pages are migrated. Forms are responsive, tables are scrollable, ARIA errors are linked.

---

## Phase 5: Admin Components (US3/US4)

**Goal**: All 6 admin component files are fully migrated to design system classes. shadcn/ui Table, Button, Badge, Input, and Card components are adopted where applicable.

**Independent Test**: Search for `style={{` in admin components — zero results. Verify all tables use shadcn Table, all buttons use shadcn Button, all status indicators use shadcn Badge.

- [x] T025 [P] [US3/4] Migrate ProgressDashboard: replace all inline styles with Tailwind, adopt Table for data display, responsive stat grid, preserve `role="progressbar"` ARIA in `src/components/admin/ProgressDashboard.tsx`
- [x] T026 [P] [US3/4] Migrate BulkCourtForm: replace inline styles, adopt Input/Button components, responsive form layout, preserve `role="alert"` on errors in `src/components/admin/BulkCourtForm.tsx`
- [x] T027 [P] [US3/4] Migrate CsvUploader: replace inline styles, responsive drop zone, preserve `role="button"`, `tabIndex`, `aria-label` attributes, ensure 44×44px touch target in `src/components/admin/CsvUploader.tsx`
- [x] T028 [P] [US3/4] Migrate ColumnMapper: replace inline styles, adopt Table component for mapping display, preserve `aria-label` on selects in `src/components/admin/ColumnMapper.tsx`
- [x] T029 [P] [US3/4] Migrate ImportSummary: replace inline styles, adopt Card for stat cards, Badge for status indicators, responsive grid layout in `src/components/admin/ImportSummary.tsx`
- [x] T030 [US3/4] Migrate VerificationQueue: replace all inline styles (544 lines), adopt Table/Button/Badge components, responsive filters with flex-wrap, horizontal scroll table wrapper, preserve all existing `aria-label` attributes on filters/checkboxes in `src/components/admin/VerificationQueue.tsx`
- [x] T031 Verify build passes and zero `style={{` in admin components — run `npm run build` and `grep -r 'style={{' src/components/admin/`

**Checkpoint**: All admin components are migrated. shadcn/ui components adopted. All inline styles eliminated.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, focus indicator sweep, heading hierarchy audit, touch target verification, and full project build.

- [x] T032 [P] Audit focus indicators across all pages — verify all interactive elements show visible `ring` on `:focus-visible` in both light and dark modes
- [x] T033 [P] Audit heading hierarchy on all pages — verify one `<h1>` per page, sequential h2/h3, no skipped levels
- [x] T034 [P] Audit touch targets — verify all buttons, links, and form controls meet 44×44px minimum on mobile viewports
- [x] T035 [P] Audit dark mode — toggle through all pages in dark mode, verify no hardcoded light-only colors remain
- [x] T036 Run final `style={{` sweep across entire `src/` directory — verify zero inline style objects remain in any migrated file
- [x] T037 Run `npm run build` — verify zero build errors
- [x] T038 Run codebase search for hardcoded hex colors in all migrated files — verify zero results (`grep -rn '#[0-9a-fA-F]\{3,6\}' src/app/ src/components/StateGrid.tsx src/components/Disclaimer.tsx src/components/ThemeToggle.tsx src/components/admin/`)

**Checkpoint**: All 21 files migrated. Zero inline styles. Zero hardcoded colors. Build passes. Ready for Lighthouse testing.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately
- **Phase 2 (Layouts)**: Depends on Phase 1 (needs bridge tokens + typography base)
- **Phase 3 (Public Pages)**: Depends on Phase 2 (layout + StateGrid + Disclaimer must be migrated first)
- **Phase 4 (Admin Pages)**: Depends on Phase 2 (admin layout must be migrated first). Can run in parallel with Phase 3.
- **Phase 5 (Admin Components)**: Depends on Phase 2 (layout migrated). Can run in parallel with Phases 3 and 4.
- **Phase 6 (Polish)**: Depends on completion of ALL previous phases

### User Story Coverage

| Story              | Primary Phases                                                 | Files                                |
| ------------------ | -------------------------------------------------------------- | ------------------------------------ |
| US1 (Responsive)   | Phase 2, 3, 4, 5                                               | All 21 files                         |
| US2 (ADA)          | Phase 2 (skip nav), 3 (breadcrumbs), 4 (form ARIA), 6 (audits) | Layouts + public pages + admin forms |
| US3 (Migration)    | All phases                                                     | All 21 files + globals.css           |
| US4 (Admin Mobile) | Phase 4, 5                                                     | 7 admin pages + 6 admin components   |

### Parallel Opportunities

**Phase 2** (after Phase 1):

- T005, T006, T007, T008, T009 can all run in parallel (different files)

**Phase 3** (after Phase 2):

- T012, T013, T014 can run in parallel (independent pages)

**Phase 4** (after Phase 2, parallel with Phase 3):

- T018, T019, T020, T021 can run in parallel

**Phase 5** (after Phase 2, parallel with Phases 3/4):

- T025, T026, T027, T028, T029 can run in parallel

**Phase 6** (after all):

- T032, T033, T034, T035 can run in parallel

---

## Parallel Example: After Phase 2 Completion

```bash
# All three streams can run simultaneously:

# Stream A: Public pages (Phase 3)
Task T011: Migrate states grid page
Task T012: Migrate county list page (parallel with T013, T014)
Task T013: Migrate court types page (parallel with T012, T014)
Task T014: Migrate judge list page (parallel with T012, T013)
Task T015: Migrate judge profile page (after T012-T014 pattern established)

# Stream B: Admin pages (Phase 4)
Task T017: Migrate admin dashboard page
Task T018–T021: Migrate simple admin pages (all parallel)
Task T022: Migrate admin judges list
Task T023: Migrate admin judge creation form

# Stream C: Admin components (Phase 5)
Task T025–T029: All parallel (different files)
Task T030: VerificationQueue (largest, do last)
```

---

## Implementation Strategy

### MVP First (Phases 1–3)

1. Complete Phase 1: Extend bridge + typography (3 tasks)
2. Complete Phase 2: Layouts + shared components (7 tasks)
3. Complete Phase 3: Public pages (6 tasks)
4. **STOP and VALIDATE**: Build passes, public pages responsive at 3 viewports, breadcrumb ARIA in place, zero inline styles in public files
5. Deploy/demo MVP — visitors see the improved site

### Incremental Delivery

1. Phase 1 + 2 → Foundation ready
2. Phase 3 → Public pages migrated → **MVP deployable**
3. Phase 4 → Admin pages migrated
4. Phase 5 → Admin components migrated
5. Phase 6 → Polish + validation → **Feature complete**

---

## Notes

- [P] tasks = different files with no dependencies on each other
- US1/US2/US3 are applied simultaneously per-file (you don't migrate a file 3 times)
- US4 is naturally achieved through US1/US3 work on admin files
- The largest single task is T030 (VerificationQueue, 544 lines of inline styles) — budget extra time
- T023 (admin judge form, 582 lines) is the most complex for accessibility — many inputs needing `aria-describedby`
- Commit after each task or logical group
- Run `npm run build` at each checkpoint to catch regressions early
