# Feature Specification: Florida Judge Data Harvest (AI-Assisted)

**Feature Branch**: `004-florida-judge-harvest`
**Created**: 2025-02-18
**Status**: Draft
**Input**: User description: "Semi-automated AI-assisted extraction of Florida judge data into the database"

## Clarifications

### Session 2026-02-18

- Q: How should the script discover Florida court roster URLs — curated list, auto-crawl from root, or hybrid? → A: Curated URL list — maintain a static config of known Florida court roster page URLs.
- Q: Which LLM provider should the extraction script use? → A: Anthropic Claude — excellent at structured extraction with large context window for full-page HTML.
- Q: What canonical court type names should be used in the database? → A: Full formal names — "Supreme Court", "District Court of Appeal", "Circuit Court", "County Court".

## User Scenarios & Testing *(mandatory)*

### User Story 1 — AI-Assisted Extraction of Florida Judge Rosters (Priority: P1) 🎯 MVP

An admin triggers a script that fetches Florida's official judicial branch web pages, extracts judge roster data using an LLM, and produces a structured CSV file ready for import. The admin reviews the generated CSV for accuracy before importing it through the existing CSV import pipeline (built in Phase 2). The process covers all 67 Florida counties across the state's court system hierarchy: Supreme Court, District Courts of Appeal (6 districts), Circuit Courts (20 circuits), and County Courts (67 counties).

**Why this priority**: Manually copying hundreds of judge records from government websites into spreadsheets is tedious, error-prone, and time-consuming. Automating the extraction step using an LLM to parse unstructured HTML into structured CSV dramatically accelerates the path to a populated Florida pilot while preserving human review before import.

**Independent Test**: Run the extraction script targeting a single Florida circuit (e.g., 11th Circuit — Miami-Dade). Verify the output CSV contains accurate judge names, court types, counties, and source URLs by cross-referencing against the official Florida Courts website. Import the CSV via the admin panel and confirm records appear in the verification queue.

**Acceptance Scenarios**:

1. **Given** the Florida Courts website is accessible, **When** the admin runs the extraction script, **Then** the script fetches judge roster pages and produces one or more CSV files with columns: Judge Name, Court Type, County, State, Source URL, Selection Method.
2. **Given** a fetched HTML page containing a judge roster table, **When** the LLM parses the content, **Then** each judge record includes at minimum the judge's full name, court assignment, and the source URL of the page it was extracted from.
3. **Given** the extraction output CSV, **When** the admin reviews it, **Then** the CSV is formatted to be directly importable via the existing `/admin/import/` pipeline without manual reformatting.
4. **Given** a Florida court page with inconsistent formatting (e.g., judge names listed as "Hon. Jane Smith" or "Smith, Jane"), **When** the LLM parses the page, **Then** names are normalized to "First Last" format (e.g., "Jane Smith") with honorifics and suffixes preserved separately or stripped.
5. **Given** the extraction script completes, **When** the admin checks the output, **Then** a summary is displayed showing total judges extracted, counties covered, and any pages that failed or returned zero results.

---

### User Story 2 — Bulk Court Seeding for Florida (Priority: P1)

Before judge records can be imported, Florida's court structure must exist in the database. An admin uses a script or the existing bulk court creation tool to seed Florida's court types using canonical names: "Supreme Court", "District Court of Appeal", "Circuit Court", "County Court" across the appropriate counties.

**Why this priority**: The CSV import pipeline auto-creates courts when they don't exist (FR-006 from Phase 2), but having the court structure pre-seeded ensures cleaner data and avoids naming inconsistencies during import. This is a prerequisite for clean judge import.

**Independent Test**: Run the court seeding step for Florida. Verify all 67 counties have the expected court types visible in the admin panel at `/admin/courts/`.

**Acceptance Scenarios**:

1. **Given** Florida has 67 counties with no courts, **When** the admin runs court seeding (via script or bulk court tool), **Then** each county gets at minimum a Circuit Court and County Court record.
2. **Given** Florida has 6 District Courts of Appeal covering specific geographic regions, **When** courts are seeded, **Then** District Courts of Appeal are associated with their correct counties based on Florida's district map.
3. **Given** the court seeding is complete, **When** the admin navigates to any Florida county in the admin panel, **Then** the seeded court types are visible and available for judge assignment.

---

### User Story 3 — Extraction Quality Report & Deduplication (Priority: P2)

After extraction, the admin reviews a quality report that highlights potential issues: duplicate judge entries across circuits, judges with missing fields, pages that couldn't be parsed, and court type inconsistencies. The admin uses this report to clean the CSV before importing.

**Why this priority**: A single judge may appear on multiple court pages (e.g., a circuit chief judge listed on both the circuit page and the county page). Without deduplication and quality reporting, the import pipeline would create duplicate records or require multiple cleanup passes.

**Independent Test**: Run extraction on overlapping Florida court pages. Verify the quality report flags duplicate names and the deduplicated CSV has no repeated judge-court combinations.

**Acceptance Scenarios**:

1. **Given** an extraction that finds the same judge name on two different pages, **When** the quality report is generated, **Then** the duplicate is flagged with both source URLs and only one record is included in the final CSV.
2. **Given** a page that returns no parseable judge data, **When** extraction completes, **Then** the quality report lists the URL as "no data extracted" with the HTTP status and any error.
3. **Given** court type names vary across pages (e.g., "Circuit Court" vs "Circuit Ct."), **When** the quality report is generated, **Then** inconsistent names are normalized to the canonical forms: "Supreme Court", "District Court of Appeal", "Circuit Court", "County Court".

