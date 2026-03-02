# Feature Specification: Design System Rebuild — Mobile-First, ADA-Compliant Layouts

**Feature Branch**: `006-design-system-rebuild`
**Created**: 2026-03-01
**Status**: Draft
**Input**: User description: "Go through all the pages and components and rebuild the layouts, mobile first and ADA compliant using our new design system, apply the theme colors. Apply design system classes to all components."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Mobile-First Responsive Layouts (Priority: P1)

A visitor opens the Judges Directory on a mobile phone (320px–480px viewport). Every page — from the state grid to judge profiles — displays with a readable, single-column layout that adapts gracefully to tablet (768px) and desktop (1280px+) viewports. No horizontal scrolling, no text overflow, no elements hidden off-screen.

**Why this priority**: The majority of public-records and legal-directory traffic comes from mobile devices. A non-responsive layout loses visitors immediately and hurts search rankings (Google mobile-first indexing).

**Independent Test**: Open each public and admin page in Chrome DevTools at 375px, 768px, and 1280px widths. Verify no layout breakage, no horizontal overflow, and all interactive elements are tappable at standard touch targets (minimum 44×44px).

**Acceptance Scenarios**:

1. **Given** a visitor on a 375px-wide device, **When** they open the states grid page, **Then** state cards stack in a single column with full-width layout and readable text.
2. **Given** a visitor on a 768px tablet, **When** they open a county list page, **Then** county cards display in a 2-column grid with consistent spacing.
3. **Given** a visitor on a 1280px desktop, **When** they open a court types page, **Then** court cards display in a 3-column grid layout.
4. **Given** an admin on a small screen, **When** they open the admin navigation, **Then** the navigation is accessible (wraps or collapses) rather than overflowing horizontally.
5. **Given** the judge profile page, **When** viewed on mobile, **Then** the photo and name section stacks vertically, and the info grid switches to a single-column layout.
6. **Given** any data table in the admin panel, **When** viewed on mobile, **Then** the table is horizontally scrollable within its container without causing the entire page to scroll.

---

### User Story 2 — ADA/WCAG 2.1 AA Compliance (Priority: P1)

A visitor using a screen reader (VoiceOver, NVDA) or keyboard-only navigation can access every page, understand its structure, and complete all tasks. All color combinations meet WCAG 2.1 AA contrast ratios. Semantic HTML and ARIA attributes provide meaningful context.

**Why this priority**: ADA compliance is a legal requirement for public-facing directory websites. It also improves SEO and general usability. This is co-priority P1 because it must be addressed simultaneously with layout work — not bolted on afterward.

**Independent Test**: Run axe-core or Lighthouse accessibility audit on every page. All pages must score 90+ with zero critical violations. Manually test full keyboard navigation flow through the site.

**Acceptance Scenarios**:

1. **Given** a keyboard-only user on any page, **When** they press Tab, **Then** a skip-navigation link appears as the first focusable element, allowing them to jump to main content.
2. **Given** a screen reader user on a directory page, **When** the breadcrumb navigation is encountered, **Then** it is announced as "Breadcrumb" navigation with `aria-label="Breadcrumb"` and the current page link has `aria-current="page"`.
3. **Given** all text and background color pairs on the site, **When** measured with a contrast checker, **Then** normal text meets 4.5:1 ratio and large text meets 3:1 ratio in both light and dark modes.
4. **Given** any interactive element (link, button, input, select), **When** it receives keyboard focus, **Then** a visible focus indicator appears that meets WCAG 2.4.7, using the design system's ring style.
5. **Given** the admin form for adding a judge, **When** a required field has a validation error, **Then** the error message is associated with the input via `aria-describedby` and the input has `aria-invalid="true"`.
6. **Given** any page with a heading structure, **When** analyzed for heading hierarchy, **Then** headings follow a logical order (h1 → h2 → h3) with no skipped levels.

---

### User Story 3 — Design System Class Migration (Priority: P2)

A developer opens any component file and sees Tailwind utility classes and design system tokens instead of inline `style={{}}` objects. All colors reference the semantic design system tokens (e.g., `text-foreground`, `bg-card`, `border-border`) rather than raw CSS variables or hardcoded hex values. The `cn()` utility is used for conditional class composition.

**Why this priority**: Migrating to design system classes is the implementation vehicle for achieving P1 goals. It also establishes long-term maintainability, consistency, and developer experience for future features.

**Independent Test**: Search the codebase for `style={{` in all migrated components — zero occurrences should remain. Verify all migrated components use `cn()` for class composition.

**Acceptance Scenarios**:

