# Research: URL Discovery & Scrape Failure Tracking

**Date**: 2026-03-15  
**Status**: Complete

## Research Task 1: Google Custom Search JSON API Integration

### Decision: Use direct HTTP requests via native `fetch`

### Rationale

- The `@googleapis/customsearch` package (195kB) and full `googleapis` (200MB) are both in **maintenance mode** and add unnecessary dependency weight.
- The Custom Search JSON API has a trivially simple REST interface — a single GET endpoint with query parameters. No OAuth needed (API key auth only).
- The project already uses native `fetch` extensively in the harvest pipeline (`scripts/harvest/fetcher.ts`). Staying consistent avoids a new SDK pattern.
- Fewer dependencies = less supply-chain risk (Constitution V: Simplicity).

### Alternatives Considered

- **`@googleapis/customsearch`**: Maintenance mode, adds 195kB for a single GET endpoint wrapper. TypeScript types are useful but can be defined locally in ~20 lines.
- **`googleapis` (full SDK)**: 200MB, 3921 dependencies. Wildly excessive for one API.
- **SerpAPI**: $50/5,000 queries. More expensive than Google CSE's $5/1,000. Adds external vendor dependency.

### API Details

- **Endpoint**: `GET https://www.googleapis.com/customsearch/v1?key={KEY}&cx={CX}&q={QUERY}`
- **Free tier**: 100 queries/day (hard limit, returns 403 when exceeded)
- **Paid tier**: $5/1,000 queries, max 10,000/day
- **Results per query**: Max 10 per page, max 100 total (10 pages)
- **Key env vars**: `GOOGLE_CSE_API_KEY`, `GOOGLE_CSE_CX` (one CX for all gov sites)
- **Response fields used**: `items[].title`, `items[].link`, `items[].snippet`, `items[].displayLink`

### CX Configuration

- Create a single Programmable Search Engine scoped to `*.gov/*`, `*.us/*`, `*.org/*` (covers government court site domains).
- A single CX is simpler than per-state CX engines and stays within the free tier. State targeting is achieved via query terms, not CX scoping.

### Query Strategy

- Three queries per state, one per court level:
  - Supreme: `"{State}" supreme court justices roster site:*.gov OR site:*.us`
  - Appellate: `"{State}" court of appeal judges roster site:*.gov OR site:*.us`
  - Trial: `"{State}" circuit OR superior OR district court judges roster site:*.gov OR site:*.us`
- ~150 queries for all 50 states = 1.5 days on free tier, or <$1 on paid tier.

---

## Research Task 2: LLM-Based URL Classification

### Decision: Prompt gpt-4o-mini with search result metadata for batch classification

### Rationale

- The project already uses gpt-4o-mini as the default LLM (Constitution VII: cheapest reliable model).
- Search result snippets contain enough signal to classify without fetching the actual page — saving bandwidth, time, and avoiding bot detection.
- Batch classification (10 results per prompt) reduces API calls and cost.
- Confidence score (0.0–1.0) aligns with the existing `confidenceScore` pattern on the Judge model.

### Classification Prompt Design

The classifier receives a batch of search results (title + URL + snippet) and returns JSON:

```json
[
  {
    "url": "https://...",
    "isJudicialRoster": true,
    "courtType": "Circuit Court",
    "courtLevel": "trial",
    "confidence": 0.92,
    "reasoning": "Page title mentions judges roster, URL is on official .gov domain"
  }
]
```

### Alternatives Considered

- **Fetch-then-classify**: More accurate but 10× slower, triggers bot detection, wastes quota on irrelevant pages.
- **Rule-based classification (no LLM)**: Fast but brittle — domain heuristics miss edge cases (e.g., `.org` courts, unusual URL patterns).
- **Embedding similarity**: Over-engineered for ~10 results per query. LLM classification is simpler and directly outputs structured metadata.

---

## Research Task 3: Failure Classification Patterns

### Decision: Classify failures at the fetcher boundary using error type detection

### Rationale

- The existing `fetcher.ts` already catches errors and retries with backoff. Failure classification wraps this existing error handling without modifying its behavior.
- Classification happens after all retries are exhausted — a single failure record per URL per harvest run (per spec assumption).
- The existing `fetchPage()` throws errors with messages like `"HTTP 403 Forbidden"` or `"Failed after 3 retries"`. We can parse these for classification.

### Failure Type Detection Rules

| Failure Type     | Detection Logic                                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| HTTP 403         | Response status === 403                                                                                                                                |
| HTTP 429         | Response status === 429                                                                                                                                |
| Timeout          | Error message contains "TimeoutError" or "AbortError" or "timed out"                                                                                   |
| CAPTCHA Detected | Response body contains: "captcha", "verify you are human", "challenge-platform", "cf-browser-verification", "hCaptcha", "recaptcha" (case-insensitive) |
| SSL Error        | Error message contains "CERT\_", "SSL", "certificate", "UNABLE_TO_VERIFY"                                                                              |
| DNS Failure      | Error message contains "ENOTFOUND", "EAI_AGAIN", "getaddrinfo"                                                                                         |
| Empty Page       | HTTP 200 but zero judges extracted after pipeline processing                                                                                           |
| Parse Error      | Extraction or normalization throws (Zod validation failure)                                                                                            |
| Unknown          | Any error not matching above patterns                                                                                                                  |

