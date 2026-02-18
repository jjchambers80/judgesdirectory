# Phase 0 Research: Next.js 14 App Router — SEO Architecture Patterns

**Branch**: `001-foundation` | **Date**: 2026-02-17  
**Scope**: Technical patterns for Next.js 14 App Router on Vercel with SSR, Prisma, and programmatic SEO

---

## 1. Dynamic Routes: Nested Folders vs. Catch-All Segments

### Decision: Use nested folder segments (recommended)

The URL hierarchy `/judges/[state]/[county]/[courtType]/[judgeSlug]` maps directly to a nested folder structure in the App Router.

### Pattern: Nested Folder Segments

```
src/app/judges/
├── page.tsx                                  # /judges
├── [state]/
│   ├── page.tsx                              # /judges/:state
│   └── [county]/
│       ├── page.tsx                          # /judges/:state/:county
│       └── [courtType]/
│           ├── page.tsx                      # /judges/:state/:county/:courtType
│           └── [judgeSlug]/
│               └── page.tsx                  # /judges/:state/:county/:courtType/:judgeSlug
```

Each `page.tsx` receives typed `params` as a **Promise** (Next.js 15 pattern, also applies to late Next.js 14):

```typescript
// src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx
type Props = {
  params: Promise<{
    state: string;
    county: string;
    courtType: string;
    judgeSlug: string;
  }>;
};
```

### Alternative: Catch-All Route `[...slug]`

```
src/app/judges/[...slug]/page.tsx
```

- `params.slug` would be `string[]` — e.g., `['texas', 'harris-county', 'district-court', 'john-smith']`
- You'd need to manually parse the array to determine which "level" you're at
- Loses per-level `layout.tsx`, `loading.tsx`, `error.tsx` boundaries
- Loses per-level `generateMetadata` and `generateStaticParams`

### Tradeoffs

| Factor                        | Nested Folders                                | Catch-All `[...slug]`                             |
| ----------------------------- | --------------------------------------------- | ------------------------------------------------- |
| Type safety                   | Each level gets typed params                  | Manual array parsing                              |
| Per-level layouts             | ✅ Native `layout.tsx` at each depth          | ❌ Single layout, manual branching                |
| Per-level metadata            | ✅ Each `page.tsx` exports `generateMetadata` | ❌ Single function with conditional logic         |
| Per-level loading/error       | ✅ Granular Suspense boundaries               | ❌ One boundary for all depths                    |
| `generateStaticParams`        | ✅ Cascading — parent params flow to children | ❌ Must generate all combinations in one function |
| Code organization             | Clear separation of concerns                  | All logic in one file                             |
| Boilerplate                   | More files (5 `page.tsx` files)               | Less files but more conditional logic             |
| Flexibility for unknown depth | ❌ Fixed to known depth                       | ✅ Arbitrary depth                                |

### Verdict

**Nested folders**. The hierarchy is fixed at 5 levels, every level needs distinct metadata templates, distinct JSON-LD shapes, and distinct data-fetching logic. Catch-all provides no benefit and removes framework features we need.

---

## 2. Dynamic Sitemap Generation

### API: `src/app/sitemap.ts`

Next.js App Router has first-class sitemap support. Export a default function from `app/sitemap.ts` and it serves `/sitemap.xml` automatically.

