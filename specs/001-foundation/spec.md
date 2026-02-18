# Feature Specification: Phase 1 — Foundation

**Feature Branch**: `001-foundation`  
**Created**: 2026-02-17  
**Status**: Draft  
**Input**: User description: "Phase 1 - Foundation: Database schema implementation, Next.js SSR routing structure for judgesdirectory.org, admin ingestion panel (internal use), XML sitemap generator, Schema.org structured data implementation, hosting deployment (Vercel)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Browse States Grid (Priority: P1)

A visitor lands on the directory home page at `/judges` and sees a grid of all 50 U.S. states. Each state tile displays the state name and links to the state's county listing page. States without any judge data yet are visually distinguished but remain navigable.

**Why this priority**: The states grid is the single entry point to the entire directory hierarchy. Without it, no other page in the URL structure is reachable by users or crawlers. It also produces the broadest programmatic SEO landing page.

**Independent Test**: Navigate to `/judges` in a browser; confirm all 50 states render server-side, each links to `/judges/{state-slug}`, the page title follows the SEO template, JSON-LD structured data is present, and the page appears in `/sitemap.xml`.

**Acceptance Scenarios**:

1. **Given** the database is seeded with 50 states, **When** a visitor requests `/judges`, **Then** the page renders server-side with a grid of 50 state tiles, each linking to `/judges/{state-slug}`.
2. **Given** the page is rendered, **When** a search engine crawls `/judges`, **Then** the response includes Schema.org `ItemList` JSON-LD and a `<title>` of "U.S. Judges Directory — Browse by State".
3. **Given** the XML sitemap exists, **When** `/sitemap.xml` is requested, **Then** it contains an entry for `/judges` and all 50 `/judges/{state-slug}` URLs.

---

### User Story 2 — Browse Counties Within a State (Priority: P1)

A visitor navigates to `/judges/{state}` and sees a list of all counties in that state. Each county links to its court-type breakdown page.

**Why this priority**: County pages are the second level of the hierarchy. They are required for the state → county → court → judge drill-down and serve as high-value SEO pages targeting queries like "Judges in {County}, {State}".

**Independent Test**: Navigate to `/judges/texas`; verify all Texas counties render, each links to `/judges/texas/{county-slug}`, SSR and JSON-LD are present.

**Acceptance Scenarios**:

1. **Given** the database has counties for Texas, **When** a visitor requests `/judges/texas`, **Then** the page renders a list of all Texas counties with links to `/judges/texas/{county-slug}`.
2. **Given** the state slug does not exist, **When** a visitor requests `/judges/nonexistent`, **Then** the server returns a 404 page.
3. **Given** the page renders, **When** viewed by a crawler, **Then** the `<title>` is "Judges in Texas — County Directory" and JSON-LD `ItemList` is present.

---

### User Story 3 — Browse Court Types Within a County (Priority: P1)

A visitor navigates to `/judges/{state}/{county}` and sees a breakdown of court types (e.g., District Court, County Court, Family Court). Each court type links to its judge listing.

**Why this priority**: Court-type pages complete the navigational hierarchy above individual judge profiles and serve as programmatic SEO pages targeting queries like "{Court Type} Judges in {County}, {State}".

**Independent Test**: Navigate to `/judges/texas/harris-county`; verify court types render with links to `/judges/texas/harris-county/{court-type-slug}`.

**Acceptance Scenarios**:

1. **Given** Harris County has District Court and Family Court records, **When** a visitor requests `/judges/texas/harris-county`, **Then** the page lists both court types with links to their respective pages.
2. **Given** the county slug does not exist under the given state, **When** requested, **Then** the server returns a 404 page.
3. **Given** the page renders, **When** viewed by a crawler, **Then** JSON-LD `ItemList` and SEO-template title are present.

---

### User Story 4 — View Judge Listing by Court Type (Priority: P2)

A visitor navigates to `/judges/{state}/{county}/{court-type}` and sees a list of all judges assigned to that court. Each judge name links to their individual profile page.

**Why this priority**: This page bridges the hierarchy to individual profiles. It is necessary before judge profiles become reachable via navigation, but is ranked P2 because it depends on at least some judge data being ingested.

**Independent Test**: Navigate to `/judges/texas/harris-county/district-court`; verify judge names render as links to `/judges/texas/harris-county/district-court/{judge-slug}`.

**Acceptance Scenarios**:

1. **Given** there are 5 judges in Harris County District Court, **When** a visitor requests the court-type page, **Then** all 5 judges are listed with full names linking to their profile pages.
2. **Given** the court-type slug is invalid for the given county, **When** requested, **Then** the server returns a 404 page.
3. **Given** a court currently has zero judges, **When** the page renders, **Then** a "No judges currently listed" message is displayed.

---

### User Story 5 — View Individual Judge Profile (Priority: P2)

A visitor navigates to `/judges/{state}/{county}/{court-type}/{judge-slug}` and sees a structured profile page displaying the judge's full name, court assignment, term dates, selection method, appointing authority, education, prior experience, and political affiliation. An informational disclaimer is displayed on every profile page.

