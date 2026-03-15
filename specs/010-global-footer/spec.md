# Feature Specification: Global Footer with Disclaimer

**Feature Branch**: `010-global-footer`  
**Created**: 2026-03-14  
**Status**: Draft  
**Input**: User description: "Add a global footer with copyright and move the disclaimer into the footer, make the callout less colorful grey text is good enough"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See copyright and disclaimer on every page (Priority: P1)

A visitor lands on any page of judgesdirectory.org and sees a consistent footer at the bottom of every page containing copyright information and the legal disclaimer. This replaces the current per-page disclaimer pattern, ensuring the disclaimer is always visible regardless of which page the user is on.

**Why this priority**: The legal disclaimer is required on all public-facing pages (Constitution III: Legal Safety & Neutrality). Moving it to a global footer guarantees consistent display without relying on individual page authors to add it.

**Independent Test**: Navigate to any page on the site (homepage, state listing, county listing, judge profile) and confirm a footer is visible at the bottom containing both copyright text and the legal disclaimer.

**Acceptance Scenarios**:

1. **Given** a visitor is on the judges listing page, **When** they scroll to the bottom, **Then** they see a footer containing a copyright notice (e.g., "© 2026 judgesdirectory.org") and the legal disclaimer text.
2. **Given** a visitor is on a judge profile page, **When** they scroll to the bottom, **Then** they see the same footer with the same content and appearance as on every other page.
3. **Given** a visitor is on any page of the site, **When** the page loads, **Then** the footer is rendered below the main content area without overlapping or obscuring page content.

---

### User Story 2 - Subdued, non-distracting disclaimer styling (Priority: P1)

The disclaimer text in the footer uses neutral grey styling instead of the current amber/yellow callout appearance. The disclaimer should be present but visually quiet — it should not draw attention away from the primary content.

**Why this priority**: The user explicitly requested less colorful styling. The current amber background and border create unnecessary visual weight for what is standard legal boilerplate.

**Independent Test**: View the footer on both light and dark themes and confirm the disclaimer uses muted grey tones (grey text, no colored background) rather than the current amber/yellow palette.

**Acceptance Scenarios**:

1. **Given** the site is viewed in light mode, **When** looking at the footer disclaimer, **Then** the text appears in a muted grey color with no colored background — just subtle grey text.
2. **Given** the site is viewed in dark mode, **When** looking at the footer disclaimer, **Then** the text appears in a muted light-grey color appropriate for dark backgrounds, still without a colored callout.

---

### User Story 3 - Per-page disclaimer removed (Priority: P2)

After the global footer is in place, individual pages no longer include their own inline disclaimer component. This eliminates duplicate disclaimers and simplifies page templates.

**Why this priority**: Cleaning up the per-page imports is a natural follow-up once the global footer is rendering the disclaimer. It reduces maintenance burden and prevents showing the disclaimer twice.

**Independent Test**: Navigate through all page types (judges listing, state, county, court type, judge profile) and confirm the disclaimer appears exactly once — in the footer — not duplicated inline.

**Acceptance Scenarios**:

1. **Given** a visitor is on the judges listing page, **When** they view the full page, **Then** the disclaimer text appears only once (in the footer), not both inline and in the footer.
2. **Given** a developer looks at any page component, **When** they review the imports and JSX, **Then** there is no import or usage of the standalone Disclaimer component.

---

### Edge Cases

- What happens when the page content is very short (less than one screen height)? The footer should still appear at the bottom of the viewport, not floating in the middle of the screen.
- How does the footer behave on mobile viewports? The footer text should wrap gracefully and remain readable on small screens.
- What happens if JavaScript is disabled? The footer must render as server-side HTML and not require client-side JavaScript to display.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The root layout MUST render a `<footer>` element below the `<main>` content area on every page.
- **FR-002**: The footer MUST display a copyright notice including the current year and the site name (judgesdirectory.org).
- **FR-003**: The footer MUST display the full legal disclaimer text currently found in the Disclaimer component.
- **FR-004**: The footer disclaimer text MUST use neutral grey styling — muted grey text on a transparent or near-transparent background, with no amber/yellow colors.
- **FR-005**: The footer MUST be visually separated from the main content (e.g., via a subtle top border or spacing).
- **FR-006**: The footer MUST be accessible — the disclaimer section should retain its `role="note"` and `aria-label` for screen readers.
- **FR-007**: Individual page files MUST remove their per-page Disclaimer component imports and usage after the global footer is added.
- **FR-008**: The footer MUST be a server component (no client-side JavaScript required) to ensure it renders on initial page load.
- **FR-009**: The footer MUST render consistently in both light and dark themes using appropriate grey tones for each.
- **FR-010**: On short pages, the footer MUST appear at the bottom of the viewport (sticky footer behavior), not floating mid-screen.

### Key Entities

- **SiteFooter**: A new global layout-level component rendered in the root layout below `<main>`. Contains copyright text and the disclaimer.
- **Disclaimer (existing)**: The current standalone component that will be deprecated/removed after its content is absorbed into SiteFooter.
- **Theme variables**: The existing disclaimer CSS custom properties (`--color-disclaimer-bg`, `--color-disclaimer-border`, `--color-disclaimer-text`) will be updated or replaced with neutral grey values.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The footer is visible on 100% of public-facing pages without any per-page configuration.
- **SC-002**: The disclaimer appears exactly once per page — in the footer — with no duplicate inline instances.
- **SC-003**: Users report no visual distraction from the disclaimer (grey text blends into the page chrome rather than drawing the eye).
- **SC-004**: The footer renders correctly on viewports from 320px to 1920px wide.
- **SC-005**: The footer achieves a "pass" rating in accessibility audit tools (proper landmark, aria attributes, sufficient contrast for grey text against background).

## Assumptions

- The copyright year will use the current year dynamically rather than being hardcoded.
- The exact disclaimer wording remains unchanged — only its location and visual styling change.
- The site name used in the copyright line is the existing SITE_NAME constant ("judgesdirectory.org").
- "Grey text" means a muted, low-contrast-but-still-readable grey — not invisible. It must still meet WCAG AA contrast requirements (4.5:1 for small text).
- The existing Disclaimer component file can be deleted once the migration is complete, or retained as deprecated if other references exist.

## Scope Boundaries

**In scope**:
- New global SiteFooter component
- Copyright text in footer
- Disclaimer text moved into footer
- Grey/neutral restyling of disclaimer
- Removal of per-page Disclaimer imports
- Light and dark theme support

**Out of scope**:
- Footer navigation links (About, Contact, Privacy Policy, etc.)
- Social media links or icons
- Newsletter signup or other interactive elements
- SEO-specific footer content (sitemaps, etc.)