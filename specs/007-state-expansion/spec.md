# Feature Specification: State Expansion — Multi-State Harvesting Infrastructure

**Feature Branch**: `007-state-expansion`  
**Created**: 2026-03-01  
**Status**: Draft  
**Input**: User description: "Phase 5 - State Expansion: Extend harvesting infrastructure to additional states beyond Florida, starting with high-value targets (Texas, California, New York) using the proven Florida pattern. Create a state-agnostic harvester configuration, multi-state CLI orchestration, and state-specific extraction prompts."

## User Scenarios & Testing _(mandatory)_

### User Story 1 — State-Agnostic Harvester Configuration (Priority: P1) 🎯 MVP

An admin creates a new state configuration file (e.g., `texas-courts.json`) that defines the state's court hierarchy, roster URLs, court types, and county mappings. The harvester reads this configuration and runs the same fetch → extract → normalize → deduplicate → CSV pipeline that currently works for Florida — without modifying any harvester code. Each state configuration file follows a standardized schema so new states can be onboarded by adding a JSON file and optionally a state-specific extraction prompt.

**Why this priority**: Without a generalized configuration schema, every new state requires bespoke code changes. A state-agnostic config is the single highest-leverage change — it unlocks all future state expansions with minimal engineering effort.

**Independent Test**: Create a minimal Texas configuration file with 2-3 court URLs. Run the harvester with `--state texas`. Verify it fetches the pages, extracts judge records, and produces a CSV without touching any Florida-specific code.

**Acceptance Scenarios**:

1. **Given** a state configuration file exists at `scripts/harvest/{state}-courts.json`, **When** the admin runs the harvester with `--state {state}`, **Then** the harvester loads that configuration and executes the full pipeline for the specified state.
2. **Given** the state configuration schema, **When** an admin creates a new state file, **Then** the schema validates required fields (state name, abbreviation, court types with URLs and county mappings) and rejects incomplete configurations with clear error messages.
3. **Given** a state with a court hierarchy different from Florida's (e.g., Texas has no "District Court of Appeal" but has "Court of Appeals"), **When** the configuration uses state-specific court type names, **Then** the harvester accepts any court type string and maps it through the existing normalizer.
4. **Given** a state configuration with optional fields (e.g., `extractionPromptFile`, `rateLimit`), **When** those fields are omitted, **Then** the harvester uses sensible defaults (generic extraction prompt, standard rate limits matching current Florida behavior).

---

### User Story 2 — Multi-State CLI Orchestration (Priority: P1)

An admin runs the harvest CLI targeting one or more states in a single invocation. The CLI accepts a `--state` flag (single state) or `--all` flag (all configured states). Each state runs as an independent pipeline with its own checkpoint, output directory, and quality report. The admin can resume interrupted multi-state runs.

**Why this priority**: Without CLI orchestration, the admin must manually run and track each state separately. This directly enables the operational workflow for expanding to 3+ states.

**Independent Test**: Configure Florida and Texas. Run `--state texas` and verify only Texas is harvested. Run `--all` and verify both states are processed sequentially with separate output directories.

**Acceptance Scenarios**:

1. **Given** multiple state configuration files exist, **When** the admin runs `--state texas`, **Then** only the Texas configuration is loaded and processed.
2. **Given** multiple state configuration files exist, **When** the admin runs `--all`, **Then** each state is processed sequentially, each with its own checkpoint file and output directory.
3. **Given** a multi-state run is interrupted after completing Texas but midway through California, **When** the admin runs `--all --resume`, **Then** Texas is skipped (already complete) and California resumes from its last checkpoint.
4. **Given** no `--state` or `--all` flag is provided, **When** the admin runs the harvester, **Then** the CLI defaults to existing Florida behavior (backward compatibility).
5. **Given** the admin wants to see which states are configured, **When** the admin runs `--list`, **Then** the CLI prints all available state names and exits.
6. **Given** the admin runs `--state nonexistent`, **When** no configuration file is found, **Then** the CLI exits with a clear error listing available states.