**Why this priority**: Judge profiles are the ultimate content pages that drive long-tail SEO traffic and will become the monetization surface for ads and attorney placements in later phases.

**Independent Test**: Navigate to a judge profile URL; verify all populated data fields render, JSON-LD `Person` structured data is present, and the disclaimer is visible.

**Acceptance Scenarios**:

1. **Given** a judge record exists with all fields populated, **When** a visitor requests the profile URL, **Then** the page displays all fields in a structured layout with proper headings.
2. **Given** the judge record has null optional fields (e.g., `appointingAuthority` is null), **When** the profile renders, **Then** those sections are gracefully omitted — no "null", empty headings, or blank sections displayed.
3. **Given** the page is rendered, **When** a crawler indexes it, **Then** JSON-LD contains `@type: Person` with `name`, `jobTitle`, `worksFor`, and `description` properties.
4. **Given** any judge profile page, **When** rendered, **Then** a clearly visible informational disclaimer is present stating the directory is for informational purposes only.

---

### User Story 6 — Admin Data Ingestion (Priority: P2)

An internal team member accesses a protected ingestion panel to upload or manually enter judge records. The panel validates data completeness, flags missing required fields, and writes verified records to the database.

**Why this priority**: The database cannot be populated without an ingestion mechanism. This panel is a prerequisite for Phase 2 (Data Ingestion) but the interface must be built in Phase 1 so the data pipeline is ready.

**Independent Test**: Access the admin panel; submit a judge record with all required fields — verify it persists to the database. Submit a record with a missing required field — verify it is rejected with a clear error message.

**Acceptance Scenarios**:

1. **Given** an admin accesses the ingestion panel, **When** they submit a complete judge record (full name, court, term dates), **Then** the record is persisted to the database and a success confirmation is displayed.
2. **Given** an admin submits a record missing the required `fullName` field, **When** validation runs, **Then** the submission is rejected with a specific error identifying the missing field.
3. **Given** an admin submits a record where the generated `slug` already exists for the same court, **Then** the system either auto-disambiguates the slug or rejects the duplicate with a clear message.
4. **Given** the admin panel, **When** accessed without proper authorization, **Then** the system denies access.

---

### User Story 7 — XML Sitemap Generation (Priority: P1)

The system automatically generates a valid XML sitemap at `/sitemap.xml` that includes all indexable URLs in the hierarchy: the states page, every state page, every county page, every court-type page, and every judge profile page.

**Why this priority**: The sitemap is critical for search engine discovery and crawling. Without it, programmatic pages may never be indexed. This must ship with the initial deployment.

**Independent Test**: Request `/sitemap.xml`; validate it returns valid XML with correct `<url>` entries matching all database records.

**Acceptance Scenarios**:

1. **Given** the database has 50 states, 100 counties, 150 courts, and 500 judges, **When** `/sitemap.xml` is requested, **Then** it returns valid XML with 801 URL entries (1 index + 50 + 100 + 150 + 500).
2. **Given** a new judge is added to the database, **When** the sitemap regenerates on next request, **Then** the new judge's URL is included.
3. **Given** the sitemap exceeds 50,000 URLs, **When** requested, **Then** it returns a sitemap index referencing multiple sitemap files (each ≤ 50,000 URLs).

---

### User Story 8 — Deployment and Hosting (Priority: P1)

The application is deployed to Vercel with production environment configuration, preview deployments for pull requests, and secure environment variable management for the database connection and any service credentials.

**Why this priority**: No user story is accessible without hosting infrastructure. This is a day-one requirement that enables everything else.

**Independent Test**: Push to `main` branch; verify a production deployment triggers. Open a PR; verify a preview deployment URL is generated. Confirm SSR pages render correctly in the deployed environment.

**Acceptance Scenarios**:

1. **Given** the repository is connected to Vercel, **When** a commit is pushed to `main`, **Then** a production deployment triggers and completes successfully.
2. **Given** a pull request is opened, **When** Vercel detects the branch, **Then** a preview deployment URL is generated and accessible.
3. **Given** the production deployment is live, **When** `/judges` is requested, **Then** it returns server-rendered HTML (not a client-side loading spinner).
4. **Given** the deployment configuration, **When** inspected, **Then** no environment variables or database credentials are exposed in client-side bundles.

---

### Edge Cases