### Basic Pattern

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from "next";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const states = await db.state.findMany();
  const judges = await db.judge.findMany({
    include: { court: { include: { county: { include: { state: true } } } } },
  });

  return [
    {
      url: "https://judgesdirectory.org/judges",
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
    ...states.map((s) => ({
      url: `https://judgesdirectory.org/judges/${s.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.9,
    })),
    // ... counties, courts, judges
  ];
}
```

### Return Type: `MetadataRoute.Sitemap`

Each entry is:

```typescript
{
  url: string
  lastModified?: string | Date
  changeFrequency?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never'
  priority?: number        // 0.0 to 1.0
  alternates?: { languages?: Record<string, string> }
  images?: string[]
}
```

### Sitemap Index for >50,000 URLs: `generateSitemaps()`

When the URL count exceeds 50,000, export a `generateSitemaps()` function alongside the default `sitemap()`. This produces a **sitemap index** that references multiple sitemap files.

```typescript
// src/app/sitemap.ts
import type { MetadataRoute } from "next";

export async function generateSitemaps() {
  // Return array of { id } objects — each becomes /sitemap/{id}.xml
  const totalJudges = await db.judge.count();
  const chunks = Math.ceil(totalJudges / 50000);
  return Array.from({ length: chunks }, (_, i) => ({ id: i }));
}

export default async function sitemap(props: {
  id: Promise<string>;
}): Promise<MetadataRoute.Sitemap> {
  const id = await props.id;
  const start = Number(id) * 50000;
  const end = start + 50000;

  const judges = await db.judge.findMany({
    skip: start,
    take: 50000,
    include: { court: { include: { county: { include: { state: true } } } } },
  });

  return judges.map((j) => ({
    url: `https://judgesdirectory.org/judges/${j.court.county.state.slug}/${j.court.county.slug}/${j.court.slug}/${j.slug}`,
    lastModified: j.updatedAt,
  }));
}
```

**Generated URLs**: `/sitemap/0.xml`, `/sitemap/1.xml`, etc., with an auto-generated sitemap index at `/sitemap.xml`.

### Key Details

- The function runs at **request time** (dynamic by default) — no manual rebuild needed
- To cache: use `export const revalidate = 3600` (ISR) at the top of the file
- No third-party package (like `next-sitemap`) is needed — this is built into Next.js
- The `robots.txt` should reference `/sitemap.xml` — can also be generated via `app/robots.ts`

---

## 3. Metadata API for SEO

### API: `generateMetadata` function + static `metadata` export

Every `page.tsx` or `layout.tsx` in App Router can export either:

1. **Static metadata** — `export const metadata: Metadata = { ... }`
2. **Dynamic metadata** — `export async function generateMetadata({ params }): Promise<Metadata>`

### Dynamic Metadata Pattern for Parameterized Routes

```typescript
// src/app/judges/[state]/[county]/page.tsx
import type { Metadata, ResolvingMetadata } from "next";

type Props = {
  params: Promise<{ state: string; county: string }>;
};

export async function generateMetadata(
  { params }: Props,
  parent: ResolvingMetadata,
): Promise<Metadata> {
  const { state, county } = await params;
  const countyData = await getCounty(state, county);

  if (!countyData) return { title: "Not Found" };

  const title = `Judges in ${countyData.name}, ${countyData.state.name} — judgesdirectory.org`;
  const description = `Browse all court types and judges in ${countyData.name}, ${countyData.state.name}.`;
  const canonicalUrl = `https://judgesdirectory.org/judges/${state}/${county}`;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      siteName: "judgesdirectory.org",
      type: "website",
    },
  };
}
```

### Key Metadata Fields

| Field                  | Renders As                                            |
| ---------------------- | ----------------------------------------------------- |
| `title`                | `<title>`                                             |
| `description`          | `<meta name="description">`                           |
| `alternates.canonical` | `<link rel="canonical" href="...">`                   |
| `openGraph.*`          | `<meta property="og:*">`                              |
| `robots`               | `<meta name="robots">`                                |
| `keywords`             | `<meta name="keywords">` (low SEO value but harmless) |

### Title Templates

Use `title.template` in the root layout to apply a site-wide suffix:

```typescript
// src/app/layout.tsx
export const metadata: Metadata = {
  title: {
    template: "%s — judgesdirectory.org",
    default: "U.S. Judges Directory — judgesdirectory.org",
  },
};
```

Then child pages can set just `title: 'Judges in Texas'` and it renders as `Judges in Texas — judgesdirectory.org`.

### Metadata Merging Behavior

- Metadata is **merged** from root layout → nested layouts → page
- Deeper levels override shallower ones for the same key
- `generateMetadata` awaits parent metadata via the `parent` parameter if needed

---

## 4. Schema.org JSON-LD

### Recommended Approach: `<script type="application/ld+json">` in Server Components

Next.js official docs recommend rendering JSON-LD directly in the page component using a `<script>` tag with `dangerouslySetInnerHTML`. This is the canonical pattern — no `next/head` needed in App Router.

### Pattern

```typescript
// In any page.tsx (Server Component)
export default async function JudgeProfilePage({ params }: Props) {
  const { state, county, courtType, judgeSlug } = await params
  const judge = await getJudge(state, county, courtType, judgeSlug)

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: judge.fullName,
    jobTitle: `Judge, ${judge.court.name}`,
    worksFor: {
      '@type': 'Organization',
      name: judge.court.name,
    },
    description: `${judge.fullName} serves as a judge at ${judge.court.name} in ${judge.court.county.name}, ${judge.court.county.state.name}.`,
  }

  return (
    <section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c'),
        }}
      />
      {/* ... page content */}
    </section>
  )
}
```

### XSS Sanitization

The `.replace(/</g, '\\u003c')` prevents script injection if any field contains `</script>`. This is the pattern from the Next.js docs.

### Reusable Component Pattern

```typescript
// src/components/seo/JsonLd.tsx
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, '\\u003c'),
      }}
    />
  )
}
```

### JSON-LD Shapes by Page Level

| Page                       | Schema.org Type | Key Properties                                                |
| -------------------------- | --------------- | ------------------------------------------------------------- |
| `/judges` (states grid)    | `ItemList`      | `itemListElement` → array of `ListItem` with state names/URLs |
| `/judges/[state]`          | `ItemList`      | `itemListElement` → counties                                  |
| `/judges/[state]/[county]` | `ItemList`      | `itemListElement` → court types                               |
| `/judges/.../[courtType]`  | `ItemList`      | `itemListElement` → judge names/URLs                          |
| `/judges/.../[judgeSlug]`  | `Person`        | `name`, `jobTitle`, `worksFor`, `description`                 |

### Type Safety (Optional)

The `schema-dts` npm package provides TypeScript types for all Schema.org entities:

```typescript
import type { Person, WithContext } from 'schema-dts'
const jsonLd: WithContext<Person> = { '@context': 'https://schema.org', '@type': 'Person', ... }
```

### What NOT to Use

- ~~`next/head`~~ — Pages Router only; does not work in App Router
- ~~`@next/third-parties`~~ — for analytics (GA, GTM), not for JSON-LD
- ~~Helmet or react-helmet~~ — Client Components only; not SSR-first

---

## 5. Middleware for URL Normalization

### File: `src/middleware.ts` (project root or `src/` root)

Next.js middleware runs on the **Edge Runtime** before every matched request. It can redirect, rewrite, or modify headers.

### Pattern: Trailing Slash + Lowercase Redirect

```typescript
// src/middleware.ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip internal paths
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") // static files (favicon.ico, etc.)
  ) {
    return NextResponse.next();
  }

  let normalized = pathname;

  // Strip trailing slash (except root "/")
  if (normalized.length > 1 && normalized.endsWith("/")) {
    normalized = normalized.slice(0, -1);
  }

  // Lowercase
  const lowercased = normalized.toLowerCase();

  // Redirect if different from original
  if (normalized !== pathname || lowercased !== normalized) {
    const url = request.nextUrl.clone();
    url.pathname = lowercased;
    return NextResponse.redirect(url, 308); // 308 = permanent redirect (preserves method)
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except _next, static files, api
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap).*)",
  ],
};
```

### Key Details

- **308 Permanent Redirect**: Preserves HTTP method (vs. 301 which can change POST→GET). Best for SEO canonicalization.
- **`config.matcher`**: Limits which paths trigger middleware. Use negative lookahead to skip static assets.
- **`next.config.js` `trailingSlash`**: Next.js has a built-in `trailingSlash: false` (default) config that handles this at the framework level. However, it does **not** handle case normalization. Middleware is needed for the lowercase redirect.
- **Combined approach**: Set `trailingSlash: false` in `next.config.js` (default, no-op) and use middleware only for case normalization. Or handle both in middleware for explicit control.
- **Edge Runtime**: Middleware runs on Vercel Edge Functions — fast, no cold starts, but limited to Edge-compatible APIs (no Node.js `fs`, etc.).

### Alternative: `next.config.js` Redirects

```javascript
// next.config.js — for simple cases, but can't do regex-based lowercase normalization
module.exports = {
  trailingSlash: false, // default
  async redirects() {
    return [
      // Can't dynamically lowercase — would need every permutation listed
    ];
  },
};
```

**Verdict**: Middleware is required for case normalization. `trailingSlash: false` handles slash removal natively, but middleware gives full control.

---

## 6. Prisma with Next.js on Vercel

### 6a. Singleton Pattern

Prevents connection pool exhaustion from hot-reload in development and multiple serverless function instances in production.

```typescript
// src/lib/db.ts
import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
};

