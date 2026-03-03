# Feature Specification: State Expansion — Texas, California & New York Judge Harvesting

**Feature Branch**: `008-state-expansion`
**Created**: 2026-03-02
**Status**: Draft
**Input**: User description: "Phase 5 — State Expansion (Texas, California, New York)"

## User Scenarios & Testing _(mandatory)_

### User Story 1 — Harvest Texas Judges from Official Court Websites (Priority: P1) 🎯 MVP

An admin runs the harvest tool targeting Texas and receives an import-ready CSV of Texas judges covering all major court levels: Supreme Court (9 justices), Court of Criminal Appeals (9 judges), 14 Courts of Appeals, and District Courts across 254 counties. The admin reviews the generated quality report, confirms accuracy by spot-checking records against official state judiciary pages, and imports the CSV through the existing admin import pipeline. Texas judges then appear in the verification queue for manual review before publishing.

**Why this priority**: Texas has the second-largest judiciary in the US with ~2,500 judges at district level and above. It produces immediate SEO value across 254 county pages and validates the multi-state harvester against a court system structurally different from Florida's (notably, Texas uniquely has two courts of last resort — one civil, one criminal).

**Independent Test**: Run the harvester with `--state texas`. Verify the output CSV contains judges from at least 3 court levels with correct county assignments. Cross-reference 20 random records against the Texas Office of Court Administration website (txcourts.gov). Import the CSV through the admin panel and confirm records appear in the verification queue.

**Acceptance Scenarios**:

1. **Given** the Texas court configuration maps roster URLs for all 14 Courts of Appeals, **When** the harvester runs for Texas, **Then** appellate judges are extracted with their district number and correct county assignments.
2. **Given** Texas has two courts of last resort (Supreme Court for civil, Court of Criminal Appeals for criminal), **When** the harvester processes these pages, **Then** both courts are represented with correct court type names and all 18 justices/judges are captured.
3. **Given** Texas district courts span 254 counties across over 450 judicial districts, **When** the harvester processes district court pages, **Then** each judge is associated with their correct judicial district and county or counties.
4. **Given** Texas court websites have different HTML structures than Florida, **When** the extraction runs, **Then** the Texas-specific extraction prompt handles these structural differences and produces accurate records without requiring code changes.
5. **Given** the Texas extraction completes, **When** the admin reviews the quality report, **Then** the report shows total judges extracted, court level coverage, counties covered, duplicates removed, and any failed URLs.

---

### User Story 2 — Harvest California Judges from Official Court Websites (Priority: P1)

An admin runs the harvest tool targeting California and receives an import-ready CSV covering the Supreme Court (7 justices), 6 Courts of Appeal (with divisions), and 58 Superior Courts (one per county, ~1,700 judges). California's unified trial court system (Superior Courts) is structurally different from Florida's (Circuit + County courts) and Texas's (District Courts) — validating that the harvester handles diverse court hierarchies.

**Why this priority**: California has the largest state judiciary (~1,700 judges) and the highest search volume for judge-related queries in the US. It delivers maximum SEO return and tests the architecture against a unified trial court system.

**Independent Test**: Run the harvester with `--state california`. Verify the output includes Supreme Court justices, appellate justices, and Superior Court judges with correct county mappings. Cross-reference 20 random records against the California Courts website (courts.ca.gov).

**Acceptance Scenarios**:

1. **Given** California has 58 Superior Courts (one per county), **When** the harvester processes the court pages, **Then** each judge is linked to the correct county.
2. **Given** California's Courts of Appeal have numbered divisions within each district, **When** the harvester extracts appellate justices, **Then** the district assignment is captured in the record.
3. **Given** the California Courts website publishes rosters in a format different from both Florida and Texas, **When** extraction runs, **Then** the California-specific prompt produces accurate structured records.
4. **Given** California extraction completes, **When** the admin imports the CSV, **Then** records flow through the existing import pipeline and appear in the verification queue.

---

### User Story 3 — Harvest New York Judges from Official Court Websites (Priority: P2)

An admin runs the harvest tool targeting New York and receives an import-ready CSV covering the Court of Appeals (7 judges), Appellate Division (4 Departments), Supreme Court (trial-level), and County Courts across 62 counties. New York's uniquely complex judiciary — where "Supreme Court" is actually a trial court, not the highest court — stress-tests the harvester's ability to handle non-standard court naming.

