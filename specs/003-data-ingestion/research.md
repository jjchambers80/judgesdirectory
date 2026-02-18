# Technical Research: Phase 2 — Data Ingestion

**Feature Branch**: `003-data-ingestion`
**Date**: 2026-02-18
**Status**: Complete
**Context**: Next.js 14.2.35, App Router, TypeScript, Prisma 6.19.2, PostgreSQL

---

## Question 1: CSV Parsing Library Choice

### Decision: `papaparse`

### Rationale

| Criterion              | papaparse (5.5.3)                                                                                                                  | csv-parse (6.1.0)                                        | fast-csv (5.0.5)                                         |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------------------------------------- |
| **Unpacked size**      | 264 KB                                                                                                                             | 1.44 MB                                                  | 7 KB (meta-pkg, real deps ~200 KB via `@fast-csv/parse`) |
| **TypeScript types**   | Via `@types/papaparse` (5.5.2) — well-maintained DefinitelyTyped                                                                   | Built-in (`dist/esm/index.d.ts`)                         | Built-in (`./build/src/index.d.ts`)                      |
| **Streaming support**  | Yes — `Papa.parse(readableStream, { step })` for row-by-row processing                                                             | Yes — core design is Node stream Transform               | Yes — Node stream-based                                  |
| **Server-side use**    | Works in Node.js; originally browser-focused but has full Node support via `Papa.parse(string)` and file streams                   | Purpose-built for Node.js                                | Purpose-built for Node.js                                |
| **Error handling**     | Per-row error objects with row index, type, code, and message                                                                      | Error events on stream; `skip_records_with_error` option | Row-level validation callbacks; can continue or abort    |
| **Encoding detection** | Automatic encoding detection (including UTF-8, Windows-1252) via browser FileReader; in Node, expects UTF-8 or pre-decoded strings | No auto-detection; expects UTF-8 or specified encoding   | No auto-detection; expects UTF-8                         |
| **Header mapping**     | `header: true` auto-maps column headers to object keys                                                                             | `columns: true` maps headers to keys                     | `headers: true` maps headers to keys                     |
| **Last publish**       | 2025-05-19                                                                                                                         | 2025-07-16                                               | 2025-10-20                                               |
| **Popularity**         | ~2.5M weekly downloads (npm) — dominant market share                                                                               | ~1.8M weekly (part of csv toolkit)                       | ~800K weekly                                             |
| **API simplicity**     | Synchronous `Papa.parse(string, config)` — returns `{ data, errors, meta }` in one call                                            | Stream-oriented — requires piping or callback wiring     | Stream-oriented — requires piping or callback wiring     |

**Why papaparse wins for this project:**

1. **Simplest API for our use case.** We receive the entire CSV as a string from `FormData` (files ≤5 MB fit in memory). `Papa.parse(csvString, { header: true })` returns `{ data, errors, meta }` synchronously — no streams, no piping, no callbacks. One function call, done.
2. **Per-row error reporting built in.** The `errors` array contains `{ type, code, message, row }` for each parsing issue. This maps directly to the spec's requirement for row-level validation feedback (FR-004).
3. **Header detection is automatic.** `header: true` + `dynamicTyping: false` gives us an array of `Record<string, string>` objects keyed by CSV column headers — exactly what the column mapping UI needs.
4. **Encoding detection** is relevant for EC-002 (non-UTF-8 files from Excel). While server-side papaparse expects pre-decoded strings, the file's `text()` method in the browser handles encoding, and we can pre-validate with a BOM/encoding check server-side.
5. **Already chosen in the plan.** The implementation plan already specifies papaparse, so this validates that decision.
6. **1 new dependency** (+ 1 devDependency for types) aligns with Constitution Principle V (Simplicity).

### Alternatives Considered

