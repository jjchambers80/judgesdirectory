# Feature Specification: Admin State Discovery

**Feature Branch**: `016-admin-state-discovery`  
**Created**: 2026-03-17  
**Status**: Draft  
**Input**: User description: "Create an admin feature allowing a user to run discovery on a specific state"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Trigger Discovery for a State (Priority: P1)

An admin user navigates to the admin discovery dashboard, selects a US state from a dropdown, and initiates a discovery run. The system launches the discovery pipeline for that state in the background, providing immediate feedback that the run has started. The admin can see the run appear in a list of recent discovery runs with a "Running" status.

**Why this priority**: This is the core capability — without the ability to trigger discovery from the UI, the feature has no value. Currently discovery can only be run from the CLI, which limits who can use it and when.

**Independent Test**: Can be fully tested by selecting a state, clicking "Run Discovery", and verifying a new DiscoveryRun record appears with RUNNING status. Delivers immediate value by eliminating the need for CLI access.

**Acceptance Scenarios**:

1. **Given** an admin user is on the discovery dashboard, **When** they select "Florida" from the state dropdown and click "Run Discovery", **Then** a new DiscoveryRun record is created with state="Florida", stateAbbr="FL", status="RUNNING", and the user sees a confirmation message and the run appears in the history table below.
2. **Given** an admin user triggers discovery for a state, **When** the run starts successfully, **Then** the run appears in the recent runs list within 2 seconds showing state name, status "Running", and start time.
3. **Given** a discovery run is already in progress for any state, **When** an admin attempts to start another run, **Then** the system displays an error message explaining that only one discovery run can execute at a time, and the start button is disabled.
4. **Given** a discovery run is in progress, **When** the admin clicks "Cancel", **Then** the run is stopped, its status changes to "Failed" with a "Cancelled by user" message, partial metrics are preserved, and the advisory lock is released.
5. **Given** the admin selects "Florida" from the state dropdown, **When** Florida has existing candidates and past runs, **Then** a summary card appears showing candidate counts by status (e.g., "12 Approved, 3 Discovered, 1 Rejected") and the date of the last discovery run.

---

### User Story 2 - Monitor Discovery Run Progress (Priority: P2)

While a discovery run is in progress or after it completes, the admin can view the run's status, progress metrics (queries run, candidates found, new candidates), and any errors. The status updates reflect the current state of the background process.

**Why this priority**: Monitoring provides confidence that discovery is working and enables quick identification of problems. Without it, the admin would trigger runs blindly.

**Independent Test**: Can be tested by triggering a run and observing the status transition from RUNNING to COMPLETED/FAILED, with metrics populating as the run progresses.

**Acceptance Scenarios**:

1. **Given** a discovery run is in progress, **When** the admin views the discovery runs list, **Then** the run shows current metrics (queries completed, candidates found, new candidates) that auto-refresh on a fixed interval without manual page reload.
2. **Given** a discovery run completes successfully, **When** the admin views the run in the history table, **Then** the status shows "Completed", all final metrics are displayed, and the completion time is shown.
3. **Given** a discovery run fails (e.g., rate limit, API error), **When** the admin views the run in the history table, **Then** the status shows "Failed", the error message is displayed, and partial metrics from before the failure are preserved.

---

### User Story 3 - View Discovery Run History (Priority: P3)

An admin can browse past discovery runs filtered by state, with the most recent runs shown first. Each entry shows the state, status, start/completion time, and summary metrics. This enables the admin to understand which states have been discovered recently and which need attention.

**Why this priority**: Historical context helps admins make informed decisions about which states to discover next and how effective past runs have been.

**Independent Test**: Can be tested by viewing the runs list after multiple runs have completed, filtering by state, and verifying sort order and data accuracy.

**Acceptance Scenarios**:

1. **Given** multiple discovery runs exist, **When** the admin views the runs list, **Then** runs are displayed in reverse chronological order (most recent first) with state, status, start time, completion time, queries run, and candidates found.
2. **Given** discovery runs exist for multiple states, **When** the admin filters by a specific state, **Then** only runs for that state are displayed.
3. **Given** a state has never had a discovery run, **When** the admin selects that state, **Then** the list is empty and a message suggests running discovery for that state.

---

### Edge Cases

