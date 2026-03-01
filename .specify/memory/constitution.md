<!--
  Sync Impact Report
  ==================
  Version change: 1.1.0 → 1.2.0 (MINOR — new principle added,
    two principles materially revised, tech stack expanded)

  Modified principles:
    - Principle IV: "Progressive Launch & Phased Delivery"
      → "State-by-State Expansion & Phased Delivery" (updated to
      reflect completed MVP and 8-phase roadmap)
    - Principle V: "Simplicity & MVP Discipline"
      → "Simplicity & Incremental Discipline" (reframed for
      post-MVP scope control)

  Added sections:
    - Principle VII. Data Pipeline Integrity & Cost Discipline (new)
    - Technology Stack: Harvesting Pipeline subsection (new)
    - Technology Stack: Design System (planned) subsection (new)
    - Development Workflow: harvesting quality gates added

  Removed sections: None

  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution
      Check section will pick up Principle VII at plan time)
    - .specify/templates/spec-template.md ✅ compatible (specs will
      reference VII in requirements as needed)
    - .specify/templates/tasks-template.md ✅ compatible (pipeline
      tasks fit existing phased structure)
    - .specify/templates/constitution-template.md ✅ no changes needed

  Follow-up TODOs: None
-->

# judgesdirectory.org National Judge Directory Constitution

## Core Principles

### I. Data Accuracy & Source Attribution (NON-NEGOTIABLE)

- All judge profile data MUST originate from publicly available
  government records (state judicial branch websites, Secretary of
  State election records, official judicial biographies).
- Every published data point MUST cite its official source URL.
- Data MUST pass a verification workflow (manual review or
  automated cross-reference with quality gate) before publication.
- Only records with `status = VERIFIED` MUST appear on public
  pages. Unverified, stale, or unverifiable data MUST be withheld.
- Enrichment sources (e.g., Ballotpedia, state bar lookups) MUST
  be stored with separate source URLs and MUST NOT replace
  official government sources.
- Rationale: The directory's credibility depends on factual
  correctness. Inaccurate judicial data creates legal and
  reputational risk. Provenance and verification are the primary
  trust mechanisms.

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
- Pillar pages (curated, long-form jurisdiction overviews) MAY be
  introduced for high-intent location queries when programmatic
  pages would be thin. Both pillar and programmatic pages MUST
  maintain consistent canonical URLs, structured data, and sitemap
  coverage.
- Rationale: Organic search traffic is the primary growth channel.
  SEO architecture is the product's competitive moat. Pillar pages
  hedge against thin-content penalties during early state launches.

### III. Legal Safety & Neutrality (NON-NEGOTIABLE)

- Content MUST maintain a neutral, factual tone with zero editorial
  commentary, ratings, opinions, or scoring of judges.
- Only publicly available records MUST be used; no private or
  leaked information.
- Every page MUST display a clear informational disclaimer stating
  the directory is for informational purposes only.
- Features explicitly excluded (user ratings, reviews, public
  commenting, judicial scoring) MUST NOT be introduced until a
  formal legal review is conducted.
- Sponsored attorney placements MUST be clearly labeled as
  "Sponsored" and MUST NOT imply judicial endorsement of any
  legal services.
- Rationale: Publishing information about sitting judges carries
  significant legal exposure. Strict neutrality and source
  attribution are the primary risk mitigations.

### IV. State-by-State Expansion & Phased Delivery

- The project MUST be delivered in sequential phases, each with
  measurable deliverables that MUST be accepted before the next
  phase begins.
- The current roadmap comprises eight phases: Foundation, Theme
  Toggle, Data Ingestion, Florida Judge Harvest (all completed),
  State Expansion, Search & Discovery, Display Ads, and Attorney
  Placements (planned).
- Expansion to a new state MUST NOT begin until the following
  quality gates are met:
  1. Court structure is seeded and URL configuration is curated.
  2. Harvesting pipeline produces records that pass Zod schema
     validation.
  3. Identity resolution and deduplication are stable (no
     duplicate public pages).
  4. Verification throughput is sufficient to clear the state's
     queue within a defined timeline.
  5. Coverage is sufficient for the majority of target
     jurisdictions (or pillar pages are used to cover gaps).
- Post-expansion items (public API, advanced analytics, civic
  observation integration) MUST remain out of scope until the
  core expansion phases are complete.
- Rationale: State-by-state delivery reduces risk, enables early
  validation per jurisdiction, and prevents scope creep in a
  domain where data quality compounds with scale.

### V. Simplicity & Incremental Discipline

- Each phase MUST have a defined scope. Features outside that
  scope MUST NOT be added during the phase.
- New dependencies or services MUST be justified against the
  defined tech stack before adoption.
- When in doubt, choose the simpler implementation. YAGNI applies.
- Field additions to the judge data model MUST demonstrate clear
  user value or SEO benefit. Free-text fields SHOULD be
  accompanied by a normalization plan to enable future aggregation.
