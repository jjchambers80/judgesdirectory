# Tasks: Design System — shadcn/ui + Tailwind CSS

**Input**: Design documents from `/specs/005-design-system/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install missing dependencies and create configuration files that all subsequent work depends on.

- [x] T001 Install `class-variance-authority` via `npm install class-variance-authority`
- [x] T002 [P] Create PostCSS configuration in `postcss.config.mjs` with `@tailwindcss/postcss` plugin
- [x] T003 [P] Create `cn()` utility function in `src/lib/utils.ts` using `clsx` and `tailwind-merge`

**Checkpoint**: Missing dependency installed, PostCSS configured, `cn()` available. The `@/lib/utils` import in all 5 shadcn/ui components should now resolve.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Create the CSS entry point that wires Tailwind v4 to the existing theme. MUST be complete before any user story validation can begin.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T004 Create `src/app/globals.css` with Tailwind v4 imports (theme + utilities layers only — NO preflight), `@import "./theme-vars.css"`, `@custom-variant dark` targeting `[data-theme="dark"]`, `@theme inline` bridge layer mapping 15 shadcn semantic tokens to existing `--color-*` variables per plan.md Bridge Layer table, and base `body {}` styles (moved from theme-vars.css)
- [x] T005 Update `src/app/layout.tsx` line 4: change `import "./theme-vars.css"` to `import "./globals.css"`
- [x] T006 Remove the `body {}` block from `src/app/theme-vars.css` (lines 109-116) since it is now in globals.css — keeps theme-vars.css as pure variable declarations only

**Checkpoint**: Foundation ready — `npm run dev` should start without import errors. Tailwind utility classes should resolve via the bridge layer. User story implementation can now begin.

---

## Phase 3: User Story 1 — Tailwind + shadcn/ui Foundation (Priority: P1) 🎯 MVP

**Goal**: Developer runs `npm run build` successfully with zero import errors. Existing pages render correctly with no visual regressions. Tailwind utility classes resolve to correct theme values.

**Independent Test**: Run `npm run build` — must complete with zero errors. Open any page in browser and confirm styles render correctly.

### Implementation for User Story 1

- [x] T007 [US1] Run `npm run build` and verify zero import errors for `@/lib/utils` and `class-variance-authority`
- [x] T008 [US1] Run `npm run dev`, open the home page (`/judges`), and verify existing inline styles still render correctly (no layout shifts, no missing styles)
- [x] T009 [US1] Verify dark mode toggle still works: toggle theme via UI, confirm `[data-theme="dark"]` attribute switches, confirm CSS custom properties update on page
- [x] T010 [US1] Verify Tailwind utility classes resolve: add a temporary `<div className="bg-background text-foreground p-4">Tailwind test</div>` to any page, confirm it renders with theme-appropriate colors, then remove it

**Checkpoint**: User Story 1 complete. Build passes, dev server works, existing pages unchanged, Tailwind utility classes resolve via bridge layer.

---

## Phase 4: User Story 2 — shadcn/ui Core Components Work (Priority: P2)

**Goal**: Each of the 5 shadcn/ui components (`Badge`, `Button`, `Card`, `Input`, `Table`) renders correctly with proper styling, variant support, and theme awareness.

**Independent Test**: Create a temporary test page that renders each component with its primary variants. Verify visually and via keyboard navigation.

### Implementation for User Story 2

- [x] T011 [US2] Create a temporary validation page at `src/app/design-system-check/page.tsx` that imports and renders all 5 shadcn/ui components with their variants: Badge (default, secondary, destructive, outline), Button (default, secondary, destructive, outline, ghost + sizes sm/default/lg/icon), Card (with CardHeader/CardTitle/CardContent), Input (with placeholder + focus state), Table (with sample rows/columns)
- [x] T012 [US2] Open the validation page in light mode and verify: each component renders with visible, correctly-themed styling — no unstyled/broken elements, correct spacing, proper borders
- [x] T013 [US2] Toggle to dark mode on the validation page and verify: all component colors update to dark palette without page reload
- [x] T014 [US2] Verify keyboard accessibility on the validation page: Button is focusable with visible focus ring, Input shows focus ring on tab-focus, Tab navigation works through all interactive elements
- [x] T015 [US2] Run Lighthouse accessibility audit on `/judges` in both light and dark modes — score MUST be ≥ 90 (validates SC-004, constitution Principle VI)
- [x] T016 [US2] Remove the temporary validation page `src/app/design-system-check/page.tsx` (and its directory) after verification is complete

**Checkpoint**: User Story 2 complete. All 5 components render correctly in both themes with proper variants and keyboard focus.

---

## Phase 5: User Story 3 — Existing Pages Have No Visual Regressions (Priority: P3)

**Goal**: All existing public and admin pages look and behave identically to their pre-migration appearance. No layout shifts, no broken styles, no lost dark mode support.

**Independent Test**: Navigate each major page type in both light and dark mode.

### Implementation for User Story 3

- [x] T017 [P] [US3] Verify public pages: navigate `/judges` (state grid), click into a state → county list → court → judge profile. Confirm layout, colors, spacing, and typography match pre-migration appearance in both light and dark modes
- [x] T018 [P] [US3] Verify admin pages: navigate `/admin` and all sub-routes. Confirm inline-styled admin components (CsvUploader, ColumnMapper, ImportSummary, etc.) render without visual changes in both light and dark modes
- [x] T019 [US3] Verify SSR and SEO: view page source on a public judge page, confirm JSON-LD structured data and meta tags are present in the SSR HTML
- [x] T020 [US3] Verify `npx shadcn@latest add separator` installs into `src/components/ui/separator.tsx` with working imports, then remove the test file afterward (validates SC-006: new component workflow)

**Checkpoint**: User Story 3 complete. All existing pages unchanged, SSR/SEO preserved, component installation workflow verified.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final validation and cleanup.

- [x] T021 Run full `npm run build` one final time — must complete with zero errors and zero warnings related to missing modules or type mismatches (validates SC-001)
- [x] T022 [P] Verify `components.json` at project root still has correct alias paths and CSS entry point pointing to `src/app/globals.css` (validates SC-006 prerequisites)
- [x] T023 [P] Commit all changes with message: `feat(005): wire Tailwind CSS v4 + shadcn/ui design system foundation`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Foundational (Phase 2) — verification of build + dev server
- **US2 (Phase 4)**: Depends on US1 passing (build must work before component testing)
- **US3 (Phase 5)**: Depends on US1 passing (dev server must work before page verification)
- **Polish (Phase 6)**: Depends on all user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) — No dependencies on other stories
- **User Story 2 (P2)**: Depends on US1 (build must pass before component rendering can be tested)
- **User Story 3 (P3)**: Depends on US1 (dev server must work). Can run in parallel with US2 (different pages)

### Within Each User Story

- Core verification before variant/edge case testing
- Light mode before dark mode verification
- Public pages before admin pages

### Parallel Opportunities

- T002 and T003 can run in parallel (different files, no dependencies)
- T017 and T018 can run in parallel (different page sections)
- T022 and T023 can run in parallel (different concerns)
- US2 (Phase 4) and US3 (Phase 5) can overlap once US1 passes

---

## Parallel Example: Phase 1 Setup

```
# Launch in parallel (different files):
Task T002: Create postcss.config.mjs
Task T003: Create src/lib/utils.ts
```

## Parallel Example: User Story 3

```
# Launch in parallel (different page sections):
Task T017: Verify public pages (state grid → county → court → judge)
Task T018: Verify admin pages (/admin and sub-routes)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T003)
2. Complete Phase 2: Foundational (T004–T006)
3. Complete Phase 3: User Story 1 (T007–T010)
4. **STOP and VALIDATE**: `npm run build` passes, dev server works
5. This alone unblocks all shadcn/ui development

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. Add User Story 1 → Build passes → **MVP!**
3. Add User Story 2 → Components verified as working
4. Add User Story 3 → No regressions confirmed
5. Polish → Final commit

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- No test tasks generated (not requested in spec)
- The validation page (T011) is temporary scaffolding — created for verification, removed after
- Total file changes: 1 install, 3 files created, 2 files edited, 0 components modified
- Existing inline-styled components (ThemeToggle, Disclaimer, StateGrid, admin, SEO) are NOT touched