---

### User Story 3 — Texas Court Structure and Harvest (Priority: P2)

An admin onboards Texas by creating a Texas court configuration file mapping the state's judicial structure: Supreme Court, Court of Criminal Appeals, 14 Courts of Appeals, and District Courts (over 450 districts) across 254 counties. The harvester extracts Texas judge records from official state judiciary websites. Lower-level courts (County Courts, Justice of the Peace) are excluded from the initial harvest but can be added later by expanding the Texas config.

**Why this priority**: Texas has the second-largest judiciary in the US with 254 counties and ~2,500 judges at the district level and above. It provides strong SEO value and validates the state-agnostic architecture against a court system structurally different from Florida's.

**Independent Test**: Run the harvester with `--state texas`. Verify the output CSV contains judges from at least 3 different court types with correct county assignments. Cross-reference 10 random records against the Texas Office of Court Administration website.

**Acceptance Scenarios**:

1. **Given** the Texas configuration file maps all 14 Courts of Appeals with their URLs, **When** the harvester runs, **Then** appellate judges are extracted with their district number and county assignments.
2. **Given** Texas has over 450 district courts, **When** the harvester processes district court pages, **Then** each judge is associated with the correct judicial district and county.
3. **Given** Texas court websites have different HTML structures than Florida, **When** the LLM extraction runs, **Then** the Texas-specific extraction prompt handles these structural differences without requiring code changes.

---

### User Story 4 — California Court Structure and Harvest (Priority: P2)

An admin onboards California by creating a configuration file for its court system: Supreme Court, 6 Courts of Appeal (with divisions), 58 Superior Courts (one per county). The harvester extracts California judge records from the official California Courts website.

**Why this priority**: California has the largest state judiciary (~1,700 judges) and the highest search volume for judge-related queries. It provides maximum SEO return and tests the architecture against a different court structure (unified trial courts).

**Independent Test**: Run the harvester with `--state california`. Verify the output includes Superior Court judges with correct county mappings. Cross-reference 10 random records against the California Courts website.

**Acceptance Scenarios**:

1. **Given** California has 58 Superior Courts (one per county), **When** the harvester processes the court pages, **Then** each judge is linked to the correct county.
2. **Given** California Courts of Appeal have numbered divisions, **When** the harvester extracts appellate judges, **Then** the division information is captured in the judge record.
3. **Given** California publishes judge rosters in a format different from Florida and Texas, **When** the extraction runs, **Then** the California-specific prompt produces accurate structured records.

---

### User Story 5 — New York Court Structure and Harvest (Priority: P3)

An admin onboards New York by creating a configuration file for its complex court system: Court of Appeals, Appellate Division (4 Departments), Supreme Court, County Courts, Family Courts, Surrogate's Courts, and NYC Civil/Criminal Courts across 62 counties.

