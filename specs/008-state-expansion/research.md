# Research: State Expansion — TX/CA/NY Harvest Execution

**Feature**: 008-state-expansion
**Date**: 2026-03-03
**Status**: Complete

## Overview

The multi-state harvesting infrastructure (CLI, configs, prompts, per-state isolation, deterministic extraction) was built in 007. This research resolves implementation gaps specific to 008: county alias resolution, data freshness tracking, soft quality gates, division extraction in prompts, and combined multi-state reporting.

All 12 decisions from [007-state-expansion/research.md](../007-state-expansion/research.md) carry forward and are not repeated here. This document covers only new decisions.

---

## Decision 1: County Alias Map — Schema Location

**Decision**: Add `countyAliases` at the **StateConfig top level** — one map per state, not per CourtEntry.

**Rationale**: County aliases are state-scoped geographic facts. "Manhattan" always maps to "New York" county regardless of which court page produced the name. Per-CourtEntry duplication would be error-prone and redundant. The existing court type canonicalization already uses a state-level registry pattern in `normalizer.ts` (`STATE_COURT_TYPE_REGISTRY` keyed by state abbreviation). County alias resolution follows the same pattern.

**Alternatives Considered**:
- Per-CourtEntry: Would allow court-specific overrides, but county names are geographic facts — same alias must produce the same canonical name everywhere. Rejected.
- Separate JSON file per state: Over-engineered for 2-5 entries per state. Rejected.

**Schema change**:
```typescript
countyAliases: z.record(z.string(), z.string()).optional().default({}),
```

## Decision 2: County Alias Map — Data Structure

**Decision**: `Record<string, string>` (simple key-value) where key = variant name (case-insensitive lookup), value = canonical DB name.

**Rationale**: Every known alias is 1:1. Multiple variants for the same canonical county are expressed as separate keys with the same value. O(1) lookup. Matches the pattern already used for court type mappings in `normalizer.ts`.

**Alternatives Considered**:
- Array of `{ aliases: string[], canonical: string }`: Adds nesting without benefit; reverse lookup is O(n×m) vs O(1). Rejected.

## Decision 3: County Alias Resolution — Pipeline Stage

**Decision**: Resolve aliases at **two points** — during court seeding AND during normalization (post-extraction).

**Rationale**:
1. **Court seeding**: The seeder matches config county names to DB records via `countyMap.get(name.toLowerCase().trim())`. Without alias resolution, "DeWitt" in config won't match "De Witt" in DB. First line of defense.
2. **Normalization**: After LLM/deterministic extraction, the extracted county field may contain variant names scraped from pages (e.g., "Manhattan" from NYC court pages). Alias resolution acts as a safety net before dedup and CSV output.

Pipeline flow: `Config → Seeder (resolve aliases in counties[]) → Extraction → Normalizer (resolve aliases in extracted county) → Dedup → CSV → Reporter (warn on unresolved)`

**Alternatives Considered**:
- Normalization only: Leaves seeder broken for mismatched config county names. Rejected.
- Court seeding only: Leaves variant names in CSV output. Rejected.

## Decision 4: Known County Aliases per State

### New York

| Variant | Canonical (DB) | Source |
|---------|----------------|--------|
| Manhattan | New York | NYC borough → county |
| Brooklyn | Kings | NYC borough → county |
| Staten Island | Richmond | NYC borough → county |
| Saint Lawrence | St. Lawrence | Punctuation variant |

Note: Bronx → Bronx and Queens → Queens are identity mappings (no alias needed).

### Texas

| Variant | Canonical (DB) | Source |
|---------|----------------|--------|
| Dewitt | DeWitt | Capitalization variant |
| De Witt | DeWitt | Space variant |

### California

| Variant | Canonical (DB) | Source |
|---------|----------------|--------|
| San Buenaventura | Ventura | Official city name vs common county name |

California's 58 counties otherwise have clean names matching Census data.

---

## Decision 5: Data Freshness Tracking — Storage

**Decision**: Create a separate **harvest manifest file** at `output/{state-slug}/harvest-manifest.json`.

**Rationale**: The checkpoint file tracks in-progress URL-level state for resume support. Its `lastUpdated` field records when any URL was processed, not when a full run completed. Critically, `--reset` deletes the checkpoint — which would destroy the freshness timestamp. Overloading the checkpoint conflates "where did I stop?" with "when did I last finish?"