**Why this priority**: New York has a uniquely complex judiciary with overlapping jurisdictions, especially in NYC's 5 boroughs (which map to 5 counties: New York, Kings, Queens, Bronx, Richmond). It is the definitive stress test for the state-agnostic configuration schema. Lower priority than TX and CA because New York's court website structure is more fragmented and may require more manual curation.

**Independent Test**: Run the harvester with `--state new-york`. Verify the output correctly handles NYC's borough-to-county mapping and New York's inverted court naming. Cross-reference 20 random records against the NY Unified Court System website (nycourts.gov).

**Acceptance Scenarios**:

1. **Given** New York City has 5 boroughs that map to 5 counties (New York/Manhattan, Kings/Brooklyn, Queens, Bronx, Richmond/Staten Island), **When** the harvester processes NYC courts, **Then** judges are correctly assigned to their borough's county name.
2. **Given** New York's "Supreme Court" is a trial court (unlike every other state), **When** the state configuration maps it, **Then** the court type preserves New York's official naming without conflicting with other states' Supreme Courts.
3. **Given** the state-agnostic configuration schema supports arbitrary court types, **When** New York specialized courts (Family Court, Surrogate's Court) are added in a future configuration expansion, **Then** the pipeline processes them using the same extraction and import flow without code changes. _(Note: NY specialized courts are out of scope for this feature — this validates extensibility.)_
4. **Given** the New York extraction encounters the Appellate Division's 4 Departments, **When** the harvester runs, **Then** each department's justices are captured with the correct department number and county assignments.

---

### User Story 4 — Multi-State Orchestration and Combined Reporting (Priority: P2)

An admin runs a single command to harvest all configured states sequentially (Florida, Texas, California, New York). Each state runs as an independent pipeline with its own checkpoint, output directory, and quality report. At the end, the admin receives a combined summary showing per-state results and aggregate totals. If one state fails mid-run, the remaining states still complete.

**Why this priority**: Without batch orchestration, the admin must manually trigger and track each state separately — tedious and error-prone when managing 4+ states. This enables the operational workflow for ongoing multi-state data maintenance.

**Independent Test**: Configure all 4 states. Run `--all` and verify each state is processed sequentially with separate output directories. Interrupt the run after 2 states complete, then run `--all --resume` and verify the completed states are skipped while remaining states pick up.

**Acceptance Scenarios**:

1. **Given** 4 state configurations exist, **When** the admin runs `--all`, **Then** each state is processed sequentially, each with its own checkpoint and output directory.
2. **Given** a multi-state run is interrupted after Texas completes but midway through California, **When** the admin runs `--all --resume`, **Then** Texas is skipped (already complete) and California resumes from its last checkpoint.
3. **Given** the extraction for New York fails due to a website outage, **When** `--all` is running, **Then** the failure is logged, New York's checkpoint is saved, and the system proceeds to the next state.
4. **Given** all states complete (or fail), **When** the combined summary is generated, **Then** it shows per-state totals (judges extracted, coverage, errors) and an aggregate total across all states.

---

### User Story 5 — Court Structure Seeding for New States (Priority: P1)

Before judge records can be imported, each state's court structure must exist in the database. An admin runs the seeder for a target state (e.g., `--state texas --seed-courts-only`) to create Court records matching that state's judicial hierarchy — linking each court to the correct counties, districts, circuits, or departments as defined in the state's configuration file.

**Why this priority**: Court records are a prerequisite for judge import. The existing import pipeline assigns judges to courts, so courts must exist in the database first. This must work for any state configuration.

**Independent Test**: Run `--state texas --seed-courts-only`. Verify that Texas courts appear in the admin panel with correct county assignments. Confirm that a subsequent `--state texas` harvest run can import judges without "missing court" errors.

**Acceptance Scenarios**:

1. **Given** a Texas configuration with 14 Courts of Appeals, each mapping to specific counties, **When** the court seeder runs, **Then** Court records are created with the correct court type, label, and county associations.
2. **Given** a California configuration with 58 Superior Courts (one per county), **When** the court seeder runs, **Then** each county gets exactly one Superior Court record.
3. **Given** a New York configuration with multi-county courts (e.g., Appellate Division 2nd Dept covering 10 counties), **When** the court seeder runs, **Then** the court is correctly associated with all listed counties.
4. **Given** the admin runs the court seeder for a state that already has courts seeded, **When** the seeder runs again, **Then** it skips existing courts without creating duplicates.

---

### Edge Cases

- **EC-001**: A state court website is temporarily unavailable — the checkpoint system records the failure per URL; the admin can `--resume` to retry only the failed URLs without re-processing successful ones.
- **EC-002**: A state has courts that span multiple counties (e.g., Texas multi-county district courts, NY Appellate Division departments) — the configuration schema and seeder support arrays of counties per court entry.
- **EC-003**: Two states use the same court type name with different meanings (e.g., "Supreme Court" in NY is a trial court, in CA it's the highest court) — court type names are stored per-state scope and not compared across states.
- **EC-004**: A state website throttles requests more aggressively than Florida — per-state rate limit configuration (delay, max concurrent, timeout) adjusts behavior without code changes. New York's config defaults to 3-second delays vs. Florida/Texas at 1.5 seconds.
- **EC-005**: One state fails during an `--all` run — the system saves that state's checkpoint, logs the failure, skips to the next state, and reports all failures in the combined summary. The admin can later target just the failed state with `--state {name} --resume`.
- **EC-006**: A state has no judges listed for a configured court URL (vacancy, page redesign) — the quality report flags zero-result URLs; the court structure is still seeded even if no judges are extracted.
- **EC-007**: A state's court page uses JavaScript rendering that prevents simple HTTP fetching — the configuration supports a `fetchMethod` field ("http", "browser", "manual") so individual court entries can be flagged for alternative handling. Pages requiring "browser" or "manual" methods are logged as skipped in the quality report for the initial phase.
- **EC-008**: The admin runs the harvester for a state whose counties are missing from the database seed data — the system logs a warning identifying missing counties and continues extraction, allowing the admin to seed missing counties before import.

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST accept a `--state {name}` flag that selects a single state's configuration for harvesting. Running without `--state` or `--all` MUST default to Florida for backward compatibility.
- **FR-002**: System MUST accept an `--all` flag that processes all available state configurations sequentially. If one state fails mid-extraction, the system MUST log the failure, save that state's checkpoint, proceed to the next state, and include all failures in the combined summary.
- **FR-003**: System MUST accept a `--list` flag that prints all available state configuration names and their court counts, then exits.
- **FR-004**: System MUST use a standardized configuration schema for state court definitions that supports: state name, abbreviation, court hierarchy with URLs and county mappings, optional per-state rate limits, and optional extraction prompt file references.
- **FR-005**: System MUST validate state configuration files against the schema at startup, rejecting invalid configurations with specific error messages identifying the issue and field.
- **FR-006**: System MUST maintain per-state checkpoint files independent of other states, enabling per-state resume without affecting other states' progress.
- **FR-007**: System MUST maintain per-state output directories for CSV files, quality reports, and logs.
- **FR-008**: System MUST support state-specific extraction prompts stored as separate files, referenced from the state configuration. Falls back to a generic extraction prompt when no state-specific prompt is specified.
- **FR-009**: System MUST produce a per-state quality report showing: total pages fetched, total judges extracted, court level coverage, county coverage, duplicates removed, and failed URLs.
- **FR-010**: System MUST produce a combined summary report when `--all` is used, aggregating per-state results with an overall total.
- **FR-011**: System MUST generalize the court seeder to accept any state's configuration and create Court records for that state's counties and court types without duplicating existing records.
- **FR-012**: System MUST include a Texas configuration covering the Supreme Court, Court of Criminal Appeals, and 14 Courts of Appeals with curated roster URLs and county mappings. District Court URLs are added incrementally as curated — the initial harvest focuses on appellate-level courts (~200+ judges) without blocking on district court URL curation.
- **FR-013**: System MUST include a California configuration covering the Supreme Court, 6 Courts of Appeal, and 58 Superior Courts with curated roster URLs and per-county mappings.
- **FR-014**: System MUST include a New York configuration covering the Court of Appeals, Appellate Division (4 Departments), Supreme Court, and County Courts with curated roster URLs and county mappings across 62 counties including NYC borough-to-county resolution.
- **FR-015**: System MUST include state-specific extraction prompts for Texas, California, and New York that handle each state's unique court page HTML structures and naming conventions.
- **FR-016**: System MUST preserve full backward compatibility with existing CLI flags (`--resume`, `--reset`, `--dry-run`, `--skip-bio`, `--ballotpedia`, `--seed-courts-only`) when combined with `--state`.
- **FR-017**: System MUST normalize court type names per state using state-specific mappings (e.g., "Ct. App." → "Court of Appeals" for Texas, "App. Div." → "Appellate Division" for New York).
- **FR-018**: System MUST support multi-county court entries — a single court URL that covers multiple counties (e.g., a Texas judicial district spanning 3 counties).
- **FR-019**: System MUST verify that county records exist in the database for each state before harvesting, logging clear warnings for any missing counties.
- **FR-020**: System MUST support deterministic (non-LLM) extraction for court pages that have structured, predictable HTML, using a flag in the court entry configuration to bypass AI extraction when possible.
- **FR-021**: System MUST produce CSV output compatible with the existing admin import pipeline — same column format used for Florida (Judge Name, Court Type, County, State, Source URL, Selection Method).
- **FR-022**: System MUST include a valid source URL for every extracted judge record linking to the specific government page where the data was found.
- **FR-023**: System MUST produce a full replacement dataset on every run — a complete CSV of all current judges for the target state. Re-harvesting relies on the existing import pipeline's duplicate detection to handle overlap with previously imported records.
- **FR-024**: System MUST use a soft quality gate — the pipeline always completes and produces output regardless of extraction accuracy. The quality report MUST prominently flag states or court levels where accuracy appears below the 90% spot-check threshold (e.g., high ratio of missing fields, zero-result pages, or parsing errors). The admin decides whether to import or discard based on the report.
- **FR-025**: System MUST support an optional county alias map in each state configuration that maps informal or variant county names to the canonical names in the seed data (e.g., "Manhattan" → "New York", "Dewitt" → "DeWitt"). County names not found in the alias map or seed data MUST trigger a warning in the quality report listing the unresolved name and affected judge records.
- **FR-026**: System MUST track the timestamp of each state's last completed harvest and include a "data age" notice in the quality report when a state's data is older than 90 days, recommending a re-harvest.
- **FR-027**: Extraction prompts MUST attempt to capture the judge's division or subject-matter assignment (e.g., "Criminal Division", "Family Division", "Civil Division") when the source page provides this information. Extracted division data populates the existing `Judge.division` field. When division data is not available on the source page, the field is left empty.

### Key Entities

- **StateConfig**: A configuration file defining one state's complete court hierarchy — state name, abbreviation, roster URLs, court types, county mappings, optional county alias map for name resolution, optional rate limits, and optional extraction prompt reference. One config per state.
- **CourtEntry**: A single court within a StateConfig — court type, roster URL, associated counties, level (supreme/appellate/trial/specialized), optional district/circuit/department number, fetch method hint.
- **Checkpoint**: Per-state progress tracker storing completed URLs, extraction results, and timestamps. Enables resumable runs per state.
- **ExtractionPrompt**: State-specific text that instructs the LLM how to parse a particular state's court page HTML into structured judge records. Stored as a separate file.
- **QualityReport**: Per-state Markdown report summarizing harvest results — coverage metrics, extraction statistics, failures, and deduplication outcomes.

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: An admin can onboard a new state by creating a JSON configuration file and an extraction prompt in under 30 minutes, without modifying any source code.
- **SC-002**: Texas harvest produces at least 200 judge records from appellate-level courts (Supreme Court, CCA, Courts of Appeals) in the initial phase, with district court records added incrementally as URLs are curated.
- **SC-003**: California harvest produces at least 1,500 judge records covering the Supreme Court, Courts of Appeal, and all 58 Superior Courts.
- **SC-004**: New York harvest produces at least 1,000 judge records covering the Court of Appeals, Appellate Division, and Supreme Court/County Courts across 62 counties.
- **SC-005**: Combined extraction across the 3 new states yields 2,700+ total judge records in the initial phase (TX appellate ~200, CA ~1,500, NY ~1,000), scaling as district court URLs are curated.
- **SC-006**: Per-state quality reports show extraction accuracy of 90%+ when 20 random records per state are spot-checked against their source URLs.
- **SC-007**: All extracted records import cleanly through the existing admin import pipeline with fewer than 5% error rows per state.
- **SC-008**: Multi-state orchestration (`--all`) completes all configured states in a single invocation with independent per-state checkpoints and output.
- **SC-009**: Existing Florida harvester behavior is unchanged — running without flags or with `--state florida` produces identical output to pre-expansion behavior.
- **SC-010**: Each state's court structure is correctly seeded in the database, matching the official judicial hierarchy (verifiable by court count and county assignments).

## Assumptions

- Texas, California, and New York state judiciary websites publish judge rosters on publicly accessible web pages (no authentication required).
- The existing LLM integration has sufficient capacity and context window to handle HTML pages from these states, which may differ significantly in structure from Florida's.
- The 50-state + 3,143-county seed data already in the database covers all counties for the 3 target states — court creation is needed, not county creation.
- Rate limiting settings tuned for Florida will be acceptable baselines for other states; per-state rate limit overrides handle states with stricter throttling.
- State court page HTML structures, while different from Florida's, are parseable by an LLM with appropriate state-specific prompting.
- The admin has access to an LLM API key with sufficient quota for 3 additional states (estimated 300-500 total extraction calls).
- The Texas and California configurations focus on appellate and trial-level courts; lower-level courts (JP, Municipal, Small Claims) are deferred to future config expansions with no code changes needed.
- The admin import pipeline, verification workflow, and existing public pages all function correctly and require no modifications for multi-state data.

## Scope Boundaries

**In Scope**:

- Multi-state CLI orchestration with `--state`, `--all`, `--list` flags
- Per-state checkpoint, output directory, and quality report isolation
- State-agnostic configuration schema with validation
- Generalized court seeder for any state
- Texas court configuration + extraction prompt (Supreme, CCA, Appeals, District)
- California court configuration + extraction prompt (Supreme, Appeal, Superior)
- New York court configuration + extraction prompt (Court of Appeals, Appellate Division, Supreme, County)
- Combined summary report for multi-state runs
- Backward-compatible Florida behavior

**Out of Scope**:

- Automated URL discovery or web crawling to find new court pages
- Browser-based scraping for JavaScript-rendered pages (flagged as "browser" fetch method for future phases)
- Expanding beyond TX, CA, NY (additional states are future config additions)
- Texas lower-level courts (County Courts, Justice of the Peace)
- New York specialized courts beyond Supreme/County (Family Court, Surrogate's, Housing — deferred)
- Changes to the admin import pipeline or verification workflow
- Changes to public-facing website pages or SEO templates
- Automated verification of extracted records (verification remains manual)
- Performance optimization for concurrent state processing (states run sequentially)- Direct-to-database import bypassing CSV (potential future `--direct-import` flag once extraction quality is validated across states)

## Clarifications

### Session 2026-03-03

- Q: When re-harvesting a previously extracted state, should the output be a full replacement or a delta of changes? → A: Full replacement — every run produces a complete CSV of all current judges; the existing import pipeline's duplicate detection handles overlap with previously imported records.
- Q: If extraction accuracy drops below the 90% threshold for a state, should the pipeline halt, complete normally, or partially import? → A: Soft gate — pipeline completes normally; quality report prominently flags states below threshold; admin decides whether to import or discard based on the report.
- Q: Texas district courts (~450 judicial districts) lack centralized roster pages — should the harvest block on curating all URLs or proceed in phases? → A: Phased — harvest appellate courts first (Supreme Court, CCA, 14 Courts of Appeals with centralized URLs); add district court URLs incrementally as they are curated. This avoids blocking the Texas harvest on the most labor-intensive step.
- Q: How should county name mismatches between state court configs and the seed data be resolved (e.g., "Dewitt" vs "DeWitt", "Manhattan" vs "New York")? → A: Alias map — each state config includes an optional county alias map for known mismatches; unresolved county names trigger a warning in the quality report.
- Q: How long should extracted data be considered "fresh" before a re-harvest is recommended? → A: 90 days — quality report includes a "data age" notice when a state's last harvest is older than 90 days, aligning with judicial appointment cycles and election seasons.