---

### Edge Cases

- **EC-001**: Florida Courts website is down or rate-limits requests — script retries with exponential backoff (max 3 attempts per URL) and logs failed URLs for manual review.
- **EC-002**: A judge's name contains special characters, suffixes (Jr., III, Sr.), or hyphenated names — LLM extraction preserves these; slug generation handles them per existing EC-007 from Phase 2.
- **EC-003**: A court page lists judges in a non-tabular format (e.g., paragraph text, PDF links) — the script logs these as "manual review needed" and skips them rather than producing bad data.
- **EC-004**: LLM rate limit or API quota exceeded mid-extraction — script checkpoints progress so it can resume from the last successful page rather than restarting.
- **EC-005**: A county has no judges listed on the official website (e.g., vacancy) — the county is included in the output with zero judges and noted in the quality report.
- **EC-006**: Admin runs extraction multiple times — output CSVs have timestamped filenames to avoid overwriting; the existing import pipeline's duplicate detection handles re-imports.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a CLI script that fetches Florida judicial branch web pages from a curated, static URL configuration and extracts judge roster data into CSV format. The URL list covers flcourts.gov (Supreme Court, DCAs) and each of the 20 circuit court websites.
- **FR-002**: Script MUST use Anthropic Claude to parse unstructured HTML content into structured judge records.
- **FR-003**: Script MUST produce CSV files compatible with the existing admin import pipeline — columns: Judge Name, Court Type, County, State, Source URL, and optionally Selection Method.
- **FR-004**: Script MUST include the source URL for every extracted judge record, linking to the specific government page the data was found on, per Constitution Principle I (Data Accuracy & Source Attribution).
- **FR-005**: Script MUST normalize judge names to "First Last" format, stripping honorifics (Hon., Judge, Justice) and handling "Last, First" formats.
- **FR-006**: Script MUST deduplicate judges within the extraction output — same full name + same court type + same county = one record.
- **FR-007**: Script MUST produce a quality report summarizing: total pages fetched, total judges extracted, duplicates removed, pages with errors, counties with zero judges.
- **FR-008**: Script MUST support resumable execution — checkpoint progress so that interruptions (network failure, API quota) don't require a full restart.
- **FR-009**: Script MUST respect rate limits on both the source website (minimum 1-second delay between requests) and the LLM API.
- **FR-010**: Script MUST seed Florida's court structure using canonical names: "Supreme Court", "District Court of Appeal", "Circuit Court", "County Court" — per county for Circuit/County Courts, per district for DCAs, and one statewide Supreme Court. This may be a separate step or integrated into the extraction flow.
- **FR-011**: Script MUST handle Florida's specific court hierarchy: 1 Supreme Court, 6 District Courts of Appeal (with defined county groupings), 20 Circuit Courts (with defined county groupings), and 67 County Courts.
- **FR-012**: Script MUST log all activity to a timestamped log file for audit and debugging.
- **FR-013**: Script MUST store its configuration (Anthropic API key via `ANTHROPIC_API_KEY`, source URLs, output directory) via environment variables or a config file — no hardcoded secrets.
- **FR-014**: Generated CSV filenames MUST include a timestamp to prevent overwriting previous extractions.

### Key Entities

- **ExtractionRun**: Represents a single execution of the harvest script. Attributes: timestamp, source state, pages fetched, judges extracted, errors encountered, output file path. *(Tracked in log files, not in the database — this is an offline CLI tool.)*
- **SourcePage**: A URL on the Florida Courts website that contains judge roster data. Attributes: URL, court level (Supreme/DCA/Circuit/County), associated counties.
- **Judge** (existing): The extraction output feeds directly into the existing Judge model via CSV import. No schema changes needed.
- **Court** (existing): Courts are seeded or auto-created during import. No schema changes needed.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: The extraction script produces a CSV containing at least 500 Florida judge records from official government sources in a single run.
- **SC-002**: At least 90% of extracted judge records have accurate names and court assignments when spot-checked against the source URLs.
- **SC-003**: The CSV imports cleanly through the existing admin pipeline with fewer than 5% error rows (unmatched counties, missing fields, etc.).
- **SC-004**: End-to-end time from running the script to having judges in the verification queue is under 15 minutes (extraction + import).
- **SC-005**: Every imported judge record has a valid source URL pointing to the specific Florida Courts page where the data was found.
- **SC-006**: The extraction covers all 67 Florida counties and all four court levels (Supreme, DCA, Circuit, County).

### Assumptions

- Florida is the first pilot state. The script is purpose-built for Florida's judicial branch website structure; adapting to other states is a separate future effort.
- The admin has access to an Anthropic API key with sufficient quota for the extraction (estimated ~100-200 Claude calls for full Florida extraction).
- The Florida Courts website (flcourts.gov and related circuit court sites) is publicly accessible without authentication.
- The script runs locally on the admin's machine as a CLI tool — it is not a server-side feature or admin panel page.
- The existing Phase 2 CSV import pipeline, verification workflow, and duplicate detection are all working correctly and will be used as-is.
- Florida has approximately 950-1,000 active judges across all court levels, based on publicly available judicial directory data.
- Court seeding for Florida uses the standard court type naming conventions already established in the project.
