# API Contracts: Phase 1 — Foundation

**Branch**: `001-foundation` | **Date**: 2026-02-17

This document defines the contracts for all routes in Phase 1. The application uses Next.js App Router, so "API routes" are Next.js Route Handlers (`route.ts`) and "page routes" are Server Components (`page.tsx`).

---

## Table of Contents

1. [Public Page Routes](#1-public-page-routes) (SSR pages — no JSON API)
2. [Admin API Routes](#2-admin-api-routes) (JSON REST endpoints)
3. [Generated Routes](#3-generated-routes) (sitemap, robots)

---

## 1. Public Page Routes

All public pages are Server Components rendered via SSR. They return HTML, not JSON. These contracts define the **data-fetching interface** and **response shape** for each page.

### 1.1 States Grid — `GET /judges`

**File**: `src/app/judges/page.tsx`

**Data Fetched**:

```typescript
type StatesGridData = {
  states: Array<{
    id: string;
    name: string;
    slug: string;
    abbreviation: string;
    _count: { counties: number }; // county count for display
  }>;
};
```

**Response** (HTML):

- `<title>`: "U.S. Judges Directory — Browse by State"
- JSON-LD: `ItemList` with `itemListElement` entries for each state
- Canonical: `https://judgesdirectory.org/judges`
- HTTP 200

**Error Responses**:

- 500: Database unreachable → generic error page

---

### 1.2 County List — `GET /judges/[state]`

**File**: `src/app/judges/[state]/page.tsx`

**Params**: `{ state: string }` (slug)

**Data Fetched**:

```typescript
type CountyListData = {
  state: {
    id: string;
    name: string;
    slug: string;
  };
  counties: Array<{
    id: string;
    name: string;
    slug: string;
    _count: { courts: number }; // court count for display
  }>;
};
```

**Response** (HTML):

- `<title>`: "Judges in {State Name} — County Directory"
- JSON-LD: `ItemList` with county entries
- Canonical: `https://judgesdirectory.org/judges/{state}`
- HTTP 200

**Error Responses**:

- 404: State slug not found → `notFound()` → custom 404 page

---

### 1.3 Court Types — `GET /judges/[state]/[county]`

**File**: `src/app/judges/[state]/[county]/page.tsx`

**Params**: `{ state: string, county: string }` (slugs)

**Data Fetched**:

```typescript
type CourtTypesData = {
  state: { id: string; name: string; slug: string };
  county: { id: string; name: string; slug: string };
  courts: Array<{
    id: string;
    type: string;
    slug: string;
    _count: { judges: number }; // judge count for display
  }>;
};
```

**Response** (HTML):

- `<title>`: "Courts in {County Name}, {State Name} — judgesdirectory.org"
- JSON-LD: `ItemList` with court type entries
- Canonical: `https://judgesdirectory.org/judges/{state}/{county}`
- HTTP 200

**Error Responses**:

- 404: State or county slug not found → `notFound()`

---

### 1.4 Judges by Court — `GET /judges/[state]/[county]/[courtType]`

**File**: `src/app/judges/[state]/[county]/[courtType]/page.tsx`

**Params**: `{ state: string, county: string, courtType: string }` (slugs)

**Data Fetched**:

```typescript
type JudgeListData = {
  state: { id: string; name: string; slug: string };
  county: { id: string; name: string; slug: string };
  court: { id: string; type: string; slug: string };
  judges: Array<{
    id: string;
    fullName: string;
    slug: string;
    politicalAffiliation: string | null;
    termEnd: string | null; // ISO date
  }>;
};
```

**Response** (HTML):

- `<title>`: "{Court Type} Judges in {County Name}, {State Name}"
- JSON-LD: `ItemList` with judge entries
- Canonical: `https://judgesdirectory.org/judges/{state}/{county}/{courtType}`
- HTTP 200

**Error Responses**:

- 404: Invalid state, county, or court-type slug → `notFound()`

---

### 1.5 Judge Profile — `GET /judges/[state]/[county]/[courtType]/[judgeSlug]`

**File**: `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx`

**Params**: `{ state: string, county: string, courtType: string, judgeSlug: string }`

**Data Fetched**:

```typescript
type JudgeProfileData = {
  judge: {
    id: string;
    fullName: string;
    slug: string;
    termStart: string | null;
    termEnd: string | null;
    selectionMethod: string | null;
    appointingAuthority: string | null;
    education: string | null;
    priorExperience: string | null;
    politicalAffiliation: string | null;
    sourceUrl: string | null;
    verified: boolean;
    court: {
      type: string;
      slug: string;
      county: {
        name: string;
        slug: string;
        state: {
          name: string;
          slug: string;
        };
      };
    };
  };
};
```

**Response** (HTML):

- `<title>`: "Judge {Full Name} — {Court Type}, {County Name}, {State Name}"
- JSON-LD: `Person` with `name`, `jobTitle`, `worksFor`, `description`
- Canonical: `https://judgesdirectory.org/judges/{state}/{county}/{courtType}/{judgeSlug}`
- Disclaimer: visible on page
- HTTP 200

**Error Responses**:

- 404: Invalid slug at any level → `notFound()`

---

## 2. Admin API Routes

All admin routes are protected by HTTP Basic Auth via middleware. Requests without valid `Authorization: Basic ...` headers receive 401.

### 2.1 List Judges — `GET /api/admin/judges`

**File**: `src/app/api/admin/judges/route.ts`

**Query Parameters**:

| Param      | Type    | Required | Default | Description                                      |
| ---------- | ------- | -------- | ------- | ------------------------------------------------ |
| `page`     | integer | No       | 1       | Page number (1-indexed)                          |
| `limit`    | integer | No       | 50      | Results per page (max 100)                       |
| `search`   | string  | No       | —       | Search by `fullName` (case-insensitive contains) |
| `stateId`  | UUID    | No       | —       | Filter by state                                  |
| `countyId` | UUID    | No       | —       | Filter by county                                 |
| `courtId`  | UUID    | No       | —       | Filter by court                                  |
| `verified` | boolean | No       | —       | Filter by verification status                    |

**Response** (200):

```json
{
  "judges": [
    {
      "id": "uuid",
      "fullName": "John A. Smith",
      "slug": "john-a-smith",
      "verified": false,
      "court": {
        "id": "uuid",
        "type": "District Court",
        "county": {
          "id": "uuid",
          "name": "Harris County",
          "state": {
            "id": "uuid",
            "name": "Texas"
          }
        }
      },
      "createdAt": "2026-02-17T00:00:00.000Z",
      "updatedAt": "2026-02-17T00:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1500,
    "totalPages": 30
  }
}
```

**Error Responses**:

- 401: Unauthorized (missing/invalid auth)
- 400: Invalid query parameters

---

### 2.2 Create Judge — `POST /api/admin/judges`

**File**: `src/app/api/admin/judges/route.ts`

**Request Body** (`application/json`):

```json
{
  "courtId": "uuid",
  "fullName": "Jane B. Doe",
  "termStart": "2020-01-15T00:00:00.000Z",
  "termEnd": "2026-12-31T00:00:00.000Z",
  "selectionMethod": "Appointed",
  "appointingAuthority": "Governor",
  "education": "J.D., University of Texas School of Law, 2005",
  "priorExperience": "Assistant District Attorney, Harris County, 2005-2015",
  "politicalAffiliation": "Republican",
  "sourceUrl": "https://www.txcourts.gov/judges/jane-doe"
}
```

**Required Fields**: `courtId`, `fullName`, `sourceUrl`  
**Optional Fields**: All others (nullable in data model)

**Slug Generation**: Auto-generated from `fullName` using slugify. If collision within same `courtId`, appends `-2`, `-3`, etc.

**Response** (201 Created):

```json
{
  "judge": {
    "id": "uuid",
    "fullName": "Jane B. Doe",
    "slug": "jane-b-doe",
    "courtId": "uuid",
    "verified": false,
    "createdAt": "2026-02-17T00:00:00.000Z",
    "updatedAt": "2026-02-17T00:00:00.000Z"
  }
}
```

**Error Responses**:

- 401: Unauthorized
- 400: Validation error (missing required fields, invalid courtId)
  ```json
  {
    "error": "Validation failed",
    "details": [
      { "field": "fullName", "message": "Full name is required" },
      { "field": "courtId", "message": "Court not found" }
    ]
  }
  ```
- 409: Conflict (slug collision that could not be auto-resolved — edge case)

---

### 2.3 Update Judge — `PUT /api/admin/judges/[id]`

**File**: `src/app/api/admin/judges/[id]/route.ts`

**Params**: `{ id: string }` (UUID)

**Request Body** (`application/json`): Same fields as POST, all optional (partial update). `fullName` change triggers slug regeneration.

**Response** (200):

```json
{
  "judge": {
    "id": "uuid",
    "fullName": "Jane B. Doe",
    "slug": "jane-b-doe",
    "verified": false,
    "updatedAt": "2026-02-17T12:00:00.000Z"
  }
}
```

**Error Responses**:

- 401: Unauthorized
- 400: Validation error
- 404: Judge ID not found

---

### 2.4 Delete Judge — `DELETE /api/admin/judges/[id]`

**File**: `src/app/api/admin/judges/[id]/route.ts`

**Params**: `{ id: string }` (UUID)

**Response** (204 No Content): Empty body

**Error Responses**:

- 401: Unauthorized
- 404: Judge ID not found

---

### 2.5 Verify Judge — `PATCH /api/admin/judges/[id]/verify`

**File**: `src/app/api/admin/judges/[id]/verify/route.ts`

**Params**: `{ id: string }` (UUID)

**Request Body** (`application/json`):

```json
{
  "verified": true
}
```

**Response** (200):

```json
{
  "judge": {
    "id": "uuid",
    "fullName": "Jane B. Doe",
    "verified": true,
    "updatedAt": "2026-02-17T12:00:00.000Z"
  }
}
```

**Error Responses**:

- 401: Unauthorized
- 404: Judge ID not found

---

### 2.6 List States — `GET /api/admin/states`

**File**: `src/app/api/admin/states/route.ts`

Returns all states for populating dropdowns in the admin panel.

**Response** (200):

```json
{
  "states": [
    { "id": "uuid", "name": "Alabama", "slug": "alabama", "abbreviation": "AL" }
  ]
}
```

---

### 2.7 List Counties by State — `GET /api/admin/states/[stateId]/counties`

**File**: `src/app/api/admin/states/[stateId]/counties/route.ts`

**Params**: `{ stateId: string }` (UUID)

**Response** (200):

```json
{
  "counties": [
    { "id": "uuid", "name": "Harris County", "slug": "harris-county" }
  ]
}
```

**Error Responses**:

- 404: State ID not found

---

### 2.8 List/Create Courts by County — `GET|POST /api/admin/counties/[countyId]/courts`

**File**: `src/app/api/admin/counties/[countyId]/courts/route.ts`

**GET Response** (200):

```json
{
  "courts": [
    { "id": "uuid", "type": "District Court", "slug": "district-court" }
  ]
}
```

**POST Request Body**:

```json
{
  "type": "Family Court"
}
```

**POST Response** (201):

```json
{
  "court": {
    "id": "uuid",
    "type": "Family Court",
    "slug": "family-court",
    "countyId": "uuid"
  }
}
```

**Error Responses**:

- 401: Unauthorized
- 404: County ID not found
- 400: Validation error (missing `type`)
- 409: Slug collision within county

---

## 3. Generated Routes

### 3.1 Sitemap — `GET /sitemap.xml`

**File**: `src/app/sitemap.ts`

Returns dynamic XML sitemap. Uses `generateSitemaps()` for splitting when > 50,000 URLs.

**Response** (200, `application/xml`):

```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://judgesdirectory.org/judges</loc>
    <lastmod>2026-02-17</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <!-- ... all states, counties, courts, judges -->
</urlset>
```

### 3.2 Robots — `GET /robots.txt`

**File**: `src/app/robots.ts`

**Response** (200, `text/plain`):

```
User-Agent: *
Allow: /judges
Disallow: /admin
Disallow: /api

Sitemap: https://judgesdirectory.org/sitemap.xml
```

---

## Common Error Response Format

All API error responses use a consistent JSON shape:

```json
{
  "error": "Human-readable error summary",
  "details": [
    { "field": "fieldName", "message": "Specific validation message" }
  ]
}
```

- `error`: Always present
- `details`: Present only for validation errors (400)

## Authentication Header Format

All `/api/admin/*` and `/admin/*` routes require:

```
Authorization: Basic base64(username:password)
```

Where `username` and `password` match `ADMIN_USERNAME` and `ADMIN_PASSWORD` environment variables.
