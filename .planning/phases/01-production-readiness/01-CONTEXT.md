# Phase 1: Production Readiness - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a polished, performant, SEO-optimized, and legally compliant public site — ready to generate and monetize organic search traffic. It completes the shadcn/ui design system migration (006), instruments analytics, enables ISR caching, publishes legal pages, adds judge photos, and handles content quality gaps. No monetization widgets are added (Phase 2). No state expansion (Phase 3).

**27 requirements**: DSGN-01–05, ANLT-01–07, PERF-01–04, LEGL-01–04, CONT-01–03, PHOTO-01–04

</domain>

<decisions>
## Implementation Decisions

### Design System Migration
- **D-01:** Complete spec 006 incrementally — migrate page-by-page, testing mobile responsiveness at each step. The Tailwind v4 bridge layer (globals.css) mapping shadcn/ui tokens to existing CSS variables already works. Migration path: replace inline styles and raw HTML with shadcn components + Tailwind utilities, validate at 375px/768px/1280px breakpoints per spec 006 acceptance criteria.
- **D-02:** Extract breadcrumb navigation from inline implementation (judge profile page only) to a shared `<Breadcrumbs>` component used across all 5 public route templates with Schema.org BreadcrumbList JSON-LD.
- **D-03:** Create loading skeleton components (or `loading.tsx` route files) for all public routes to prevent CLS during data fetches. Currently only search has inline skeletons.

### Analytics & SEO
- **D-04:** Use Vercel Analytics + Speed Insights (cookie-free, zero GDPR banner). Install `@vercel/analytics` and `@vercel/speed-insights` packages. No Google Analytics — GSC configured separately via domain verification and sitemap submission.
- **D-05:** Add Open Graph and Twitter Card meta tags to all 5 public page templates via `generateMetadata()`. Extend existing `seo.ts` title helpers to return full metadata objects including OG/Twitter.
- **D-06:** Add BreadcrumbList JSON-LD to all listing pages (currently only ItemList and Person schemas exist). Validate all JSON-LD via Schema.org validator.
- **D-07:** Enforce canonical URLs with trailing slashes on all routes. Add 301 redirects for non-trailing-slash variants. Current state: canonical URLs already set on judge profiles.

### Performance & ISR
- **D-08:** Enable ISR via `revalidate` exports on all public routes — judge profiles revalidate daily (86400s), listing pages hourly (3600s). No ISR exists currently.
- **D-09:** Implement on-demand revalidation via API route using `revalidateTag`/`revalidatePath` triggered after harvest pipeline imports. Tag-based invalidation for granular control.
- **D-10:** Remove `unoptimized` flag from judge profile Image component. Use `next/image` with proper `width`/`height` props and lazy loading.

### Judge Photos
- **D-11:** Photo scraping pipeline extracts photos from official court bio pages during harvest (extend existing harvester). Store optimized images via sharp (WebP format, resized to profile dimensions ~300×360px) in Vercel Blob storage (free tier, CDN-served).
- **D-12:** Fallback avatar: keep existing JudgeSilhouette SVG component but add initials overlay when judge name is available. Use `next/image` with proper dimensions for actual photos.

### Legal Pages
- **D-13:** Create static React pages at /privacy, /terms, /about — no MDX or CMS needed. Simple JSX with prose content. The /about page explains data sources, methodology, and verification process.
- **D-14:** Existing footer disclaimer is complete and renders on all pages (SiteFooter.tsx). Verify it displays correctly post-migration.

### Content Quality
- **D-15:** Empty jurisdictions (0 verified judges) show "Coverage coming soon" message with links to parent jurisdiction and neighboring counties. Use `<aside>` with helpful navigation.
- **D-16:** Pages with <3 verified judges get `noindex` via `robots` metadata. ≥3 judges = indexable. This prevents thin content from diluting SEO quality.
- **D-17:** Enhance 404 page with navigation to existing jurisdictions (state list, search), not just a single link to /judges/.

### Agent's Discretion
- Font choices: Roboto already configured via next/font — keep it.
- Exact wording of legal pages: agent writes initial drafts following standard patterns; user reviews before launch.
- Specific sharp resize dimensions: agent determines based on current profile layout proportions (~300×360).
- ISR revalidation exact intervals: daily/hourly as specified, agent can adjust within reason if testing reveals issues.
- Loading skeleton visual design: match existing design system tokens, agent designs per shadcn/ui patterns.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Design System
- `specs/006-design-system-rebuild/spec.md` — Full user stories, acceptance criteria for mobile-first responsive + ADA compliance + design system class migration
- `specs/006-design-system-rebuild/plan.md` — Original implementation plan (may need updating)
- `specs/006-design-system-rebuild/tasks.md` — Task breakdown from original spec
- `specs/006-design-system-rebuild/checklists/requirements.md` — Checklist for verification
- `src/app/globals.css` — Tailwind v4 CSS-first config with shadcn/ui bridge layer
- `src/app/theme-vars.css` — CSS custom property definitions for light/dark themes
- `components.json` — shadcn/ui configuration

### SEO & Metadata
- `src/lib/seo.ts` — JSON-LD builders (ItemList, Person), title generators for all 5 templates
- `src/components/seo/JsonLd.tsx` — Server component for JSON-LD injection with XSS sanitization
- `src/app/sitemap.ts` — Dynamic sitemap generation with 50K URL split support
- `src/lib/constants.ts` — SITE_URL, SITE_NAME, TITLE_TEMPLATE constants