- What happens when the external search API key is missing or invalid? The system displays a clear error indicating the external search service is unavailable, without exposing credentials.
- What happens when a discovery run is interrupted (e.g., server restart)? Stale locks older than 1 hour are automatically cleaned up and marked as FAILED, following existing behavior.
- What happens when the admin selects a state that was just discovered? The system allows re-running discovery, as new court roster URLs may have appeared since the last run.
- What happens if the admin navigates away while a run is in progress? The background process continues unaffected; returning to the page shows current status.
- What happens if multiple admin users try to start discovery simultaneously? The advisory lock prevents concurrent runs; the second user sees an appropriate error message.
- What happens if the admin cancels a run that has already completed? The system ignores the cancellation request if the run is no longer RUNNING.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide an admin-accessible page for managing discovery runs.
- **FR-002**: System MUST display a selection control listing all 50 US states for the admin to choose a target state.
- **FR-003**: System MUST allow the admin to trigger a discovery run for the selected state with a single action.
- **FR-004**: System MUST execute the discovery pipeline in the background so the admin interface remains responsive during execution.
- **FR-005**: System MUST enforce that only one discovery run can be active at a time (including runs in transitional CANCELLED state awaiting background process completion), consistent with the existing advisory lock mechanism.
- **FR-006**: System MUST display a paginated list of discovery runs (20 per page by default) showing: state name, status (Running/Completed/Failed), start time, completion time, queries run, candidates found, and new candidates. While any run has RUNNING status, the list MUST auto-refresh on a fixed interval (e.g., every 5 seconds) and stop polling once no runs are active.
- **FR-007**: System MUST allow filtering the discovery run history by state.
- **FR-008**: System MUST display error messages from failed runs so the admin can diagnose issues.
- **FR-009**: System MUST provide visual indication of whether a run is currently in progress (e.g., disabled controls, status indicator).
- **FR-010**: System MUST record each triggered run as a DiscoveryRun entity with all associated metrics upon completion.
- **FR-011**: System MUST allow the admin to cancel a running discovery run. Cancellation requests that the run be stopped — the system sets the run status to CANCELLED, and the background process transitions the run to FAILED with a "Cancelled by user" message upon detecting the flag, preserving partial metrics collected before cancellation and releasing the advisory lock so a new run can be started.
- **FR-012**: When the admin selects a state, the system MUST display a brief summary for that state: number of candidates by status (Approved, Discovered, Rejected), and the date of the most recent discovery run (or "Never" if none exists).

### Key Entities

- **DiscoveryRun**: Represents a single execution of the discovery pipeline for one state. Key attributes: state, stateAbbr, status (RUNNING/COMPLETED/FAILED), queriesRun, candidatesFound, candidatesNew, startedAt, completedAt, errorMessage.
- **UrlCandidate**: A discovered URL that may contain judge roster data. Created as output of a discovery run. Key attributes: url, state, stateAbbr, confidenceScore, status (DISCOVERED/APPROVED/REJECTED), scrapeWorthy.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Admin users can trigger a discovery run for any US state within 3 clicks from the admin dashboard.
- **SC-002**: The admin interface remains responsive (interactive within 1 second) while a discovery run executes in the background.
- **SC-003**: 100% of discovery runs triggered through the admin UI produce the same results as equivalent CLI invocations.
- **SC-004**: Admin users can determine the status of any discovery run (current or historical) within 5 seconds of loading the page.
- **SC-005**: Failed runs display actionable error information that enables the admin to identify the root cause without consulting server logs.

## Clarifications

### Session 2026-03-17

- Q: How should the admin UI refresh discovery run status while a run is in progress? → A: Auto-poll on a fixed interval (e.g., every 5 seconds) while a run is active
- Q: Should the admin be able to cancel a running discovery run from the UI? → A: Yes — provide a "Cancel" button that stops the run and marks it FAILED
- Q: How many discovery runs should the history list display by default? → A: 20 most recent runs with pagination
- Q: Should the discovery page show a summary of existing candidates for the selected state before triggering a new run? → A: Yes — show a brief state summary (candidate counts by status, last run date) when a state is selected
- Q: What is explicitly out of scope for this feature? → A: Managing individual candidates (approve/reject/promote), editing discovery queries, and running discovery for all states at once

## Out of Scope

- Managing individual URL candidates (approve, reject, promote) — these operations already exist via existing API routes and are addressed separately.
- Editing or customizing discovery search queries from the UI — queries are generated programmatically by the discovery pipeline.
- Running discovery for all 50 states in a single batch from the UI — the CLI `--all` flag remains the mechanism for bulk discovery.

## Assumptions

- The existing discovery pipeline (search-client, classifier, candidate-store) is stable and does not need modification — the admin UI wraps the same logic currently invoked via CLI.
- The admin area is already protected by authentication/authorization; this feature inherits the existing access control.
- The external search API credentials are configured via environment variables and available to the server process.
- The advisory lock mechanism (one concurrent run at a time) is a deliberate constraint that should be preserved in the UI, not removed.
- Discovery runs are expected to take several minutes per state due to API rate limits and LLM classification; the UI must not block or time out during execution.
