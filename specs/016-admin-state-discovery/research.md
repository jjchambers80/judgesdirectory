# Research: Admin State Discovery

**Feature**: 016-admin-state-discovery  
**Date**: 2026-03-17

## Decision 1: Background Process Execution

**Decision**: Use `child_process.spawn` with `detached: true` + `stdio: "ignore"` + `child.unref()` to run the discovery CLI as a fire-and-forget background process.

**Rationale**: This is the exact pattern already established by the harvest POST handler (`src/app/api/admin/harvest/route.ts` L134-142). The API handler returns immediately with the run ID, and the spawned process updates the `DiscoveryRun` record in the database as it progresses and completes.

**Alternatives considered**:

- Worker threads: Unnecessary complexity for a process that is I/O-bound (search API calls, LLM classification). A child process provides clean isolation.
- Queue system (Bull, BullMQ): Over-engineered for single-concurrent-run workload. Would add a Redis dependency.
- In-process async: Would block the Next.js server process and risk timeout on serverless platforms.

**Implementation note**: The existing `discover.ts` creates its own `DiscoveryRun` record internally. The API route needs to either (a) add a `--run-id` flag to let the API pre-create the record and pass the ID, or (b) let the script create the record and return the ID via stdout. Option (a) is recommended — matches the harvest `--job-id` pattern and allows the API to return the run ID immediately.

## Decision 2: Cancellation Mechanism

**Decision**: Cooperative cancellation via database flag. Add `CANCELLED` to the `DiscoveryRunStatus` Prisma enum. The cancel endpoint sets the status to `CANCELLED`. The `discover.ts` script checks the DB status before each query iteration and exits gracefully if cancelled.

**Rationale**: The discovery loop runs 6-12 queries sequentially. Checking the DB status once per iteration provides cancellation responsiveness of ~10-30 seconds per query cycle. PID-based `process.kill()` would require storing PIDs and is fragile across deployment environments (PID reuse, serverless, Vercel).

**Alternatives considered**:

- PID tracking + `process.kill()`: Requires a `pid` column on `DiscoveryRun`, fragile in serverless/containerized environments, and risk of killing an unrelated process if PID is reused.
- IPC channel: Requires `detached: false` which would tie the child process lifecycle to the API handler.
- Signal files / named pipes: OS-specific, adds filesystem coordination complexity.

**Implementation note**: When the script detects `CANCELLED`, it should update the run with `status: FAILED`, `errorMessage: "Cancelled by user"`, preserve partial metrics, and exit. Using `FAILED` (not `CANCELLED`) for the final status keeps the UI simple — a cancelled run is visually identical to a failed run, just with a specific error message.

## Decision 3: Status Refresh Mechanism

**Decision**: Client-side auto-poll via `setInterval` + `fetch` at 5-second intervals. Polling starts when any run in the list has `RUNNING` status and stops when all runs are terminal.

**Rationale**: Discovery runs produce very few progress events (6-12 queries over several minutes). The harvest page's SSE implementation is effectively server-side DB polling pushed to the client — for discovery's low event frequency, direct client polling is simpler with no loss in user experience.

**Alternatives considered**:

- Server-Sent Events (SSE): The harvest page uses this (`/api/admin/harvest/[jobId]/stream/route.ts`). It's server-side `setInterval` polling the DB every 1.5s, pushed as SSE events. For discovery's cadence, this adds infrastructure (SSE endpoint, EventSource client setup, reconnection handling) without benefit.
- WebSocket: Even more overhead for a read-only status stream. No existing WebSocket infrastructure in the project.

**Implementation note**: The existing `GET /api/admin/discovery/` endpoint returns candidates. New endpoints needed: `GET /api/admin/discovery/runs` for the runs list and `GET /api/admin/discovery/summary?state=XX` for the state summary card.

## Decision 4: UI Integration Approach

**Decision**: Extend the existing `/admin/discovery/` page by adding new sections above the existing candidates table. Add two new client components: `DiscoveryRunTrigger` (state selector + summary + run button) and `DiscoveryRunHistory` (runs table with auto-poll).

**Rationale**: The admin discovery page already exists and manages URL candidates. Adding run triggering and history to the same page keeps the workflow cohesive — admin selects a state, sees its summary, triggers discovery, monitors progress, then reviews/approves candidates below.

**Alternatives considered**:

- Separate page (`/admin/discovery/runs`): Splits the workflow across two pages. Less cohesive.
- Merge into harvest page: Discovery and harvest are different pipeline stages with different data models.

## Decision 5: Schema Change

**Decision**: Add `CANCELLED` value to the `DiscoveryRunStatus` enum in Prisma schema. This is the only schema change required.

**Rationale**: All other fields needed for the feature (status, queriesRun, candidatesFound, candidatesNew, errorMessage, startedAt, completedAt) already exist on the `DiscoveryRun` model. The `UrlCandidate` model is read-only for the summary endpoint.

**Alternatives considered**:

- No schema change (repurpose `FAILED` for cancellation): Simpler, but loses the ability to distinguish user-cancelled runs from genuinely failed runs in queries and analytics.
