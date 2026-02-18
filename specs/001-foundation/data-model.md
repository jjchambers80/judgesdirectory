# Data Model: Phase 1 — Foundation

**Branch**: `001-foundation` | **Date**: 2026-02-17  
**Source**: [spec.md](spec.md) Key Entities + [research.md](research.md) Prisma patterns

---

## Entity Relationship Diagram

```
┌──────────┐       ┌──────────┐       ┌──────────┐       ┌──────────────┐
│  State   │ 1───* │  County  │ 1───* │  Court   │ 1───* │    Judge     │
│          │       │          │       │          │       │              │
│ id       │       │ id       │       │ id       │       │ id           │
│ name     │       │ stateId  │◄──FK  │ countyId │◄──FK  │ courtId      │◄──FK
│ slug ◄UK │       │ name     │       │ type     │       │ fullName     │
│ createdAt│       │ slug     │       │ slug     │       │ slug         │
│ updatedAt│       │ createdAt│       │ createdAt│       │ termStart    │
└──────────┘       │ updatedAt│       │ updatedAt│       │ termEnd      │
                   └──────────┘       └──────────┘       │ selectionMeth│
                                                         │ appointingAut│
                                                         │ education    │
                                                         │ priorExperien│
                                                         │ politicalAffi│
                                                         │ sourceUrl    │
                                                         │ verified     │
                                                         │ createdAt    │
                                                         │ updatedAt    │
                                                         └──────────────┘

FK = Foreign Key
UK = Unique constraint
```

---

## Entities

### State

Represents a U.S. state or territory (50 states + DC optionally).

| Field          | Type      | Constraints           | Notes                                       |
| -------------- | --------- | --------------------- | ------------------------------------------- |
| `id`           | UUID      | PK, auto-generated    | `@id @default(uuid())`                      |
| `name`         | String    | NOT NULL, UNIQUE      | Display name ("Texas", "California")        |
| `slug`         | String    | NOT NULL, UNIQUE      | URL segment ("texas", "california")         |
| `abbreviation` | String(2) | NOT NULL, UNIQUE      | USPS code ("TX", "CA") — useful for display |
| `fipsCode`     | String(2) | UNIQUE, nullable      | FIPS state code for Census join             |
| `createdAt`    | DateTime  | NOT NULL, default NOW |                                             |
| `updatedAt`    | DateTime  | NOT NULL, auto-update |                                             |

**Relationships**: One State → Many Counties

**Validation Rules**:

- `slug` MUST be lowercase ASCII with hyphens only (`/^[a-z][a-z0-9-]*$/`)
- `slug` max length: 100 characters
- `name` cannot be empty string

---

### County

Represents a county, parish, borough, or census area within a state.

| Field       | Type      | Constraints              | Notes                                         |
| ----------- | --------- | ------------------------ | --------------------------------------------- |
| `id`        | UUID      | PK, auto-generated       |                                               |
| `stateId`   | UUID      | FK → State(id), NOT NULL |                                               |
| `name`      | String    | NOT NULL                 | Display name ("Harris County", "Cook County") |
| `slug`      | String    | NOT NULL                 | URL segment ("harris-county")                 |
| `fipsCode`  | String(5) | UNIQUE, nullable         | Full FIPS county code (state+county)          |
| `createdAt` | DateTime  | NOT NULL, default NOW    |                                               |
| `updatedAt` | DateTime  | NOT NULL, auto-update    |                                               |

**Relationships**: Belongs to one State; One County → Many Courts

**Validation Rules**:

- `slug` MUST be lowercase ASCII with hyphens
- `slug` max length: 100 characters
- Composite unique: `(stateId, slug)` — slugs unique within a state

---

### Court

Represents a court within a county.

| Field       | Type     | Constraints               | Notes                                                    |
| ----------- | -------- | ------------------------- | -------------------------------------------------------- |
| `id`        | UUID     | PK, auto-generated        |                                                          |
| `countyId`  | UUID     | FK → County(id), NOT NULL |                                                          |
| `type`      | String   | NOT NULL                  | Free-text designation ("District Court", "Family Court") |
| `slug`      | String   | NOT NULL                  | URL segment ("district-court")                           |
| `createdAt` | DateTime | NOT NULL, default NOW     |                                                          |
| `updatedAt` | DateTime | NOT NULL, auto-update     |                                                          |

**Relationships**: Belongs to one County; One Court → Many Judges

**Validation Rules**:

- `slug` MUST be lowercase ASCII with hyphens
- `slug` max length: 100 characters
- Composite unique: `(countyId, slug)` — slugs unique within a county
- `type` is free-text (not enum) per spec assumption — varies by state

---

### Judge

Represents an individual judge assigned to a court.

