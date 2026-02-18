# Research: Florida Judge Data Harvest

**Date**: 2026-02-18 | **Feature**: 004-florida-judge-harvest

## Decision 1: LLM SDK & Structured Output

**Decision**: Use `@anthropic-ai/sdk` with `messages.parse()` + Zod schemas for type-safe structured extraction.

**Rationale**: The Anthropic SDK has first-class structured output support via `output_config` with Zod validation. This ensures the LLM returns exactly the schema we define (judge name, court, county, source URL) — no fragile JSON parsing of free-text responses. The SDK auto-retries 429/5xx errors with exponential backoff (default 2 retries, configurable).

**Alternatives considered**:

- OpenAI SDK with function calling — rejected per clarification (Anthropic Claude chosen)
- Raw system prompt requesting JSON — fragile, no schema validation, requires manual parsing
- Tool use / agent loops — over-engineered for one-shot extraction

**Key details**:

- Package: `@anthropic-ai/sdk` (latest: 0.76.0) + `zod` for schema definitions
- Model: `claude-sonnet-4-5-20250929` — 200K context window, handles ~50KB HTML pages easily
- Cost: ~$0.05 per page (~15K input tokens + ~500 output tokens) → ~$5 for 100 pages
- Rate limits (Tier 1): 50 RPM, 40K input TPM — script must throttle to ~1 request/1.5s
- Error classes: `RateLimitError`, `APIError`, `APIConnectionError` — all inherit `APIError`

## Decision 2: HTTP Fetching Strategy

**Decision**: Use native `fetch` (Node 20+) with a custom retry wrapper. No HTTP library dependency.

**Rationale**: Node 20's built-in `fetch` supports custom headers, redirect following, and `AbortSignal.timeout()`. For ~30 sequential requests to government websites, this is simpler than adding axios (400KB+) or undici directly.

**Alternatives considered**:

- `axios` — unnecessary weight for sequential fetching
- `node-fetch` — redundant on Node 20+
- `undici` direct — only needed for connection pooling / HTTP/2, which we don't need

**Key details**:

- Retry: custom wrapper with 3 retries, linear backoff (2s, 4s, 6s)
- Timeout: `AbortSignal.timeout(15_000)` per request
- User-Agent: `JudgesDirectory/1.0 (public court data research)`
- Rate limiting: simple `await sleep(1500)` between requests — no library needed

## Decision 3: HTML Cleaning Pipeline

**Decision**: Two-stage pipeline — `cheerio` for DOM stripping + `turndown` for HTML→Markdown conversion before sending to Claude.

**Rationale**: Raw HTML wastes ~60-70% of tokens on scripts, styles, navigation, and markup. Cheerio strips noise elements; Turndown converts to Markdown for minimal token usage. This reduces cost per page from ~$0.05 to ~$0.02 and improves extraction accuracy by removing irrelevant content.

**Alternatives considered**:

- `@mozilla/readability` — designed for articles, not tabular court directories; discards the data we want
- Regex stripping — unreliable with inconsistent government HTML
- Send raw HTML — works but wastes tokens and money

**Key details**:

- `cheerio` (~200KB): `$('script, style, nav, footer, header, iframe, noscript').remove()`
- `turndown` (~30KB): converts cleaned HTML to Markdown
- Both have TypeScript types, zero native dependencies

## Decision 4: Checkpoint/Resume Pattern

**Decision**: JSON file-based checkpointing — save progress after each successfully processed court URL.

**Rationale**: Simplest reliable approach for a CLI script. Atomic writes via `.tmp` + `rename` prevent corruption on kill. Script filters work queue on startup by excluding completed URLs. No database or external state needed.

**Alternatives considered**:

- SQLite for state tracking — overkill for ~30 URLs
- In-memory only — loses progress on interruption
- Database-backed — unnecessary coupling to the web app's DB for an offline tool

**Key details**:

- Checkpoint file: `scripts/harvest/output/checkpoints/harvest-checkpoint.json`
- Schema: `{ completedUrls: string[], results: Record<string, CourtResult>, lastUpdated: string }`
- Atomic write: write to `.tmp`, then `fs.renameSync` to final path
- `--reset` CLI flag to clear checkpoint and start fresh

## Decision 5: Florida Court Structure & URL List

**Decision**: Hand-curated URL list stored in `scripts/harvest/florida-courts.json`. Supreme Court + 6 DCAs use consistent flcourts.gov subdomains. 20 circuit courts each have their own inconsistent websites requiring manual URL discovery.

**Rationale**: Florida's court system is decentralized. The Supreme Court and DCAs are hosted on `*.flcourts.gov` with consistent `/Justices` and `/Judges` paths. Circuit courts each run independent websites with varying CMSes (Drupal, DotNetNuke, custom) and no standard URL pattern for judge rosters. Auto-discovery is fragile; a curated list is reliable and verifiable.

