# Research: URL Health Scoring & Delta-Run Prioritization

**Feature**: 012-url-health  
**Date**: 2026-03-15

## Research Tasks

### 1. Health Score Computation Formula

**Decision**: Weighted composite score using 4 signals, computed over a sliding window of the last 10 scrape attempts.

**Formula**:
```
healthScore = (successRate × 0.40) + (yieldConsistency × 0.30) + (freshness × 0.20) + (volumeScore × 0.10)
```

**Signal definitions**:

- **successRate** (weight 40%): `successfulScrapes / totalScrapes` over last 10 attempts. Range: 0.0–1.0. A URL that succeeds 10/10 times scores 1.0; one that fails 5/10 scores 0.5.

- **yieldConsistency** (weight 30%): Inverted coefficient of variation (CV) of judge counts from successful scrapes in the last 10 attempts. `1 - min(1, stddev / mean)`. A URL that always returns 15 judges has CV ≈ 0, so consistency ≈ 1.0. One that swings between 0 and 30 has high CV, so consistency is low. If only 1 successful scrape exists, consistency defaults to 0.5 (neutral).

- **freshness** (weight 20%): Decay function based on days since last successful scrape. `max(0, 1 - (daysSinceSuccess / 90))`. At 0 days: 1.0. At 45 days: 0.5. At 90+ days: 0.0. The 90-day decay window aligns with the existing DATA_FRESHNESS_THRESHOLD_DAYS.

- **volumeScore** (weight 10%): Normalized yield relative to a baseline expectation. `min(1, lastYield / expectedYield)` where expectedYield is the rolling average from prior scrapes (or a default of 5 for first-time URLs). A URL returning 15 judges when the average is 15 scores 1.0; one returning 2 when average is 15 scores 0.13.

**Rationale**: Success rate dominates because a URL that can't be fetched is useless regardless of past yield. Yield consistency is second because swing URLs waste extraction effort. Freshness rewards recently-scraped URLs. Volume is lowest weight because a URL returning 3 reliable judges is more valuable than one returning 30 unreliably.

**Alternatives considered**:
- Single signal (success rate only): Too coarse — doesn't capture yield degradation on EMPTY_PAGE scenarios where HTTP succeeds but page structure changed.
- Equal weights: Over-rewards freshness for recently-broken URLs. A URL that failed today but succeeded 9 times before would score too high.
- Machine learning model: Overengineered for ~1,500 URLs. The weighted formula is transparent, debuggable, and tunable.

### 2. ScrapeFailure → ScrapeLog Migration Strategy

**Decision**: Create ScrapeLog as a new table that subsumes ScrapeFailure. Migrate existing ScrapeFailure data into ScrapeLog rows (with `success=false`). Drop ScrapeFailure table and retire all ScrapeFailure write paths.

**Migration approach**:
1. Create ScrapeLog table with all fields from ScrapeFailure plus: `success` boolean, `judgesFound` integer, `scrapeDurationMs` integer, `urlHealthId` foreign key.
2. Write a data migration that copies all ScrapeFailure records into ScrapeLog with `success=false`, `judgesFound=0`.
3. Update `failure-tracker.ts` to write to ScrapeLog instead of ScrapeFailure.
4. Add success-path writes in the harvest pipeline (after each successful extraction).
5. Update `/admin/failures/` API routes to query ScrapeLog (with `success=false` filter) — then retire the page in favor of `/admin/health/`.
6. Drop ScrapeFailure table in a subsequent migration after verification.

**Rationale**: Clean migration avoids dual-write complexity. Keeping the old table temporarily during transition allows rollback if issues arise.

**Alternatives considered**:
- Keep both tables indefinitely: Violates DRY, dual-write risk, confusing to maintain.
- Rename ScrapeFailure to ScrapeLog in-place: Risky — requires altering a live table with data, and the columns don't map cleanly (ScrapeFailure lacks success/yield fields).

### 3. Delta-Run Prioritization Algorithm

**Decision**: Sort URLs into priority buckets based on health score and staleness, then process in bucket order.

