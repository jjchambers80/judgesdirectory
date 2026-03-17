# judgesdirectory Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-02-17

## Active Technologies
- TypeScript 5.x / Next.js 14 App Router + None new — inline SVG icons, CSS custom properties, vanilla JS for localStorage (002-theme-toggle)
- Browser `localStorage` only (key: `theme`, values: `light` | `dark` | `system`) (002-theme-toggle)
- TypeScript 5.x on Node.js 20.18.0 + Next.js 14.2.35 (App Router), React 18, Prisma 6.19.2, papaparse (CSV parsing — new) (003-data-ingestion)
- PostgreSQL via Prisma ORM (`postgres@localhost:5432/judgesdirectory`) (003-data-ingestion)
- TypeScript 5.x on Node.js 20.18.0 + Next.js 14.2.35 (existing app), Anthropic SDK (new — Claude API), Prisma 6.19.2, papaparse 5.5.3 (004-florida-judge-harvest)
- PostgreSQL via Prisma ORM (existing — courts and judges imported via CSV pipeline); file system for CSV output, logs, and checkpoints (004-florida-judge-harvest)
- TypeScript (strict mode), Node.js 20+ + Zod (schema validation), Cheerio + Turndown (HTML→Markdown), PapaParse (CSV), Prisma (ORM), multi-provider LLM abstraction (OpenAI/Anthropic) (007-state-expansion)
- PostgreSQL via Prisma ORM (State→County→Court→Judge hierarchy); JSON config files on disk; CSV output files (007-state-expansion)
- TypeScript 5.x / Node.js 20.18.0 (strict mode) + Zod (validation), Cheerio (deterministic extraction), OpenAI gpt-4o-mini (LLM extraction), tsx (runtime) (008-state-expansion)
- PostgreSQL 16 via Prisma ORM — existing State → County → Court → Judge hierarchy; no schema migrations needed (008-state-expansion)
- TypeScript 5.x / Node.js 20.x + Next.js 14 (App Router), React 18, Prisma ORM, PostgreSQL (009-search-discovery)
- PostgreSQL with pg_trgm extension for fuzzy text search (009-search-discovery)
- TypeScript 5.x (Next.js 14+ App Router) + Next.js, Tailwind CSS, existing theme-vars.css custom properties (010-global-footer)
- N/A — pure UI component, no database interaction (010-global-footer)
- TypeScript 5, React 18, Next.js 14.2 + Next.js (SSR + client components), Prisma ORM, Tailwind CSS 4, Radix UI (no new dependencies) (011-lazy-load-results)
- PostgreSQL via Prisma (existing — no schema changes) (011-lazy-load-results)
- TypeScript (strict mode), Node.js 20+ + Next.js (SSR), Prisma ORM, Google Custom Search JSON API (`googleapis` npm package), OpenAI gpt-4o-mini (for classification), Zod (validation), cheerio/turndown (existing fetcher) (011-url-discovery-scrape-tracking)
- PostgreSQL via Prisma ORM (existing `judgesdirectory` database) (011-url-discovery-scrape-tracking)
- TypeScript (strict mode), Node.js + Next.js 14, Prisma ORM v6, Tailwind CSS, shadcn/ui (012-url-health)
- PostgreSQL (existing, via Prisma) (012-url-health)
- TypeScript (strict mode) on Next.js 14.2, React 18 + `@tanstack/react-table` (new), `radix-ui` (existing), `class-variance-authority` + `clsx` + `tailwind-merge` (existing), `lucide-react` (shadcn icon library) (013-admin-data-tables)
- PostgreSQL via Prisma ORM (existing — no schema changes) (013-admin-data-tables)
- TypeScript (Node.js runtime, strict mode) + Next.js 14, Prisma ORM, Zod, cheerio, @tanstack/react-table (014-auto-verification)

- TypeScript 5.x on Node.js 20 LTS + Next.js 14 (App Router, SSR), Prisma ORM 5.x, next-sitemap, slugify (001-foundation)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

TypeScript 5.x on Node.js 20 LTS: Follow standard conventions

## Recent Changes
- 014-auto-verification: Added TypeScript (Node.js runtime, strict mode) + Next.js 14, Prisma ORM, Zod, cheerio, @tanstack/react-table
- 013-admin-data-tables: Added TypeScript (strict mode) on Next.js 14.2, React 18 + `@tanstack/react-table` (new), `radix-ui` (existing), `class-variance-authority` + `clsx` + `tailwind-merge` (existing), `lucide-react` (shadcn icon library)
- 012-url-health: Added TypeScript (strict mode), Node.js + Next.js 14, Prisma ORM v6, Tailwind CSS, shadcn/ui


<!-- MANUAL ADDITIONS START -->

## Self-Improvement Workflow

When any of the following occur during a session, log a structured entry to the appropriate file in `skills/self-improving-agent/.learnings/`:

| Trigger | Log To |
|---------|--------|
| Command or operation fails unexpectedly | `.learnings/ERRORS.md` |
| User corrects you ("No, that's wrong…", "Actually…") | `.learnings/LEARNINGS.md` (category: `correction`) |
| User requests a capability that doesn't exist | `.learnings/FEATURE_REQUESTS.md` |
| API or external tool fails | `.learnings/ERRORS.md` |
| Knowledge is outdated or incorrect | `.learnings/LEARNINGS.md` (category: `knowledge_gap`) |
| A better approach is discovered | `.learnings/LEARNINGS.md` (category: `best_practice`) |

Before starting major tasks, review existing learnings for relevant context. See `skills/self-improving-agent/SKILL.md` for entry formats and promotion rules.

<!-- MANUAL ADDITIONS END -->