- Rationale: Disciplined scope control is essential at every stage.
  Complexity deferred is complexity avoided.

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
- Rationale: A public judicial directory MUST be usable by all
  citizens including those using assistive technologies. WCAG 2.1
  AA is the recognized legal standard (ADA, Section 508) and
  ensures the widest possible audience has equal access.

### VII. Data Pipeline Integrity & Cost Discipline

- The harvesting pipeline MUST follow the established stage order:
  seed → fetch → extract → enrich → normalize → deduplicate →
  output.
- Deterministic extraction (CSS/XPath patterns for known site
  structures) MUST be preferred over LLM extraction. LLM fallback
  MUST only be used for pages without a deterministic pattern.
- All extraction results MUST be validated against a Zod schema
  before entering the pipeline. Records that fail validation MUST
  be logged and excluded from output.
- Identity resolution MUST assign a stable unique identifier to
  each judge using the defined confidence hierarchy (bar number →
  name + education → name + bar admission → name + appointment →
  name + court + county fallback).
- Deduplication MUST run before output. Duplicate records MUST be
  merged, preserving the highest-confidence identity and all
  source URLs.
- Checkpoint and resume MUST be supported for all harvesting runs.
  A failed run MUST be resumable without re-fetching successfully
  processed pages.
- The cheapest model that reliably returns valid JSON MUST be the
  default for LLM extraction. Higher-cost models MUST only be used
  when the default fails or when context length requires it.
- Every harvesting run MUST produce a quality report documenting:
  pages fetched (success/failure), judges extracted, duplicates
  removed, field coverage percentages, and counties with zero
  judges.
- Rationale: The harvesting pipeline is the primary data supply
  mechanism. Deterministic-first extraction minimizes cost,
  identity resolution prevents duplicate public pages, and quality
  reports provide the operational visibility needed to maintain
  data accuracy at scale.

## Technology Stack & Infrastructure

### Application

- **Framework**: Next.js (SSR for all public pages)
- **Database**: PostgreSQL with Prisma ORM
- **Hosting**: Vercel (production deployment target)
- **Ad Platform**: Google Ad Manager for programmatic display ads
- **Data Entities**: State, County, Court, Judge, ImportBatch —
  relationships MUST follow the defined data model (state → county
  → court → judge hierarchy).
- **Domain**: `https://judgesdirectory.org` — all routes MUST be
  served under this domain.

### Harvesting Pipeline

- **Runtime**: Node.js with TypeScript (strict mode)
- **LLM Providers**: Multi-provider abstraction supporting OpenAI
  and Anthropic. Default: OpenAI gpt-4o-mini for cost efficiency.
- **Validation**: Zod schemas for all extraction results.
- **Enrichment**: Bio page extraction, Ballotpedia integration,
  Florida Bar lookup (planned).
- **Identity**: Stable ID generation with confidence levels (high,
  medium, low) and cross-source matching via Levenshtein distance.

### Design System (Planned)

- **CSS Framework**: Tailwind CSS (migration from inline styles)
- **Component Library**: shadcn/ui (Radix primitives, copy/paste
  ownership model)
- **Documentation**: Storybook for component isolation and visual
  testing
- **Theme**: CSS custom properties in `theme-vars.css` bridged to
  Tailwind via `darkMode: ["class", '[data-theme="dark"]']`

### Infrastructure Rules

- Schema changes MUST be managed via Prisma migrations and
  version-controlled.
- Environment configuration (API keys, database URLs) MUST NOT be
  committed to the repository.
- State harvesting configurations MUST be stored as versioned JSON
  files (e.g., `florida-courts.json`) in the `scripts/harvest/`
  directory.

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
- Harvesting pipeline changes MUST include a quality report
  comparison (before/after) demonstrating no regression in field
  coverage or extraction accuracy.
- New state configurations MUST pass the state expansion quality
  gates (Principle IV) before harvest output is imported into
  production.
- Ad placement zones (header, sidebar, in-content) MUST NOT
  interfere with content readability, SEO performance, or
  accessibility.
- Deployment to production MUST be gated on successful build and
  preview verification on Vercel.

## Governance

- This constitution supersedes all other process documents and
  informal practices for the judgesdirectory.org project.
- All pull requests and code reviews MUST verify compliance with
  these principles. Non-compliance MUST be documented and resolved
  before merge.
- Amendments to this constitution require:
  1. A written proposal describing the change and its rationale.
  2. Review and approval by the project lead.
  3. A migration plan for any in-flight work affected by the
     change.
  4. An updated version number following semantic versioning:
     - MAJOR: Principle removal or incompatible redefinition.
     - MINOR: New principle or materially expanded guidance.
     - PATCH: Clarifications, wording, or non-semantic
       refinements.
- Compliance reviews MUST occur at each phase gate (end of each
  project phase) to verify adherence.
- Runtime development guidance is maintained in project
  documentation (`docs/`, `plan/`, `specs/`) and MUST align with
  this constitution.

**Version**: 1.2.0 | **Ratified**: 2026-02-17 | **Last Amended**: 2026-03-01
