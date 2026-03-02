# Feature Specification: Design System — shadcn/ui + Tailwind CSS

**Feature Branch**: `005-design-system`
**Created**: 2026-03-01
**Status**: Draft
**Input**: User description: "add design system plans from project roadmap chore: add shadcn/ui components and design system docs, Add shadcn/ui components: badge, button, card, input"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Tailwind + shadcn/ui Foundation (Priority: P1)

A developer opens the project, runs the dev server, and all existing pages render correctly with Tailwind CSS processing utility classes. The `cn()` utility is available for composing class names. Existing CSS custom properties in `theme-vars.css` continue to drive the light/dark theme.

**Why this priority**: Nothing else works until the build pipeline compiles Tailwind classes and the `cn()` utility resolves. The 5 existing shadcn/ui component files already import from `@/lib/utils`, which does not exist yet — this is blocking.

**Independent Test**: Run `npm run build` successfully with zero import errors. Open any page in the browser and confirm existing styles render correctly (no visual regressions).

**Acceptance Scenarios**:

1. **Given** the project has Tailwind CSS configured, **When** a developer runs `npm run dev`, **Then** utility classes (e.g., `bg-background`, `text-foreground`) resolve to the correct CSS custom property values.
2. **Given** `@/lib/utils` exports a `cn()` function, **When** any shadcn/ui component is imported, **Then** the import resolves without error.
3. **Given** `theme-vars.css` defines light and dark variables, **When** the user toggles to dark mode, **Then** Tailwind utility classes using the mapped variables switch correctly.
4. **Given** the project has Tailwind v4, **When** `npm run build` completes, **Then** there are zero type errors and zero missing-module warnings.

---

### User Story 2 — shadcn/ui Core Components Work (Priority: P2)

A developer imports a shadcn/ui component (`Badge`, `Button`, `Card`, `Input`, `Table`) in a page or composite component and it renders with correct styling, supports variants, and passes accessibility checks.

**Why this priority**: These 5 components are the building blocks for migrating existing admin and public components. They must render and be usable before any migration work.

**Independent Test**: Create a simple test page that renders each component with its primary variants. Verify visually and via keyboard navigation.

**Acceptance Scenarios**:

1. **Given** `Badge` is imported, **When** rendered with variant `default`, `secondary`, `destructive`, or `outline`, **Then** each variant displays distinct, theme-appropriate colors.
2. **Given** `Button` is imported, **When** rendered, **Then** it is focusable via keyboard, shows a visible focus ring, and supports `variant` and `size` props.
3. **Given** `Card` is imported with `CardHeader`, `CardTitle`, `CardContent`, **When** rendered, **Then** it displays a contained card with appropriate spacing and border.
4. **Given** `Input` is imported, **When** rendered inside a form, **Then** it accepts text input, supports placeholder, and shows a focus ring on keyboard focus.
5. **Given** `Table` is imported, **When** rendered with rows and columns, **Then** it displays a styled, responsive table.
6. **Given** any component is rendered in dark mode, **When** the theme is toggled, **Then** colors update to the dark palette without page reload.

---

### User Story 3 — Existing Pages Have No Visual Regressions (Priority: P3)

A visitor navigates the public site (state grid, county list, court list, judge profile) and the admin panel after the design system is installed. All pages look and behave the same as before — no layout shifts, no broken styles, no lost dark mode support.

**Why this priority**: The design system adoption must be non-destructive. Existing inline styles and CSS custom properties must continue working during the incremental migration period.

**Independent Test**: Open each major page type in both light and dark mode and compare against the current production appearance.

**Acceptance Scenarios**:

1. **Given** the home page (`/judges`) uses inline styles, **When** Tailwind is installed, **Then** the page renders identically to its pre-migration appearance.
2. **Given** the admin panel uses inline styles, **When** Tailwind is installed, **Then** all admin components render without visual changes.
3. **Given** a user has dark mode enabled, **When** they navigate any page, **Then** dark mode colors apply correctly.
4. **Given** a search engine crawls a public page, **When** it renders the SSR HTML, **Then** all meta tags, JSON-LD, and content are present (no JavaScript-only rendering of critical content).

---

### Edge Cases