Manifest format:
```json
{
  "lastCompletedAt": "2026-03-01T06:15:41.892Z",
  "judgeCount": 1029,
  "reportFile": "florida-enriched-report-2026-03-01.md",
  "pagesTargeted": 27,
  "pagesFailed": 0
}
```

Written atomically at the end of `runSingleState()` after CSV + report are successfully written. Readable at startup with `JSON.parse`.

**Alternatives Considered**:
- Add `completedAt` to Checkpoint: Checkpoint is reset by `--reset`, destroying the timestamp. Semantically wrong. Rejected.
- Parse quality report filename for timestamp: Brittle regex on human-readable strings. Doesn't distinguish completed vs interrupted run. Rejected.

## Decision 6: Data Freshness — Surfacing

**Decision**: Surface data age **both on stdout at startup** and **in the quality report**.

**Rationale**:
1. **Stdout at startup**: Operator sees immediately which states are stale before processing begins. For `--all`, print a table of all states with data age before processing.
2. **Quality report**: A "## Data Freshness" section showing last harvest date and days elapsed. Prominently flagged when > 90 days. Creates a permanent record.

The 90-day threshold is stored as a named constant (`DATA_FRESHNESS_THRESHOLD_DAYS = 90`) for future tunability.

**Alternatives Considered**:
- Report only: Operators need the warning before the run, not only in output. Rejected.
- Stdout only: No permanent record for async review. Rejected.

---

## Decision 7: Soft Quality Gate — Proxy Metrics

**Decision**: Use five proxy metrics with independent thresholds. Any metric breaching its threshold flags the state.

| Metric | Warning (🟡) | Critical (🔴) | Rationale |
|--------|-------------|---------------|-----------|
| Failed page rate | > 10% | > 25% | Missing entire court's worth of judges |
| Zero-judge page rate | > 15% | > 30% | Page structure changed or silent extraction failure |
| Missing county rate (trial courts) | > 20% | > 40% | Trial judges must be county-attributed for directory value |
| Core field incompleteness (fullName/courtType) | > 2% | > 5% | Mandatory identity fields — FL baseline is 99%+ |
| Zod validation failure rate | > 10% | > 20% | LLM producing malformed output |

Overall severity = maximum of any individual metric's severity.

Thresholds calibrated against Florida baseline (0% failed pages, 91.5% county coverage, 99.2% fullName).

**Alternatives Considered**:
- Single composite score: Masks which dimension is failing. Rejected.
- Field coverage only: Misses structural failures (zero-judge pages look fine if remaining judges have good coverage). Rejected.

## Decision 8: Soft Quality Gate — Report Presentation

**Decision**: A prominent `## ⚠️ Quality Gate` section placed **immediately after the report header**, before Summary. Three severity levels.

When concerns exist:
```markdown
## ⚠️ Quality Gate — WARNING

| Metric | Value | Threshold | Severity |
|--------|-------|-----------|----------|
| Zero-judge page rate | 22.2% (6/27) | >15% warn | 🟡 WARNING |

**Action**: Review zero-judge pages for site structure changes.
```

When passing:
```markdown
## ✅ Quality Gate — PASS

All proxy metrics are within acceptable thresholds.
```

Also echo verdict to stdout alongside existing harvest summary.

**Alternatives Considered**:
- Inline annotations throughout report: Scatters quality signals. Rejected.
- Exit code gating: Too aggressive for a "soft" gate per FR-024. A future `--strict-quality` flag could opt in. Rejected.

---

## Decision 9: Division Extraction — Prompt Updates

**Decision**: Add a `## Division Extraction` section to each state prompt and the generic prompt with state-specific guidance.

**Current state**: The pipeline already fully supports `division` end-to-end:
- Zod extraction schema has `division: z.string().nullable()` ✅
- `EnrichedJudgeRecord` has `division: string | null` ✅
- CSV output includes `Division` column ✅
- `buildRosterPrompt` user template includes `"division": "Division or null"` ✅
- Bio enricher merges `divisions[]` → `division` ✅
- Prisma Judge model has `division String?` ✅

**Gap**: State-specific system prompts don't explain what "division" means or when to extract it. The LLM may confuse structural divisions (e.g., "2nd Division" of an appellate court) with subject-matter divisions (e.g., "Criminal Division").

**Per-state additions**:

**Texas**: "Division" = subject-matter designation of a court (Criminal, Family, Civil). Some District Courts are designated as "Criminal District Court" → extract "Criminal" as division. Courts of Appeals districts are structural — NOT division.

