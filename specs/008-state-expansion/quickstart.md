# Quickstart: State Expansion — TX/CA/NY Harvest Execution

**Feature**: 008-state-expansion
**Prerequisite**: Database running with seeded states + counties (`prisma db seed`)

## 1. Seed Court Structure for a State

Before importing judges, seed the court records for a target state:

```bash
# Seed Texas courts
npx tsx scripts/harvest/index.ts --state texas --seed-courts-only

# Seed California courts
npx tsx scripts/harvest/index.ts --state california --seed-courts-only

# Seed New York courts
npx tsx scripts/harvest/index.ts --state new-york --seed-courts-only

# Seed all states
npx tsx scripts/harvest/index.ts --all --seed-courts-only
```

Verify: Check the admin panel or database for Court records linked to the target state's counties.

## 2. List Available States

```bash
npx tsx scripts/harvest/index.ts --list
```

Expected output:

```
Available states:
  california    8 courts
  florida      27 courts
  new-york     11 courts
  texas        16 courts
```

## 3. Run a Single-State Harvest

```bash
# Texas (appellate focus — ~200 judges expected)
npx tsx scripts/harvest/index.ts --state texas

# California (full — ~1,700 judges expected)
npx tsx scripts/harvest/index.ts --state california

# New York (full — ~1,000 judges expected)
npx tsx scripts/harvest/index.ts --state new-york
```

Output goes to `scripts/harvest/output/{state-slug}/`:

- `{state}-judges-{timestamp}.csv` — Import-ready CSV
- `{state}-enriched-report-{timestamp}.md` — Quality report with quality gate
- `harvest-manifest.json` — Freshness tracking manifest
- `checkpoints/harvest-checkpoint.json` — Resumable checkpoint

## 4. Review the Quality Report

Open the quality report Markdown file. Check:

1. **Quality Gate** — Top of report shows ✅ PASS / 🟡 WARNING / 🔴 CRITICAL
2. **Summary** — Judge count, page success rate, court type coverage
3. **Data Freshness** — Days since last harvest
4. **Court Type Breakdown** — Judges per court level
5. **Failed Pages** — Any URLs that need investigation

## 5. Spot-Check Accuracy

For each state, pick 20 random records from the CSV and verify against the source URL:

- Judge name matches
- Court type is correct
- County assignment is correct
- Source URL actually contains the judge's information

Target: 90%+ accuracy (18/20 records correct).

## 6. Resume an Interrupted Harvest

```bash
# Resume from last checkpoint
npx tsx scripts/harvest/index.ts --state texas --resume
```

## 7. Run All States

```bash
# Harvest all configured states sequentially
npx tsx scripts/harvest/index.ts --all
```

Produces:

- Per-state output in `output/{state-slug}/`
- Combined summary at `output/combined-summary-{timestamp}.md`

If a state fails, the others continue. Resume the failed state later:

```bash
npx tsx scripts/harvest/index.ts --state {failed-state} --resume
```

## 8. Import to Database

Once satisfied with the quality report:

```bash
# Import via the admin import pipeline
npx tsx scripts/import/index.ts --file scripts/harvest/output/texas/texas-judges-{timestamp}.csv
```

Records enter the verification queue. Only VERIFIED records appear on public pages.

## 9. Backward Compatibility Check

```bash
# Verify Florida still works identically
npx tsx scripts/harvest/index.ts --state florida --dry-run
```

Running without `--state` or `--all` defaults to Florida.

## Key Files

| File                                                       | Purpose                                                |
| ---------------------------------------------------------- | ------------------------------------------------------ |
| `scripts/harvest/texas-courts.json`                        | TX court config (16 URLs, countyAliases)               |
| `scripts/harvest/california-courts.json`                   | CA court config (8 URLs, countyAliases)                |
| `scripts/harvest/new-york-courts.json`                     | NY court config (11 URLs, countyAliases)               |
| `scripts/harvest/prompts/texas-extraction-prompt.txt`      | TX extraction rules + division                         |
| `scripts/harvest/prompts/california-extraction-prompt.txt` | CA extraction rules + division                         |
| `scripts/harvest/prompts/new-york-extraction-prompt.txt`   | NY extraction rules + division                         |
| `scripts/harvest/state-config-schema.ts`                   | Zod schemas (StateConfig, CourtEntry, HarvestManifest) |
| `scripts/harvest/reporter.ts`                              | Quality reports + quality gate + freshness             |
| `scripts/harvest/index.ts`                                 | CLI orchestrator + combined summary                    |

## Common Issues

| Issue                           | Solution                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------ |
| "X county(ies) not found in DB" | Add missing county aliases to `countyAliases` in state config JSON                   |
| Zero judges from a page         | Check if page needs `fetchMethod: "browser"` (deferred) or if HTML structure changed |
| Quality gate WARNING            | Review flagged metrics in report; update extraction prompt if needed                 |
| "Data is stale (>90 days)"      | Re-run harvest for the flagged state                                                 |
| Rate limiting errors            | Increase `fetchDelayMs` in state config's `rateLimit` section                        |
