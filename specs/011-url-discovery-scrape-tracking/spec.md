# Feature Specification: URL Discovery & Scrape Failure Tracking

**Feature Branch**: `011-url-discovery-scrape-tracking`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: Semi-automated URL discovery pipeline using search engine API to find court roster pages, store candidates in database for review, and track all scrape failures (403s, bot blocks, timeouts, CAPTCHAs, empty pages, SSL errors, DNS failures) with CLI for discovery runs and admin UI for review/approve/reject workflows.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Discover Court Roster URLs for a New State (Priority: P1)

An administrator expanding coverage to a new state runs a discovery command targeting that state. The system queries a search engine for court roster pages, uses AI classification to score each result's likelihood of being a valid judicial roster, and stores the scored candidates in the database for later review.

**Why this priority**: This is the core value proposition. Today, finding court roster URLs requires hours of manual research per state. Automating the search and classification step is the single biggest time savings when scaling from 4 states to 50.

**Independent Test**: Can be fully tested by running a CLI command targeting a known state (e.g., Florida, where we can validate results against the existing hand-curated config) and verifying candidates appear in the database with confidence scores.

**Acceptance Scenarios**:

1. **Given** an administrator has a search engine API key configured, **When** they run the discovery command for a state, **Then** the system queries the search engine with court-level-specific queries (supreme, appellate, trial) and stores resulting URL candidates in the database with suggested court type, level, and confidence score.
2. **Given** the system discovers a URL that already exists in the database, **When** it attempts to store the candidate, **Then** the existing record is preserved (no duplicates created) and a log message indicates the URL was skipped.
3. **Given** the administrator runs the discovery command with a dry-run flag, **When** results are returned, **Then** candidates are displayed in the terminal but not written to the database.
4. **Given** the search engine API returns zero results for a query, **When** the discovery run completes, **Then** the system logs that no candidates were found for that court level and continues to the next query.

---

### User Story 2 - Track Scrape Failures During Harvest Runs (Priority: P1)

When the existing harvest pipeline encounters a failure (HTTP 403, timeout, bot detection, empty page, etc.), the system automatically classifies the failure type and records it in the database with the URL, state, error details, and retry count. When a previously-failed URL later succeeds, the failure record is marked as resolved.

**Why this priority**: Equally critical to discovery. Without failure tracking, the team has no visibility into which URLs are broken, why they fail, or whether problems are getting worse. This data directly informs decisions about which states need alternative fetching strategies (headless browser, proxy, etc.).

**Independent Test**: Can be fully tested by running a harvest against a state known to have unreachable URLs and checking that failure records appear in the database with correct classification. Then re-running after the URL recovers to confirm the resolved timestamp is set.

**Acceptance Scenarios**:

1. **Given** the harvest pipeline fetches a URL that returns HTTP 403, **When** the fetch attempt exhausts its retries, **Then** a scrape failure record is created with failure type "HTTP 403", the HTTP status code, the error message, and the number of retries attempted.
2. **Given** the harvest pipeline fetches a URL that times out, **When** the error is caught, **Then** a scrape failure record is created with failure type "Timeout".
3. **Given** the harvest pipeline fetches a URL that returns HTTP 200 but yields zero judges after extraction, **When** the extraction completes, **Then** a scrape failure record is created with failure type "Empty Page".
4. **Given** a URL returns a response containing CAPTCHA or bot-challenge indicators (e.g., "verify you are human", Cloudflare challenge page), **When** the system inspects the response, **Then** a scrape failure record is created with failure type "CAPTCHA Detected".
5. **Given** a URL that previously had a scrape failure record, **When** a subsequent harvest run successfully fetches and extracts judges from that URL, **Then** the failure record's resolved timestamp is set and the resolution is logged.
6. **Given** a harvest run encounters an SSL certificate error or DNS resolution failure, **When** the error is caught, **Then** a scrape failure record is created with the appropriate failure type ("SSL Error" or "DNS Failure").

---