const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
```

**Why**: In development, Next.js hot-reload creates new module instances but `global` persists. In production on Vercel, each serverless function invocation reuses the module-level `prisma` from the warm container.

### 6b. Prisma Generate in Vercel Builds

Add to `package.json`:

```json
{
  "scripts": {
    "postinstall": "prisma generate",
    "build": "next build"
  }
}
```

`postinstall` runs after `npm install` during the Vercel build step, ensuring the Prisma Client is generated from the latest schema before `next build` runs.

### 6c. Database Connection with Pooling

For serverless, a connection pooler sits between your functions and PostgreSQL to prevent connection exhaustion. Three main options:

#### Option A: Neon Serverless Driver (Recommended for Neon)

Neon provides a built-in connection pooler (via PgBouncer) on a separate pooler hostname.

```
# .env
DATABASE_URL="postgresql://user:pass@ep-xxx-pooler.us-east-2.aws.neon.tech/neondb?sslmode=require"
DIRECT_URL="postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

```prisma
// schema.prisma
datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")       // Pooled connection for runtime
  directUrl = env("DIRECT_URL")         // Direct connection for migrations
}
```

- `DATABASE_URL` uses the **pooler** endpoint (for serverless runtime queries)
- `DIRECT_URL` uses the **direct** endpoint (for `prisma migrate` and `prisma db push` CLI operations — these need a direct connection)

