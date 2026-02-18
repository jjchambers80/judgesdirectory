# Quickstart: Florida Judge Data Harvest

**Feature**: 004-florida-judge-harvest | **Time to first result**: ~5 minutes

## Prerequisites

1. **Node.js 20+** — verify with `node --version`
2. **PostgreSQL running** with the judgesdirectory database seeded (50 states + 3,142 counties)
3. **Anthropic API key** — get one at [console.anthropic.com](https://console.anthropic.com)

## Setup

```bash
# 1. Install new dependencies
npm install @anthropic-ai/sdk zod cheerio turndown
npm install -D @types/turndown

# 2. Set your Anthropic API key
export ANTHROPIC_API_KEY="sk-ant-..."

# 3. Verify database connection
npx prisma db pull
```

## Step 1: Seed Florida Courts

Seeds the 4 court types across Florida's 67 counties, 20 circuits, and 6 DCA districts.

```bash
npx ts-node scripts/harvest/index.ts --seed-courts-only
```

**Expected output**:

```
Seeding Florida court structure...
  Created 67 County Courts
  Created 20 Circuit Courts (across 67 counties)
  Created 6 District Courts of Appeal
  Created 1 Supreme Court
Done. 94 courts seeded for Florida.
```

**Verify**: Open the admin panel at `http://localhost:3000/admin/courts/` — Florida counties should now show their court types.

## Step 2: Dry Run (Optional)

Test HTML fetching and cleaning without making Claude API calls.

```bash
npx ts-node scripts/harvest/index.ts --dry-run
```

**Expected output**: Fetches all ~28 court URLs, shows HTML size before/after cleaning, but skips extraction. Useful for verifying the URL list and network access.

## Step 3: Full Extraction

```bash
npx ts-node scripts/harvest/index.ts
```

**Expected output**:

```
Starting Florida judge harvest...
[1/28] Fetching: supremecourt.flcourts.gov/Justices — 200 OK (42KB → 8KB)
[1/28] Extracted: 7 judges from Supreme Court
[2/28] Fetching: 1dca.flcourts.gov/Judges — 200 OK (38KB → 6KB)
...
[28/28] Complete.

Quality Report:
  Pages: 26/28 successful
  Judges: 1,027 extracted (15 duplicates removed)
  Missing counties: Lafayette, Liberty

Output: scripts/harvest/output/florida-judges-2026-02-18T14-30-00.csv
Report: scripts/harvest/output/florida-report-2026-02-18T14-30-00.md
```

**Estimated time**: 5-10 minutes (rate-limited to 1 request per 1.5 seconds)
**Estimated cost**: ~$3-5 in Anthropic API credits

## Step 4: Review & Import

1. **Review the CSV**: Open `scripts/harvest/output/florida-judges-*.csv` in a spreadsheet or text editor. Spot-check 10-20 entries against their source URLs.

2. **Import via admin panel**:
   - Navigate to `http://localhost:3000/admin/import/`
   - Upload the CSV file
   - Select "Florida" as the state
   - Map columns (they should auto-match)
   - Preview and confirm import

3. **Verify in verification queue**: Navigate to `/admin/verification/` — all imported judges appear as UNVERIFIED.

## Resuming After Interruption

If the script is interrupted (Ctrl+C, network failure, API quota):

```bash
# Automatically resumes from last checkpoint
npx ts-node scripts/harvest/index.ts

# To start completely fresh
npx ts-node scripts/harvest/index.ts --reset
```

## Troubleshooting

| Problem                            | Solution                                                                                            |
| ---------------------------------- | --------------------------------------------------------------------------------------------------- |
| `ANTHROPIC_API_KEY not set`        | `export ANTHROPIC_API_KEY="sk-ant-..."`                                                             |
| `Rate limited after retries`       | Wait 60s, re-run (auto-resumes)                                                                     |
| Court URL returns 403/503          | Check if the site is down; the URL may need updating in `florida-courts.json`                       |
| CSV import shows county mismatches | Compare CSV county names against `normalizeCountyName()` output; update extraction prompt if needed |
| `0 judges extracted` from a page   | The page structure may have changed — check the HTML, update the cleaning logic in `fetcher.ts`     |