- **State with zero counties**: The state page renders with a "No counties available yet" message and still returns a 200 status.
- **County with zero courts**: The county page renders with a "No court records available" message.
- **Court with zero judges**: The court-type page renders with a "No judges currently listed" message.
- **Special characters in names**: URL slugs are normalized to lowercase ASCII with hyphens during ingestion; non-ASCII characters are transliterated or stripped.
- **Duplicate judge names in same court**: Slugs are disambiguated with a numeric suffix (e.g., `john-smith-2`).
- **Database unreachable**: SSR returns a generic 500 error page — no stack traces, connection strings, or internal details exposed.
- **Very long names**: Slugs are truncated to 100 characters maximum.
- **Trailing slashes**: URLs with and without trailing slashes resolve to the same canonical URL (redirect or rewrite).
- **Mixed-case URLs**: `/judges/Texas` redirects to `/judges/texas` (canonical lowercase).

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST render all public-facing pages via server-side rendering to ensure full crawlability by search engines.
- **FR-002**: System MUST implement the five-level URL hierarchy: `/judges`, `/judges/{state}`, `/judges/{state}/{county}`, `/judges/{state}/{county}/{court-type}`, `/judges/{state}/{county}/{court-type}/{judge-slug}`.
- **FR-003**: System MUST return proper HTTP 404 responses for invalid slugs at any level of the hierarchy.
- **FR-004**: System MUST generate Schema.org JSON-LD structured data on every indexable page — `ItemList` for listing pages and `Person` for judge profiles.
- **FR-005**: System MUST generate a valid XML sitemap at `/sitemap.xml` covering all indexable URLs, with sitemap index support for > 50,000 URLs.
- **FR-006**: System MUST persist data using a relational database following the four-entity data model: State → County → Court → Judge.
- **FR-007**: System MUST provide an internal admin ingestion panel for creating and editing judge records with field-level validation.
- **FR-008**: System MUST display an informational disclaimer on every public-facing page stating the directory is for informational purposes only.
- **FR-018**: System MUST only display judge records on public pages where `verified = true`; unverified records MUST be visible only in the admin panel.
- **FR-019**: System MUST require a `sourceUrl` (public government source link) when creating or verifying a judge record via the admin panel.
- **FR-009**: System MUST normalize all URL slugs to lowercase ASCII with hyphens, handling duplicates with numeric suffixes.
- **FR-010**: System MUST manage all database schema changes via versioned migrations committed to source control.
- **FR-011**: System MUST deploy to a hosting platform with server-side rendering support and environment variable management.
- **FR-012**: System MUST include `<title>` tags following SEO keyword templates on every page (e.g., "Judges in {County}, {State} — judgesdirectory.org").
- **FR-013**: System MUST include canonical URL `<link rel="canonical">` tags on every indexable page.
- **FR-014**: System MUST seed the database with all 50 U.S. states and their counties (~3,143 counties).
- **FR-015**: System MUST NOT expose environment variables, database credentials, or stack traces to public users or in client-side bundles.
- **FR-016**: System MUST redirect or rewrite mixed-case and trailing-slash URL variants to their canonical lowercase form.
- **FR-017**: System MUST restrict access to the admin ingestion panel to authorized internal users only.

### Key Entities

- **State**: Represents a U.S. state or territory. Key attributes: unique identifier, display name, URL-safe slug. One state contains many counties.
- **County**: Represents a county (or parish/borough) within a state. Key attributes: unique identifier, parent state reference, display name, URL-safe slug. One county contains many courts.
- **Court**: Represents a court within a county. Key attributes: unique identifier, parent county reference, court type designation (e.g., "District Court", "Family Court"), URL-safe slug. One court has many judges.
- **Judge**: Represents an individual judge assigned to a court. Key attributes: unique identifier, full name, URL-safe slug, parent court reference, term start date, term end date, selection method (elected/appointed), appointing authority, education background, prior professional experience, political affiliation, record creation timestamp, record update timestamp.

## Assumptions

- The three pilot states for Phase 2 data ingestion have not yet been selected; the foundation must support all 50 states structurally so any three can be activated.
- The admin ingestion panel is internal-only (not public-facing) and does not require a user account system — a simple authentication gate (e.g., environment-variable-based shared credential or OAuth with a single provider) is sufficient for MVP.
- County data for all 50 states is available from public reference sources (e.g., Census Bureau FIPS codes) and can be seeded programmatically.
- Court type is a free-text designation (not a fixed enum) since court naming conventions vary by state.
- The judge profile page does not include search, ads, or attorney placements in Phase 1 — those are Phase 3 and Phase 4 deliverables.
- The sitemap regenerates on each request (or on a short cache interval) rather than requiring a manual rebuild.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: All five levels of the URL hierarchy return server-rendered HTML viewable without JavaScript within 1 second of page load on standard connections.
- **SC-002**: Every indexable page includes valid Schema.org JSON-LD that passes structured data validation tools without errors.
- **SC-003**: `/sitemap.xml` returns valid XML containing all database-derived URLs confirmed by an XML sitemap validator.
- **SC-004**: Database contains all 50 U.S. states and their counties (~3,143 counties) after the seed process completes.
- **SC-005**: Admin ingestion panel successfully creates, validates, and persists judge records — rejects incomplete records with specific field-level error messages.
- **SC-006**: Production deployment completes without errors and all SSR routes respond correctly when accessed via the public URL.
- **SC-007**: SEO audit score ≥ 90 on the `/judges` states grid page and a sample judge profile page.
- **SC-008**: Zero instances of environment variables, database credentials, or internal error details exposed in any public page response or client-side bundle.
