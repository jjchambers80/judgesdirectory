# API Contracts: URL Health Scoring & Delta-Run Prioritization

**Feature**: 012-url-health  
**Date**: 2026-03-15

## Admin API Routes

All routes require Basic Auth (existing admin authentication).

---

### GET /api/admin/health

List URL health records with filtering, sorting, and pagination.

**Query Parameters**:

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| state | string | — | Filter by state abbreviation (e.g., "FL") |
| status | string | — | Filter: "healthy" (≥0.7), "moderate" (0.3–0.7), "unhealthy" (<0.3), "anomaly" (anomalyDetected=true), "inactive" (active=false) |
| failuresOnly | boolean | false | Filter to URLs with at least one unresolved failure |
| sort | string | "healthScore" | Sort field: "healthScore", "lastScrapedAt", "lastYield", "avgYield" |
| order | string | "desc" | Sort direction: "asc" or "desc" |
| page | number | 1 | Page number (1-indexed) |
| limit | number | 50 | Results per page (max 100) |

**Response** (200):
```json
{
  "urls": [
    {
      "id": "uuid",
      "url": "https://www.flcourts.gov/...",
      "domain": "flcourts.gov",
      "state": "Florida",
      "stateAbbr": "FL",
      "healthScore": 0.85,
      "totalScrapes": 8,
      "successfulScrapes": 7,
      "lastYield": 15,
      "avgYield": 14.5,
      "yieldTrend": "STABLE",
      "anomalyDetected": false,
      "anomalyMessage": null,
      "lastScrapedAt": "2026-03-10T08:00:00Z",
      "lastSuccessAt": "2026-03-10T08:00:00Z",
      "source": "MANUAL",
      "active": true,
      "createdAt": "2026-03-01T00:00:00Z",
      "updatedAt": "2026-03-10T08:00:00Z"
    }
  ],
  "summary": {
    "total": 27,
    "healthy": 20,
    "moderate": 5,
    "unhealthy": 2,
    "anomalies": 1,
    "avgHealthScore": 0.72
  },
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 27,
    "totalPages": 1
  }
}
```

---

### GET /api/admin/health/[id]

Get a single URL health record with its scrape history.

**Response** (200):
```json
{
  "health": {
    "id": "uuid",
    "url": "https://www.flcourts.gov/...",
    "domain": "flcourts.gov",
    "state": "Florida",
    "stateAbbr": "FL",
    "healthScore": 0.85,
    "totalScrapes": 8,
    "successfulScrapes": 7,
    "lastYield": 15,
    "avgYield": 14.5,
    "yieldTrend": "STABLE",
    "anomalyDetected": false,
    "anomalyMessage": null,
    "lastScrapedAt": "2026-03-10T08:00:00Z",
    "lastSuccessAt": "2026-03-10T08:00:00Z",
    "source": "MANUAL",
    "active": true
  },
  "scrapeHistory": [
    {
      "id": "uuid",
      "success": true,
      "judgesFound": 15,
      "failureType": null,
      "httpStatusCode": 200,
      "errorMessage": null,
      "retryCount": 0,
      "scrapeDurationMs": 3200,
      "resolvedAt": null,
      "resolvedBy": null,
      "scrapedAt": "2026-03-10T08:00:00Z"
    },
    {
      "id": "uuid",
      "success": false,
      "judgesFound": 0,
      "failureType": "HTTP_403",
      "httpStatusCode": 403,
      "errorMessage": "Access forbidden",
      "retryCount": 3,
      "scrapeDurationMs": 1500,
      "resolvedAt": "2026-03-10T08:00:00Z",
      "resolvedBy": "auto",
      "scrapedAt": "2026-03-03T08:00:00Z"
    }
  ]
}
```

**Response** (404): `{ "error": "Health record not found" }`

---

### GET /api/admin/health/summary

Get per-state health summaries for the admin dashboard.

**Response** (200):
```json
{
  "states": [
    {
      "stateAbbr": "FL",
      "state": "Florida",
      "totalUrls": 27,
      "healthy": 20,
      "moderate": 5,
      "unhealthy": 2,
      "avgHealthScore": 0.72,
      "anomalies": 1,
      "lastHarvestAt": "2026-03-10T08:00:00Z"
    }
  ]
}
```

---

### PATCH /api/admin/health/[id]

Admin actions on a health record (dismiss anomaly, toggle active).

**Request Body**:
```json
{
  "action": "dismiss-anomaly" | "deactivate" | "reactivate"
}
```

**Behavior**:
- `dismiss-anomaly`: Sets `anomalyDetected=false`, `anomalyMessage=null`
- `deactivate`: Sets `active=false` (excluded from delta runs)
- `reactivate`: Sets `active=true`

**Response** (200): Updated UrlHealth record
**Response** (404): `{ "error": "Health record not found" }`

---

### PATCH /api/admin/health/scrape-logs/[id]

Mark a failed scrape log as resolved.

**Request Body**:
```json
{
  "resolvedBy": "admin",
  "resolutionNotes": "Updated selector hint for new page layout"
}
```

**Response** (200): Updated ScrapeLog record  
**Response** (404): `{ "error": "Scrape log not found" }`

---

## CLI Contracts

### Harvest Pipeline (scripts/harvest/index.ts)

**New flags**:

| Flag | Type | Default | Description |
|------|------|---------|-------------|
| `--delta` | boolean | false | Enable delta-run prioritization (scrape URLs in health-informed order) |
| `--skip-broken` | boolean | false | Skip URLs with health score below threshold |
| `--skip-broken-threshold` | number | 0.2 | Health score threshold for --skip-broken |

**Delta-run priority order**:
1. Stale + Healthy (score ≥ 0.7, last success > 7 days ago)
2. Never scraped (no UrlHealth record or totalScrapes = 0)
3. Stale + Moderate (score 0.3–0.7, last success > 7 days ago)
4. Stale + Unhealthy (score < 0.3, last success > 7 days ago) — skipped if `--skip-broken`
5. Fresh (last success ≤ 7 days) — skipped in delta mode

**Console output** (delta mode):
```
[Health] Delta mode: 27 URLs prioritized
  Bucket 1 (stale+healthy): 5 URLs
  Bucket 2 (never scraped): 2 URLs
  Bucket 3 (stale+moderate): 8 URLs
  Bucket 4 (stale+unhealthy): 3 URLs [skipped: --skip-broken]
  Bucket 5 (fresh): 9 URLs [skipped: fresh data]
[Health] Processing 15 URLs (12 skipped)
```

**Post-run health report** (appended to existing quality report):
```
[Health] === Health Summary ===
  URLs processed: 15
  Health scores updated: 15
  Anomalies detected: 1
    ⚠️ https://www.flcourts.gov/circuit-3: yield dropped 15 → 0 (100% decline)
  Average health score: 0.74 (was 0.71)
```