### CAPTCHA Detection Keywords

Based on analysis of common government site bot protections:

```typescript
const CAPTCHA_INDICATORS = [
  "captcha",
  "verify you are human",
  "challenge-platform",
  "cf-browser-verification",
  "cf-chl-bypass",
  "hcaptcha",
  "recaptcha",
  "g-recaptcha",
  "turnstile",
  "just a moment", // Cloudflare interstitial
  "checking your browser", // Cloudflare interstitial
  "bot detection",
  "access denied", // Generic WAF block (paired with 403)
];
```

### Integration Point

- Wrap `fetchPage()` calls in the harvest pipeline's main loop with a try/catch that classifies and records failures.
- For "Empty Page" detection: check after extraction, not after fetch.
- Recording is non-blocking: wrap DB writes in try/catch with `console.warn` on failure (FR-011).

---

## Research Task 4: Advisory Lock Implementation

### Decision: Application-level lock via DiscoveryRun table status check

### Rationale

- A `DiscoveryRun` table already needs to exist for tracking discovery run metadata (start time, status, result counts). Using the "running" status as the lock is zero-additional-infrastructure.
- PostgreSQL advisory locks (`pg_try_advisory_lock`) would work but require raw SQL and are connection-scoped — they release if the connection drops, which is desirable but adds Prisma raw query complexity.
- The simpler approach: `SELECT * FROM discovery_runs WHERE status = 'RUNNING' LIMIT 1`. If a row exists, abort. On start, insert a RUNNING row. On finish (or crash recovery), update to COMPLETED/FAILED.

### Crash Recovery

- On startup, check for RUNNING records older than 1 hour → mark as FAILED (stale lock cleanup).
- This prevents permanent lockout if a process crashes without updating status.

### Alternatives Considered

- **PostgreSQL `pg_try_advisory_lock`**: More robust but requires raw SQL via `prisma.$queryRaw`. Over-engineered for a CLI tool with single expected operator.
- **File-based lock (PID file)**: Filesystem-dependent, doesn't work across machines, easy to leave stale locks.

---

## Research Task 5: Config Promotion Strategy

### Decision: Generate a new JSON config file following the existing `{state}-courts.json` pattern

### Rationale

- Existing state configs (e.g., `florida-courts.json`) follow the `StateConfigSchema` validated by Zod. Promotion must output this exact format.
- For new states: generate a complete `{state}-courts.json` from approved candidates.
- For existing states: merge new approved URLs into the existing config, preserving all existing entries and metadata (counties, circuit numbers, etc.).
- Approved candidates may not have all CourtEntry fields (e.g., counties, district). Promotion fills required fields with defaults and flags entries needing manual enrichment via a `notes` field.

### Merge Strategy

- Key: URL is the unique identifier for deduplication during merge.
- New URLs are appended to the `courts` array.
- Existing URLs are skipped (no overwrite).
- Output is written to `scripts/harvest/{state}-courts.json`.

---

## Research Task 6: Stale Candidate Transition Strategy

### Decision: Compute staleness at query time, not via scheduled job

### Rationale

- Adding a cron job or database trigger for a simple date comparison is over-engineering (Constitution V: Simplicity).
- The admin UI queries candidates anyway — adding a `WHERE discoveredAt < NOW() - INTERVAL 30 days AND status = 'DISCOVERED'` filter is trivial.
- The "Stale" status is a virtual/computed status, not a persisted state transition. Alternatively, a Prisma middleware or query-time filter handles it.
- For API responses: the status field returns "STALE" when `status === 'DISCOVERED' && age > 30 days`.

### Alternatives Considered

- **Cron job to update status nightly**: Adds operational complexity (what runs the cron? What if it fails?). For a display-only status, unnecessary.
- **Prisma `$extends` middleware**: Could auto-compute but adds implicit magic. Better to be explicit in the query layer.

---

## Research Task 7: Request Throttling Enhancement

### Decision: Update `fetchDelayMs` default from 1500ms to 2000ms in StateConfigSchema

### Rationale

- The existing `fetcher.ts` already honors `rateLimit.fetchDelayMs` from state configs. The spec requires a 2-second minimum default.
- Single-line change: update default in `RateLimitConfigSchema` from `1500` to `2000`.
- Per-state override is already supported via the `rateLimit` field in state config JSON files.
- No new infrastructure needed.

---

## Research Task 8: Failure Record Purge Strategy

### Decision: CLI command `npx tsx scripts/maintenance/purge-failures.ts` run manually or via system cron

### Rationale

- The Next.js app doesn't have a built-in scheduler. Adding a dependency (node-cron, bullmq) for one monthly task is over-engineering.
- A standalone script that can be run manually or added to system crontab is the simplest approach.
- Query: `DELETE FROM scrape_failures WHERE resolved_at IS NOT NULL AND resolved_at < NOW() - INTERVAL '90 days'`
- Logs count of purged records for operational visibility.

### Alternatives Considered

- **In-app scheduler (node-cron)**: Adds dependency, runs inside the web process, complicates deployments.
- **Vercel Cron Jobs**: Would work in production but not locally. Adds Vercel-specific configuration.
- **Database trigger/rule**: PostgreSQL can do this but implicit purging is surprising. Explicit script is clearer.