1. **Given** any migrated component, **When** a developer inspects the code, **Then** it uses Tailwind utility classes exclusively (no inline `style={{}}` objects).
2. **Given** any migrated component referencing colors, **When** inspected, **Then** it uses semantic tokens (`text-foreground`, `bg-muted`, `border-border`) not raw CSS variables (`var(--color-*)`) or hex values.
3. **Given** the root layout (`layout.tsx`), **When** migrated, **Then** it uses Tailwind spacing, flex, and border utilities for the header and main content area.
4. **Given** the admin layout, **When** migrated, **Then** navigation links use design system link styling with consistent hover and focus states.
5. **Given** existing theme toggling between light, dark, and system modes, **When** all components are migrated, **Then** theme switching still works correctly with no visual regressions.

---

### User Story 4 — Admin Panel Usability on Mobile (Priority: P3)

An admin user accesses the admin panel from a mobile device to quickly verify a judge record or check import progress. The admin navigation, forms, data tables, and action buttons are usable on touch devices.

**Why this priority**: While admin usage is primarily desktop, mobile access for quick tasks improves operational flexibility. Lower priority because the admin audience is smaller and more tolerant of minor layout adjustments.

**Independent Test**: Complete the judge verification workflow entirely on a 375px viewport — select filters, review a record, approve/reject. All actions must be reachable and tappable.

**Acceptance Scenarios**:

1. **Given** an admin on mobile, **When** they open the admin panel, **Then** the navigation links wrap into multiple rows or collapse into an accessible menu.
2. **Given** the admin judge creation form, **When** opened on mobile, **Then** all form fields stack vertically, labels are above inputs, and the submit button is full-width.
3. **Given** the CSV import page on mobile, **When** the upload drop zone is shown, **Then** it is full-width and the tap target for file selection meets the 44×44px minimum.
4. **Given** the verification queue on mobile, **When** viewing the judge table, **Then** the table scrolls horizontally within a contained wrapper without breaking page layout.

---

### Edge Cases

- What happens when a page has no data (e.g., a state with zero counties)? Empty states must be styled with the design system and include helpful messaging, not raw unstyled text.
- What happens when a judge profile has no photo? The layout must not collapse or leave a broken image placeholder; it should gracefully omit the photo section.
- What happens when breadcrumb text is extremely long (e.g., "Circuit Court of the Seventeenth Judicial Circuit")? Text must truncate with ellipsis on mobile or wrap gracefully on larger screens.
- What happens when the admin loads 500+ judge rows in the table? The table must remain performant, and the horizontal scroll container must not cause the entire page to jump.
- What happens when a user zooms to 200%? Per WCAG 1.4.4, all content must remain readable and functional at 200% zoom without horizontal scrolling.
- What happens in dark mode? All migrated components must respect the design system's dark mode tokens — no hardcoded light-only colors survive the migration.

## Clarifications

### Session 2026-03-01

- **Q1: shadcn/ui component adoption depth** — Should raw `<input>`, `<button>`, `<table>`, card-like `<div>`s, and status badges be replaced with shadcn equivalents, or just have inline styles swapped for Tailwind classes on existing HTML elements?
  → **A: Adopt shadcn where available.** Replace raw `<input>`, `<button>`, `<table>`, card-like `<div>`s, and status badge `<span>`s with shadcn `Input`, `Button`, `Table`, `Card`, and `Badge` components. No additional shadcn components (e.g., `Select`, `Label`) will be installed — only the 5 already present.

- **Q2: Admin navigation mobile pattern** — The admin nav has 7 links. On mobile, should they wrap, collapse behind a hamburger, or scroll horizontally?
  → **A: Flex-wrap.** Links wrap into multiple rows naturally. No JavaScript required, all links always visible. Simplest approach consistent with admin panel's functional focus.

- **Q3: Typography base styles** — Headings and body text currently rely on browser defaults (preflight is disabled). How should typography be handled after migration?
  → **A: Global `@layer base` styles in `globals.css`.** Add a typography base layer that styles `h1`–`h6`, `p`, and `a` with `@apply` directives. Components inherit these defaults and can override per-element. No new plugins installed.

- **Q4: Loading/empty state styling** — Several admin components have raw unstyled "Loading..." and "No data" strings. Should these get shared components or inline styling?
  → **A: Inline Tailwind classes.** Style each loading/empty state directly where it appears (e.g., `text-muted-foreground text-sm py-8 text-center`). Only ~8 instances — no shared component needed.

- **Q5: Unmapped color tokens in judge profile** — Hardcoded hex colors (`#b45309`, `#fef3c7`, etc.) map to existing CSS variables (`--color-badge-warning-text`, `--color-badge-warning-bg`) that are NOT bridged to Tailwind tokens. How to handle?
  → **A: Extend the bridge layer.** Add new `@theme inline` entries in `globals.css` for badge, warning, success, error, disclaimer, and link tokens. `theme-vars.css` remains unchanged; only `globals.css` bridge section is extended.

