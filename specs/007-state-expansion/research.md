# Research: State Expansion — Multi-State Harvesting Infrastructure

**Feature**: 007-state-expansion  
**Date**: 2026-03-01  
**Status**: Complete

## Decision 1: Configuration Schema — Flat Array vs. Nested

**Decision**: Use a flat `courts[]` array of court entries instead of nested, type-specific keys.

**Rationale**: The current Florida config uses nested keys (`supremeCourt`, `districtCourts`, `circuitCourts`). This requires new keys for every different state hierarchy (Texas has `courtOfCriminalAppeals`, NY has `appellateDivision`, etc.). A flat array with a structural `level` enum handles any hierarchy uniformly.

**Alternatives Considered**:

- Nested by court level: Natural for one state, but requires bespoke keys per state. Rejected.
- Hybrid (top-level sections + flat within): Adds complexity without benefit. Rejected.

## Decision 2: Court Entry Required Fields

**Decision**: Every court entry has 5 required fields: `url`, `courtType`, `level`, `label`, `counties`.

- `courtType` — free-form string, per-state naming (NY's "Supreme Court" is trial-level, that's OK)
- `level` — enum: `"supreme"` | `"appellate"` | `"trial"` | `"specialized"` — the structural tier, not the name
- `counties` — string array (empty = statewide)

**Rationale**: `level` decouples structural tier from naming. Texas has two `level: "supreme"` courts (Supreme Court + Court of Criminal Appeals). NY's "Supreme Court" gets `level: "trial"`. The enum enables pipeline ordering and court seeder logic.

## Decision 3: Backward Compatibility Strategy

**Decision**: Migrate `florida-courts.json` to the new flat format. Remove the legacy `FloridaCourtsConfig` interface.

**Rationale**: The legacy format exists in exactly one file. The current `flattenCourtUrls()` function literally produces the same shape as the new `courts[]` array. Migration is mechanical. Auto-detection adds code complexity for zero benefit.

**Alternatives Considered**:

- Auto-detect format at load time (version field): Adds branching logic. Rejected — one-time migration is cleaner.
- Keep both formats forever: Technical debt. Rejected.

## Decision 4: Rate Limiting

**Decision**: Top-level `rateLimit` object in each state config with sensible defaults.

Fields:

- `fetchDelayMs` (default: 1500) — minimum ms between requests
- `maxConcurrent` (default: 1) — parallel fetches
- `requestTimeoutMs` (default: 15000) — per-request timeout
- `maxRetries` (default: 3) — retry count on transient failure

**Rationale**: NY needs higher delays (Cloudflare), CA could tolerate more parallelism (single domain with clean data). Per-state config is zero-code-change tunable.

## Decision 5: Extraction Prompt Storage

**Decision**: Separate `.txt` files in `scripts/harvest/prompts/`, referenced by `extractionPromptFile` from JSON config.

**Rationale**: Extraction prompts can be 500+ lines with examples. Inline JSON embedding requires escaping and is unreadable. Separate files allow proper formatting and version control diffs. Falls back to `prompts/generic-extraction.txt`.

## Decision 6: Multi-State Failure Handling

**Decision**: Fail-forward on `--all` runs. Log failure, save checkpoint, skip to next state, report all failures in combined summary.

**Rationale**: Halting on first failure wastes successful work on subsequent states. The admin can `--resume` the failed state later.

## Decision 7: Texas Court Scope (Initial)

**Decision**: Exclude Justice of the Peace and County Courts from initial harvest. Focus on Supreme Court, Court of Criminal Appeals, 14 Courts of Appeals, and District Courts.

**Rationale**: ~800 JP courts double the URL count with minimal SEO value. The architecture supports adding them later by expanding the JSON config file — zero code changes needed.

## Decision 8: Texas Court Website Findings

- **txcourts.gov** is the central hub for Supreme Court, Court of Criminal Appeals, and all 14 Courts of Appeals
- URLs follow pattern: `https://www.txcourts.gov/{N}thcoa/` (or `1stcoa`, `2ndcoa`, `3rdcoa`)
- Server-rendered HTML, no JavaScript required
- Texas has two courts of last resort: Supreme Court (civil) and Court of Criminal Appeals (criminal)
- 14 Courts of Appeals with numbered districts
- 450+ district courts organized by judicial district (districts may span multiple counties)
- District court rosters may need separate research for URL discovery — not all published centrally

## Decision 9: California Court Website Findings

- **Single centralized roster page** at `https://courts.ca.gov/courts/superior-courts/judges-roster` contains ALL ~1,672 Superior Court judges in a structured HTML table organized by county headers
- Only ~8 HTTP requests needed for full California harvest (1 central roster + 6 appellate + 1 Supreme Court)
- All pages are server-rendered HTML (Drupal CMS) — no JavaScript rendering needed
- Central roster is **deterministic-parseable** — `<th>` = county name, `<td>` = "Hon. {Name}" — Cheerio extraction with zero LLM cost
- Appellate URL pattern: `https://appellate.courts.ca.gov/district-courts/{N}dca/justices` for all 6 districts
- Some appellate districts have numbered divisions (1st has 5 divisions, 2nd has 8, 4th has 3)
- robots.txt allows access to all target pages
- Estimated extraction cost: ~$0.14 total (vs. ~$5 for Florida)

## Decision 10: New York Court Website Findings

- **Most complex state for harvesting**: Cloudflare protection on all domains, encrypted judge IDs, fragmented court system
- 3+ separate data sources: nycourts.gov (appellate), iapps.courts.state.ny.us (trial court directory), individual court pages
- Appellate Division has 4 Departments with confirmed roster pages (AD1-AD3 verified)
- Trial court directory at `iapps.courts.state.ny.us/judicialdirectory/` is a Java web app with A-Z pagination — likely needs headless browser
- `fetchMethod: "browser"` flag needed for Cloudflare-protected pages
- Higher rate limits needed (3000ms+ delay, 30s timeout)
- NYC 5 boroughs map to 5 counties: Manhattan→New York County, Brooklyn→Kings, Queens→Queens, Bronx→Bronx, Staten Island→Richmond
- NY "Supreme Court" is a trial court (not the highest court) — handled by `level: "trial"` in schema
- ~1,300 state-paid judges total
- **Recommended approach**: Start with Appellate Division (4 pages, ~60 judges) as proof-of-concept; defer full trial court crawl

## Decision 11: Pipeline Hints in Config

**Decision**: Add optional pipeline hint fields to court entries: `fetchMethod`, `deterministic`, `selectorHint`.

- `fetchMethod`: `"http"` (default) | `"browser"` (Playwright needed) | `"manual"` (skip fetch)
- `deterministic`: boolean (default false) — use Cheerio instead of LLM when true
- `selectorHint`: CSS selector to narrow HTML before extraction

**Rationale**: California's central roster table is trivially parseable without LLM ($0 vs $5). NY's Cloudflare pages need a headless browser. These hints are per-court-entry, not per-state, because within a single state some pages may be simple and others complex.

**Note**: `fetchMethod: "browser"` is documented in the schema but browser-based scraping is OUT OF SCOPE for this feature per spec. Entries marked `"browser"` will be skipped with a warning during harvesting. This documents the intent for a future feature.

## Decision 12: CLI Default Behavior

**Decision**: Running without `--state` or `--all` defaults to Florida (backward compat). New `--list` flag shows available states.

**Rationale**: Resolved contradiction between FR-011 and FR-018. Backward compatibility is critical per constitution Principle V.
