# API Contracts: Sort Allowlist Changes

**Feature**: 013-admin-data-tables  
**Date**: 2026-03-15

> These contracts specify changes to existing admin API endpoints to support expanded sorting. No new endpoints are created.

## General Pattern

All endpoints that accept a `sort` query parameter MUST validate it against an allowlist of permitted field names. Unknown values MUST fall back to the endpoint's default sort field.

```
Request:  GET /api/admin/{resource}?sort={field}&order={asc|desc}
Response: Same as current (no response shape changes)
```

The `order` parameter accepts `asc` or `desc` (default: `desc`).

---

## Endpoint: `GET /api/admin/judges`

**Current**: No sort parameter; hardcoded `createdAt DESC`  
**Change**: Add `sort` and `order` query parameters

| Parameter | Type   | Default     | Allowed Values                    |
| --------- | ------ | ----------- | --------------------------------- |
| `sort`    | string | `createdAt` | `fullName`, `createdAt`, `status` |
| `order`   | string | `desc`      | `asc`, `desc`                     |

**Prisma mapping**:

```
fullName  → { fullName: order }
createdAt → { createdAt: order }
status    → { status: order }
```

---

## Endpoint: `GET /api/admin/discovery`

**Current**: Accepts `sort` (discoveredAt, confidenceScore) and `order`  
**Change**: Expand sort allowlist

| Parameter | Type   | Default        | Allowed Values                                                  |
| --------- | ------ | -------------- | --------------------------------------------------------------- |
| `sort`    | string | `discoveredAt` | `discoveredAt`, `confidenceScore`, `stateAbbr`, `status`, `url` |
| `order`   | string | `desc`         | `asc`, `desc`                                                   |

**New Prisma mappings**:

```
stateAbbr → { stateAbbr: order }
status    → { status: order }
url       → { url: order }
```

---

## Endpoint: `GET /api/admin/health`

**Current**: Accepts `sort` (healthScore, lastScrapedAt, lastYield, avgYield) and `order`  
**Change**: Expand sort allowlist

| Parameter | Type   | Default       | Allowed Values                                                                              |
| --------- | ------ | ------------- | ------------------------------------------------------------------------------------------- |
| `sort`    | string | `healthScore` | `healthScore`, `lastScrapedAt`, `lastYield`, `avgYield`, `url`, `stateAbbr`, `totalScrapes` |
| `order`   | string | `desc`        | `asc`, `desc`                                                                               |

**New Prisma mappings**:

```
url          → { url: order }
stateAbbr    → { stateAbbr: order }
totalScrapes → { totalScrapes: order }
```

---

## Endpoint: `GET /api/admin/import`

**Current**: No sort parameter; hardcoded `createdAt DESC`  
**Change**: Add `sort` and `order` query parameters

| Parameter | Type   | Default     | Allowed Values                     |
| --------- | ------ | ----------- | ---------------------------------- |
| `sort`    | string | `createdAt` | `createdAt`, `status`, `totalRows` |
| `order`   | string | `desc`      | `asc`, `desc`                      |

**Prisma mapping**:

```
createdAt → { createdAt: order }
status    → { status: order }
totalRows → { totalRows: order }
```

---

## Endpoint: `GET /api/admin/verification`

**Current**: Accepts `sort` (createdAt, fullName, updatedAt) and `order`  
**Change**: None — existing allowlist is sufficient

---

## Endpoint: `GET /api/admin/dashboard`

**Change**: None — State Breakdown table sorts client-side; no API sort needed
