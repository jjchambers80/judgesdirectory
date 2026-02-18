# Tasks: Theme Toggle

**Input**: Design documents from `/specs/002-theme-toggle/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks grouped by user story. US1 and US2 are both P1 but separated for independent testability. Color migration tasks are split into parallelizable file-level units.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Setup/Foundational phases have no story label

---

## Phase 1: Setup

**Purpose**: Create new files that all user stories depend on — theme utility module and CSS custom properties file.

- [x] T001 Create theme types, constants, and helper functions in src/lib/theme.ts
- [x] T002 Create CSS custom properties file with light/dark/disclaimer/admin/toggle tokens in src/app/theme-vars.css

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire theme infrastructure into the root layout. MUST complete before any user story work.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Import theme-vars.css in src/app/layout.tsx and add suppressHydrationWarning to html element
- [x] T004 Update header in src/app/layout.tsx to use flexbox with justify-content: space-between for flush-right toggle placement

**Checkpoint**: Theme infrastructure is wired — CSS variables are available globally and header layout supports the toggle position.

---

## Phase 3: User Story 1 — Toggle Between Light and Dark Mode (Priority: P1) 🎯 MVP

**Goal**: Visitor can cycle through light → dark → system themes via a button. Preference persists in localStorage. Theme applies immediately to all page colors.

**Independent Test**: Load any page, click the toggle repeatedly, verify appearance changes through 3 modes. Refresh to confirm persistence. Navigate between pages to confirm consistency.

### Core Component

- [x] T005 [US1] Create ThemeToggle client component with 3-state cycle logic, localStorage read/write, and matchMedia system listener in src/components/ThemeToggle.tsx
- [x] T006 [US1] Add ThemeToggle component to header in src/app/layout.tsx

### Public Page Color Migration

- [x] T007 [P] [US1] Replace hardcoded colors with CSS variables in src/components/StateGrid.tsx
- [x] T008 [P] [US1] Replace hardcoded colors with CSS variables in src/components/Disclaimer.tsx
- [x] T009 [P] [US1] Replace hardcoded colors with CSS variables in src/app/judges/page.tsx
- [x] T010 [P] [US1] Replace hardcoded colors with CSS variables in src/app/judges/[state]/page.tsx
- [x] T011 [P] [US1] Replace hardcoded colors with CSS variables in src/app/judges/[state]/[county]/page.tsx
- [x] T012 [P] [US1] Replace hardcoded colors with CSS variables in src/app/judges/[state]/[county]/[courtType]/page.tsx
- [x] T013 [P] [US1] Replace hardcoded colors with CSS variables in src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx
- [x] T014 [P] [US1] Replace hardcoded colors with CSS variables in src/app/not-found.tsx
- [x] T015 [P] [US1] Replace hardcoded border color in header border-bottom in src/app/layout.tsx

### Admin Page Color Migration

- [x] T016 [P] [US1] Replace hardcoded colors with CSS variables in src/app/admin/layout.tsx
- [x] T017 [P] [US1] Replace hardcoded colors with CSS variables in src/app/admin/page.tsx
- [x] T018 [P] [US1] Replace hardcoded colors with CSS variables in src/app/admin/judges/page.tsx
- [x] T019 [P] [US1] Replace hardcoded colors with CSS variables in src/app/admin/judges/new/page.tsx

**Checkpoint**: Theme switching works end-to-end. All public and admin pages respond to theme changes. Preference persists across refresh and navigation.

---

## Phase 4: User Story 2 — Icon-Only Header Placement (Priority: P1)

**Goal**: Toggle button shows distinct SVG icons for each mode (sun/moon/monitor), flush-right in header, with hover highlight and keyboard focus ring. Responsive across 320–2560px.

**Independent Test**: Inspect the header on any page — icon is right-aligned, vertically centered. Hover shows background highlight. Tab to it and see focus ring. Each mode shows correct icon.

- [x] T020 [US2] Add inline SVG icons (Sun, Moon, Monitor) to ThemeToggle component in src/components/ThemeToggle.tsx — inline SVGs render immediately so no fallback needed (EC-005 is inherently satisfied)
- [x] T021 [US2] Add hover background highlight and keyboard focus ring styles to ThemeToggle in src/components/ThemeToggle.tsx
- [x] T022 [US2] Add dynamic aria-label and title attributes per mode to ThemeToggle in src/components/ThemeToggle.tsx

**Checkpoint**: Toggle icon is visually correct, responsive, accessible, and shows appropriate hover/focus feedback.

---

## Phase 5: User Story 3 — No Flash of Incorrect Theme (Priority: P2)

**Goal**: Page renders in correct theme from first paint — no white flash when dark mode is saved.

**Independent Test**: Set dark mode, hard-refresh. Watch for any flash of white. Throttle CPU to 4x in DevTools to make flash visible if present.

- [x] T023 [US3] Add synchronous inline FOUC prevention script to head element in src/app/layout.tsx
- [x] T024 [US3] Add @media (prefers-color-scheme: dark) no-JS fallback rules to src/app/theme-vars.css

**Checkpoint**: No flash of incorrect theme on hard refresh with any saved preference. No-JS users get OS-preferred theme.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Build verification, visual QA, and final validation.

- [x] T025 Run npm run build and verify all routes compile without errors
- [x] T026 Run quickstart.md verification checklist (visual switching, persistence, FOUC, system follow, accessibility, cross-page incl. admin, responsive 320–2560px, build) and compare Lighthouse performance score against pre-feature baseline (SC-006)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001, T002)
- **US1 (Phase 3)**: Depends on Phase 2 (T003, T004) — BLOCKS on layout wiring
- **US2 (Phase 4)**: Depends on T005 (ThemeToggle component exists) — extends it with icons/a11y
- **US3 (Phase 5)**: Depends on Phase 2 (T003) — adds inline script to layout
- **Polish (Phase 6)**: Depends on all prior phases

### User Story Dependencies

- **US1 (P1)**: Core toggle + color migration. Can start after Foundational.
- **US2 (P1)**: Extends ThemeToggle from US1. Depends on T005 being complete.
- **US3 (P2)**: Independent of US1/US2 toggle logic — only needs layout access from Phase 2. Can run in parallel with US1 color migration tasks.

### Within Each User Story

- T005 (component) before T006 (add to layout)
- T006 before T007–T019 (color migration needs toggle to test against)
- T007–T019 are all [P] — different files, no interdependencies
- T020–T022 extend T005 — must come after T005
- T023–T024 only need T003 — can run in parallel with T007–T019

### Parallel Opportunities

**After T006 is complete, these can ALL run in parallel:**

```
T007  StateGrid.tsx          T016  admin/layout.tsx
T008  Disclaimer.tsx         T017  admin/page.tsx
T009  judges/page.tsx        T018  admin/judges/page.tsx
T010  [state]/page.tsx       T019  admin/judges/new/page.tsx
T011  [county]/page.tsx      T023  FOUC inline script (US3)
T012  [courtType]/page.tsx   T024  No-JS fallback CSS (US3)
T013  [judgeSlug]/page.tsx
T014  not-found.tsx
T015  layout.tsx header border
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T004)
3. Complete Phase 3: US1 core (T005–T006), then all color migration in parallel (T007–T019)
4. **STOP and VALIDATE**: Toggle works, colors change, preference persists
5. This is a shippable increment — basic theme toggle with persistence