#### Option B: Prisma Accelerate

Prisma's managed proxy that provides connection pooling + global edge caching.

```typescript
import { PrismaClient } from "@prisma/client";
import { withAccelerate } from "@prisma/extension-accelerate";

const prisma = new PrismaClient().$extends(withAccelerate());
```

`DATABASE_URL` would be a `prisma://` URL from the Accelerate dashboard. Adds a separate paid service.

#### Option C: Supabase / Vercel Postgres (PgBouncer built-in)

Same dual-URL pattern as Neon:

```
DATABASE_URL="postgresql://...@...-pooler.supabase.com:6543/postgres?pgbouncer=true"
DIRECT_URL="postgresql://...@....supabase.com:5432/postgres"
```

### Recommendation for This Project

**Neon (Option A)**. Reasons:

- Free tier sufficient for MVP (0.5 GiB storage, autoscaling compute)
- Built-in pooler with no extra service/cost
- `directUrl` in Prisma schema natively supported
- Official Prisma + Vercel integration guides available
- Serverless-friendly: scales to zero when idle

### 6d. Prisma with PrismaPg Adapter (Prisma 6.x+)

For Prisma 6+, the recommended pattern uses the `@prisma/adapter-pg` driver adapter:

```typescript
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

export default prisma;
```

**Note**: For Prisma 5.x (as specified in plan.md), use the standard `PrismaClient()` without the adapter. The adapter pattern is for Prisma 6+. Stick with the simple singleton in Section 6a for Prisma 5.x.

---

## 7. Admin Route Protection

### Options Evaluated

