# Feature Specification: Autonomous Harvest Pipeline

**Feature Branch**: `015-autonomous-harvest-pipeline`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "Database-driven autonomous harvest pipeline: eliminate JSON configs and CSV import, use UrlCandidate as single source of truth, add intelligent URL classification, admin click-to-scrape UI, direct DB writes, Vercel Cron for annual deltas, and persistent harvest reports"

## Overview

The current harvest pipeline relies on per-state JSON config files to define which URLs to scrape, outputs results as CSV files, and requires a separate admin CSV import step to materialize judges into the database. This feature replaces that entire flow with a database-driven architecture where the `UrlCandidate` table is the single source of truth for scrapeable URLs, the harvest pipeline writes judges directly to the database, and admins can trigger harvests with a single click. The system becomes autonomous through scheduled annual delta checks with persistent reports tracking what changed.

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Admin Triggers State Harvest (Priority: P1)

As an admin, I want to select a state from a dropdown, click "Start Harvest," and have the system automatically scrape all approved URLs for that state, writing discovered judge profiles directly into the database — without any CSV files, manual imports, or column mapping.

**Why this priority**: This is the core workflow that replaces the current multi-step process (harvest → CSV → admin import → column mapping → confirm). Without this, nothing else in the feature delivers value.

**Independent Test**: Navigate to the harvest admin page, select a state with approved URLs, click "Start Harvest," and verify judges appear in the database with correct court linkage and source attribution.

**Acceptance Scenarios**:

1. **Given** South Carolina has 15 approved URLs in the discovery table, **When** admin selects "SC" and clicks "Start Harvest," **Then** a harvest job is created, the system begins scraping all 15 URLs in the background, and the admin sees a live status indicator showing progress.
2. **Given** a harvest job is running for Florida, **When** admin views the harvest page, **Then** the page shows the job status (RUNNING), URLs processed so far, and judges found count — updating every few seconds.
3. **Given** a harvest job completes for California, **When** admin views the harvest page, **Then** the job shows as COMPLETED with final counts: total judges found, new judges added, existing judges updated, and URLs that failed.
4. **Given** a state has zero approved URLs in the discovery table, **When** admin selects that state, **Then** the "Start Harvest" button is disabled with a message: "No approved URLs. Run discovery first."
5. **Given** a harvest is already running for Texas, **When** admin tries to start another harvest for Texas, **Then** the system prevents the duplicate run and shows the existing active job.

---

### User Story 2 — Database-Driven URL Source (Priority: P1)

As an admin, I want the harvest system to read which URLs to scrape exclusively from the discovery database table (not from JSON config files), so that newly discovered and approved URLs are automatically included in the next harvest without manual config file edits.

**Why this priority**: This is a prerequisite for Story 1 — the harvest pipeline cannot run from the admin UI without a database-driven URL source, and it eliminates the error-prone step of promoting candidates to JSON files.

**Independent Test**: Approve a URL candidate in the admin discovery panel, then run a harvest for that state — the newly approved URL is scraped without any JSON file changes.

**Acceptance Scenarios**:

1. **Given** a URL candidate is approved in the discovery table for South Carolina, **When** a harvest runs for SC, **Then** that URL is included in the scrape list without any JSON config file existing for SC.
2. **Given** Florida has 27 URLs previously defined in a JSON config, **When** those URLs exist as approved candidates in the discovery table, **Then** the harvest produces equivalent results (same judges, same courts) using only the database source.
3. **Given** the admin promotes a discovered URL from DISCOVERED to APPROVED status, **When** promotion completes, **Then** the URL is immediately eligible for the next harvest run — no additional steps required.
4. **Given** an admin runs `--list` to see available states, **When** the system responds, **Then** it lists only states that have at least one approved URL in the discovery table (not states with JSON files on disk).

---

### User Story 3 — Intelligent URL Classification (Priority: P2)

As an admin, I want discovered URLs to be automatically classified as "scrape-worthy" or "not scrape-worthy" during the discovery process, so that obviously non-judicial URLs are filtered out before I review them and before they waste scrape cycles.

**Why this priority**: Reduces manual review burden on admins and prevents the system from wasting time and API credits scraping pages that don't contain judge profiles. Builds on the existing classifier but adds persistent intelligence.