### User Story 3 - Review and Approve Discovered URL Candidates (Priority: P2)

An administrator opens the discovery review page in the admin panel to see all discovered URL candidates. They can filter by state and status, review the suggested court type and confidence score for each candidate, and approve or reject candidates individually or in bulk. Approved candidates can then be promoted into the state's court configuration.

**Why this priority**: Discovery without a review step would allow false positives (news articles, bar association pages) into the harvest pipeline. The review UI is the human-in-the-loop quality gate that makes the discovery output trustworthy.

**Independent Test**: Can be fully tested by populating the database with sample candidates (discovered status) and verifying that the admin page loads, filters work, and approve/reject actions update the database. Then clicking "Promote to Config" and verifying a valid configuration file is generated.

**Acceptance Scenarios**:

1. **Given** an administrator navigates to the discovery review page, **When** the page loads, **Then** all discovered URL candidates are displayed in a table showing URL, state, suggested court type, suggested level, confidence score, status, and discovery date.
2. **Given** the administrator selects a state filter, **When** the filter is applied, **Then** only candidates for that state are displayed.
3. **Given** the administrator clicks "Approve" on a candidate, **When** the action completes, **Then** the candidate's status changes to "Approved" and a reviewed timestamp is recorded.
4. **Given** the administrator clicks "Reject" on a candidate, **When** a rejection reason is provided, **Then** the candidate's status changes to "Rejected" with the reason stored.
5. **Given** the administrator selects multiple candidates and clicks "Bulk Approve", **When** the action completes, **Then** all selected candidates are marked as "Approved".
6. **Given** one or more candidates for a state are approved, **When** the administrator clicks "Promote to Config", **Then** the system generates a valid court configuration file for that state containing only the approved URLs with their court metadata.

---

### User Story 4 - View and Manage Scrape Failures (Priority: P2)

An administrator opens the scrape failures page in the admin panel to see all recorded failures across states. They can filter by state, failure type, and date range. When a failure has been manually investigated and resolved (e.g., by adding a headless browser config, contacting the court IT department, or switching to an alternative URL), the administrator marks it as resolved with notes.

**Why this priority**: Visibility into failures is critical for maintaining data freshness. Without this UI, failure data sits unused in the database. The UI turns raw failure records into actionable intelligence.

**Independent Test**: Can be fully tested by inserting sample failure records into the database and verifying the admin page displays them with correct failure types, filters work as expected, and the "Mark Resolved" action persists to the database.

**Acceptance Scenarios**:

1. **Given** an administrator navigates to the scrape failures page, **When** the page loads, **Then** all failure records are displayed in a table showing URL, state, failure type, HTTP status code, error message excerpt, retry count, last attempt date, and resolution status.
2. **Given** the administrator filters by failure type "CAPTCHA Detected", **When** the filter is applied, **Then** only CAPTCHA-related failures are displayed.
3. **Given** the administrator clicks "Mark Resolved" on a failure record, **When** they provide resolution notes (e.g., "Switched to headless browser fetch"), **Then** the failure's resolved timestamp is set and the notes are stored.
4. **Given** multiple failures exist for the same URL, **When** the administrator views the failures list, **Then** the most recent failure for each URL is prominently shown with a count of total occurrences.

---

### User Story 5 - Navigate to Discovery and Failures from Admin Dashboard (Priority: P3)

The admin dashboard includes cards linking to the discovery review page and the scrape failures page, consistent with the existing admin navigation pattern. The admin navigation bar also includes links to both new pages.

**Why this priority**: This is a navigation convenience feature. The pages function independently, but dashboard integration makes them discoverable for new administrators.

**Independent Test**: Can be fully tested by loading the admin dashboard and verifying two new cards appear, and clicking each navigates to the correct page.

**Acceptance Scenarios**:

1. **Given** an administrator loads the admin dashboard, **When** the page renders, **Then** cards for "URL Discovery" and "Scrape Failures" are visible with brief descriptions and link to their respective pages.
2. **Given** any admin page is loaded, **When** the administrator views the navigation bar, **Then** links for "Discovery" and "Scrape Failures" are present and functional.

