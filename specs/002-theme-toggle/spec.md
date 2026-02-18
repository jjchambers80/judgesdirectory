# Feature Specification: Theme Toggle

**Feature Branch**: `002-theme-toggle`
**Created**: 2026-02-18
**Status**: Draft
**Input**: User description: "light dark system mode theme toggle, place an icon (no text) in flush right in the header"

## Clarifications

### Session 2026-02-18

- Q: Should admin pages be included in theme support or excluded to keep scope tight? → A: Include admin pages — same CSS variable migration as public pages.
- Q: Should the toggle icon have hover/focus visual feedback? → A: Subtle background highlight on hover and visible focus ring on keyboard focus.

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Toggle Between Light, Dark, and System Modes (Priority: P1)

A visitor clicks the theme toggle to cycle the site appearance through three modes: light, dark, and system (OS preference). The selected mode applies immediately to the current page and persists across page navigations and return visits. _(Icon placement and header positioning are covered in US2.)_

**Why this priority**: This is the core functionality — without the toggle working and persisting, the feature has no value.

**Independent Test**: Can be fully tested by loading any page, clicking the toggle icon repeatedly, and observing that the page appearance changes through light → dark → system → light. Refreshing the page confirms the choice persists.

**Acceptance Scenarios**:

1. **Given** a visitor on any page with no prior preference set, **When** the page loads, **Then** the site renders in the user's OS color scheme preference (system mode is the default).
2. **Given** a visitor viewing the site in light mode, **When** they click the theme toggle icon, **Then** the site switches to dark mode immediately without a full page reload.
3. **Given** a visitor viewing the site in dark mode, **When** they click the theme toggle icon, **Then** the site switches to system mode immediately.
4. **Given** a visitor viewing the site in system mode, **When** they click the theme toggle icon, **Then** the site switches to light mode immediately.
5. **Given** a visitor who previously selected dark mode, **When** they close the browser and return later, **Then** the site loads in dark mode.
6. **Given** a visitor who selected dark mode on the states grid page, **When** they navigate to a county listing page, **Then** the dark mode persists without flickering.

---

### User Story 2 — Icon-Only Header Placement (Priority: P1)

The theme toggle is rendered as a single icon button (no text label) positioned flush-right in the existing site header, on the same row as the site name. The icon visually communicates the current active mode (e.g., sun for light, moon for dark, monitor/auto for system).

**Why this priority**: The user explicitly specified icon-only, flush-right header placement — this is a core layout requirement, not optional.

**Independent Test**: Can be tested by inspecting the header on any page — the icon should be right-aligned, vertically centered with the site name, and show the correct icon for the active mode.

**Acceptance Scenarios**:

1. **Given** any page on the site, **When** the page renders, **Then** a theme toggle icon appears in the header, flush-right on the same row as the site name.
2. **Given** the site is in light mode, **When** the visitor looks at the toggle icon, **Then** the icon indicates light mode (e.g., a sun icon).
3. **Given** the site is in dark mode, **When** the visitor looks at the toggle icon, **Then** the icon indicates dark mode (e.g., a moon icon).
4. **Given** the site is in system mode, **When** the visitor looks at the toggle icon, **Then** the icon indicates system/auto mode (e.g., a monitor icon).
5. **Given** a narrow mobile viewport, **When** the page renders, **Then** the toggle icon remains visible and accessible in the header without overlapping the site name.

---

### User Story 3 — No Flash of Incorrect Theme on Page Load (Priority: P2)

When a visitor who previously chose dark mode loads a page, the page renders in dark mode from the very first paint — there is no visible flash of light mode followed by a switch to dark mode (FOUC).

**Why this priority**: Flash of wrong theme is a common UX degradation in SSR apps. Critical for perceived quality but slightly lower priority than core toggle functionality.

**Independent Test**: Can be tested by selecting dark mode, hard-refreshing the page, and visually confirming no white flash appears before the dark theme renders.

**Acceptance Scenarios**:

1. **Given** a visitor with dark mode saved, **When** they hard-refresh the page, **Then** the page background is dark from the first visible frame (no white flash).
2. **Given** a visitor with system mode saved and OS set to dark, **When** they load a page, **Then** the page renders dark from the first visible frame.

---

### Edge Cases

- What happens when a visitor has JavaScript disabled? The site falls back to the user's OS color scheme preference via CSS media query; the toggle icon is not interactive but the site remains usable in the OS-preferred theme.
- What happens when a visitor clears their browser storage? The site reverts to system mode (OS preference) as the default.
- What happens when a visitor switches their OS theme while the site is open in system mode? The site reactively follows the OS change without requiring a page refresh or manual toggle click.
- What happens on pages with inline styles (e.g., admin panel)? Theme colors apply to all pages including admin — admin pages receive the same CSS variable migration as public pages.
- What happens if the toggle icon fails to load? A fallback text character or emoji is shown so the button remains functional.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide a three-state theme toggle cycling through: light → dark → system → light.
- **FR-002**: System MUST render the toggle as a single icon button (no text label) flush-right in the site header, on the same row as the site name.
- **FR-003**: System MUST persist the visitor's selected theme preference in browser local storage so it survives page navigations and return visits.
- **FR-004**: System MUST default to "system" mode (OS color scheme preference) when no stored preference exists.
- **FR-005**: System MUST apply the selected theme immediately on toggle click without a full page reload.
- **FR-006**: System MUST prevent flash of incorrect theme on page load by applying the stored preference before first paint.
- **FR-007**: System MUST display a distinct icon for each mode — one icon for light, one for dark, one for system — so the user can identify the current state at a glance.
- **FR-008**: System MUST reactively follow OS theme changes when in system mode (via the `prefers-color-scheme` media query).
- **FR-009**: System MUST ensure the toggle icon is keyboard-accessible (focusable, activatable with Enter/Space), includes an accessible label for screen readers, shows a subtle background highlight on hover, and displays a visible focus ring on keyboard focus.
- **FR-010**: System MUST apply theme colors consistently across all public-facing pages (states grid, county list, court types, judge list, judge profile, 404 page) and admin pages.

### Key Entities

- **Theme Preference**: The visitor's selected mode (light, dark, or system). Stored client-side only — no server-side persistence or user accounts required.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Visitors can cycle through all three theme modes (light → dark → system) within 3 clicks from any page.
- **SC-002**: Theme preference persists across 100% of page navigations within the site and across browser sessions.
- **SC-003**: No visible flash of incorrect theme on page load when a preference is stored (zero frames of wrong-theme content before correct render).
- **SC-004**: Toggle icon is visible and functional on viewports from 320px to 2560px width without layout breakage.
- **SC-005**: Toggle button passes accessibility audit — keyboard operable, screen reader label present, sufficient color contrast in both light and dark modes.
- **SC-006**: The feature adds no more than 1 second to page load time on a 3G connection compared to the baseline without the toggle.

## Assumptions

- SVG icons will be used inline (no external icon library dependency required) — keeps bundle size minimal per Constitution V (Simplicity).
- CSS custom properties (variables) will manage theme colors — the approach is well-supported across modern browsers (95%+ support).
- A small inline script in `<head>` reads local storage before first paint to prevent FOUC — this is a standard SSR-safe pattern.
- Admin panel pages are in scope per clarification — they receive the same CSS variable migration as public pages.
- No server-side theme detection or cookie-based persistence is needed — local storage is sufficient for an anonymous directory site with no user accounts.