**Independent Test**: Run discovery for a state, verify that URLs classified as non-judicial rosters are automatically marked as not scrape-worthy, and that high-confidence roster URLs are marked as scrape-worthy.

**Acceptance Scenarios**:

1. **Given** a URL is discovered and the classifier determines it is a judicial roster page with confidence ≥ 0.7, **When** the candidate is stored, **Then** it is automatically marked as scrape-worthy.
2. **Given** a URL is discovered and the classifier determines it is NOT a judicial roster page, **When** the candidate is stored, **Then** it is automatically marked as not-scrape-worthy and will not be included in future harvests.
3. **Given** a URL has a classifier confidence between 0.3 and 0.7, **When** the candidate is stored, **Then** it is left as "unclassified" for admin manual review.
4. **Given** an admin views the discovery table, **When** filtering by scrape-worthiness, **Then** they see badges indicating each URL's classification status (scrape-worthy, not-scrape-worthy, needs-review) and can override the classification.
5. **Given** a URL was marked scrape-worthy but yields zero judges across two or more harvest attempts, **When** the post-scrape yield check runs, **Then** the URL is automatically downgraded to not-scrape-worthy with reason "zero-yield."

---

### User Story 4 — Autonomous Annual Delta Harvests (Priority: P2)

As a system owner, I want the system to automatically re-harvest all states on an annual schedule, only scraping URLs that are due for a refresh, so that judge data stays current without manual intervention.

**Why this priority**: This is the "autonomous" part of the feature. Without it, an admin must remember to manually trigger harvests. Important but depends on Stories 1-2 being complete.

**Independent Test**: Simulate a scheduled trigger, verify only stale states are harvested, verify recently-harvested states are skipped.

**Acceptance Scenarios**:

1. **Given** the scheduled trigger fires, **When** three states have not been harvested in over 11 months, **Then** harvest jobs are created for those three states with trigger type "CRON."
2. **Given** the scheduled trigger fires, **When** a state was manually harvested 2 months ago, **Then** that state is skipped (no job created).
3. **Given** a cron-triggered harvest runs for a state, **When** some URLs were successfully scraped within the past year, **Then** only stale or never-scraped URLs for that state are processed (delta behavior).
4. **Given** the scheduled trigger fires, **When** no authentication token is provided, **Then** the request is rejected with an unauthorized error.
5. **Given** a cron harvest is in progress for a state, **When** an admin also manually triggers that same state, **Then** the system prevents the conflict and shows the existing cron job.

---

### User Story 5 — Post-Harvest Reports (Priority: P3)

As an admin, I want to view a detailed report after each harvest run showing how many new judges were added, how many were updated, which URLs failed, and a quality assessment — so I can monitor data freshness and catch issues.

**Why this priority**: Reports are the observability layer. They depend on the harvest execution (Stories 1-2) but are not blocking for the core value delivery.

**Independent Test**: Complete a harvest run for any state, then view the report in the admin panel — verify all metrics are present and accurate.

**Acceptance Scenarios**:

1. **Given** a harvest job completes for Florida, **When** admin clicks on the job in the harvest history table, **Then** they see a detailed report showing: new judges added, existing judges updated, total judges found, URLs processed, URLs failed, and duration.
2. **Given** a harvest job encountered 3 failed URLs (e.g., 403, timeout), **When** viewing the report, **Then** each failed URL is listed with its failure reason and HTTP status code.
3. **Given** the admin dashboard is loaded, **When** recent harvests have completed, **Then** the dashboard shows a summary: total judges across all states, last harvest date per state, and whether each state is fresh or stale.
4. **Given** no harvest has ever run for a state, **When** viewing the dashboard, **Then** that state shows as "Never harvested" with a prompt to run discovery first.

---

### User Story 6 — Remove CSV Import Workflow (Priority: P1)

As an admin, I no longer need the CSV upload/import wizard, column mapper, or batch management UI because the harvest pipeline now writes judges directly to the database. The old import workflow should be completely removed to reduce confusion and maintenance burden.

**Why this priority**: The CSV import path is being replaced by direct DB writes (Story 1). Leaving it in place creates confusion (two ways to add judges) and maintenance overhead. Must ship alongside Story 1.

**Independent Test**: Verify the admin navigation no longer shows an "Import" link, `/admin/import/` returns a 404, and no CSV-related API endpoints are accessible.