---

### Edge Cases

- What happens when the search engine API key is missing or invalid? The system displays a clear error at CLI startup and exits without making any requests.
- What happens when the search engine API rate limit is exceeded? The system logs the rate limit response and stops the current discovery run with a message indicating how many candidates were found before the limit.
- What happens when the LLM classification service is unavailable? Candidates are stored with a null confidence score and flagged for manual classification.
- What happens when a URL returns intermittent failures (succeeds sometimes, fails others)? Each failure creates a new record; the system does not overwrite previous failure records. The admin UI shows all historical failures for trend analysis.
- What happens when an approved candidate URL later starts failing during harvest? A scrape failure record is created like any other URL. The admin can see both the approved discovery record and the failure record for the same URL.
- What happens when promoting candidates to config for a state that already has a config file? The system merges new approved URLs into the existing config, preserving all existing entries.
- What happens when two discovery runs are triggered simultaneously? The second run detects an active run via a database advisory lock (DiscoveryRun record with status "running") and aborts immediately with a clear message, preventing duplicate candidate insertion races.

## Requirements _(mandatory)_

### Functional Requirements

**URL Discovery**:

- **FR-001**: System MUST query the Google Custom Search JSON API for court roster page candidates using state-specific and court-level-specific search queries.
- **FR-002**: System MUST classify each search result using AI to determine whether it is a judicial roster page, and assign a court type, court level, and confidence score (0.0–1.0).
- **FR-003**: System MUST store discovered URL candidates with their classification metadata, the search query that found them, and the search result snippet text.
- **FR-004**: System MUST deduplicate candidates — if a URL already exists in the candidate store, no duplicate is created.
- **FR-005**: System MUST support a dry-run mode that displays candidates in the terminal without persisting them.
- **FR-005a**: System MUST automatically transition URL candidates from "Discovered" to "Stale" status when they have been in "Discovered" status for 30 or more days without being reviewed. Stale candidates remain visible in the admin UI and can still be approved or rejected.
- **FR-006**: System MUST support promoting approved candidates into a state court configuration file, merging with any existing configuration.
- **FR-006a**: System MUST enforce single-run concurrency for discovery via a database advisory lock — if a DiscoveryRun record with status "running" exists, a new run MUST abort immediately with a descriptive error message.

**Scrape Failure Tracking**:

- **FR-007**: System MUST automatically record scrape failures during harvest runs, capturing the URL, state, failure type classification, HTTP status code (when applicable), error message, and retry count.
- **FR-008**: System MUST classify failures into distinct types: HTTP 403, HTTP 429, Timeout, CAPTCHA Detected, SSL Error, DNS Failure, Empty Page (200 response with zero judges extracted), Parse Error, and Unknown.
- **FR-009**: System MUST detect CAPTCHA/bot-challenge responses by inspecting response body content for known challenge indicators.
- **FR-010**: System MUST automatically mark a failure record as resolved when a subsequent harvest run successfully processes the same URL.
- **FR-011**: System MUST not break the existing harvest pipeline — failure tracking is additive and non-blocking. If failure recording itself fails (e.g., database unavailable), the harvest continues normally with a warning logged.
- **FR-011a**: System MUST automatically purge resolved scrape failure records older than 90 days. Unresolved failure records MUST be retained indefinitely regardless of age.
- **FR-011b**: System MUST enforce a minimum 2-second delay between HTTP requests to the same domain during harvest runs. The delay MUST be configurable per state via the court configuration file, defaulting to 2 seconds if not specified.

**Admin Review**:

- **FR-012**: Administrators MUST be able to view all URL candidates with filtering by state and status, sorted by confidence score or discovery date.
- **FR-013**: Administrators MUST be able to approve or reject individual candidates, with a required rejection reason for rejections.
- **FR-014**: Administrators MUST be able to bulk-approve or bulk-reject multiple candidates at once.
- **FR-015**: Administrators MUST be able to view all scrape failure records with filtering by state, failure type, and date range.
- **FR-016**: Administrators MUST be able to mark failure records as resolved with free-text resolution notes.
- **FR-017**: Admin pages MUST be protected by the same authentication mechanism used for existing admin pages.

