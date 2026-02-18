<!--
  Sync Impact Report
  ==================
  Version change: N/A → 1.0.0 (initial ratification)
  Modified principles: N/A (initial)
  Added sections:
    - Core Principles (5 principles)
    - Technology Stack & Infrastructure
    - Development Workflow & Quality Gates
    - Governance
  Removed sections: N/A (initial)
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ compatible (Constitution Check
      section will be populated from these principles at plan time)
    - .specify/templates/spec-template.md ✅ compatible (no changes needed)
    - .specify/templates/tasks-template.md ✅ compatible (phased delivery
      aligns with Progressive Launch principle)
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
- Ad placement zones (header, sidebar, in-content) MUST NOT
  interfere with content readability or SEO performance.
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

**Version**: 1.0.0 | **Ratified**: 2026-02-17 | **Last Amended**: 2026-02-17