**Acceptance Scenarios**:

1. **Given** an admin navigates the admin panel, **When** viewing the sidebar/navigation, **Then** there is no "Import" or "CSV Import" link.
2. **Given** an admin tries to access `/admin/import/` directly, **When** the page loads, **Then** a 404 or redirect is returned.
3. **Given** the system has existing judges that were previously imported via CSV batches, **When** the migration runs, **Then** those judges are preserved in the database with their data intact (the batch reference is cleared gracefully).
4. **Given** the admin views the verification queue, **When** filtering judges, **Then** filtering is based on harvest job (not import batch).

---

### Edge Cases

- What happens when a harvest is running and the server restarts? — The harvest job record remains in RUNNING status. A stale-job detector should mark jobs as FAILED if no progress update is received within a configurable timeout (e.g., 2 hours).
- What happens when two admins try to start the same state harvest simultaneously? — The system prevents duplicate concurrent jobs for the same state, returning the existing active job to the second admin.
- What happens when a URL changes its page structure between annual harvests? — The LLM extractor adapts to new structures. If extraction fails, the URL is logged as failed in the report and its health score is decremented in the URL health table.
- What happens when all URLs for a state fail during harvest? — The harvest job completes with status COMPLETED (not FAILED) but the report reflects 0 judges found and 100% URL failure rate, flagging it for admin review.
- What happens when the annual cron fires but no states are stale? — No harvest jobs are created. The cron logs "All states are fresh, nothing to do" and exits cleanly.
- How are existing judges from prior CSV imports handled during migration? — The `importBatchId` foreign key on existing judge records is set to null. Judge data (name, court, biographical fields) is completely untouched. The `ImportBatch` table is dropped after clearing references.

## Requirements *(mandatory)*

### Functional Requirements

**URL Source & Classification**

- **FR-001**: System MUST read scrapeable URLs exclusively from the discovery database table, not from JSON config files on disk.
- **FR-002**: System MUST automatically classify each discovered URL as scrape-worthy (true), not-scrape-worthy (false), or unclassified (needs manual review) based on the classifier's roster detection confidence score.
- **FR-003**: Classification thresholds MUST be: confidence ≥ 0.7 with positive roster detection → scrape-worthy; confidence < 0.3 or negative roster detection → not-scrape-worthy; all others → unclassified.
- **FR-004**: System MUST allow admins to override the automated scrape-worthiness classification for any URL.
- **FR-005**: System MUST automatically downgrade a URL to not-scrape-worthy when it yields zero judges across two or more harvest attempts, with rejection reason "zero-yield."
- **FR-006**: Promoting a URL candidate from DISCOVERED to APPROVED status MUST make it immediately eligible for the next harvest run with no additional steps.

**Harvest Execution**

- **FR-007**: Admins MUST be able to select a state and trigger a harvest from the admin interface with a single click.
- **FR-008**: Harvest execution MUST run as a background process so the admin interface remains responsive.
- **FR-009**: The admin interface MUST show real-time harvest progress (status, URLs processed, judges found) with periodic polling.
- **FR-010**: System MUST prevent concurrent harvest jobs for the same state.
- **FR-011**: System MUST block harvest attempts for states with zero approved URLs, displaying a clear message.
- **FR-012**: The harvest pipeline MUST write judge records directly to the database, not to intermediate CSV files.
- **FR-013**: New judges MUST be created with UNVERIFIED status and linked to the harvest job that discovered them.
- **FR-014**: When a judge already exists in the database (matched by court and slugified name — the `courtId`+`slug` composite unique key), the system MUST update the existing record rather than create a duplicate.
- **FR-015**: Each harvest job MUST record: state, status (QUEUED/RUNNING/COMPLETED/FAILED), judges found, judges new, judges updated, URLs processed, URLs failed, start time, completion time, trigger source (ADMIN or CRON), and the full report.

**Autonomous Scheduling**

- **FR-016**: System MUST support a scheduled annual trigger that automatically initiates harvests for all states with approved URLs.
- **FR-017**: The scheduled trigger MUST be secured with a secret token — unauthenticated requests MUST be rejected.
- **FR-018**: Scheduled harvests MUST skip states whose most recent completed harvest is less than 11 months old.
- **FR-019**: Within a scheduled harvest, the system MUST skip individual URLs whose last successful scrape is within the freshness window (default: 365 days).
- **FR-020**: States MUST be processed sequentially during scheduled runs to respect external rate limits.

