# Quickstart: Pragmatic Auto-Verification

**Feature**: 014-auto-verification
**Branch**: `014-auto-verification`

## Prerequisites

- Node.js 18+, PostgreSQL running, `.env` configured
- Current branch: `git checkout 014-auto-verification`

## Implementation Order

### Step 1: Schema Migration

```bash
# Add rosterUrl and extractionMethod fields to Judge model
npx prisma migrate dev --name add_roster_url_and_extraction_method
```

Adds two nullable fields to the `judges` table. No data migration needed.

### Step 2: Source Authority Classifier

Create `scripts/harvest/source-classifier.ts`:

- `classifySourceAuthority(url, stateConfigs)` → `SourceAuthority`
- Reads state court config JSONs as the trusted URL allowlist
- `.gov` → OFFICIAL_GOV, config-listed domains → COURT_WEBSITE, else → SECONDARY

**Verify**: Unit test with known `.gov`, `.org`, `.com` court URLs.

### Step 3: Update Confidence Scoring

Modify `scripts/harvest/bio-enricher.ts`:

- Replace flat base `0.50` with source-authority-aware bases (0.65 / 0.55 / 0.45)
- Add extraction method bonus (+0.10 for deterministic)
- Update cap from 0.90 to 0.95

**Verify**: Harvest a small set of Florida courts, check CSV scores are higher for `.gov` sources.

### Step 4: Update Harvest CSV Output

Modify `scripts/harvest/reporter.ts`:

- Add "Source Authority" and "Extraction Method" columns
- Tag records during harvest using classifier + extractor metadata

**Verify**: Open output CSV, confirm new columns present.

### Step 5: Update CSV Importer

Modify `scripts/import/csv-importer.ts`:

- Parse new columns with defaults (COURT_WEBSITE / null)
- Map "Roster URL" → `rosterUrl` field
- Pass `extractionMethod` through to judge record

Modify `scripts/import/index.ts`:

- Remove hardcoded `sourceAuthority: 'COURT_WEBSITE'`
- Use parsed value from CSV

**Verify**: Import an old CSV (no new columns) — should succeed with defaults.

### Step 6: Update Quality Gate

Modify `scripts/import/quality-gate.ts`:

- Source-aware auto-verify thresholds (0.70 / 0.75 / 0.80)
- Anomaly flags always force NEEDS_REVIEW
- Set `autoVerified: true` and `verifiedAt` on auto-verified records

**Verify**: Import a new harvest CSV. Check `.gov`-sourced judges are VERIFIED.

### Step 7: Re-Scoring Script

Create `scripts/maintenance/rescore-judges.ts`:

- Query UNVERIFIED + flag-cleared NEEDS_REVIEW candidates
- Batch process (100/txn) with progress logging
- Classify source authority from sourceUrl
- Apply new confidence formula and auto-verify thresholds
- `--dry-run` (default) and `--apply` modes

**Verify**:
```bash
npx tsx scripts/maintenance/rescore-judges.ts --dry-run
# Review counts, then:
npx tsx scripts/maintenance/rescore-judges.ts --apply
```

### Step 8: Batch Verify API

Create `src/app/api/admin/judges/sources/route.ts` (GET):

- Aggregate judges by sourceUrl with status counts

Create `src/app/api/admin/judges/batch-verify/route.ts` (POST):

- Batch promote UNVERIFIED judges by sourceUrl

**Verify**: `curl` the endpoints with test data.

### Step 9: Admin Sources UI

Add a "Sources" tab/view to the admin judges page:

- Table: source URL, authority badge, total/verified/unverified/needs-review counts
- "Verify All" button per source with confirmation dialog
- State/county filter dropdowns

**Verify**: Navigate to admin panel, test batch verify on a source.

## End-to-End Smoke Test

```bash
# 1. Run Florida harvest
npx tsx scripts/harvest/index.ts --state FL --limit 5

# 2. Import the harvest CSV
# (through admin import UI or scripts/import/index.ts)

# 3. Check database — .gov judges should be VERIFIED
npx prisma studio
# Filter judges by status=VERIFIED, confirm autoVerified=true

# 4. Re-score existing records
npx tsx scripts/maintenance/rescore-judges.ts --dry-run
npx tsx scripts/maintenance/rescore-judges.ts --apply

# 5. Check public pages — newly verified judges should appear
# Visit localhost:3000/florida/[county]/judges
```
