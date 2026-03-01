# Data Harvesting Architecture

**Last Updated**: 2026-03-01  
**Status**: Production (Florida)  
**Location**: `scripts/harvest/`

## Overview

The data harvesting system extracts judge information from government court websites and external sources using a multi-stage pipeline: fetch → extract → enrich → normalize → deduplicate → output.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        Enriched Harvest Pipeline                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ florida-     │    │   fetcher    │    │ deterministic│                   │
│  │ courts.json  │───▶│     .ts      │───▶│  -extractor  │──┐               │
│  │ (URL config) │    │ (HTTP+Clean) │    │     .ts      │  │               │
│  └──────────────┘    └──────────────┘    └──────────────┘  │               │
│                             │                    │          │               │
│                             │                    │ (FREE)   │ fallback     │
│                             ▼                    ▼          ▼               │
│                      ┌──────────────┐    ┌──────────────┐                   │
│                      │  Markdown    │    │ llm-provider │                   │
│                      │  (reduced    │    │     .ts      │                   │
│                      │   tokens)    │    │ (OpenAI/Anth)│                   │
│                      └──────────────┘    └──────────────┘                   │
│                                                 │                           │
│                                                 ▼                           │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │ ballotpedia  │◀───│ bio-enricher │◀───│  extractor   │                   │
│  │  -enricher   │    │     .ts      │    │     .ts      │                   │
│  │  (external)  │    │  (bio pages) │    │  (Zod valid) │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                    │                                              │
│         ▼                    ▼                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  reporter    │◀───│ deduplicator │◀───│  normalizer  │                   │
│  │     .ts      │    │     .ts      │    │     .ts      │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                                                                    │
│         ▼                                                                    │
│  ┌──────────────┐    ┌──────────────┐                                       │
│  │  CSV Output  │    │  Quality     │                                       │
│  │ (23 fields)  │    │  Report      │                                       │
│  └──────────────┘    └──────────────┘                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

### `config.ts`
- CLI flag parsing (--skip-bio, --ballotpedia, --reset, etc.)
- Environment variable loading (OPENAI_API_KEY, ANTHROPIC_API_KEY)
- Type definitions for enriched records (23 fields)

### `llm-provider.ts` (NEW)
- Multi-provider abstraction (OpenAI and Anthropic)
- Default: OpenAI gpt-4o-mini (~10x cheaper than Claude)
- Configurable via `LLM_PROVIDER` and `LLM_MODEL` env vars

### `deterministic-extractor.ts` (NEW)
- CSS/XPath pattern matching for known FL court sites
- Patterns: `flcourts-next-data`, `table-roster`, `list-roster`
- **FREE extraction** — no LLM API calls needed
- Currently handles 19/27 Florida court sites

### `bio-enricher.ts` (NEW)
- Fetches individual judge bio/profile pages
- Extracts detailed biographical data (education, experience, etc.)
- Merges bio data into enriched records

### `ballotpedia-enricher.ts` (NEW)
- Fetches Ballotpedia pages for political/electoral data
- Extracts: political affiliation, term dates, appointment info
- Flags: `--ballotpedia`, `--ballotpedia-max <n>`

### `florida-courts.json`
- Curated list of court URLs to scrape
- Court metadata (type, counties, circuit)
- Organized by court level hierarchy

### `fetcher.ts`
- HTTP requests with rate limiting (1.5s between requests)
- Retry logic with exponential backoff (3 attempts)
- HTML → Markdown conversion via cheerio + turndown
- **SPA Support**:
  - Next.js `__NEXT_DATA__` extraction
  - Gatsby `page-data.json` fetching

### `extractor.ts`
- LLM-based extraction (via llm-provider abstraction)
- Zod schema validation for type safety
- **Normalization** for courtType and selectionMethod variations
- JSON repair for truncated responses

### `normalizer.ts`
- Name normalization ("Last, First" → "First Last")
- Honorific stripping (Hon., Judge, Justice)
- Court type canonicalization

### `deduplicator.ts`
- Cross-page duplicate detection
- Supports legacy (name+court+county) and identity-based deduplication
- Merges fields from duplicate records
- Source URL preservation for all sources

### `identity-resolver.ts` (NEW)
- Generates stable unique identifiers for judges
- Identity confidence levels: high, medium, low
- Identity basis hierarchy:
  1. Florida Bar Number (most reliable, when available)
  2. Normalized name + law school + graduation year
  3. Normalized name + bar admission year + state
  4. Normalized name + appointment year + court type
  5. Fallback: normalized name + court type + county
- Cross-source record matching using Levenshtein distance
- Flags: `--use-identity` (default), `--no-identity`

### `reporter.ts`
- Quality metrics generation
- Error/warning aggregation
- CSV output formatting

### `checkpoint.ts`
- Progress persistence for resumable runs
- Failed URL tracking
- Incremental extraction support

### `court-seeder.ts`
- Florida court structure seeding
- County-to-circuit mapping
- DCA district definitions

## Data Flow

1. **Input**: `florida-courts.json` provides URLs organized by court level
2. **Fetch**: Each URL is fetched with rate limiting; HTML cleaned to Markdown
3. **Extract**: Markdown sent to LLM with court context; returns structured JSON
4. **Enrich**: Bio pages and external sources (Ballotpedia) add detailed data
5. **Normalize**: Names standardized, court types canonicalized
6. **Identity**: Generate stable IDs based on education/bar/appointment data
7. **Deduplicate**: Cross-reference all records; merge duplicates by identity
8. **Output**: CSV file with 23 fields, quality report with identity stats