- What happens if Tailwind's preflight CSS reset is enabled? It strips default heading sizes, list bullets, and image display — breaking existing pages that rely on browser defaults. Preflight MUST be disabled.
- What happens if Tailwind utility classes conflict with existing inline styles on the same element? Inline styles have higher specificity and should win, preventing regressions until a component is explicitly migrated.
- What happens if `globals.css` with Tailwind v4 `@import` directives is missing? The build should still succeed, but no utility classes will render — this must be validated.
- What happens if a shadcn/ui component is used without the bridge CSS variables? It should still render, but with browser defaults for missing variables — the bridge layer must be present.
- What happens if `class-variance-authority` is not installed? Components importing `cva` will fail at build time — this dependency must be present.

## Clarifications

### Session 2026-03-01

- Q: Should Tailwind's preflight (CSS reset) be enabled, disabled, or scoped? → A: Disabled — no base style resets during this infrastructure phase to guarantee zero regressions.
- Q: Which color tokens must be bridged from theme-vars.css to Tailwind/shadcn variables? → A: Minimum set required by the 5 installed components (~15 semantic tokens: background, foreground, card, primary, secondary, muted, border, input, ring, destructive, accent and their foreground variants). Additional tokens added when new components are installed.
- Q: Should globals.css import theme-vars.css internally (single entry) or should both be imported in the root layout? → A: Single entry — globals.css imports theme-vars.css internally; root layout imports only globals.css.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: The project MUST include a `globals.css` file with Tailwind directives that is imported in the root layout. Tailwind's preflight (base CSS reset) MUST be disabled to prevent visual regressions on existing pages that rely on browser default styles. `globals.css` MUST import `theme-vars.css` internally as a single CSS entry point — the root layout MUST import only `globals.css`, not both files separately.
- **FR-002**: A `cn()` utility function MUST be exported from `@/lib/utils` that merges class names using `clsx` and `tailwind-merge`.
- **FR-003**: CSS custom properties from `theme-vars.css` MUST be bridged to the minimum set of Tailwind/shadcn semantic variable names required by the 5 installed components. This includes approximately 15 tokens: `--background`, `--foreground`, `--card`, `--card-foreground`, `--primary`, `--primary-foreground`, `--secondary`, `--secondary-foreground`, `--muted`, `--muted-foreground`, `--border`, `--input`, `--ring`, `--destructive`, `--accent`, `--accent-foreground`. Additional tokens SHOULD be added only when new components are installed that require them (e.g., `--popover`, `--popover-foreground` when popover-based components are added).
- **FR-004**: Dark mode MUST continue to work via the existing `data-theme="dark"` attribute. Tailwind MUST be configured to recognize this attribute for dark-mode class variants.
- **FR-005**: The following shadcn/ui components MUST be present and functional in `src/components/ui/`: `badge`, `button`, `card`, `input`, `table`.
- **FR-006**: All shadcn/ui components MUST render correctly in both light and dark modes.
- **FR-007**: All shadcn/ui components MUST meet WCAG 2.1 AA accessibility requirements: keyboard operability, visible focus indicators, and minimum color contrast ratios (4.5:1 for normal text, 3:1 for large text).
- **FR-008**: All required dependencies (`tailwindcss`, `@tailwindcss/postcss`, `clsx`, `tailwind-merge`, `class-variance-authority`, `radix-ui`) MUST be installed and listed in `package.json`.
- **FR-009**: The existing `ThemeToggle`, `Disclaimer`, `StateGrid`, admin components, and SEO components MUST NOT be modified in this feature — they continue using inline styles.
- **FR-010**: The `components.json` configuration file for shadcn/ui MUST be present at the project root with correct alias paths.
- **FR-011**: The build (`npm run build`) MUST succeed with zero errors after all changes.

### Assumptions

- Tailwind CSS v4 is the target version (already in `package.json`).
- shadcn/ui's "new-york" style is used (already configured in `components.json`).
- Component migration (replacing inline styles in existing components with shadcn/ui equivalents) is out of scope for this feature — it will be a follow-up effort.
- Storybook integration is out of scope for this feature.
- No new visible UI changes are introduced; this is infrastructure-only from the end user's perspective.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: `npm run build` completes with zero errors and zero warnings related to missing modules or type mismatches.
- **SC-002**: All 5 shadcn/ui components (`badge`, `button`, `card`, `input`, `table`) render correctly when imported in a page.
- **SC-003**: Theme toggling between light, dark, and system modes produces correct color changes on both legacy (inline-styled) and new (Tailwind-styled) elements.
- **SC-004**: All public pages pass Lighthouse accessibility audit with a score of 90 or higher.
- **SC-005**: No visual regressions on existing pages — existing inline styles continue to render as before.
- **SC-006**: A developer can add a new shadcn/ui component via `npx shadcn@latest add <component>` and it installs into the correct directory with working imports.