### Page Templates (all 5 public routes)
- `src/app/judges/page.tsx` — States grid / search landing
- `src/app/judges/[state]/page.tsx` — County list for a state
- `src/app/judges/[state]/[county]/page.tsx` — Court types in a county
- `src/app/judges/[state]/[county]/[courtType]/page.tsx` — Judge list for a court
- `src/app/judges/[state]/[county]/[courtType]/[judgeSlug]/page.tsx` — Individual judge profile

### Existing Components
- `src/components/SiteHeader.tsx` — Client component with search, theme toggle, scroll hide/show
- `src/components/SiteFooter.tsx` — Footer with copyright + legal disclaimer
- `src/components/ThemeToggle.tsx` — Light/dark/system theme switcher
- `src/components/search/` — SearchInput, SearchResults (with LoadingSkeleton), SearchFilters
- `src/components/ui/` — 18 shadcn/ui components (button, card, badge, table, input, select, dropdown-menu, checkbox, separator, progress, popover, tabs, pagination, data-table + 4 helpers)

### Layout
- `src/app/layout.tsx` — Root layout with Roboto font, skip-nav, Suspense header, max-w-[1400px] container
- `src/app/not-found.tsx` — Minimal 404 page (needs enhancement)

### Architecture References
- `.planning/research/ARCHITECTURE.md` — ISR caching strategy, Client Component monetization zones
- `.planning/research/STACK.md` — New deps needed (@vercel/analytics, @vercel/speed-insights, sharp)
- `.planning/research/PITFALLS.md` — CWV protection, thin content risks, mobile-first indexing
- `docs/architecture/pillar-pages-vs-programmatic-seo.md` — Content strategy architecture

### Data Model
- `prisma/schema.prisma` — State → County → Court → Judge hierarchy, Judge.photoUrl field, Judge.status (VERIFIED/UNVERIFIED)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **18 shadcn/ui components**: Full data-table suite (table, pagination, toolbar, filters, column-header, faceted-filter), card, badge, button, input, select, checkbox, dropdown-menu, separator, progress, popover, tabs — these are the building blocks for all migration work
- **seo.ts utilities**: Title generators for all 5 page types + JSON-LD builders for ItemList and Person schemas — extend these for OG/Twitter meta
- **JsonLd.tsx**: Production-ready JSON-LD injection with XSS sanitization — reuse for BreadcrumbList
- **sitemap.ts**: Complete dynamic sitemap with 50K split — already handles VERIFIED judge filtering
- **SiteFooter disclaimer**: Legal disclaimer already present on all pages via footer
- **JudgeSilhouette SVG**: Ready-made fallback for judge profiles without photos
- **SearchResults LoadingSkeleton**: Pattern for skeleton UI — extract and generalize

### Established Patterns
- **Tailwind v4 CSS-first with bridge layer**: `globals.css` maps shadcn/ui tokens → CSS variables. All new components MUST use semantic tokens (`text-foreground`, `bg-card`, etc.), not raw CSS variables
- **`data-theme` attribute for dark mode**: Custom variant `@custom-variant dark` in globals.css. Theme set via localStorage in inline script (layout.tsx head)
- **Server Components by default**: All public pages are async server components. Only SiteHeader and search components are client-side
- **`generateMetadata()` async functions**: Each public page exports metadata with canonical URLs. Extend, don't replace
- **VERIFIED-only public rendering**: All DB queries filter `status: "VERIFIED"` — maintain this everywhere
- **`cn()` utility**: Used for conditional class composition — standard for all component styling

### Integration Points
- **Harvest pipeline → ISR**: After harvest imports, trigger revalidation via API route. Pipeline code is in `scripts/harvest/`
- **Prisma queries in page components**: Direct `prisma.*.findMany()` calls in each page — add caching layer around these
- **next/image on judge profile**: Currently has `unoptimized` flag — remove and configure sharp in next.config
- **Root layout**: The single entry point for analytics script injection (Vercel Analytics + Speed Insights components go here)

</code_context>

<specifics>
## Specific Ideas

- All 5 public page templates need breadcrumbs (currently only judge profile has them inline)
- Judge profile uses `Image` with `unoptimized` — switching to optimized requires sharp in the build pipeline
- The 006 spec has very detailed acceptance criteria per page type at 3 breakpoints — use as test matrix
- Legal disclaimer in footer is well-written — legal pages (/privacy, /terms) should be consistent in tone
- Search component already has good Suspense patterns — replicate for other data-heavy pages
- Consider `loading.tsx` convention files for each route segment for automatic Suspense boundaries

</specifics>

<deferred>
## Deferred Ideas

- **Storybook setup** — mentioned in `docs/design/storybook-plan.md` but not needed for Phase 1 production readiness
- **Pillar pages** — deferred to v2 (CSTG-01). Phase 1 handles thin content with noindex, not with custom content
- **A/B testing** — explicitly out of scope per REQUIREMENTS (no traffic volume)
- **Coverage dashboard** — deferred to v2 (SCLE-03)
- **Email newsletter** — deferred to v2 (DIST-01)

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 01-production-readiness*
*Context gathered: 2026-03-22*