### Key Entities

- **URL Candidate**: A potential court roster page discovered via search engine. Key attributes: URL (unique), state, suggested court type and level, AI confidence score, search query origin, discovery status (Discovered → Stale after 30 days unreviewed, Approved, Rejected), rejection reason, promotion timestamp.
- **Scrape Failure**: A record of a failed attempt to fetch or extract data from a URL during a harvest run. Key attributes: URL, state, failure type classification, HTTP status code, error message, retry count, attempt timestamp, resolution timestamp, resolution notes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An administrator can discover court roster URL candidates for a new state in under 5 minutes (versus hours of manual research).
- **SC-002**: At least 60% of discovered candidates for a state with known court websites score above 0.7 confidence and are valid roster pages upon manual review.
- **SC-003**: 100% of scrape failures during harvest runs are automatically recorded in the database with correct failure type classification.
- **SC-004**: Administrators can review, approve, and promote discovered URLs for a state through the admin UI in under 10 minutes.
- **SC-005**: When a previously-failed URL recovers, the system automatically marks the failure as resolved within the next harvest run.
- **SC-006**: The admin scrape failures page provides enough information (failure type, error message, URL, date) for an administrator to diagnose and plan a resolution without needing to consult log files.
- **SC-007**: Failure tracking has zero impact on harvest pipeline performance — the existing pipeline does not slow down or break due to failure recording.

## Clarifications

### Session 2026-03-15

- Q: Which search engine API provider should the system use? → A: Google Custom Search JSON API (100 free queries/day, $5/1000 after; structured metadata, Node.js SDK)
- Q: How should the system handle concurrent discovery runs? → A: Advisory lock via database — check for an active DiscoveryRun record with status "running"; abort with a clear message if one exists.
- Q: What is the data retention policy for scrape failure records? → A: 90 days — purge resolved failures older than 90 days; keep unresolved failures indefinitely.
- Q: What triggers a URL candidate to become "Stale"? → A: Time-based — candidates in "Discovered" status for 30+ days automatically transition to "Stale".
- Q: What request throttling strategy should the harvest pipeline use for court websites? → A: 2-second delay between requests to the same domain, configurable per state in the court config.

## Assumptions

- The Google Custom Search JSON API free tier (100 queries/day) is sufficient for initial coverage of all 50 US states, given approximately 5 queries per state per court level.
- Government court roster pages are predominantly hosted on `.gov` domains, though some states may use `.us` or `.org` domains for court websites.
- The existing AI classification capability used by the harvest pipeline is capable of classifying whether a search result snippet describes a judicial roster page with reasonable accuracy.
- Basic HTTP authentication (matching existing admin pattern) is sufficient security for the admin review pages.
- CAPTCHA/bot-challenge detection via keyword matching in response bodies (e.g., "captcha", "verify you are human", "Cloudflare challenge") captures the majority of bot-blocking scenarios encountered on government websites.
- A 2-second default delay between requests to the same domain is sufficient politeness for government court websites and configurable per state to accommodate sites with stricter or more lenient rate tolerance.
- A single failure record per URL per harvest run is sufficient granularity — we do not need to track each individual retry attempt as a separate record.
- Resolved scrape failure records older than 90 days can be safely purged without losing operationally relevant data. Unresolved records are kept indefinitely to ensure no failure is silently forgotten.

## Out of Scope

- Fully automated end-to-end discovery-to-harvest pipeline with no human review step.
- Automated CAPTCHA solving or bot-detection evasion.
- Proxy rotation or IP management for circumventing blocks.
- Real-time monitoring or alerting when new failures occur (notifications, email alerts).
- Historical trend analysis or failure dashboards with charts and graphs.
- Discovery of court pages on non-English language websites.