## Key Design Decisions

### Why Markdown intermediate format?
- Reduces Claude API token usage by 60-70%
- Strips irrelevant HTML (nav, footer, scripts)
- Preserves semantic structure (headings, lists, tables)

### Why Zod validation?
- Type-safe extraction results
- Runtime validation catches LLM hallucinations
- Schema serves as documentation

### Why custom SPA extractors?
- `flcourts.gov` uses Next.js — standard HTML extraction yields empty results
- Circuit court sites use Gatsby — similar issue
- Generic tools would miss this data entirely

### Why not headless browser?
- Government sites are generally well-behaved
- Adds complexity and resource overhead
- Reserved for future states if needed (see: research/web-scraping-tools.md)

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `OPENAI_API_KEY` | Yes* | — | OpenAI API authentication |
| `ANTHROPIC_API_KEY` | Yes* | — | Anthropic API authentication |
| `LLM_PROVIDER` | No | `openai` | Which provider to use (`openai` or `anthropic`) |
| `LLM_MODEL` | No | `gpt-4o-mini` | Override default model |

*One of OPENAI_API_KEY or ANTHROPIC_API_KEY is required based on LLM_PROVIDER.

### CLI Flags

| Flag | Description |
|------|-------------|
| `--reset` | Clear checkpoint and start fresh |
| `--resume` | Resume from last checkpoint (default) |
| `--skip-bio` | Skip bio page enrichment (roster only) |
| `--ballotpedia` | Enable Ballotpedia enrichment |
| `--ballotpedia-max <n>` | Limit Ballotpedia to n judges |
| `--output-dir <path>` | Override output directory |
| `--dry-run` | Fetch HTML but skip LLM calls |
| `--seed-courts-only` | Seed court structure and exit |

### URL Configuration Schema

```json
{
  "supremeCourt": {
    "url": "https://...",
    "label": "Florida Supreme Court",
    "courtType": "Supreme Court",
    "counties": []
  },
  "districtCourts": [...],
  "circuitCourts": [...],
  "countyCourts": [...]
}
```

## Output Format

### Enriched CSV Columns (23 fields)

**Identity:**
- `Judge Name` — Normalized full name
- `Photo URL` — Official portrait if found

**Court Assignment:**
- `Court Type` — Supreme Court, District Court of Appeal, Circuit Court, County Court
- `County` — County name or empty for statewide
- `State` — Always "FL" for Florida
- `Division` — Court division/section
- `Is Chief Judge` — Yes/No

**Term & Selection:**
- `Term Start` — Start of current term
- `Term End` — End of current term
- `Selection Method` — Elected/Appointed
- `Appointing Authority` — Governor name if appointed
- `Appointment Date` — Date of appointment

**Biographical:**
- `Birth Date` — If known
- `Education` — Degrees, schools, years
- `Prior Experience` — Career before bench
- `Political Affiliation` — Party from Ballotpedia
- `Bar Admission Date` — Date admitted to bar
- `Bar Admission State` — State of bar admission

**Contact:**
- `Courthouse Address` — Physical address
- `Courthouse Phone` — Phone number

**Source Attribution:**
- `Roster URL` — Government roster page
- `Bio Page URL` — Individual bio page
- `Confidence Score` — Data quality score (0.0-1.0)

### Quality Report

- Total pages fetched (OK/failed)
- Bio pages fetched (OK/failed)
- Ballotpedia enrichment stats
- Judges: extracted → dupes removed → final
- Field coverage percentages
- Counties with zero judges
- Failed page details

## Error Handling

| Error Type | Handling |
|------------|----------|
| HTTP 4xx/5xx | Retry with backoff, log to quality report |
| Claude rate limit | Checkpoint progress, resume later |
| Parse failure | Log URL, continue with other pages |
| Empty extraction | Flag in quality report, don't fail run |

## Cost Optimization

The harvest uses a tiered extraction strategy to minimize LLM API costs:

1. **Deterministic extraction** (FREE) — CSS patterns for known site structures
2. **LLM extraction** (cheap) — GPT-4o-mini for unknown structures
3. **Bio enrichment** (optional) — Individual profile pages
4. **External enrichment** (optional) — Ballotpedia for political data

**Current Results (Florida):**
- 19/27 roster pages use deterministic extraction (FREE)
- 8/27 roster pages need LLM fallback
- Bio pages: ~550 fetchable
- Estimated cost: $1-3 for full Florida harvest with bio pages

## Future Enhancements

1. **Florida Bar lookup** — Bar admission verification
2. **Playwright integration** — For JS-heavy state sites
3. **Multi-state support** — Abstract Florida-specific logic
4. **Incremental updates** — Only re-fetch changed pages
5. **Per-field confidence scoring** — Track extraction reliability

## Related Documents

- [Web Scraping Tools Research](../research/web-scraping-tools.md)
- [Florida Judge Harvest Spec](../../specs/004-florida-judge-harvest/spec.md)
- [CLI Contract](../../specs/004-florida-judge-harvest/contracts/cli-contract.md)