## Requirements _(mandatory)_

### Functional Requirements

#### Layout & Responsiveness

- **FR-001**: All page layouts MUST follow a mobile-first approach — base styles target small screens (< 640px), with progressive enhancements at `sm` (640px), `md` (768px), and `lg` (1024px) breakpoints.
- **FR-002**: The root layout header MUST be responsive — stacking the site name and theme toggle vertically on mobile and displaying them in a row on larger screens.
- **FR-003**: All card grid layouts (state grid, county list, court types, judge list, admin dashboard) MUST use a single column on mobile, 2 columns on tablet, and 3+ columns on desktop.
- **FR-004**: The admin navigation MUST use flex-wrap on small screens so links flow into multiple rows naturally. No JavaScript-based hamburger menu or horizontal scrolling — all links remain visible at all viewport sizes.
- **FR-005**: Data tables in admin pages MUST be wrapped in a horizontally-scrollable container that does not cause full-page horizontal scrolling.
- **FR-006**: The judge profile page MUST stack photo and info sections vertically on mobile and display them side-by-side on desktop.
- **FR-007**: All form layouts (admin judge creation, CSV import) MUST stack fields vertically on mobile with full-width inputs.
- **FR-008**: The main content area MUST use responsive padding — smaller padding on mobile (1rem) and standard padding (2rem) on larger screens — with a max-width container.

#### Accessibility (ADA / WCAG 2.1 AA)

- **FR-009**: A skip-navigation link MUST be the first focusable element in the DOM, visually hidden until focused, linking to the `<main>` element with `id="main-content"`.
- **FR-010**: All breadcrumb navigation elements MUST have `aria-label="Breadcrumb"` and the current (last) item MUST have `aria-current="page"`.
- **FR-011**: All interactive elements MUST have visible focus indicators using the design system's ring utility.
- **FR-012**: All form inputs MUST be associated with labels via `htmlFor`/`id` pairs. Validation errors MUST be linked via `aria-describedby` with `aria-invalid="true"` on the input.
- **FR-013**: All color combinations MUST meet WCAG 2.1 AA contrast ratios: 4.5:1 for normal text (< 18px), 3:1 for large text (≥ 18px or 14px bold) in both light and dark modes.
- **FR-014**: Touch targets for all interactive elements MUST be at least 44×44 CSS pixels.
- **FR-015**: Heading hierarchy MUST be logical and sequential on every page — one `<h1>` per page, followed by `<h2>`, `<h3>`, etc., with no skipped levels.
- **FR-016**: The site MUST remain fully usable at 200% browser zoom with no horizontal scrolling and no content clipping.
- **FR-017**: All images MUST have descriptive `alt` text. Decorative images MUST have `alt=""` and `aria-hidden="true"`.
- **FR-018**: The `<html>` element MUST retain `lang="en"` for screen reader language detection.

#### Design System Migration

- **FR-019**: All inline `style={{}}` objects in migrated components MUST be replaced with Tailwind utility classes using the design system's semantic tokens.
- **FR-020**: All color references MUST use semantic design system tokens (`text-foreground`, `bg-card`, `border-border`, etc.) — no raw CSS variables (`var(--color-*)`) or hardcoded hex values in component JSX.
- **FR-021**: Hardcoded hex colors in the judge profile page MUST be replaced with corresponding design system tokens — enabled by extending the bridge layer in `globals.css` (see FR-029).
- **FR-022**: All migrated components MUST use the `cn()` utility from `@/lib/utils` for composing class names.
- **FR-023**: Where shadcn/ui components exist (`Badge`, `Button`, `Card`, `Input`, `Table`), they MUST be used in place of custom markup (raw `<input>`, `<button>`, `<table>`, card-like `<div>`s, status `<span>`s) for consistent styling and built-in accessibility. No additional shadcn components will be installed beyond the existing 5.
- **FR-024**: The `Disclaimer` component MUST use design system classes, preserving its `role="note"` and `aria-label` attributes.
- **FR-025**: The `ThemeToggle` component MUST retain its current functionality and accessibility while being migrated to design system classes.
- **FR-026**: The `StateGrid` component MUST use responsive grid classes replacing its inline grid styles.
- **FR-028**: A global typography base layer MUST be added in `globals.css` using `@layer base` with `@apply` directives to style `h1`–`h6`, `p`, and `a` elements. This replaces reliance on browser defaults and ensures consistent typography across all pages. Components MAY override these base styles per-element.
- **FR-029**: The `globals.css` bridge layer (`@theme inline`) MUST be extended with additional semantic tokens for badge, warning, success, error, disclaimer, link, and toggle colors. Specifically: `--color-link`, `--color-disclaimer-bg`, `--color-disclaimer-border`, `--color-disclaimer-text`, `--color-badge-success-bg`, `--color-badge-success-text`, `--color-badge-warning-bg`, `--color-badge-warning-text`, `--color-error-bg`, `--color-error-text`, `--color-btn-primary-disabled`, `--color-toggle-hover`, `--color-input-border-error`. `theme-vars.css` remains unchanged.
- **FR-030**: Loading and empty states (~8 instances across admin components) MUST be styled with inline Tailwind classes (e.g., `text-muted-foreground text-sm py-8 text-center`). No shared loading/empty-state components will be created.