| Field                  | Type     | Constraints              | Notes                                       |
| ---------------------- | -------- | ------------------------ | ------------------------------------------- |
| `id`                   | UUID     | PK, auto-generated       |                                             |
| `courtId`              | UUID     | FK → Court(id), NOT NULL |                                             |
| `fullName`             | String   | NOT NULL                 | Display name ("John A. Smith")              |
| `slug`                 | String   | NOT NULL                 | URL segment ("john-a-smith")                |
| `termStart`            | DateTime | nullable                 | Some judges have unknown start dates        |
| `termEnd`              | DateTime | nullable                 | Some terms are indefinite                   |
| `selectionMethod`      | String   | nullable                 | "Elected", "Appointed", "Retained"          |
| `appointingAuthority`  | String   | nullable                 | "Governor", "President", etc.               |
| `education`            | Text     | nullable                 | Free-text: degrees, schools                 |
| `priorExperience`      | Text     | nullable                 | Free-text: prior roles                      |
| `politicalAffiliation` | String   | nullable                 | "Republican", "Democrat", etc.              |
| `sourceUrl`            | String   | nullable                 | URL of the public source for this record    |
| `verified`             | Boolean  | NOT NULL, default FALSE  | Data verification status per Constitution I |
| `createdAt`            | DateTime | NOT NULL, default NOW    |                                             |
| `updatedAt`            | DateTime | NOT NULL, auto-update    |                                             |

**Relationships**: Belongs to one Court

**Validation Rules**:

- `slug` MUST be lowercase ASCII with hyphens
- `slug` max length: 100 characters
- Composite unique: `(courtId, slug)` — slugs unique within a court
- `fullName` cannot be empty string
- If `slug` collision within same `courtId`, disambiguate with numeric suffix ("john-smith-2")

---

## State Transitions

### Judge Verification Status

```
┌─────────────┐     manual review      ┌─────────────┐
│  UNVERIFIED │ ──────────────────────► │  VERIFIED   │
│ verified=F  │                         │ verified=T  │
└─────────────┘                         └─────────────┘
       ▲                                       │
       │          stale data detected          │
       └───────────────────────────────────────┘
```

- New records ingested via admin panel default to `verified = false`
- Manual verification sets `verified = true`
- Constitution I requires verification before publication; profile pages SHOULD display a visual indicator when `verified = false`
- Stale data (e.g., term expired) can be flagged back to `verified = false`

---

## Prisma Schema

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

model State {
  id           String   @id @default(uuid())
  name         String   @unique
  slug         String   @unique
  abbreviation String   @unique @db.VarChar(2)
  fipsCode     String?  @unique @db.VarChar(2)
  counties     County[]
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("states")
}

model County {
  id        String   @id @default(uuid())
  stateId   String
  state     State    @relation(fields: [stateId], references: [id], onDelete: Cascade)
  name      String
  slug      String
  fipsCode  String?  @unique @db.VarChar(5)
  courts    Court[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([stateId, slug])
  @@index([stateId])
  @@map("counties")
}

model Court {
  id        String   @id @default(uuid())
  countyId  String
  county    County   @relation(fields: [countyId], references: [id], onDelete: Cascade)
  type      String
  slug      String
  judges    Judge[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([countyId, slug])
  @@index([countyId])
  @@map("courts")
}

model Judge {
  id                    String    @id @default(uuid())
  courtId               String
  court                 Court     @relation(fields: [courtId], references: [id], onDelete: Cascade)
  fullName              String
  slug                  String
  termStart             DateTime?
  termEnd               DateTime?
  selectionMethod       String?
  appointingAuthority   String?
  education             String?   @db.Text
  priorExperience       String?   @db.Text
  politicalAffiliation  String?
  sourceUrl             String?
  verified              Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  @@unique([courtId, slug])
  @@index([courtId])
  @@index([fullName])
  @@map("judges")
}
```

---

## Indexes

| Table      | Index              | Type             | Purpose                     |
| ---------- | ------------------ | ---------------- | --------------------------- |
| `states`   | `slug`             | UNIQUE           | URL lookup by state slug    |
| `states`   | `name`             | UNIQUE           | Display/search dedup        |
| `counties` | `(stateId, slug)`  | UNIQUE COMPOSITE | URL lookup scoped to state  |
| `counties` | `stateId`          | INDEX            | FK join performance         |
| `courts`   | `(countyId, slug)` | UNIQUE COMPOSITE | URL lookup scoped to county |
| `courts`   | `countyId`         | INDEX            | FK join performance         |
| `judges`   | `(courtId, slug)`  | UNIQUE COMPOSITE | URL lookup scoped to court  |
| `judges`   | `courtId`          | INDEX            | FK join performance         |
| `judges`   | `fullName`         | INDEX            | Admin search by name        |

---

## Seed Data

### States (50)

Seeded from a static array of U.S. state names, abbreviations, and FIPS codes. Slugs auto-generated: "Texas" → "texas", "New York" → "new-york".

### Counties (~3,143)

Seeded from Census Bureau FIPS county codes dataset (publicly available CSV). Each county linked to its parent state by FIPS code. Slugs auto-generated from county name.

### Courts and Judges

NOT seeded in Phase 1. Court and judge records will be populated via the admin ingestion panel during Phase 2 (Data Ingestion).
