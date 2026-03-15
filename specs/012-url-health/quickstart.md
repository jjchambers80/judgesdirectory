# Quickstart: URL Health Scoring & Delta-Run Prioritization

**Feature**: 012-url-health  
**Branch**: `012-url-health`

## Prerequisites

- PostgreSQL running locally with `DATABASE_URL` configured
- Tavily API key in `.env` (`TAVILY_API_KEY`)
- OpenAI API key in `.env` (`OPENAI_API_KEY`)
- At least one state config JSON in `scripts/harvest/` (e.g., `florida-courts.json`)

## Setup

```bash
# Switch to feature branch
git checkout 012-url-health

# Install dependencies (if any new ones added)
npm install

# Run Prisma migration (creates UrlHealth + ScrapeLog, migrates ScrapeFailure data, drops ScrapeFailure)
npx prisma migrate dev

# Generate Prisma client
npx prisma generate
```

## Testing the Feature

### 1. Run a Standard Harvest (Populates Health Data)

```bash
# Run a full harvest for Florida — health recording happens automatically
npx tsx scripts/harvest/index.ts --state florida

# Check: UrlHealth records should now exist for all FL URLs
npx prisma studio
# → Open url_health table, verify records exist with healthScore, lastYield, etc.
```

### 2. Run a Delta Harvest

```bash
# Delta mode: prioritizes stale/healthy URLs, defers broken ones
npx tsx scripts/harvest/index.ts --state florida --delta

# Delta + skip broken: excludes URLs with healthScore < 0.2
npx tsx scripts/harvest/index.ts --state florida --delta --skip-broken

# Custom threshold: skip URLs below 0.3
npx tsx scripts/harvest/index.ts --state florida --delta --skip-broken --skip-broken-threshold 0.3
```

### 3. View Health Dashboard

```bash
# Start dev server
npx next dev

# Navigate to health dashboard
open http://localhost:3000/admin/health/

# Filter by state
open http://localhost:3000/admin/health/?state=FL

# View anomalies only
open http://localhost:3000/admin/health/?status=anomaly
```

### 4. API Endpoints

```bash
# List all health records
curl -u admin:password http://localhost:3000/api/admin/health

# Filter by state
curl -u admin:password "http://localhost:3000/api/admin/health?state=FL"

# Get per-state summary
curl -u admin:password http://localhost:3000/api/admin/health/summary

# Get single URL health with scrape history
curl -u admin:password http://localhost:3000/api/admin/health/{id}

# Dismiss an anomaly
curl -u admin:password -X PATCH \
  -H "Content-Type: application/json" \
  -d '{"action":"dismiss-anomaly"}' \
  http://localhost:3000/api/admin/health/{id}
```

## Verification Checklist

- [ ] `npx prisma migrate dev` completes without errors
- [ ] ScrapeFailure table no longer exists in the schema
- [ ] Running a harvest creates UrlHealth + ScrapeLog records
- [ ] Health scores are between 0.0 and 1.0
- [ ] `--delta` flag changes URL processing order
- [ ] `--skip-broken` flag excludes low-score URLs
- [ ] `/admin/health/` page loads and displays health records
- [ ] Clicking a URL row expands to show scrape history
- [ ] State filter and sort controls work
- [ ] Anomaly badge appears for URLs with yield anomalies
- [ ] `/admin/failures/` page is removed (404 or redirects to /admin/health/)
- [ ] `npx next build` completes without errors
