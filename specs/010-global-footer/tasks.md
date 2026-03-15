# Tasks: Global Footer with Disclaimer

**Input**: Design documents from `/specs/010-global-footer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: Not requested — no test tasks included.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Phase 1: Setup

**Purpose**: No new project initialization needed — working within existing Next.js project. This phase covers the foundational CSS changes that all user stories depend on.

- [X] T001 Update light theme disclaimer CSS variables to grey values in `src/app/theme-vars.css` (`:root` / `[data-theme="light"]` block: `--color-disclaimer-bg: transparent`, `--color-disclaimer-border: #e5e7eb`, `--color-disclaimer-text: #6b7280`)
- [X] T002 Update dark theme disclaimer CSS variables to grey values in `src/app/theme-vars.css` (`[data-theme="dark"]` block: `--color-disclaimer-bg: transparent`, `--color-disclaimer-border: #374151`, `--color-disclaimer-text: #9ca3af`)
- [X] T003 Update no-JS fallback dark theme disclaimer CSS variables to grey values in `src/app/theme-vars.css` (`@media (prefers-color-scheme: dark)` block — if disclaimer vars are repeated there, update to match dark values)

**Checkpoint**: Theme variables updated — amber/yellow disclaimer colors replaced with neutral grey across all theme modes.

---

## Phase 2: User Story 1 — See copyright and disclaimer on every page (Priority: P1) 🎯 MVP

**Goal**: A global footer appears on every page with copyright text and disclaimer, styled with subdued grey text. Footer sticks to viewport bottom on short pages.

**Independent Test**: Navigate to any page, scroll to bottom, confirm footer is visible with copyright year + site name + disclaimer text in grey.

### Implementation for User Story 1

- [X] T004 [US1] Create `SiteFooter` server component in `src/components/SiteFooter.tsx` — renders `<footer>` with: top border (`border-t border-border`) for visual separation from main content (FR-005), copyright line using `SITE_NAME` constant and dynamic year, disclaimer `<aside>` with `role="note"` and `aria-label="Legal disclaimer"`, grey text styling via `text-disclaimer-text` / `border-disclaimer-border` classes, responsive padding matching site max-width (`max-w-[1200px]`)
- [X] T005 [US1] Add sticky footer layout to `<body>` in `src/app/layout.tsx` — add `min-h-screen flex flex-col` classes to `<body>`, add `flex-grow` (or `flex-1`) to `<main>` element
- [X] T006 [US1] Import and render `<SiteFooter />` after `</main>` in `src/app/layout.tsx`

**Checkpoint**: Footer is visible on every page with copyright + disclaimer in grey. Short pages push footer to viewport bottom. US1 complete and testable — this is the MVP.

---

## Phase 3: User Story 3 — Per-page disclaimer removed (Priority: P2)

**Goal**: Remove all per-page Disclaimer component imports so the disclaimer appears exactly once (in the global footer).

**Independent Test**: Navigate through all page types and confirm no duplicate disclaimer. Grep codebase for `Disclaimer` imports and find zero hits in page files.

### Implementation for User Story 3

- [X] T007 [P] [US3] Remove Disclaimer import and `<Disclaimer />` usage from `src/app/judges/page.tsx`
- [X] T008 [P] [US3] Remove Disclaimer import and `<Disclaimer />` usage from `src/app/judges/[state]/page.tsx`
- [X] T009 [P] [US3] Remove Disclaimer import and `<Disclaimer />` usage from `src/app/judges/[state]/[county]/page.tsx`
- [X] T010 [P] [US3] Remove Disclaimer import and `<Disclaimer />` usage from `src/app/judges/[state]/[county]/[courtType]/page.tsx`
- [X] T011 [P] [US3] Remove Disclaimer import and `<Disclaimer />` usage from `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx`
- [X] T012 [US3] Delete `src/components/Disclaimer.tsx` (absorbed into SiteFooter)

**Checkpoint**: Disclaimer appears exactly once per page (in footer). No duplicate inline instances. US3 complete.

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: Final validation, styling verification, and cleanup

- [X] T013 [US2] Verify WCAG AA contrast for disclaimer text — light mode: `#6b7280` on `#ffffff` ≥ 4.5:1, dark mode: `#9ca3af` on `#111827` ≥ 4.5:1. Adjust values if needed in `src/app/theme-vars.css`
- [X] T014 [US2] Verify disclaimer renders with no background color (transparent) and only a subtle top border in both themes by inspecting `src/components/SiteFooter.tsx` output
- [X] T015 Run `quickstart.md` acceptance checks — verify all 8 items pass
- [X] T016 Verify footer renders correctly without JavaScript (disable JS in browser, confirm SSR output)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — can start immediately
- **Phase 2 (US1)**: Depends on Phase 1 (theme vars must be grey before component uses them)
- **Phase 3 (US3)**: Depends on Phase 2 (footer must be rendering before removing per-page disclaimers)
- **Phase 4 (Polish)**: Depends on Phase 3 completion

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 setup only — delivers the MVP
- **US2 (P1)**: Styling delivered by Phase 1 + T004; verified in Phase 4 polish
- **US3 (P2)**: Depends on US1 — cleanup pass after global footer is confirmed working

### Parallel Opportunities

- T001, T002, T003 edit the same file — run sequentially
- T007, T008, T009, T010, T011 can ALL run in parallel (different files, no dependencies between them)
- T013, T014, T015, T016 can run in parallel (independent verification checks)

---

## Parallel Example: User Story 3

```text
# All page cleanups can run in parallel (different files):
T007: Remove Disclaimer from src/app/judges/page.tsx
T008: Remove Disclaimer from src/app/judges/[state]/page.tsx
T009: Remove Disclaimer from src/app/judges/[state]/[county]/page.tsx
T010: Remove Disclaimer from src/app/judges/[state]/[county]/[courtType]/page.tsx
T011: Remove Disclaimer from src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx

# Then delete the component (depends on all removals):
T012: Delete src/components/Disclaimer.tsx
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Update theme variables to grey
2. Complete Phase 2: Create SiteFooter + update layout
3. **STOP and VALIDATE**: Footer visible on all pages, grey styling, sticky behavior
4. Deploy/demo if ready — disclaimer still appears twice (footer + inline) but MVP is functional

### Incremental Delivery

1. Phase 1 → Grey theme variables ready
2. Phase 2 (US1) → Footer on every page → **MVP!**
3. Phase 3 (US3) → Per-page disclaimers removed → Single source of truth
4. Phase 4 → Styling verified (US2) + final validation pass

---

## Notes

- All 5 per-page Disclaimer removals (T007–T011) are [P] — parallelizable across different files
- T012 (delete Disclaimer.tsx) MUST wait until all 5 page removals are done
- SiteFooter is a server component — no "use client" directive needed
- Copyright year uses `new Date().getFullYear()` — dynamic, no hardcoding
- SITE_NAME constant imported from `@/lib/constants`