**Why this priority**: New York has a uniquely complex judiciary with overlapping jurisdictions (especially in NYC's 5 boroughs). It stress-tests the state-agnostic schema against the most complex court hierarchy in the US.

**Independent Test**: Run the harvester with `--state new-york`. Verify the output handles NYC's multi-county courts correctly. Cross-reference 10 random records against the NY Unified Court System website.

**Acceptance Scenarios**:

1. **Given** New York City has 5 boroughs that map to 5 counties, **When** the harvester processes NYC courts, **Then** judges are correctly assigned to their borough/county.
2. **Given** New York's "Supreme Court" is actually a trial court (unlike other states), **When** the configuration maps this court type, **Then** the court type name matches New York's official naming ("Supreme Court") without conflict with other states.
3. **Given** New York has specialized courts (Family, Surrogate's, Housing), **When** the configuration includes these court types, **Then** the schema accepts them and the pipeline processes them normally.

---

### Edge Cases

- What happens when a state court website is temporarily unavailable? The checkpoint system records the failure and the admin can `--resume` to retry failed URLs.
- What happens when a state has courts that span multiple counties (e.g., Texas multi-county district courts)? The configuration schema supports arrays of counties per court entry.
- What happens when two states use the same court type name with different meanings (e.g., "Supreme Court" in NY is a trial court, in CA it's the highest court)? Court type names are stored per-state and are not compared across states.
- What happens when a state configuration file has duplicate URLs? The schema validator warns about duplicates; the pipeline deduplicates by URL before fetching.
- What happens when the admin runs `--state texas --seed-courts-only`? Only the court structure for Texas is seeded in the database without fetching or extracting judges.
- What happens when a state website throttles requests more aggressively? The per-state rate limit config (delay, max concurrent) is adjusted in the state's JSON file without code changes.
- What happens when one state fails during an `--all` run? The system saves that state's checkpoint, logs the failure, skips to the next state, and reports all failures in the combined summary. The admin can later `--resume` just the failed state.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST define a standardized JSON schema for state court configurations that supports arbitrary court hierarchies, URLs, county mappings, optional extraction prompts, and optional per-state rate limit settings (fetch delay, max concurrent requests) with sensible defaults matching current Florida behavior.
- **FR-002**: System MUST validate state configuration files against the schema at startup, rejecting invalid configurations with specific error messages identifying the issue.
- **FR-003**: System MUST accept a `--state {name}` CLI flag that selects a single state configuration file for processing.
- **FR-004**: System MUST accept an `--all` CLI flag that processes all available state configurations sequentially. If a state fails mid-extraction, the system logs the failure, saves the state's checkpoint, proceeds to the next state, and includes all failures in the combined summary report.
- **FR-005**: System MUST maintain per-state checkpoint files (e.g., `output/texas/checkpoints/harvest-checkpoint.json`) independent of other states, enabling resume per state.
- **FR-006**: System MUST maintain per-state output directories (e.g., `output/texas/`) for CSV files, quality reports, and logs.
- **FR-007**: System MUST generalize the court seeder to accept any state configuration, creating court records for the state's counties and court types.
- **FR-008**: System MUST support state-specific extraction prompts stored as separate files (e.g., `texas-extraction-prompt.txt`), referenced by file path from the state configuration JSON. Falls back to a generic extraction prompt when no prompt file is specified.
- **FR-009**: System MUST produce a per-state quality report showing extraction statistics, coverage, failures, and deduplication results.
- **FR-010**: System MUST preserve full backward compatibility with the existing `--resume`, `--reset`, `--dry-run`, `--skip-bio`, `--ballotpedia` flags when combined with `--state`.
- **FR-011**: System MUST accept a `--list` flag that prints all available state configuration names and exits. Running without `--state`, `--all`, or `--list` defaults to Florida.
- **FR-012**: System MUST create a Texas configuration file mapping the state's court hierarchy with curated roster URLs.
- **FR-013**: System MUST create a California configuration file mapping the state's court hierarchy with curated roster URLs.
- **FR-014**: System MUST create a New York configuration file mapping the state's court hierarchy with curated roster URLs.
- **FR-015**: System MUST normalize court type names per state using the existing normalizer, extended with state-specific mappings.
- **FR-016**: System MUST support multi-county court entries (a single court URL that covers multiple counties).
- **FR-017**: System MUST produce a combined summary report when `--all` is used, aggregating per-state results.
- **FR-018**: System MUST preserve the existing Florida harvester behavior exactly when run with `--state florida` or without any state flag (no `--state`, `--all`, or `--list`).
- **FR-019**: System MUST verify that county records exist in the database for each state being harvested, logging a warning if any configured county is missing from the seed data.
- **FR-020**: System MUST support deterministic (non-LLM) extraction for court pages with structured, predictable HTML, using the `deterministic` flag and optional `selectorHint` CSS selector defined in the court entry configuration.

### Key Entities

- **StateConfig**: A JSON configuration file defining a state's court hierarchy — state name, abbreviation, court types, roster URLs, county mappings, and optional rate limit settings (fetch delay, max concurrent requests). One file per state.
- **CourtEntry**: A single court within a state config — court type, URL, list of counties served, optional district/circuit number.
- **Checkpoint**: Per-state progress tracker — completed URLs, extraction results, timestamp. Enables resume.
- **ExtractionPrompt**: State-specific LLM prompt text that handles variations in court page HTML structure. Stored as a separate file (e.g., `texas-extraction-prompt.txt`) and referenced by path from the state's JSON config.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An admin can onboard a new state by creating a single JSON configuration file in under 30 minutes, without modifying any harvester source code.
- **SC-002**: The harvester successfully extracts judge records from Texas, California, and New York, producing import-ready CSV files for each state.
- **SC-003**: Combined extraction across the 3 new states yields 4,000+ judge records (Texas ~2,500 appellate+district, California ~1,700, New York ~1,300).
- **SC-004**: Per-state quality reports show extraction accuracy of 90%+ when spot-checked against 20 random records per state.
- **SC-005**: Multi-state orchestration (`--all`) completes all configured states in a single invocation with independent checkpoints.
- **SC-006**: Existing Florida harvester behavior is unchanged — running without flags or with `--state florida` produces identical output to pre-expansion behavior.
- **SC-007**: Each state's court structure is correctly seeded in the database, matching the official judicial hierarchy of that state.

## Assumptions

- Texas, California, and New York state judiciary websites publish judge rosters on publicly accessible web pages (no authentication required).
- The existing LLM-based extraction integration has sufficient capacity and context window to handle HTML pages from these states.
- The 50-state + 3,143-county seed data already in the database covers all counties for the target states — new states don't require county creation, only court creation.
- State court website HTML structures, while different from Florida's, are parseable by an LLM with appropriate prompting.
- Rate limiting and fetching patterns (delays, retries) that work for Florida courts will be acceptable for other state judiciary websites.

## Scope Boundaries

**In Scope**:

- State-agnostic configuration schema and validation
- Multi-state CLI orchestration with per-state checkpoints
- Court seeder generalization
- Texas, California, and New York configuration files with curated URLs
- State-specific extraction prompts for the 3 target states
- Per-state and aggregate quality reports

**Out of Scope**:

- Automated URL discovery or web crawling to find court pages
- Browser-based scraping (Playwright/Puppeteer) for JavaScript-rendered pages
- Expanding beyond the initial 3 target states (that's a future phase)
- Texas lower-level courts (County Courts, Justice of the Peace) — deferred to a config expansion, no code changes needed
- Changes to the admin import pipeline or verification workflow
- Changes to the public-facing website pages
- Automated verification of extracted records (verification remains manual)

## Clarifications

### Session 2026-03-01

- Q: FR-011 (list states without flags) contradicts FR-018 (default to Florida without flags). How should the CLI behave when run without `--state` or `--all`? → A: Default to Florida for backward compatibility; add explicit `--list` flag for state discovery.
- Q: Should the config schema support per-state rate limits, or use a single global rate limit? → A: Per-state rate limit config (fetch delay, max concurrent requests) with sensible defaults matching Florida's current behavior.
- Q: Should extraction prompts be inline in the JSON config or separate files? → A: Separate prompt files (e.g., `texas-extraction-prompt.txt`) referenced by path from the JSON config. Keeps configs readable and prompts editable.
- Q: When running `--all` and one state fails mid-extraction, should the CLI halt or continue to remaining states? → A: Log failure, save checkpoint for the failed state, skip to the next state, and report all failures in the combined summary.
- Q: Should the initial Texas harvest include Justice of the Peace courts (~800 courts)? → A: Exclude JP and County courts initially. Focus on Supreme Court, Court of Criminal Appeals, Courts of Appeals, and District Courts. JP courts can be added later by expanding the Texas config with zero code changes.