- **csv-parse**: Superior streaming architecture, but overkill for ≤5 MB in-memory files. Stream wiring adds complexity with no benefit at this scale. Larger unpacked size (1.44 MB). Would be the choice if we needed to handle 100 MB+ files.
- **fast-csv**: Good TypeScript support and small core, but stream-only API means more boilerplate. Less battle-tested community. The meta-package pattern (`fast-csv` → `@fast-csv/parse` + `@fast-csv/format`) adds dependency indirection.
- **Manual parsing (no library)**: CSV has enough edge cases (quoted fields, embedded commas, escaped quotes, newlines in fields) that hand-rolling is a liability. Not recommended.

---

## Question 2: File Upload in Next.js App Router

### Decision: Use the native Web `FormData` API — no external library needed

### Findings

**Does Next.js App Router support `multipart/form-data` natively?**
Yes. App Router route handlers use the Web standard `Request`/`Response` API. The `request.formData()` method natively parses `multipart/form-data` request bodies, including file uploads. No `formidable`, `multer`, or `busboy` needed.

**Recommended pattern for receiving a file in `route.ts`:**

```typescript
// src/app/api/admin/import/route.ts
export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  // File is a Web API File object (extends Blob)
  const csvText = await file.text(); // Read entire file as string
  // csvText is now a string ready for Papa.parse()
}
```

**File size limits:**

