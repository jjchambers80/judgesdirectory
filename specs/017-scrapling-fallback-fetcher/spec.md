# Feature Specification: Scrapling Fallback Fetcher

**Feature Branch**: `017-scrapling-fallback-fetcher`  
**Created**: 2026-03-19  
**Status**: Draft  
**Input**: User description: "Integrate Scrapling as a fallback fetcher for anti-bot and JS-heavy court sites in the harvest pipeline"

## Clarifications

### Session 2026-03-19

- Q: Should the system enforce a minimum delay between stealth fetch requests to the same domain? → A: Configurable per-domain delay with a sensible default (e.g., 2-5 seconds between requests to the same domain)
- Q: What retry behavior should the system use when a stealth fetch fails? → A: Retry once with a short backoff (10-30 seconds), then mark as failed
- Q: If the stealth fetcher cannot bypass NY Cloudflare Turnstile, is the feature successful? → A: Yes, partial success — the fallback infrastructure is valuable even without NY; NY becomes a deferred target
- Q: Should the stealth fetcher be restricted to an explicit allowlist of approved domains? → A: Yes — stealth fetcher only runs against domains in an explicit allowlist; requests to unlisted domains are rejected
- Q: Should the system persist stealth fetch metrics per domain beyond log output? → A: Log-only for now; persistent metrics tracking is a future enhancement

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Harvest Judges from Anti-Bot Protected Court Sites (Priority: P1)

As a pipeline operator, I want the harvest pipeline to automatically retrieve judge data from court websites that block standard programmatic access (e.g., Cloudflare Turnstile) so that judges from states like New York are included in the directory without manual intervention.

**Why this priority**: New York alone has ~1,000+ judges completely inaccessible today. Anti-bot protection is the single biggest blocker to state expansion. Without this, the directory has a permanent coverage gap for any state using similar protections.

**Independent Test**: Run the harvest pipeline against a known Cloudflare-protected court roster URL and verify that judge names and metadata are extracted into the system.

**Acceptance Scenarios**:

1. **Given** a court website protected by Cloudflare Turnstile (e.g., NY Court of Appeals roster), **When** the harvest pipeline runs for that court, **Then** the system retrieves the page content and extracts judge names successfully.
2. **Given** a court website protected by anti-bot measures, **When** the stealth fetcher retrieves the page, **Then** the returned content contains at least as many judge records as are visible when browsing the site manually.
3. **Given** a court config that specifies the stealth fetch method, **When** the pipeline processes that court, **Then** the system uses the stealth fetcher instead of the standard fetcher, and logs which method was used.

---

### User Story 2 - Existing Harvest Runs Are Unaffected (Priority: P1)

As a pipeline operator, I want the existing harvest behavior for currently-working states (FL, CA, TX, SC) to remain completely unchanged so that introducing the fallback fetcher causes zero regressions.

**Why this priority**: Equal to P1 because data integrity for existing states is non-negotiable. The fallback fetcher must be additive, not disruptive.

**Independent Test**: Run dry-run harvests for FL, CA, TX, and SC. Verify all pages use the standard fetcher, produce identical output, and no fallback fetcher is invoked.

**Acceptance Scenarios**:

1. **Given** a court website that works with the standard fetcher (e.g., Florida courts), **When** the harvest pipeline runs, **Then** the standard fetcher is used and the fallback fetcher is never invoked.
2. **Given** a court config that does not specify a special fetch method, **When** the pipeline runs, **Then** the default standard fetcher is used with no behavior change.
3. **Given** a dry-run harvest for FL, **When** comparing output before and after the fallback integration, **Then** the results are identical.

---

### User Story 3 - Graceful Degradation Without Fallback Tool Installed (Priority: P2)

As a developer or CI system running the pipeline without the fallback tool installed, I want the pipeline to detect the missing tool and skip fallback fetching gracefully so that the pipeline still works for all standard sites.

**Why this priority**: Not all environments (CI, fresh dev setups) will have the fallback tool installed. The pipeline must not crash or produce confusing errors when it's absent.

**Independent Test**: Uninstall the fallback tool, run a harvest that would normally use it, and verify the pipeline logs a warning and continues without error.

**Acceptance Scenarios**:

1. **Given** the fallback tool is not installed on the system, **When** the pipeline encounters a court configured to use it, **Then** the system logs a warning and skips that court's roster (or falls back to the standard fetcher) without crashing.
2. **Given** the fallback tool is not installed, **When** a harvest runs for a state that only uses the standard fetcher, **Then** the harvest completes normally with no warnings.
3. **Given** the fallback tool becomes available after initially being missing, **When** the next harvest runs, **Then** the system detects it and uses it for configured courts.

---

### User Story 4 - Per-Court Fetch Method Configuration (Priority: P2)

As a pipeline operator, I want to configure the fetch method per court (standard, stealth, or auto-detect) so that I have fine-grained control over which courts use which fetcher.

**Why this priority**: Different courts behave differently — some work fine with standard fetch, some need stealth, and some may work intermittently. Per-court config gives operators control without code changes.

**Independent Test**: Configure one court to use standard, one to use stealth, and one to use auto-detect. Run the pipeline and verify each court uses the correct fetch method.

**Acceptance Scenarios**:

1. **Given** a court config with fetch method set to "stealth," **When** the pipeline processes that court, **Then** the stealth fetcher is used directly without attempting the standard fetcher first.
2. **Given** a court config with fetch method set to "auto," **When** the standard fetcher returns insufficient content (<200 characters), **Then** the system automatically falls back to the stealth fetcher.
3. **Given** a court config with fetch method set to "auto," **When** the standard fetcher returns sufficient content, **Then** the stealth fetcher is not invoked.

---

### User Story 5 - Observability of Fetch Method Used (Priority: P3)

As a pipeline operator, I want to see which fetch method was used for each page in the harvest logs so that I can diagnose issues and optimize court configurations. Persistent metrics (success/failure counts, latency per domain) are out of scope for this feature and deferred to a future enhancement; operators can derive metrics from log output.

**Why this priority**: Debugging harvest failures requires knowing which path was taken. This is operationally important but not blocking for core functionality.

**Independent Test**: Run a harvest with a mix of standard and stealth-configured courts and verify the logs clearly indicate which method was used for each page.

**Acceptance Scenarios**:

1. **Given** a harvest run that uses both standard and stealth fetchers, **When** reviewing the logs, **Then** each page fetch entry indicates which method was used.
2. **Given** an auto-detect court where the standard fetcher fails and the stealth fetcher succeeds, **When** reviewing the logs, **Then** both the initial standard attempt and the stealth fallback are logged.

---

### Edge Cases

- What happens when the stealth fetcher times out? The system should retry once with a short backoff (10-30 seconds). If the retry also fails, treat it as a fetch failure, log the timeout, and continue with the next court.
- What happens when the stealth fetcher returns content but it's unparseable (garbled HTML, CAPTCHA page)? The system should detect insufficient/invalid content and log it as a fetch failure rather than storing bad data.
- What happens when a court URL returns a redirect chain that the standard fetcher follows but the stealth fetcher handles differently? The system should handle redirects consistently and log any discrepancies.
- What happens when the stealth fetcher is invoked concurrently for multiple court pages? The system should handle concurrent invocations without resource conflicts.
- What happens when multiple stealth fetches target the same domain in rapid succession? The system should enforce a configurable per-domain delay (default 2-5 seconds) to avoid triggering IP bans or additional anti-bot escalation.

## Terminology Mapping

