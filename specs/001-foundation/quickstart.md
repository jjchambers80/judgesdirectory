# Quickstart: Phase 1 — Foundation

**Branch**: `001-foundation` | **Date**: 2026-02-17

---

## Prerequisites

- Node.js 20 LTS (`node -v` → `v20.x.x`)
- npm 10+ or pnpm 8+
- PostgreSQL 15+ (local install or managed: Neon recommended for Vercel)
- Git

---

## 1. Clone and Install

```bash
git clone <repo-url> judgesdirectory
cd judgesdirectory
git checkout 001-foundation
npm install
```

---

## 2. Environment Setup

Copy the environment template and fill in values:

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
# Database — use Neon pooled URL for runtime, direct for migrations
DATABASE_URL="postgresql://user:password@host:5432/judgesdirectory?sslmode=require"
DIRECT_URL="postgresql://user:password@host:5432/judgesdirectory?sslmode=require"

# Admin panel credentials
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<generate-a-strong-password>

# Site
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

For **Neon** (recommended):

1. Create a project at [neon.tech](https://neon.tech)
2. Copy the **pooled** connection string → `DATABASE_URL`
3. Copy the **direct** connection string → `DIRECT_URL`

---

## 3. Database Setup

```bash
# Generate Prisma Client from schema
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev --name init

# Seed states and counties
npx prisma db seed
```

Verify seed data:

```bash
npx prisma studio
```

Opens a browser UI to inspect the database. Expect:

- 50 rows in `states`
- ~3,143 rows in `counties`
- 0 rows in `courts` and `judges` (populated in Phase 2)

---

## 4. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000/judges](http://localhost:3000/judges) — you should see the states grid with 50 states.

---

## 5. Verify Key Routes

| URL                           | Expected                             |
| ----------------------------- | ------------------------------------ |
| `/judges`                     | Grid of 50 states                    |
| `/judges/texas`               | List of Texas counties               |
| `/judges/texas/harris-county` | Court types (empty until Phase 2)    |
| `/sitemap.xml`                | Valid XML with state/county URLs     |
| `/robots.txt`                 | Disallow `/admin`, sitemap reference |
| `/admin`                      | Browser login prompt (Basic Auth)    |

---

## 6. Verify SEO Compliance

For any page, view source and confirm:

- `<title>` follows the keyword template
- `<link rel="canonical" href="...">` is present
- `<script type="application/ld+json">` contains valid JSON-LD
- HTML is fully rendered (no client-side loading spinners)

Quick check with curl:

```bash
# Should return full HTML, not a JS bundle
curl -s http://localhost:3000/judges | head -50
```

---

## 7. Admin Panel

Navigate to [http://localhost:3000/admin](http://localhost:3000/admin).

The browser will prompt for Basic Auth credentials. Enter the values from `.env.local`.

To test judge creation:

1. Go to `/admin/judges/new`
2. Select a state → county → court (or create a court)
3. Fill in judge fields (minimum: full name + court)
4. Submit → verify success message
5. Navigate to the judge's public profile URL to confirm rendering

---

## 8. Run Tests

```bash
# All tests
npm test

# Specific test suite
npm test -- --testPathPattern=unit/lib/slugify
npm test -- --testPathPattern=integration/pages
```

---

## 9. Build and Preview Production

```bash
npm run build
npm start
```

Verify SSR works in production mode — same checks as step 5.

---

## 10. Deploy to Vercel

1. Connect repository to Vercel
2. Set environment variables in Vercel dashboard:
   - `DATABASE_URL` (pooled)
   - `DIRECT_URL` (direct — for build-time migrations)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD`
   - `NEXT_PUBLIC_SITE_URL` → `https://judgesdirectory.org`
3. Push to `main` → production deploys automatically
4. Open a PR → preview deployment URL generated

---

## Common Commands

| Command                  | Purpose                        |
| ------------------------ | ------------------------------ |
| `npm run dev`            | Start development server       |
| `npm run build`          | Production build               |
| `npm start`              | Serve production build locally |
| `npm test`               | Run test suite                 |
| `npx prisma studio`      | Database browser UI            |
| `npx prisma migrate dev` | Run pending migrations         |
| `npx prisma db seed`     | Seed states + counties         |
| `npx prisma generate`    | Regenerate Prisma Client       |

---

## Troubleshooting

| Issue                             | Fix                                                                |
| --------------------------------- | ------------------------------------------------------------------ |
| `PrismaClientInitializationError` | Check `DATABASE_URL` in `.env.local`; ensure PostgreSQL is running |
| Blank page on `/judges`           | Check `npm run build` for errors; verify SSR is not disabled       |
| 401 on `/admin`                   | Verify `ADMIN_USERNAME` / `ADMIN_PASSWORD` in `.env.local`         |
| Sitemap empty                     | Run `npx prisma db seed` to populate states/counties               |
| `Module not found: prisma`        | Run `npx prisma generate`                                          |