**Reports**

- **FR-021**: Every harvest run MUST produce a persistent report containing: new judges added, judges updated, URLs processed, URLs failed (with reasons), court-type breakdown, and a quality assessment.
- **FR-022**: Harvest reports MUST be viewable from the admin interface by clicking on a completed harvest job.
- **FR-023**: The admin dashboard MUST display a summary of harvest activity: total judges per state, last harvest date per state, and staleness indicator.

**Removal of CSV Import**

- **FR-024**: The CSV upload wizard, column mapper, import confirmation flow, and batch management UI MUST be removed from the admin interface.
- **FR-025**: All CSV import API endpoints MUST be removed.
- **FR-026**: The ImportBatch database model MUST be removed. Existing judges previously linked to import batches MUST have their batch reference cleared (set to null) without data loss.
- **FR-027**: The admin navigation MUST no longer display an import link.
- **FR-028**: The verification queue MUST filter by harvest job instead of import batch.

### Key Entities

- **UrlCandidate**: A discovered URL potentially containing judge profile data. Extended with scrape-worthiness classification, fetch method preference, and optional extraction hints. Serves as the single source of truth for what the harvest pipeline scrapes. Related to a DiscoveryRun and may have an associated UrlHealth record.
- **HarvestJob**: Tracks a single harvest execution for one state. Records status lifecycle (QUEUED → RUNNING → COMPLETED/FAILED), metrics (judges found/new/updated, URLs processed/failed), trigger source (admin or scheduled), and the full quality report. Judges discovered during the run are linked back to this job.
- **Judge**: Extended with a link to the HarvestJob that created or last updated the record (replacing the former ImportBatch link). Retains all existing fields: name, court, biographical data, verification status, confidence score, source attribution.
- **UrlHealth**: Existing table tracking scrape reliability per URL (health score, success rate, yield trends). Used by the delta logic to determine which URLs need re-scraping during scheduled harvests.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Admin can trigger a state harvest and see judges appear in the database within a single session — zero CSV files created, zero manual import steps required.
- **SC-002**: A harvest for a state with 20+ URLs completes end-to-end (scrape → extract → write to DB → report) without manual intervention after the initial click.
- **SC-003**: 95% of URLs previously defined in JSON config files produce equivalent judge counts when harvested via the database-driven pipeline (regression parity).
- **SC-004**: Newly approved URL candidates are automatically included in the next harvest run without any config file edits or promoter scripts.
- **SC-005**: The scheduled annual trigger correctly skips fresh states and processes only stale ones, reducing unnecessary scraping by at least 80% compared to a full re-harvest.
- **SC-006**: Post-harvest reports accurately reflect the delta: admins can see exactly how many new judges were added per run, enabling year-over-year tracking.
- **SC-007**: The admin import page, CSV uploader, column mapper, and all related API endpoints are no longer accessible — no CSV import path exists in the application.
- **SC-008**: Existing judges (from prior CSV imports) are fully preserved after migration with zero data loss.
- **SC-009**: URL auto-classification correctly identifies at least 85% of non-judicial URLs as not-scrape-worthy during discovery, reducing admin review burden.
- **SC-010**: Concurrent harvest prevention works — two simultaneous requests for the same state never produce duplicate jobs or data corruption.

## Assumptions

- The existing classifier (GPT-4O-mini) provides sufficiently accurate roster detection via search snippet analysis — no need for probe-scraping individual pages to determine scrape-worthiness.
- The deployment platform supports background job execution (the harvest process can run longer than typical request timeouts).
- The deployment platform supports scheduled triggers (cron-style endpoints with secret-based authentication).
- Rate limit configurations per state (fetch delay, max concurrent, timeout, retries) can remain as code-level constants for now, since they rarely change.
- New York's Cloudflare-blocked URLs will continue to use a "browser" fetch method, which must be stored per-URL in the database.
- The existing deterministic extraction patterns (e.g., Florida's `flcourts-next-data`, California's table roster) can be represented as optional extraction hints stored on the URL candidate record.
- The admin panel uses existing authentication (Basic Auth) — no new auth changes needed for harvest trigger or report viewing.