| Approach                                        | Complexity | Security                                                    | MVP-Appropriate?                         |
| ----------------------------------------------- | ---------- | ----------------------------------------------------------- | ---------------------------------------- |
| **Middleware-based HTTP Basic Auth**            | Low        | Moderate (credentials in env vars, transmitted per-request) | ✅ Yes                                   |
| **Environment variable secret in admin layout** | Very Low   | Low (no browser auth prompt, manual token passing)          | ❌ Too fragile                           |
| **NextAuth.js with single provider**            | Medium     | High (session cookies, CSRF protection)                     | ❌ Overengineered for 1-2 internal users |

### Recommendation: Middleware-Based HTTP Basic Auth

Simplest approach that satisfies "authorized internal users only" (FR-017) for an internal-only admin panel with 1-2 users.

### Pattern

```typescript
// src/middleware.ts (extend the URL normalization middleware)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- Admin route protection ---
  if (pathname.startsWith("/admin")) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !isValidAuth(authHeader)) {
      return new NextResponse("Authentication required", {
        status: 401,
        headers: { "WWW-Authenticate": 'Basic realm="Admin"' },
      });
    }
  }

  // --- URL normalization (trailing slash, lowercase) ---
  // ... (see Section 5)

  return NextResponse.next();
}

function isValidAuth(authHeader: string): boolean {
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  const decoded = Buffer.from(encoded, "base64").toString();
  const [user, pass] = decoded.split(":");

  return (
    user === process.env.ADMIN_USERNAME && pass === process.env.ADMIN_PASSWORD
  );
}
```

### Environment Variables

```
# .env.local (gitignored)
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-random-password>
```

Set the same values in Vercel project settings → Environment Variables (production + preview).

### Key Details

- **Browser prompt**: The `WWW-Authenticate: Basic` header triggers the browser's native username/password dialog — no login page needed
- **`Buffer.from`**: Available in Edge Runtime (Vercel Edge) for base64 decoding
- **Scope**: Only `/admin` and `/admin/*` paths are protected; public pages are unaffected
- **Upgrade path**: Can be replaced with NextAuth.js or Clerk in Phase 3/4 if multi-user access is needed
- **HTTPS required**: Basic Auth sends credentials base64-encoded (not encrypted). Vercel enforces HTTPS on all deployments, so this is safe in practice.
- **No session/cookies**: Each request re-authenticates. Browsers cache Basic Auth credentials for the session, so users aren't re-prompted on every click.

### Alternative: Admin Layout Server-Side Check

If you prefer not to use middleware for auth (keeping middleware focused on URL normalization), you can check in the admin layout:

```typescript
// src/app/admin/layout.tsx
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const headersList = await headers()
  const auth = headersList.get('authorization')

  if (!auth || !isValidAuth(auth)) {
    // Return 401 — but note: layout can't set status codes directly.
    // Middleware is the correct place for this.
  }

  return <div className="admin-layout">{children}</div>
}
```

**Verdict**: Middleware is the right place. It runs before rendering, can set HTTP status codes, and cleanly separates auth from UI.

---

## Summary of Decisions

| Topic             | Decision                                                   | Key API / Pattern                                                       |
| ----------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| Routing           | Nested folder segments                                     | `[state]/[county]/[courtType]/[judgeSlug]` folders                      |
| Sitemap           | Built-in `app/sitemap.ts`                                  | `MetadataRoute.Sitemap`, `generateSitemaps()` for >50k URLs             |
| SEO Metadata      | `generateMetadata` per page                                | `Metadata` type, `alternates.canonical`, title templates                |
| JSON-LD           | `<script type="application/ld+json">` in Server Components | `dangerouslySetInnerHTML`, XSS sanitize with `replace(/</g, '\\u003c')` |
| URL Normalization | `middleware.ts`                                            | `NextResponse.redirect(url, 308)`, `config.matcher`                     |
| Prisma            | Singleton + `postinstall` generate                         | Global singleton, `DATABASE_URL` + `DIRECT_URL` dual-URL pattern        |
| Database          | Neon PostgreSQL with built-in pooler                       | Free tier, `directUrl` in schema.prisma                                 |
| Admin Auth        | Middleware HTTP Basic Auth                                 | `WWW-Authenticate: Basic`, env var credentials                          |