**Priority buckets** (processed in this order):
1. **Stale + Healthy** (score ≥ 0.7, last scrape > 7 days): Most valuable — reliable URLs with outdated data. Scrape first.
2. **Never scraped** (no UrlHealth record or totalScrapes = 0): Unknown quantity — need baseline data. Process second.
3. **Stale + Moderate** (score 0.3–0.7, last scrape > 7 days): Somewhat reliable, worth retrying.
4. **Stale + Unhealthy** (score < 0.3, last scrape > 7 days): Likely broken, but re-check periodically.
5. **Fresh** (last scrape ≤ 7 days): Skip unless forced with `--force`.

Within each bucket, URLs are sorted by health score descending (best first).

**`--skip-broken` flag**: When set, bucket 4 (Stale + Unhealthy) is excluded entirely. Default threshold: 0.2.

**Rationale**: Bucket-based approach is simple to implement (one SQL query with ORDER BY), easy to understand in logs, and naturally handles the cold-start problem (never-scraped URLs get second priority).

**Alternatives considered**:
- Weighted priority score combining health + staleness into a single number: Harder to debug, unclear ordering semantics.
- Skip all non-stale URLs: Too aggressive — sometimes a re-scrape of a fresh URL is desired (e.g., after fixing a deterministic extractor).

### 4. Yield Trend Calculation

**Decision**: Compare the average yield of the last 3 scrapes to the average yield of the 3 scrapes before that (positions 4–6 in the window). Three categories: improving, stable, declining.

**Thresholds**:
- **Improving**: recent avg > previous avg × 1.2 (20% increase)
- **Declining**: recent avg < previous avg × 0.8 (20% decrease)
- **Stable**: between 0.8× and 1.2× of previous avg

If fewer than 6 scrapes exist, trend defaults to "stable" (insufficient data).

**Rationale**: Comparing two 3-scrape windows smooths noise vs. comparing just last-vs-previous. The 20% threshold avoids flagging minor fluctuations (e.g., 15 → 14 judges).

**Alternatives considered**:
- Linear regression over all 10 scrapes: Statistically more rigorous but overkill and harder to explain in the UI.
- Simple delta (last vs. previous): Too noisy — one bad scrape triggers "declining."

### 5. Admin Health Dashboard UX Patterns

**Decision**: Table-based UI consistent with existing admin pages (discovery, judges). Row-expandable to show scrape history per URL.

**Layout**:
- **Top**: State filter dropdown + sort controls (health score, last scrape date) + failures-only toggle
- **Summary bar**: Per-state health summary (avg score, healthy/unhealthy/unscored counts)
- **Table columns**: URL (truncated with tooltip), State, Health Score (color-coded badge: green ≥0.7, yellow 0.3–0.7, red <0.3), Last Yield, Trend (↑/→/↓ icon), Last Scraped (relative time), Anomaly flag (⚠️ icon when set)
- **Row expansion**: Click a row to expand inline scrape history (last 10 entries) showing: timestamp, success/fail, judges found, failure type, duration
- **Anomaly filter**: Toggle to show only URLs with anomalyDetected=true

**Replaces /admin/failures/**: The failures page is retired. Failure data is accessible via the "failures only" filter toggle, which filters ScrapeLog entries where success=false and groups by URL.

**Rationale**: Consistent with existing admin UX patterns. Table + expandable rows avoids a separate detail page for each URL.

### 6. Harvest Pipeline Integration Points

**Decision**: Health recording hooks into two existing pipeline points — no new pipeline stages.

**Integration points**:

1. **Post-extraction (per URL)**: After `extractJudges()` returns (success or failure), record a ScrapeLog entry and upsert/update UrlHealth. This happens inside the existing `for (const entry of urlEntries)` loop in `runEnrichedPipeline()`.

2. **Post-run (batch)**: After all URLs are processed, recompute health scores for all UrlHealth records that were touched during this run. This is a new step added after the existing deduplication + CSV write step.

**No changes to**: Checkpoint structure (additive only — health recording is independent), deterministic extractor logic, LLM extraction, bio enrichment, deduplication, CSV output.

**Rationale**: Minimal disturbance to the proven pipeline. Health recording is a side-effect, not a gate — if it fails, the harvest run should still complete (catch + warn, never throw).