### Incremental Delivery

1. Setup + Foundational → Infrastructure ready
2. US1 (toggle + all color migration) → Test independently → **MVP shippable**
3. US2 (icons + hover/focus + a11y) → Test independently → Visual polish complete
4. US3 (FOUC prevention + no-JS) → Test independently → Production quality
5. Polish (build + QA) → Ready for PR

### Single-Developer Recommended Order

Since this is a small feature (26 tasks), sequential execution in priority order:

1. T001 → T002 → T003 → T004 (setup + foundational)
2. T005 → T006 (core component)
3. T020 → T021 → T022 (icons + a11y — do this right after component creation while in the file; deviates from phase order for efficiency since you're already in the file)
4. T007–T019 in any order (color migration — bulk find/replace)
5. T023 → T024 (FOUC prevention)
6. T015 (layout header border — saved for last since layout.tsx has been modified multiple times)
7. T025 → T026 (build + QA)

---

## Notes

- All color migrations (T007–T019) follow the same pattern: replace `"#hexval"` with `"var(--color-token)"` per contracts/color-tokens.md
- ThemeToggle is a `'use client'` component — all other files remain server components
- T001 and T002 create NEW files — all other tasks MODIFY existing files
- Admin pages use additional tokens (badges, inputs, buttons) defined in color-tokens.md
- The FOUC script (T023) must be <250 bytes and synchronous — no async/defer
- Commit logical groups: setup, component, public migration, admin migration, FOUC, polish