#### Scope: Components to Migrate

- **FR-027**: The following files MUST be migrated (21 total):
  - **Layouts (3)**: `src/app/layout.tsx`, `src/app/admin/layout.tsx`, `src/app/not-found.tsx`
  - **Public pages (5)**: `src/app/judges/page.tsx`, `src/app/judges/[state]/page.tsx`, `src/app/judges/[state]/[county]/page.tsx`, `src/app/judges/[state]/[county]/[courtType]/page.tsx`, `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx`
  - **Admin pages (7)**: `src/app/admin/page.tsx`, `src/app/admin/dashboard/page.tsx`, `src/app/admin/courts/page.tsx`, `src/app/admin/import/page.tsx`, `src/app/admin/verification/page.tsx`, `src/app/admin/judges/page.tsx`, `src/app/admin/judges/new/page.tsx`
  - **Shared components (2)**: `src/components/StateGrid.tsx`, `src/components/Disclaimer.tsx`
  - **Admin components (6)**: `src/components/admin/ProgressDashboard.tsx`, `src/components/admin/BulkCourtForm.tsx`, `src/components/admin/CsvUploader.tsx`, `src/components/admin/ColumnMapper.tsx`, `src/components/admin/ImportSummary.tsx`, `src/components/admin/VerificationQueue.tsx`

### Key Entities

- **Design Token**: A semantic color or spacing value defined in the theme (e.g., `foreground`, `background`, `muted`, `border`) that maps to CSS custom properties and is consumed via Tailwind utility classes.
- **Breakpoint**: A viewport-width threshold at which the layout reorganizes. Three primary breakpoints: `sm` (640px), `md` (768px), `lg` (1024px).
- **Component**: A React file (`.tsx`) in `src/components/` or inline in a page file that renders UI. Each is migrated independently.

### Assumptions

- The design system infrastructure from feature 005 (Tailwind v4, shadcn/ui bridge layer, `cn()` utility, CSS variable bridge in `globals.css`) is fully operational and is a prerequisite for this work.
- The existing 5 shadcn/ui components (`Badge`, `Button`, `Card`, `Input`, `Table`) are available and functional for adoption where appropriate.
- `ThemeToggle` is kept as a standalone component (not replaced by a shadcn component) but is migrated to Tailwind classes.
- No new pages or features are being added — this is purely a styling/layout/accessibility rebuild of existing content.
- The existing CSS custom properties in `theme-vars.css` remain unchanged. The bridge layer in `globals.css` will be extended with additional `@theme inline` entries (per FR-029) and a `@layer base` typography block (per FR-028).
- Server components remain server components; client components remain client components — no rendering strategy changes.
- JSON-LD structured data and SEO metadata are preserved exactly as-is.
- The migration does not change any data-fetching logic, API endpoints, or Prisma queries.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All 21 files listed in FR-027 contain zero inline `style={{}}` objects — verified by codebase search.
- **SC-002**: All public pages (states grid, county list, court types, judge list, judge profile) display correctly at 375px, 768px, and 1280px viewports with no horizontal overflow.
- **SC-003**: Every public page scores 90 or higher on Lighthouse accessibility audit.
- **SC-004**: Zero axe-core critical or serious violations across all pages in both light and dark modes.
- **SC-005**: A keyboard-only user can navigate from the skip link through all interactive elements on every page without getting trapped.
- **SC-006**: All admin panel pages are usable on a 375px viewport — all actions reachable, all form fields accessible, all data tables scrollable.
- **SC-007**: Theme toggling (light → dark → system) continues to work correctly on all migrated components with no visual regressions.
- **SC-008**: The project builds successfully with zero errors after all migrations are complete.
- **SC-009**: Zero hardcoded hex color values remain in any migrated component file.
- **SC-010**: All touch targets on interactive elements measure at least 44×44 CSS pixels on mobile viewports.
