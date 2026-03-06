# Feature Specification: Search & Discovery

**Feature Branch**: `009-search-discovery`  
**Created**: 2026-03-06  
**Status**: Draft  
**Input**: User description: "Search & Discovery - Add judge search functionality with autocomplete, filters by state/county/court type, and relevance ranking"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Quick Judge Name Search (Priority: P1)

A user wants to find a specific judge by name. They navigate to the judges directory, type the judge's name into the search box, and see matching results as they type. They click on a result to view the judge's profile.

**Why this priority**: Name search is the most common discovery pattern. Users arriving with a specific judge in mind need instant access. This is the core value proposition of search.

**Independent Test**: Can be fully tested by typing a known judge name (e.g., "Smith") and verifying matching judges appear. Delivers immediate value without filters.

**Acceptance Scenarios**:

1. **Given** I'm on the `/judges` page, **When** I type "Martinez" in the search box, **Then** I see judges with "Martinez" in their name within 300ms
2. **Given** search results are displayed, **When** I click on a judge's name, **Then** I navigate to that judge's profile page
3. **Given** I type a partial name "Mar", **When** results appear, **Then** the matching text is highlighted in each result
4. **Given** I search for a name with no matches, **When** results load, **Then** I see a "No judges found" message with suggestions

---

### User Story 2 - Filter by State (Priority: P2)

A user wants to find judges in a specific state. They select a state from a dropdown filter, and the results narrow to only judges in that state. The filter works both standalone and in combination with name search.

**Why this priority**: Geographic filtering is the second-most common pattern after name search. Lawyers and researchers typically work within specific jurisdictions.

**Independent Test**: Can be fully tested by selecting "California" filter and verifying only CA judges appear. Combines with P1 for powerful filtered search.

**Acceptance Scenarios**:

1. **Given** I'm on the search page, **When** I select "California" from the state filter, **Then** only judges from California courts appear
2. **Given** I've selected a state filter, **When** I also type a name in search, **Then** results match both the state AND the name query
3. **Given** I've applied a state filter, **When** I click "Clear filters", **Then** the filter is removed and all results show again
4. **Given** a state filter is active, **When** I view results, **Then** the active filter is visually indicated as a badge/chip

---

### User Story 3 - Filter by Court Type (Priority: P3)

A user wants to find judges in a specific type of court (e.g., Supreme Court, Circuit Court, County Court). They select a court type filter to narrow results.

**Why this priority**: Court type filtering refines search for users with specific jurisdictional needs (appellate vs. trial courts). Builds on state filter foundation.

**Independent Test**: Can be fully tested by selecting "Supreme Court" filter and verifying only supreme court judges appear.

**Acceptance Scenarios**:

1. **Given** I'm on the search page, **When** I select "Circuit Court" from the court type filter, **Then** only judges from circuit courts appear
2. **Given** I've selected both state and court type filters, **When** results load, **Then** results match both filter criteria
3. **Given** court type filter is active, **When** I change the state filter, **Then** court type filter remains active and results update accordingly

---

### User Story 4 - Filter by County (Priority: P4)

A user wants to find judges in a specific county. After selecting a state, they can further narrow by county.

**Why this priority**: County-level filtering provides precise geographic targeting. Dependent on state filter (counties only meaningful within a state context).

**Independent Test**: Can be fully tested by selecting "California" then "Los Angeles County" and verifying only LA County judges appear.

**Acceptance Scenarios**:

1. **Given** I've selected "Florida" from state filter, **When** I select "Miami-Dade County" from county filter, **Then** only judges from Miami-Dade courts appear
2. **Given** no state is selected, **When** I view the county filter, **Then** it is disabled with helper text "Select a state first"
3. **Given** I change the state filter, **When** a county was previously selected, **Then** the county filter resets (county may not exist in new state)

---

### User Story 5 - Search Results Pagination (Priority: P5)

A user performs a broad search that returns many results. They can navigate through pages of results or load more incrementally.

**Why this priority**: Pagination is necessary for performance and usability with large result sets, but only matters once search works.

**Independent Test**: Can be fully tested by searching with no filters (returns all 2,800+ judges) and navigating between pages.

**Acceptance Scenarios**:

1. **Given** search returns more than 20 results, **When** results load, **Then** only the first 20 are displayed with pagination controls
2. **Given** I'm viewing page 1 of results, **When** I click "Next" or page 2, **Then** the next 20 results load
3. **Given** I'm on page 3 with filters active, **When** I refresh the page, **Then** I return to page 3 with the same filters (URL state)