**Alternatives considered**:

- Auto-crawl from flcourts.gov — circuit court sites are separate domains, not linked consistently
- Scrape a central directory — no central judge directory exists for circuit/county courts

**Key details — Florida Court Counts**:

| Level                     | Count | Authorized Judges | URL Pattern                                   |
| ------------------------- | ----- | ----------------- | --------------------------------------------- |
| Supreme Court             | 1     | 7 justices        | `supremecourt.flcourts.gov/Justices`          |
| District Courts of Appeal | 6     | 73                | `{N}dca.flcourts.gov/Judges`                  |
| Circuit Courts            | 20    | 630               | Each circuit has its own website (no pattern) |
| County Courts             | 67    | 357               | Listed on parent circuit's website            |
| **Total**                 | —     | **1,067**         | ~28 primary URLs                              |

**Circuit → County Mappings**:

| Circuit | Counties                                                        |
| ------- | --------------------------------------------------------------- |
| 1st     | Escambia, Okaloosa, Santa Rosa, Walton                          |
| 2nd     | Franklin, Gadsden, Jefferson, Leon, Liberty, Wakulla            |
| 3rd     | Columbia, Dixie, Hamilton, Lafayette, Madison, Suwannee, Taylor |
| 4th     | Clay, Duval, Nassau                                             |
| 5th     | Citrus, Hernando, Lake, Marion, Sumter                          |
| 6th     | Pasco, Pinellas                                                 |
| 7th     | Flagler, Putnam, St. Johns, Volusia                             |
| 8th     | Alachua, Baker, Bradford, Gilchrist, Levy, Union                |
| 9th     | Orange, Osceola                                                 |
| 10th    | Hardee, Highlands, Polk                                         |
| 11th    | Miami-Dade                                                      |
| 12th    | DeSoto, Manatee, Sarasota                                       |
| 13th    | Hillsborough                                                    |
| 14th    | Bay, Calhoun, Gulf, Holmes, Jackson, Washington                 |
| 15th    | Palm Beach                                                      |
| 16th    | Monroe                                                          |
| 17th    | Broward                                                         |
| 18th    | Brevard, Seminole                                               |
| 19th    | Indian River, Martin, Okeechobee, St. Lucie                     |
| 20th    | Charlotte, Collier, Glades, Hendry, Lee                         |

**DCA → Circuit Mappings**:

| DCA                       | Circuits Covered |
| ------------------------- | ---------------- |
| 1st DCA (Tallahassee)     | 1, 2, 3, 8, 14   |
| 2nd DCA (Tampa)           | 6, 12, 13        |
| 3rd DCA (Miami)           | 11, 16           |
| 4th DCA (West Palm Beach) | 15, 17, 19       |
| 5th DCA (Daytona Beach)   | 4, 5, 7, 18      |
| 6th DCA (Lakeland)        | 9, 10, 20        |

## Decision 6: New Dependencies

**Decision**: Add 4 new packages — `@anthropic-ai/sdk`, `zod`, `cheerio`, `turndown`.

**Rationale**: Each serves a specific, irreplaceable function. All are well-maintained with TypeScript types. Total added size is modest (~600KB unpacked). No native/binary dependencies.

**Alternatives considered**:

- Fewer dependencies by using raw fetch + regex HTML cleaning + manual JSON parsing — significantly more fragile and error-prone
- Use existing `papaparse` for CSV generation — yes, already installed, will reuse

| Package             | Purpose                          | Size   | Justification                     |
| ------------------- | -------------------------------- | ------ | --------------------------------- |
| `@anthropic-ai/sdk` | Claude API access                | ~400KB | Core feature requirement (FR-002) |
| `zod`               | Schema validation for LLM output | ~60KB  | Type-safe structured extraction   |
| `cheerio`           | HTML DOM parsing + cleaning      | ~200KB | Strip noise before LLM processing |
| `turndown`          | HTML→Markdown conversion         | ~30KB  | Reduce token count ~60-70%        |

## Decision 7: robots.txt & Legal Considerations

**Decision**: Log a warning if robots.txt disallows access, but proceed — government court data is public record.

**Rationale**: Government court websites are public records by law. Many .gov sites have overly broad `Disallow: /` rules aimed at search engine crawlers, not data consumers. The script accesses only public judge roster pages at a polite rate (1.5s between requests). A descriptive User-Agent string identifies the tool and provides contact info.

**Alternatives considered**:

- Hard-block on robots.txt disallow — would prevent access to public records on many government sites
- Ignore robots.txt entirely — less transparent; logging is better practice