| Context                                    | Default Limit                                                                                          | Configuration                                                                                                                     |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **App Router route handlers** (Next.js 14) | **1 MB** for `request.json()` / `request.text()`                                                       | No built-in per-route config in App Router (unlike Pages Router's `export const config = { api: { bodyParser: { sizeLimit } } }`) |
| **App Router `request.formData()`**        | Limited by server memory; Next.js does not impose a hard cap on FormData beyond the underlying runtime | Manual size check on the `File` object after parsing                                                                              |
| **Pages Router API routes**                | 1 MB (bodyParser)                                                                                      | `export const config = { api: { bodyParser: { sizeLimit: '5mb' } } }`                                                             |
| **Vercel serverless**                      | 4.5 MB request body                                                                                    | Platform limit, not configurable                                                                                                  |
| **Node.js runtime**                        | No inherent limit                                                                                      | OS memory                                                                                                                         |

**For our 5 MB limit (FR-001):**

- App Router + `request.formData()` will accept the 5 MB file without special configuration when running on Node.js.
- Enforce the 5 MB limit **in application code** by checking `file.size` before processing:

```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
if (file.size > MAX_FILE_SIZE) {
  return NextResponse.json(
    { error: "File exceeds 5 MB limit" },
    { status: 413 },
  );
}
```

- If deploying to Vercel, the 4.5 MB platform limit is close to our 5 MB app limit — may need to set the body size to 4.5 MB or switch to a streaming upload approach for Vercel. For the current self-hosted/single-server deployment, this is a non-issue.

### Alternatives Considered

- **`formidable` / `multer`**: These are Express/Connect middleware libraries for the Pages Router (`req`/`res` API). They do NOT work with App Router route handlers (which use the Web `Request` API). Not applicable.
- **`busboy`**: Lower-level streaming multipart parser. Would work but is unnecessary — `request.formData()` handles this natively.
- **Client-side file reading + JSON POST**: Read the file as text on the client, send as JSON body. Works but adds client-side complexity and doubles memory usage (file + JSON-encoded string). The `FormData` approach is cleaner and is the idiomatic pattern.

---

## Question 3: Sequential Import Lock (FR-019)

### Decision: In-memory lock (simple `Promise`-based mutex)

### Rationale

**Requirements recap**: Only one CSV import may execute at a time (FR-019). Single-server deployment. Admin team of 1–3 users.

**Comparison:**

| Approach                                        | Survives restart?                 | Complexity                              | Dependencies                              |
| ----------------------------------------------- | --------------------------------- | --------------------------------------- | ----------------------------------------- |
| **In-memory mutex**                             | No                                | Minimal — ~15 lines of code             | None                                      |
| **Database advisory lock** (`pg_advisory_lock`) | Yes (lock released on disconnect) | Medium — raw SQL needed                 | None (uses existing Prisma `$executeRaw`) |
| **Database row lock** (lock table with status)  | Yes                               | Medium — need migration + cleanup logic | None                                      |
| **File-based lock** (lockfile on disk)          | Yes                               | Medium — need stale lock cleanup        | `proper-lockfile` or manual               |
| **Redis lock**                                  | Yes                               | High — new infrastructure               | Redis server                              |

**Why in-memory wins:**

1. **Simplest possible implementation.** A module-level `Promise` chain or boolean flag in `src/lib/import-lock.ts` is ~15 lines. No migrations, no new tables, no external dependencies.
2. **Restart is a non-issue.** If the server restarts mid-import, the import was interrupted anyway — a lock surviving the restart would be a stale lock that needs cleanup. The in-memory approach self-heals on restart.
3. **Sufficient for scale.** 1–3 admin users, single server, sequential imports. This is not a distributed system problem.
4. **The spec already describes this pattern.** FR-019 says "subsequent uploads MUST wait or display a clear 'import in progress' message." An in-memory lock + a GET `/api/admin/import/status` endpoint checking the lock state satisfies both behaviors.

**Implementation pattern:**

```typescript
// src/lib/import-lock.ts
let currentImport: Promise<void> | null = null;

export function isImportRunning(): boolean {
  return currentImport !== null;
}

export async function withImportLock<T>(fn: () => Promise<T>): Promise<T> {
  if (currentImport) {
    throw new Error("Import already in progress");
  }
  let resolve: () => void;
  currentImport = new Promise<void>((r) => {
    resolve = r;
  });
  try {
    return await fn();
  } finally {
    currentImport = null;
    resolve!();
  }
}
```

### Alternatives Considered

- **Database advisory lock (`pg_advisory_lock`)**: Overkill for single-server. Adds raw SQL complexity. Risk of orphaned locks if the connection drops without releasing. Would be the right choice for multi-server deployment.
- **Database row lock (ImportBatch status check)**: Could check if any `ImportBatch` has status `processing`. Reasonable, but ties lock logic to domain model, and requires careful cleanup if the process crashes mid-import. A pragmatic fallback if we later find the in-memory lock insufficient.
- **File-based lock**: Stale lock files are an operational hazard. Not worth the complexity for this use case.

---

## Question 4: Bulk Insert Performance with Prisma

### Decision: Use Prisma `createMany` with `skipDuplicates` for judge records. Use a separate `createMany` step first for auto-created courts. Consider raw SQL only if the 30-second target is not met.

### Findings

**Does Prisma support `createMany`?**
Yes. Available since Prisma 2.16.0. Fully supported on PostgreSQL in Prisma 6.19.2.

**Key characteristics:**

| Feature              | `createMany`                                                                    | `createManyAndReturn`                             |
| -------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Returns**          | `{ count: number }` — only the count of created records                         | Full array of created record objects              |
| **`skipDuplicates`** | ✅ Supported (PostgreSQL) — silently skips rows that violate unique constraints | ✅ Supported                                      |
| **Nested relations** | ❌ Not supported — cannot create related records in a single `createMany` call  | ❌ Not supported                                  |
| **PostgreSQL**       | ✅                                                                              | ✅                                                |
| **Generated SQL**    | Single `INSERT INTO ... VALUES (...), (...), (...)` statement                   | `INSERT INTO ... VALUES (...), (...) RETURNING *` |
| **Transaction**      | Automatically wrapped in a transaction                                          | Automatically wrapped in a transaction            |

**Can `createMany` return the created records?**
No, `createMany` returns only `{ count }`. Use `createManyAndReturn` (available in Prisma 5.14.0+, supported in 6.19.2) if you need the created records back. For our batch import, we primarily need the count for the `ImportBatch` summary, so `createMany` suffices.

**Performance for 5,000 rows:**

- `createMany` generates a single `INSERT` statement with 5,000 value tuples. PostgreSQL handles this efficiently — typically **1–3 seconds** for 5,000 rows with simple columns and a few indexes.
- With `skipDuplicates: true`, Prisma adds `ON CONFLICT DO NOTHING` to the generated SQL. Minimal performance overhead.
- **Well within the 30-second target** (FR-017). The bottleneck will be CSV parsing + validation + court auto-creation, not the bulk insert itself.

**`createMany` vs raw SQL `INSERT ... ON CONFLICT`:**

| Approach                                            | Pros                                                                                | Cons                                                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **`createMany` + `skipDuplicates`**                 | Type-safe, clean API, auto-generates SQL, handles `ON CONFLICT DO NOTHING`          | No custom `ON CONFLICT ... DO UPDATE` (upsert behavior); `skipDuplicates` only skips, never updates |
| **Raw `$executeRaw` with `INSERT ... ON CONFLICT`** | Full control over conflict behavior (skip, update, return); can batch arbitrary SQL | No type safety, manual SQL construction, harder to maintain                                         |

**Recommendation:** Start with `createMany({ skipDuplicates: true })`. The spec says duplicates should be _skipped_ (not updated) — FR-007: "the duplicate record is skipped and reported." This is exactly what `skipDuplicates` does. No need for raw SQL unless requirements change to require upsert behavior.

**Handling "auto-create courts" alongside bulk judge creation:**

Courts must exist before judges can be inserted (foreign key constraint: `Judge.courtId → Court.id`). Strategy:

1. **Phase 1 — Collect unique courts needed.** Parse the CSV, extract unique `(countyName, stateName, courtType)` tuples.
2. **Phase 2 — Resolve/create courts.** For each unique tuple:
   - Look up the state and county by name (case-insensitive).
   - Check if the court already exists for that county + type.
   - If not, create it.
   - Build a lookup map: `"stateName|countyName|courtType" → courtId`.
3. **Phase 3 — Bulk insert judges.** Map each CSV row to a judge record using the court lookup map. Call `createMany({ data: judgeRecords, skipDuplicates: true })`.

This can be wrapped in a Prisma interactive transaction (`prisma.$transaction(async (tx) => { ... })`) to ensure atomicity — if judge insertion fails, the auto-created courts are also rolled back.

**Court creation volume estimate:** For a typical CSV of one state with ~50 counties and 3 court types, that's ≤150 courts. Individual `upsert` calls or a `createMany` with `skipDuplicates` for courts is fast enough (sub-second).

### Alternatives Considered

- **Individual `create` calls in a loop**: 5,000 separate INSERT statements. ~10–30 seconds. Too slow and generates excessive database round-trips.
- **`Promise.all` with individual creates**: Parallelizes but still 5,000 queries. Higher connection pool pressure. Not recommended.
- **Raw SQL batch insert**: Would work and be marginally faster, but sacrifices type safety for negligible gain. Reserve as fallback.
- **Chunked `createMany` (e.g., 1,000 at a time)**: If PostgreSQL chokes on a single 5,000-row INSERT (unlikely for our column count), chunk into batches of 1,000. Keep as fallback strategy.

---

## Question 5: Duplicate Detection Strategy

### Decision: Pre-fetch existing judges for relevant courts and check in-memory

### Rationale

**Duplicate definition** (from spec clarifications): Same `fullName` + same `courtId`.

**Option A: Pre-fetch + in-memory check**

1. After resolving courts (Question 4, Phase 2), collect all `courtId` values referenced by the CSV.
2. Query: `prisma.judge.findMany({ where: { courtId: { in: courtIds } }, select: { fullName: true, courtId: true } })`.
3. Build a `Set<string>` of `"fullName|courtId"` composite keys.
4. Filter CSV rows: skip any row whose composite key exists in the Set.
5. Report skipped count in the import summary.

**Performance analysis:**

- For 3 pilot states with ~500 counties × 3 court types = ~1,500 courts max. Even if all courts have existing judges, fetching `fullName + courtId` for all judges in those courts is a lightweight query (just two columns, no joins).
- At pilot scale (≤1,500 existing judges), this query returns in **<100ms**.
- The in-memory Set lookup is O(1) per row × 5,000 rows = negligible.
- **Total: well under 1 second** for the entire deduplication step.

**Option B: Database unique constraint + catch errors**

The schema already has `@@unique([courtId, slug])` on Judge, not `@@unique([courtId, fullName])`. Options:

- Add a composite unique constraint `@@unique([courtId, fullName])` and use `createMany({ skipDuplicates: true })`.
- This is cleaner at the database level but has a downside: `skipDuplicates` silently drops duplicates, so we **cannot report the exact count of skipped duplicates** back to the user without additional logic.

**Why Option A wins:**

1. **Reporting requirement.** FR-007: "the duplicate record is skipped **and reported** in the import summary." We need to know _which_ rows were duplicates, not just that some were silently dropped. Pre-fetch + in-memory check lets us tag each row as "duplicate" before insertion and include those rows in the preview/summary.
2. **Also check within the CSV itself.** A CSV might contain internal duplicates (same judge listed twice). The in-memory Set naturally catches these as well — after adding the first occurrence, the second is flagged as a duplicate.
3. **No schema change required.** Avoids adding a database constraint that might conflict with legitimate cases (e.g., two judges with the same name at the same court — rare but theoretically possible at larger scale). The duplicate check is an import-time business rule, not a database invariant.
4. **Performance is excellent.** Sub-second even at full pilot scale.

**However**, we should still use `createMany({ skipDuplicates: true })` as a safety net on the `[courtId, slug]` constraint. If two judges have names that slugify identically, the database constraint prevents a hard error. Belt and suspenders.

### Alternatives Considered

- **Database unique constraint on `[courtId, fullName]` + `skipDuplicates`**: Simpler code but cannot report duplicate details to the user. Would require a post-insert diff query to count duplicates. Also permanently constrains the data model — may be incorrect at larger scale.
- **Row-by-row `upsert` / `findOrCreate`**: 5,000 individual queries. Too slow. Defeats the purpose of bulk insert.
- **Hash-based approach**: Same as pre-fetch but using a hash of `fullName + courtId` instead of the raw string. Marginally more memory-efficient but adds complexity for no real benefit at this scale.

---

## Summary of Decisions

| #   | Question               | Decision                                           | Key Reason                                                                                                                             |
| --- | ---------------------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | CSV parsing library    | **papaparse**                                      | Simplest API for in-memory parsing; synchronous `parse()` returns `{ data, errors, meta }`; auto header mapping; dominant market share |
| 2   | File upload approach   | **Native `request.formData()`**                    | Built into App Router; no external library needed; check `file.size` in code for 5 MB limit                                            |
| 3   | Sequential import lock | **In-memory Promise-based mutex**                  | ~15 lines of code; self-heals on restart; sufficient for single-server / 1–3 admins                                                    |
| 4   | Bulk insert method     | **Prisma `createMany` + `skipDuplicates`**         | Single INSERT statement; 1–3 seconds for 5K rows; type-safe; auto-create courts first in transaction                                   |
| 5   | Duplicate detection    | **Pre-fetch existing judges, check in-memory Set** | Enables reporting _which_ rows are duplicates (FR-007); catches intra-CSV duplicates; sub-second performance                           |

### Dependencies to Install

| Package            | Version | Purpose                | Type              |
| ------------------ | ------- | ---------------------- | ----------------- |
| `papaparse`        | ^5.5.3  | CSV parsing            | `dependencies`    |
| `@types/papaparse` | ^5.5.2  | TypeScript definitions | `devDependencies` |

No other new dependencies required. All other solutions use built-in Next.js/Prisma/Node.js APIs.