**California**: "Division" = subject-matter assignment of a trial court judge (Criminal, Civil, Family, Juvenile, Probate). Appellate numbered divisions (e.g., "Division 3") are structural — NOT subject-matter. Set to null if unstated.

**New York**: "Division" = specialized assignment (Commercial Division, Integrated Domestic Violence Part). "Appellate Division" is a court name — NOT a division value. Supreme Court justices may have Commercial Division assignment.

**Generic**: Extract subject-matter division if listed (Criminal, Civil, Family, Juvenile). Set to null if not stated.

Also add `"division": null` to example JSON output in each prompt for output shape consistency.

**Alternatives Considered**:
- Rely on `buildRosterPrompt` template alone: LLM won't disambiguate structural vs subject-matter divisions without guidance. Rejected.

## Decision 10: Division — Court Types with Division Data

| Court Level | Division Likelihood | Examples |
|-------------|-------------------|----------|
| Trial courts | **High** | Criminal, Civil, Family, Juvenile, Probate, Commercial |
| Intermediate appellate | **Very low** — only structural | Not subject-matter |
| Courts of last resort | **None** | N/A |

Prompt guidance should focus extraction on trial-level pages and explicitly instruct the LLM to NOT populate `division` for appellate/supreme courts' numbered divisions.

---

## Decision 11: Combined Multi-State Summary Report — Location

**Decision**: `output/combined-summary-{timestamp}.md` (change existing `.txt` to `.md`).

**Rationale**: The existing `writeCombinedSummary` already writes to `output/combined-summary-{timestamp}.txt` with Markdown content. Changing extension to `.md` correctly reflects format. Root `output/` is correct since per-state reports go to `output/{state-slug}/`.

## Decision 12: Combined Report — Content

**Decision**: Expand the existing summary with:

1. **Run metadata** — timestamp, CLI flags, LLM provider
2. **Per-state results table** (enhanced) — State | Status | Verdict | Judges | Pages | Report Path
3. **Quality gate verdict per state** — ✅/🟡/🔴 from Decision 8
4. **Aggregate totals** — total judges, total pages, total duplicates removed
5. **Failed state details** — error messages (already present)

**Implementation**: `runSingleState()` currently returns only `number` (judge count). Expand to return a richer result object:

```typescript
interface StateRunResult {
  judgeCount: number;
  pages: { total: number; succeeded: number; failed: number };
  courtTypeCounts: Record<string, number>;
  duplicatesRemoved: number;
  reportPath: string;
  qualityVerdict: "PASS" | "WARNING" | "CRITICAL";
}
```

The `results[]` accumulator in the `--all` branch passes these to an enhanced `writeCombinedSummary()`.

## Decision 13: Combined Report — Timing

**Decision**: Generate **once after all states complete** (current behavior).

**Rationale**: The existing code already calls `writeCombinedSummary()` after the `for...of` loop. Progressive generation adds I/O overhead and partial reports are misleading. Per-state checkpoints preserve progress independently.

---

## Summary of Implementation Changes

| File | Change | Decisions |
|------|--------|-----------|
| `state-config-schema.ts` | Add `countyAliases` to `StateConfigSchema` | 1, 2 |
| `normalizer.ts` | Add `resolveCountyAlias()` before county DB match | 3 |
| `court-seeder.ts` | Add alias lookup before `countyMap.get()` | 3 |
| `texas-courts.json` | Add `countyAliases` with TX variants | 4 |
| `california-courts.json` | Add `countyAliases` with CA variants | 4 |
| `new-york-courts.json` | Add `countyAliases` with NY variants | 4 |
| `index.ts` | Write harvest manifest after run; read at startup for freshness; enhance `runSingleState` return type; improve `writeCombinedSummary` | 5, 6, 12, 13 |
| `reporter.ts` | Add quality gate section; add data freshness section; add combined verdict | 7, 8 |
| `prompts/texas-extraction-prompt.txt` | Add Division Extraction section + `division` in example JSON | 9 |
| `prompts/california-extraction-prompt.txt` | Add Division Extraction section + `division` in example JSON | 9 |
| `prompts/new-york-extraction-prompt.txt` | Add Division Extraction section + `division` in example JSON | 9 |
| `prompts/generic-extraction.txt` | Add division extraction rule + `division` in example JSON | 9 |
