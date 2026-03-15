# Feature Specification: URL Health Scoring & Delta-Run Prioritization

**Feature Branch**: `012-url-health`  
**Created**: 2026-03-15  
**Status**: Draft  
**Input**: User description: "I want a way to determine the quality of a URL so the system can get smart and prioritize URLs with historical healthy data when it does delta runs. Would adding on the discover URL table a field that documents how many records were collected for the last harvest and calculate this int to the confidence score or should we have a separate score for this?"

## Architectural Decision

**Recommendation: Separate `UrlHealth` model + `ScrapeLog` history table — NOT fields on UrlCandidate.**

### Why NOT add fields to UrlCandidate?

1. **Scope mismatch**: UrlCandidate is a *discovery-phase* entity answering "is this a court roster?" — health answers a fundamentally different question: "does this URL reliably produce data?"
2. **Coverage gap**: The system already has 4 manually-configured states (FL, TX, NY, CA) with court URLs that *never went through discovery*. Health tracking must cover ALL harvest URLs, not just discovered ones.
3. **Semantic confusion**: UrlCandidate.confidenceScore means "LLM confidence this is a judicial roster." Overloading it with harvest yield data muddies both signals and makes the admin UI harder to interpret.
4. **Lifecycle mismatch**: Candidates are reviewed once and promoted. Health evolves continuously across many harvests. Different update cadences belong in different tables.

### Why a separate UrlHealth + ScrapeLog pair?

1. **Universal coverage**: Tracks ANY URL the harvest pipeline touches, regardless of origin (discovered, manual config, or future sources).
2. **Trend analysis**: ScrapeLog records every harvest attempt per URL, enabling "this URL yielded 12 judges last month but 0 today" visibility.
3. **Composite health score**: Computed from multiple signals (yield consistency, failure rate, freshness) rather than a single raw count.
4. **Delta-run intelligence**: The harvest pipeline can query UrlHealth to prioritize URLs by reliability, skip chronically broken ones, and focus on stale-but-healthy URLs first.

---

## User Scenarios & Testing

### User Story 1 — Harvest Pipeline Prioritizes Healthy URLs (Priority: P1)

When the system operator runs a delta harvest, the pipeline automatically scrapes stale-but-healthy URLs first, defers chronically broken URLs, and reports on URL health changes — without any manual intervention.

**Why this priority**: This is the core value proposition. Without smart prioritization, every delta run wastes time and API credits on broken URLs while healthy URLs with outdated data wait.

**Independent Test**: Run a harvest with `--delta` on a state with a mix of healthy and broken URLs. Verify healthy-stale URLs are processed first, broken URLs are deferred, and the run completes faster than a full harvest.

**Acceptance Scenarios**:

1. **Given** a state with 20 URLs where 5 are stale-but-healthy (last harvest >7 days, health score >0.7) and 3 are chronically broken (health score <0.3), **When** the operator runs `--delta`, **Then** the 5 stale-healthy URLs are processed first, followed by remaining URLs, and the 3 broken URLs are processed last (or skipped with `--skip-broken`).
2. **Given** a URL that previously yielded 15 judges but now yields 0, **When** the harvest completes, **Then** the URL's health score decreases, the yield drop is logged, and the admin is notified of the anomaly.
3. **Given** a URL with no prior harvest history, **When** it is scraped for the first time, **Then** a UrlHealth record is created with the initial yield and a neutral health score.

---

### User Story 2 — Admin Reviews URL Health in Dashboard (Priority: P2)

The admin views a health dashboard showing per-URL yield history, health scores, and trends — enabling informed decisions about which URLs to keep, investigate, or remove from the config.

**Why this priority**: Visibility into URL health lets the admin make data-driven decisions about the harvest config rather than guessing.

**Independent Test**: Navigate to `/admin/health/`, verify URLs are listed with health scores, last yield, trend indicators, and can be filtered/sorted.

**Acceptance Scenarios**:

1. **Given** the admin navigates to `/admin/health/`, **When** the page loads, **Then** all tracked URLs are displayed with health score, last yield count, last scrape date, failure count, and a trend indicator (improving/stable/declining).
2. **Given** a URL with health score below 0.3, **When** displayed in the list, **Then** it is visually flagged as unhealthy (red indicator).
3. **Given** the admin filters by state "FL" and sorts by health score ascending, **When** results load, **Then** the unhealthiest Florida URLs appear first.

---