| Spec Term | Enum Value | Notes |
|-----------|------------|-------|
| standard (fetcher) | `http` | Existing default — uses `fetchPage()` |
| stealth (fetcher) | `scrapling` | New — uses Scrapling CLI via `fetchWithScrapling()` |
| auto-detect | `auto` | New — tries standard first, falls back to stealth |
| browser | `browser` | Legacy, unsupported — skipped with warning |
| manual | `manual` | Legacy, unsupported — skipped with warning |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST support a fallback fetcher that can retrieve content from court websites protected by anti-bot measures (e.g., Cloudflare Turnstile).
- **FR-002**: The system MUST allow per-court configuration of fetch method with at least three options: standard (default), stealth, and auto-detect.
- **FR-003**: The system MUST use the standard fetcher as the default for all courts unless explicitly configured otherwise.
- **FR-004**: In auto-detect mode, the system MUST fall back to the stealth fetcher only when the standard fetcher returns insufficient content (fewer than 200 characters of extracted text).
- **FR-005**: The system MUST detect whether the fallback tool is available at startup and cache the result for the duration of the process.
- **FR-006**: When the fallback tool is unavailable, the system MUST log a warning and continue operating with the standard fetcher only — no crashes or unhandled errors.
- **FR-007**: The system MUST log which fetch method was used for every page retrieval, including fallback attempts.
- **FR-008**: The stealth fetcher MUST return content in the same format as the standard fetcher so downstream extraction logic works identically regardless of fetch method.
- **FR-009**: The system MUST NOT use the stealth fetcher to bypass authentication — only public court websites with anti-bot challenges are in scope. This is enforced by the domain allowlist (FR-015).
- **FR-010**: The system MUST apply the configured fetch method to both roster page fetches and individual bio page fetches.
- **FR-011**: Existing harvest behavior for states using the standard fetcher (FL, CA, TX, SC) MUST remain unchanged — zero regressions.
- **FR-012**: Court configurations MUST be updatable without code changes — operators can switch a court's fetch method by editing configuration files.
- **FR-013**: The system MUST enforce a configurable per-domain delay between consecutive stealth fetch requests to the same domain, with a sensible default (e.g., 2-5 seconds), to avoid triggering IP bans or anti-bot escalation.
- **FR-014**: When a stealth fetch fails (timeout, error, or empty response), the system MUST retry once with a short backoff (10-30 seconds). If the retry also fails, the system MUST mark that court as failed for the current run and continue processing remaining courts.
- **FR-015**: The stealth fetcher MUST only execute against domains listed in an explicit allowlist. Requests targeting domains not on the allowlist MUST be rejected with a logged error. New domains require a configuration change to be added to the allowlist.

### Key Entities

- **Court Config**: Per-court configuration that includes the roster URL, state abbreviation, and a fetch method preference (standard, stealth, or auto-detect).
- **Fetch Result**: The standardized output of any fetcher — contains the retrieved content (markdown/HTML), success status, error details if failed, and metadata about which fetch method produced it.
- **Fetch Method**: An enumerated value on each court config entry that controls which fetcher the pipeline dispatches for that court. Valid values: standard (default), stealth, auto-detect.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Judge data from at least one previously-blocked New York court roster is successfully extracted and stored in the system. If NY Cloudflare Turnstile resists the stealth fetcher, this criterion is deferred — see SC-007 for infrastructure-only success.
- **SC-002**: Harvest dry-runs for FL, CA, TX, and SC produce identical results before and after the integration — zero regressions.
- **SC-003**: The pipeline completes without errors when the fallback tool is not installed, with a single logged warning per run.
- **SC-004**: Each page fetch in the harvest logs clearly identifies which fetch method was used (standard or stealth).
- **SC-005**: Courts configured with the stealth fetch method retrieve content within 30 seconds per page.
- **SC-006**: The auto-detect mode correctly falls back to the stealth fetcher in 100% of cases where the standard fetcher returns insufficient content for a stealth-configured test court.
- **SC-007**: Even if NY bypass fails, the feature is considered a partial success if: the fallback fetcher infrastructure is integrated, per-court fetch method configuration works, graceful degradation is verified, and the stealth fetcher successfully retrieves content from at least one test URL (any anti-bot or JS-heavy site). NY becomes a deferred target for a future alternative tool.

## Assumptions

- The required runtime environment for the fallback tool is available on development and deployment machines.
- The fallback tool's interface and output format remain stable across minor versions.
- Court websites targeted by the stealth fetcher are public government sites — no authentication is required.
- The stealth fetcher's output (markdown) is compatible with the existing content extraction workflow used downstream.
- The standard fetcher's existing behavior and performance characteristics do not change.
- The Cloudflare Turnstile protection on NY courts is representative of the anti-bot measures the system will encounter as it expands to more states.

## Constraints

- The fallback tool runs as a separate external process, adding a system-level dependency beyond the core application runtime.
- Stealth fetching is significantly slower than standard fetching (~5-15 seconds per page vs ~1-2 seconds), so it must only be used for courts that genuinely need it.
- The integration with the external tool is a coupling point — output format changes in the fallback tool could break content parsing.

## Dependencies

- Existing standard fetcher and content cleaning pipeline must remain stable.
- Court configuration schema must be extensible to include the new fetch method field.
- The fallback tool must be installable and functional on the target operating systems (macOS for development, Linux for deployment).
