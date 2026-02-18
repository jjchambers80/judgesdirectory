<!--
  Sync Impact Report
  ==================
  Version change: 1.0.0 → 1.1.0 (MINOR — new principle added)
  Modified principles: None renamed or redefined
  Added sections:
    - Principle VI. Accessibility & WCAG Compliance (new)
    - Development Workflow: accessibility quality gate added
  Removed sections: None
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution
      Check section will pick up Principle VI at plan time)
    - .specify/templates/spec-template.md ✅ compatible (specs will
      reference VI in requirements as needed)
    - .specify/templates/tasks-template.md ✅ compatible (accessibility
      tasks fit existing phased structure)
  Follow-up TODOs: None
-->

# judgesdirectory.org National Judge Directory MVP Constitution

## Core Principles

### I. Data Accuracy & Source Attribution (NON-NEGOTIABLE)

- All judge profile data MUST originate from publicly available
  government records (state judicial branch websites, Secretary of
  State election records, official judicial biographies).
- Every published data point MUST cite its official source.
- Data MUST pass a manual verification workflow before publication.
- Stale or unverifiable data MUST be flagged and withheld until
  confirmed.
- Rationale: The directory's credibility depends on factual
  correctness. Inaccurate judicial data creates legal and
  reputational risk.

### II. SEO-First Architecture

- Every routing, URL, and page-rendering decision MUST prioritize
  search engine discoverability.
- The hierarchical URL structure (`/judges/{state}/{county}/
{court-type}/{judge-name}`) MUST be maintained without exception.
- Every indexable page MUST include Schema.org JSON-LD structured
  data and be included in the XML sitemap.
- Server-side rendering (SSR) via Next.js MUST be used for all
  public-facing pages to ensure crawlability.
- Programmatic page titles MUST follow keyword templates (e.g.,
  "Judges in {County}", "{Judge Name} biography").
- Rationale: Organic search traffic is the primary growth channel.
  SEO architecture is the product's competitive moat.

### III. Legal Safety & Neutrality (NON-NEGOTIABLE)

- Content MUST maintain a neutral, factual tone with zero editorial
  commentary, ratings, opinions, or scoring of judges.
- Only publicly available records MUST be used; no private or
  leaked information.
- Every page MUST display a clear informational disclaimer stating
  the directory is for informational purposes only.
- Features explicitly excluded (user ratings, reviews, public
  commenting, judicial scoring) MUST NOT be introduced until a
  formal legal review is conducted post-MVP.
- Rationale: Publishing information about sitting judges carries
  significant legal exposure. Strict neutrality and source
  attribution are the primary risk mitigations.

### IV. Progressive Launch & Phased Delivery

- The project MUST be delivered in four distinct phases (Foundation,
  Data Ingestion, Profile Optimization, Monetization) over 90–120
  days.
- Each phase MUST have measurable deliverables and MUST NOT begin
  until its predecessor's deliverables are accepted.
- Pilot launch MUST cover exactly 3 states with a minimum of 1,500
  verified judge profiles before any expansion work begins.
- Post-MVP expansion items (10-state rollout, automated ingestion,
  election history, term alerts, analytics dashboard) MUST remain
  out of scope during MVP delivery.
- Rationale: Phased delivery reduces risk, enables early
  validation, and prevents scope creep in a domain where data
  quality compounds with scale.

### V. Simplicity & MVP Discipline

- The MVP feature set is fixed: state grid, county lists, court
  breakdowns, judge profiles, name search, state/county/court
  filters, SEO infrastructure, display ads, and manual attorney
  placements.
- Excluded features (user accounts, public API, advanced analytics,
  civic observation integration) MUST NOT be added during MVP.
- New dependencies or services MUST be justified against the
  defined tech stack (Next.js, PostgreSQL, Prisma, Vercel, Google
  Ad Manager) before adoption.
- When in doubt, choose the simpler implementation. YAGNI applies.
- Rationale: A focused MVP shipped on time with accurate data is
  more valuable than a feature-rich product that never launches.

### VI. Accessibility & WCAG Compliance

- All public-facing pages MUST conform to WCAG 2.1 Level AA
  success criteria.