### User Story 3 — Health Score Auto-Updates After Each Harvest (Priority: P1)

After every harvest run, the system automatically records a scrape log entry for each URL processed and recomputes the health score — no manual step required.

**Why this priority**: Tied to P1 because the prioritization in Story 1 depends on health scores being current. If scores don't auto-update, the entire feature breaks.

**Independent Test**: Run a harvest for one state, then query the UrlHealth table and ScrapeLog table. Verify new records were created and health scores were recomputed.

**Acceptance Scenarios**:

1. **Given** a harvest run processes a URL, **When** extraction completes with 12 judges found, **Then** a ScrapeLog entry is created with `judgesFound=12, success=true` and the UrlHealth record is updated with recomputed health score.
2. **Given** a URL fetch fails with HTTP 403, **When** the failure is recorded, **Then** a ScrapeLog entry is created with `success=false, failureType=HTTP_403` and the health score decreases.
3. **Given** a URL has 10 successful scrapes averaging 15 judges each, **When** a new scrape yields 15 judges, **Then** the health score remains high (>0.8) and the yield consistency signal stays stable.

---

### User Story 4 — Config Promoter Seeds Health Record (Priority: P3)

When a UrlCandidate is promoted to the state config, the system seeds an initial UrlHealth record so it immediately participates in delta-run prioritization.