---

### User Story 6 - Autocomplete Suggestions (Priority: P6)

As a user types in the search box, they see autocomplete suggestions that help them find judges faster and correct typos.

**Why this priority**: Autocomplete improves search efficiency but is an enhancement to basic search, not a core requirement.

**Independent Test**: Can be fully tested by typing "Smi" and seeing suggestions like "Smith, John" appear in a dropdown.

**Acceptance Scenarios**:

1. **Given** I start typing in the search box, **When** I've typed 2+ characters, **Then** autocomplete suggestions appear within 200ms
2. **Given** suggestions are displayed, **When** I press down arrow or up arrow, **Then** I can navigate through suggestions
3. **Given** a suggestion is highlighted, **When** I press Enter or click it, **Then** the search executes with that judge's name
4. **Given** I'm typing quickly, **When** autocomplete requests are made, **Then** requests are debounced (max 1 request per 150ms)

---

### Edge Cases

- What happens when a user searches for a judge who exists in multiple courts (e.g., transferred)?
  - Show all matching records; user clicks to view each profile
- How does the system handle very long judge names or special characters?
  - Normalize search input; handle unicode, hyphens, apostrophes (e.g., "O'Brien")
- What happens when the database has no verified judges for a selected state?
  - Show "No verified judges found in [State]. Check back soon." with link to browse all states
- How does search handle judges with similar names?
  - Display court and location context in results to disambiguate
- What happens when user clears search while typing?
  - Cancel pending autocomplete requests; reset to default state

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide a search input field accessible from the `/judges` page
- **FR-002**: System MUST search judge names using case-insensitive partial matching
- **FR-003**: System MUST return search results within 500ms for queries against the full dataset
- **FR-004**: System MUST provide a state filter dropdown populated with all states and DC
- **FR-005**: System MUST provide a court type filter dropdown dynamically populated from distinct court types in the database
- **FR-006**: System MUST provide a county filter dropdown that activates when a state is selected
- **FR-007**: System MUST support combining search query with multiple filters (AND logic)
- **FR-008**: System MUST paginate results with 20 judges per page
- **FR-009**: System MUST persist filter and pagination state in the URL (shareable/bookmarkable)
- **FR-010**: System MUST display result count showing "Showing X of Y judges"
- **FR-011**: System MUST highlight matching search terms in result names
- **FR-012**: System MUST only return judges with status VERIFIED in public search results
- **FR-013**: System MUST provide autocomplete suggestions after 2+ characters typed
- **FR-014**: System MUST debounce autocomplete requests with 150ms delay
- **FR-015**: System MUST display judge's court name and state in search results for disambiguation
- **FR-016**: System MUST provide a "Clear all filters" action when any filter is active
- **FR-017**: System MUST handle empty result sets with helpful messaging
- **FR-018**: System MUST be keyboard-navigable (Tab through filters, Enter to search, Arrow keys for autocomplete)

### Key Entities

- **Search Query**: Text input for judge name search; optional, combined with filters via AND logic
- **Filter State**: Active filters (state, county, courtType); persisted in URL query params
- **Search Result**: Judge record with id, fullName, court.name, court.county.state.name, slug for navigation
- **Pagination State**: Current page number, page size (20), total result count

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Users can find a specific judge by name within 10 seconds (search + click)
- **SC-002**: Search results return in under 500ms for all queries against 10,000+ judges
- **SC-003**: 95% of searches return expected judge in top 5 results (relevance quality)
- **SC-004**: Filter application updates results in under 300ms
- **SC-005**: Zero verified judges are excluded from search results when they should match
- **SC-006**: Search page maintains Lighthouse SEO score ≥90
- **SC-007**: Search is fully functional on mobile devices (responsive design)
- **SC-008**: Users can share a filtered search via URL and recipient sees the same results

## Assumptions

- Full-text search will be implemented using PostgreSQL's built-in text search capabilities (pg_trgm or tsvector) rather than external search services
- The current judge count (~2,800) is small enough that client-side filtering is not preferred; server-side search scales better
- Court type taxonomy is consistent across states (Supreme Court, Appellate/DCA, Circuit/District, County)
- Autocomplete will query the same search endpoint with a `limit` parameter rather than a separate suggestions API