- Semantic HTML MUST be used for all page structure: headings
  (`h1`–`h6`) in logical order, `nav` for navigation, `main` for
  primary content, `footer` for site footer, lists for grouped
  items.
- All interactive elements (links, buttons, form controls) MUST be
  fully operable via keyboard alone with a visible focus indicator.
- Color MUST NOT be the sole means of conveying information.
  Text color contrast MUST meet a minimum ratio of 4.5:1 for
  normal text and 3:1 for large text (≥18pt or ≥14pt bold) per
  WCAG 2.1 SC 1.4.3.
- All form inputs MUST have associated `<label>` elements or
  `aria-label`/`aria-labelledby` attributes. Validation errors
  MUST be programmatically associated with their fields.
- All images and meaningful icons MUST have descriptive `alt` text
  or an equivalent accessible name. Decorative images MUST use
  `alt=""` or `aria-hidden="true"`.
- Pages MUST remain usable and readable when zoomed to 200% and
  MUST reflow content without horizontal scrolling at viewport
  widths down to 320px (WCAG 2.1 SC 1.4.10 Reflow).
- Motion and animation MUST respect `prefers-reduced-motion`.
  Transitions MUST be suppressed or shortened when the user has
  enabled reduced-motion preferences.
- ARIA attributes MUST only be used to supplement native HTML
  semantics, never as a substitute for correct element choice
  (e.g., use `<button>` instead of `<div role="button">`).
- Skip-navigation links MUST be provided to allow keyboard users
  to bypass repeated header/navigation content.
- Page `<title>` elements and heading hierarchy MUST accurately
  describe page content for screen reader users.
- Rationale: A publicly funded judicial directory MUST be usable
  by all citizens including those using assistive technologies.
  WCAG 2.1 AA is the recognized legal standard (ADA, Section 508)
  and ensures the widest possible audience has equal access.

## Technology Stack & Infrastructure

- **Framework**: Next.js (SSR for all public pages)
- **Database**: PostgreSQL with Prisma ORM
- **Hosting**: Vercel (production deployment target)
- **Ad Platform**: Google Ad Manager for programmatic display ads
- **Data Entities**: State, County, Court, Judge — relationships
  MUST follow the defined data model (state → county → court →
  judge hierarchy).
- **Domain**: `https://judgesdirectory.org` — all routes MUST be
  served under this domain.
- Schema changes MUST be managed via Prisma migrations and version-
  controlled.
- Environment configuration (API keys, database URLs) MUST NOT be
  committed to the repository.

## Development Workflow & Quality Gates

- All code changes MUST be submitted via pull request with at least
  one reviewer.
- Every PR MUST pass linting, type checks, and automated tests
  before merge.
- Judge data ingestion MUST include a verification step (manual or
  automated cross-reference) before data enters production.
- SEO compliance MUST be validated on every page change: structured
  data present, sitemap updated, canonical URL correct, SSR
  rendering verified.
- Accessibility compliance MUST be validated on every UI change:
  Lighthouse accessibility score MUST be ≥ 90, keyboard navigation
  MUST be verified, and color contrast MUST meet WCAG 2.1 AA
  ratios. Axe or equivalent automated a11y checks SHOULD be run
  as part of PR review.
- Ad placement zones (header, sidebar, in-content) MUST NOT
  interfere with content readability, SEO performance, or
  accessibility.
- Deployment to production MUST be gated on successful build and
  preview verification on Vercel.

## Governance

- This constitution supersedes all other process documents and
  informal practices for the judgesdirectory.org MVP project.
- All pull requests and code reviews MUST verify compliance with
  these principles. Non-compliance MUST be documented and resolved
  before merge.
- Amendments to this constitution require:
  1. A written proposal describing the change and its rationale.
  2. Review and approval by the project lead.
  3. A migration plan for any in-flight work affected by the change.
  4. An updated version number following semantic versioning:
     - MAJOR: Principle removal or incompatible redefinition.
     - MINOR: New principle or materially expanded guidance.
     - PATCH: Clarifications, wording, or non-semantic refinements.
- Compliance reviews MUST occur at each phase gate (end of each
  project phase) to verify adherence.
- Runtime development guidance is maintained in project
  documentation and MUST align with this constitution.

**Version**: 1.1.0 | **Ratified**: 2026-02-17 | **Last Amended**: 2026-02-18