**Why this priority**: Nice-to-have that closes the loop between discovery and health. Without this, newly promoted URLs start with no health data, which is acceptable (they'd be treated as neutral priority).

**Independent Test**: Promote a UrlCandidate via the admin UI, verify a UrlHealth record is seeded.

**Acceptance Scenarios**:

1. **Given** an APPROVED UrlCandidate, **When** the admin promotes it to the state config, **Then** a UrlHealth record is created with a neutral health score, zero scrapes, and source marked as DISCOVERED.
2. **Given** an existing URL already in a state config that was never discovered, **When** it is first harvested, **Then** a UrlHealth record is created with source marked as MANUAL.

---

### Edge Cases

- What happens when a URL is removed from the state config? UrlHealth record is retained (soft archive via `active=false`) for historical analysis but excluded from delta-run prioritization.
- What happens when a URL changes (redirect)? The system tracks the canonical URL. If the URL redirects permanently, the admin should update the config; health does not auto-transfer.
- What happens when yield drops to 0 but the page loads successfully? This is classified as an EMPTY_PAGE event. The ScrapeLog records `success=false, failureType=EMPTY_PAGE, judgesFound=0`. Health score degrades.
- What happens on the first-ever harvest for a state with no health data? All URLs start with neutral priority. The first scrape establishes baseline health. Delta runs become meaningful from the second harvest onward.
- What happens when Tavily API quota is exhausted during discovery? Discovery failures do not affect URL health — health only tracks harvest outcomes, not discovery search results.

---

## Requirements

### Functional Requirements

- **FR-001**: System MUST maintain a health record for every URL processed by the harvest pipeline, regardless of whether the URL originated from discovery or manual configuration.
- **FR-002**: System MUST log every harvest attempt per URL with outcome (success/failure), judge yield count, failure type (if any), HTTP status code, error message, retry count, resolution status, and timestamp. ScrapeLog replaces the existing ScrapeFailure table as the single canonical event log — no dual-write path.
- **FR-003**: System MUST compute a composite health score (0.0–1.0) for each URL based on the last 10 scrape attempts: yield consistency (how stable the judge count is across scrapes), success rate (percentage of scrapes that succeed), freshness (how recently the URL was successfully scraped), and yield volume (absolute judge count relative to expectation).
- **FR-004**: System MUST recompute health scores automatically after every harvest run — no manual trigger required.
- **FR-005**: System MUST support a `--delta` harvest mode that considers URLs stale when their last successful scrape is older than 7 days (configurable) and prioritizes them by: (1) stale + healthy (score ≥0.7) first, (2) never-scraped second, (3) stale + moderate (score 0.3–0.7) third, (4) stale + unhealthy (score <0.3) fourth, (5) recently-scraped last.
- **FR-006**: System MUST support a `--skip-broken` flag that excludes URLs with health score below a configurable threshold (default 0.2) from the harvest run.
- **FR-007**: System MUST provide an admin page at `/admin/health/` displaying URL health records with score, last yield, trend, failure count, anomaly flag, and last scrape date. This page replaces the existing `/admin/failures/` page — all failure visibility is consolidated here via drill-down scrape history per URL.
- **FR-008**: System MUST allow the admin to filter health records by state, sort by health score or last scrape date, filter by failures-only, and expand individual URLs to view their full scrape history (including failure details: type, HTTP status, error message, resolution status).
- **FR-009**: System MUST flag yield anomalies — when the judge count for a URL drops by more than 50% compared to the rolling average, the system sets an `anomalyDetected` flag on the UrlHealth record and displays a visual alert (warning icon/badge) in the `/admin/health/` dashboard. No external notification service required.
- **FR-010**: System MUST seed a UrlHealth record when a UrlCandidate is promoted to state config.
- **FR-011**: System MUST expose a health summary per state (average health score, count of healthy/unhealthy/unscored URLs) for the admin dashboard.
- **FR-012**: System MUST allow the admin to mark failed scrape log entries as resolved, recording who resolved it and optional resolution notes.

### Key Entities

- **UrlHealth**: Represents the cumulative health profile of a single harvest URL. Key attributes: URL (unique), state, health score (composite 0.0–1.0), total scrapes, successful scrapes, last yield count, average yield, yield trend (improving/stable/declining), anomaly detected flag (boolean, set when yield drops >50% vs rolling average), last scraped timestamp, source origin (discovered or manual), active flag.
- **ScrapeLog**: Represents a single harvest attempt against a URL. Replaces the existing ScrapeFailure table as the canonical event log for ALL scrape events (successes and failures). Key attributes: URL reference, timestamp, success boolean, judges found count, failure type (if failed), HTTP status code, error message, retry count, resolution status (resolvedAt, resolvedBy, resolutionNotes), scrape duration. Many-to-one relationship with UrlHealth.

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: Delta harvest runs complete at least 30% faster than full harvests on states with established health data, by skipping or deferring broken URLs.
- **SC-002**: 100% of URLs processed by the harvest pipeline have corresponding UrlHealth records within one harvest cycle.
- **SC-003**: Yield anomalies (>50% drop) are detected and flagged within the same harvest run — zero manual monitoring required.
- **SC-004**: Admin can identify the unhealthiest URLs per state in under 10 seconds via the health dashboard.
- **SC-005**: Health scores stabilize (variance <0.1 between consecutive runs) for consistently-performing URLs after 3 harvest cycles.

## Clarifications

### Session 2026-03-15

- Q: How should ScrapeLog relate to the existing ScrapeFailure table? → A: ScrapeLog replaces ScrapeFailure as the single canonical event log. Failure-specific fields (retryCount, resolvedAt, resolvedBy) migrate into ScrapeLog. ScrapeFailure writes are retired.
- Q: How should the system notify the admin of yield anomalies? → A: Flag on UrlHealth record (anomalyDetected boolean) plus visual alert in /admin/health/ dashboard. No external notification service.
- Q: How many past scrape logs should the health score formula consider per URL? → A: Last 10 scrapes. Balanced window for meaningful trend statistics (~10 months at monthly cadence) without unbounded query growth.
- Q: What should happen to the existing /admin/failures/ page now that ScrapeLog replaces ScrapeFailure? → A: Retire /admin/failures/ entirely. Consolidate failure visibility into /admin/health/ with drill-down scrape history per URL. One page, zero duplication.
- Q: What should the delta-run staleness threshold be? → A: 7 days. Court rosters change infrequently; weekly is aggressive enough to catch changes without burning API credits on daily re-scrapes.

## Assumptions

- The harvest pipeline will continue to use the existing checkpoint structure, with health recording added as a post-processing step per URL.
- Health score computation uses a weighted formula: success rate (40%), yield consistency (30%), freshness (20%), volume (10%). These weights can be tuned without schema changes.
- The ScrapeLog table will grow linearly with harvest runs. At 50 states x ~30 URLs/state x monthly harvests, this is ~18,000 rows/year — negligible storage.
- "Delta run" means a mode that re-scrapes all URLs but processes them in health-informed priority order, rather than skipping URLs entirely (unless `--skip-broken` is used). URLs are considered stale when their last successful scrape is older than 7 days (configurable via constant, distinct from the existing 90-day state-level freshness threshold).
- Yield consistency is measured as coefficient of variation (standard deviation / mean) of the last 10 scrape yields, inverted to a 0–1 scale. The 10-scrape window covers ~10 months at monthly harvest cadence and provides enough data points for meaningful statistics without unbounded query growth.
