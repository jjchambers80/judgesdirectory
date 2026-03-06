---
goal: JudgesDirectory Project Roadmap and Feature Status
version: 1.1
date_created: 2026-03-01
last_updated: 2026-03-05
owner: JudgesDirectory Team
status: "In progress"
tags: ["roadmap", "feature", "architecture", "migration"]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-In%20progress-yellow)

This document serves as the consolidated project roadmap for judgesdirectory.org — a programmatic SEO directory of U.S. judges. It tracks completed features, in-progress work, and planned future phases. Each feature references its spec-kit specification for detailed implementation requirements.

**Project Vision**: Build the authoritative, source-attributed, search-engine-optimized directory of judges in the United States.

**Current Milestone**: Multi-state expansion complete — 2,818 judges across CA (1,777), FL (944), TX (97). NY blocked by Cloudflare.

## 1. Requirements & Constraints

- **REQ-001**: All judge data must have source URL attribution (Constitution Principle I)
- **REQ-002**: Only verified judges appear on public pages (verification-first publishing)
- **REQ-003**: SEO-first architecture with SSR, JSON-LD, and sitemaps (Constitution Principle II)
- **SEC-001**: Admin panel protected by Basic Auth; no credentials in client bundles
- **CON-001**: PostgreSQL + Prisma ORM stack; Vercel deployment
- **CON-002**: No ratings, reviews, or editorial content (Constitution Principle III)
- **GUD-001**: Progressive launch — state-by-state expansion with quality gates
- **PAT-001**: Spec-kit workflow: spec.md → research.md → data-model.md → contracts/ → tasks.md

## 2. Implementation Steps

### Implementation Phase 1: Foundation (COMPLETED)

- GOAL-001: Build foundational infrastructure — Next.js app with 5-level URL hierarchy, SSR pages, Schema.org JSON-LD, XML sitemap, admin ingestion panel, and 50-state + 3,143-county seed data.

| Task     | Description                                                                      | Completed | Date       |
| -------- | -------------------------------------------------------------------------------- | --------- | ---------- |
| TASK-001 | Next.js 14 project setup with TypeScript, Prisma, and all dependencies           | ✅        | 2026-02-17 |
| TASK-002 | Prisma schema with State, County, Court, Judge models                            | ✅        | 2026-02-17 |
| TASK-003 | 50-state + 3,143-county seed data from Census FIPS                               | ✅        | 2026-02-17 |
| TASK-004 | Public pages: `/judges` → `[state]` → `[county]` → `[courtType]` → `[judgeSlug]` | ✅        | 2026-02-17 |
| TASK-005 | JSON-LD structured data (ItemList, Person schemas)                               | ✅        | 2026-02-17 |
| TASK-006 | XML sitemap with >50k URL splitting                                              | ✅        | 2026-02-17 |
| TASK-007 | Admin panel with Basic Auth, judge CRUD, verification toggle                     | ✅        | 2026-02-17 |
| TASK-008 | Vercel deployment with SSR and preview deployments                               | ✅        | 2026-02-17 |

**Spec Reference**: [specs/001-foundation/](../specs/001-foundation/)

---

### Implementation Phase 2: Theme Toggle (COMPLETED)

- GOAL-002: Add three-state (light/dark/system) theme toggle with CSS custom properties, localStorage persistence, and FOUC prevention.

| Task     | Description                                     | Completed | Date       |
| -------- | ----------------------------------------------- | --------- | ---------- |
| TASK-009 | CSS custom properties for light/dark themes     | ✅        | 2026-02-18 |
| TASK-010 | ThemeToggle client component with 3-state cycle | ✅        | 2026-02-18 |
| TASK-011 | Color migration across all public + admin pages | ✅        | 2026-02-18 |
| TASK-012 | FOUC prevention inline script                   | ✅        | 2026-02-18 |
| TASK-013 | Accessible icons with hover/focus states        | ✅        | 2026-02-18 |

**Spec Reference**: [specs/002-theme-toggle/](../specs/002-theme-toggle/)

---

### Implementation Phase 3: Data Ingestion Pipeline (COMPLETED)

- GOAL-003: Build bulk CSV import, verification workflow, court seeding, rollback capabilities, and ingestion dashboard to enable 1,500-judge pilot across 3 states.

| Task     | Description                                             | Completed | Date       |
| -------- | ------------------------------------------------------- | --------- | ---------- |
| TASK-014 | ImportBatch model and JudgeStatus enum migration        | ✅        | 2026-02-18 |
| TASK-015 | CSV upload + parse API with preview                     | ✅        | 2026-02-18 |
| TASK-016 | Column mapper and import confirmation flow              | ✅        | 2026-02-18 |
| TASK-017 | Sequential import lock (in-memory mutex)                | ✅        | 2026-02-18 |
| TASK-018 | Import rollback for unverified batches                  | ✅        | 2026-02-18 |
| TASK-019 | Verification queue with filter/pagination               | ✅        | 2026-02-18 |
| TASK-020 | Single + batch verify/reject actions                    | ✅        | 2026-02-18 |
| TASK-021 | Bulk court creation by state                            | ✅        | 2026-02-18 |
| TASK-022 | Ingestion progress dashboard with 1,500-target tracking | ✅        | 2026-02-18 |

**Spec Reference**: [specs/003-data-ingestion/](../specs/003-data-ingestion/)

---

### Implementation Phase 4: Florida Judge Harvest (COMPLETED)

- GOAL-004: CLI extraction tool that fetches Florida court pages, uses Claude AI to parse HTML into structured judge records, and produces import-ready CSV with deduplication and quality reporting.

| Task     | Description                                                           | Completed | Date       |
| -------- | --------------------------------------------------------------------- | --------- | ---------- |
| TASK-023 | CLI config with flags (--resume, --reset, --dry-run)                  | ✅        | 2026-02-28 |
| TASK-024 | Florida courts JSON (Supreme Court, 6 DCAs, 20 Circuits, 67 Counties) | ✅        | 2026-02-28 |
| TASK-025 | Name/court normalizer utilities                                       | ✅        | 2026-02-28 |
| TASK-026 | Court seeder for Florida structure                                    | ✅        | 2026-02-28 |
| TASK-027 | HTML fetcher with rate limiting + retries                             | ✅        | 2026-02-28 |
| TASK-028 | Claude AI extractor with Zod schemas                                  | ✅        | 2026-02-28 |
| TASK-029 | Checkpoint system for resumable extraction                            | ✅        | 2026-02-28 |
| TASK-030 | Cross-page deduplication                                              | ✅        | 2026-02-28 |
| TASK-031 | Quality report generation (Markdown)                                  | ✅        | 2026-02-28 |
| TASK-032 | CSV output compatible with import pipeline                            | ✅        | 2026-02-28 |

**Spec Reference**: [specs/004-florida-judge-harvest/](../specs/004-florida-judge-harvest/)

---

### Implementation Phase 5: State Expansion (COMPLETED)

- GOAL-005: Extend harvesting infrastructure to additional states, starting with high-value targets (Texas, California, New York) using the proven Florida pattern.

| Task     | Description                                            | Completed | Date       |
| -------- | ------------------------------------------------------ | --------- | ---------- |
| TASK-033 | Create state-agnostic harvester configuration schema   | ✅        | 2026-03-05 |
| TASK-034 | Texas court structure mapping + URL curation           | ✅        | 2026-03-05 |
| TASK-035 | California court structure mapping + URL curation      | ✅        | 2026-03-05 |
| TASK-036 | New York court structure mapping + URL curation        | ✅        | 2026-03-05 |
| TASK-037 | Multi-state CLI orchestration (--state flag)           | ✅        | 2026-03-05 |
| TASK-038 | State-specific extraction prompts for court variations | ✅        | 2026-03-05 |

**Spec Reference**: [specs/008-state-expansion/](../specs/008-state-expansion/)

**Results**: CA: 1,777 judges | FL: 944 judges | TX: 97 judges (appellate only) | NY: 0 (Cloudflare blocked — see [docs/research/new-york-cloudflare-block.md](../docs/research/new-york-cloudflare-block.md))

---

### Implementation Phase 6: Search & Discovery (PLANNED)

- GOAL-006: Add judge search functionality with autocomplete, filters by state/county/court type, and relevance ranking.

| Task     | Description                                     | Completed | Date |
| -------- | ----------------------------------------------- | --------- | ---- |
| TASK-039 | Search API with full-text query support         |           |      |
| TASK-040 | Autocomplete component with debounced input     |           |      |
| TASK-041 | Filter UI (state, county, court type dropdowns) |           |      |
| TASK-042 | Search results page with pagination             |           |      |
| TASK-043 | Search analytics tracking                       |           |      |

**Spec Reference**: Not yet created — requires `specs/006-search/`

---

### Implementation Phase 7: Monetization - Display Ads (PLANNED)

- GOAL-007: Integrate Google Ad Manager for conservative, trust-preserving display advertising on high-traffic pages.

| Task     | Description                                               | Completed | Date |
| -------- | --------------------------------------------------------- | --------- | ---- |
| TASK-044 | Google Ad Manager account setup and ad unit configuration |           |      |
| TASK-045 | Ad placement components (sidebar, in-content)             |           |      |
| TASK-046 | Ad density policy enforcement (max ads per page)          |           |      |
| TASK-047 | Revenue tracking dashboard                                |           |      |

**Spec Reference**: Not yet created — requires `specs/007-ads/`

---

### Implementation Phase 8: Monetization - Attorney Placements (PLANNED)

- GOAL-008: Enable sponsored attorney/firm placements on jurisdiction pages with clear "Sponsored" labeling and lead tracking.

| Task     | Description                                               | Completed | Date |
| -------- | --------------------------------------------------------- | --------- | ---- |
| TASK-048 | Placement schema (attorney, firm, jurisdiction targeting) |           |      |
| TASK-049 | Self-serve placement purchase flow                        |           |      |
| TASK-050 | Sponsored placement rendering component                   |           |      |
| TASK-051 | Click/impression tracking and reporting                   |           |      |
| TASK-052 | Disclaimers: "Sponsored — not an endorsement"             |           |      |

**Spec Reference**: Not yet created — requires `specs/008-attorney-placements/`

## 3. Alternatives

- **ALT-001**: Manual data entry vs. AI-assisted extraction — Rejected because manual cannot scale to 30,000+ judges; AI extraction with verification gate balances speed and accuracy.
- **ALT-002**: Nationwide launch vs. state-by-state — Rejected immediate nationwide because verification throughput is the bottleneck; state-by-state ensures quality.
- **ALT-003**: PostgreSQL + Prisma vs. serverless DB (PlanetScale, Turso) — Prisma chosen for ORM simplicity and migration workflow; can revisit at scale.
- **ALT-004**: Affiliate monetization vs. display ads — Display ads chosen as lowest-friction starting point; affiliate requires legal product partnerships that don't exist yet.

## 4. Dependencies

- **DEP-001**: Anthropic Claude API — Required for AI-assisted judge extraction (Phases 4+)
- **DEP-002**: Vercel hosting — SSR and preview deployments (all phases)
- **DEP-003**: PostgreSQL database (Neon/Supabase/Vercel Postgres) — All data persistence
- **DEP-004**: Google Ad Manager — Phase 7 monetization (not yet integrated)
- **DEP-005**: State court websites — Source data for harvesting; availability varies by state

## 5. Files

### Completed Feature Specs

- **FILE-001**: [specs/001-foundation/](../specs/001-foundation/) — Foundation phase spec-kit (plan, spec, research, data-model, contracts, tasks, quickstart)
- **FILE-002**: [specs/002-theme-toggle/](../specs/002-theme-toggle/) — Theme toggle spec-kit
- **FILE-003**: [specs/003-data-ingestion/](../specs/003-data-ingestion/) — Data ingestion spec-kit
- **FILE-004**: [specs/004-florida-judge-harvest/](../specs/004-florida-judge-harvest/) — Florida harvest spec-kit

### Key Implementation Files

- **FILE-005**: [scripts/harvest/](../scripts/harvest/) — CLI harvest tool (fetcher, extractor, normalizer, deduplicator, reporter)
- **FILE-006**: [scripts/import/](../scripts/import/) — Import CLI (csv-importer, court-resolver, quality-gate)
- **FILE-007**: [prisma/schema.prisma](../prisma/schema.prisma) — Database schema (State, County, Court, Judge, ImportBatch)

### Business Documentation

- **FILE-008**: [docs/business/](../docs/business/) — ICP, monetization hypotheses, directory strategy notes
- **FILE-009**: [docs/architecture/](../docs/architecture/) — Data harvesting pipeline, pillar pages vs programmatic SEO

## 6. Testing

- **TEST-001**: Manual verification of harvested data against source URLs (current approach per spec SC-002)
- **TEST-002**: Admin panel walkthrough per quickstart.md (CSV import → verify → dashboard)
- **TEST-003**: Lighthouse SEO score ≥90 on all public pages
- **TEST-004**: Build verification (`npm run build` passes without errors)
- **TEST-005**: Import performance: 5,000-row CSV completes within 30 seconds (FR-017)

**Note**: Automated test suite (Jest + React Testing Library) is not yet implemented. Testing is currently manual via admin panel and CLI validation.

## 7. Risks & Assumptions

- **RISK-001**: Court website changes may break extractors — Mitigation: checkpoint system allows resumable runs; extractors can be updated per state.
- **RISK-002**: Verification throughput bottleneck — 1 admin verifying 50 judges/day = 30 days for 1,500 judges. Batch verification and dashboard priority ordering help.
- **RISK-003**: AI extraction hallucinations — Mitigation: extraction prompts prohibit fabrication; all records enter as UNVERIFIED; manual review required.
- **RISK-004**: SEO competition from established legal directories — Mitigation: source attribution + verification provenance as differentiators; focus on long-tail location queries.
- **ASSUMPTION-001**: Florida court websites provide accurate, up-to-date rosters — validated during pilot.
- **ASSUMPTION-002**: Other states have similarly structured court websites — requires validation per state.
- **ASSUMPTION-003**: Display ads on judge pages are acceptable to legal traffic — test with conservative placements first.

## 8. Related Specifications / Further Reading

- [Constitution / Product Principles](../AGENTS.md) — Non-negotiable principles for data accuracy, SEO, legal safety
- [Data Harvesting Architecture](../docs/architecture/data-harvesting.md) — Pipeline design: fetch → extract → enrich → normalize → identity → dedupe
- [Pillar Pages vs Programmatic SEO](../docs/architecture/pillar-pages-vs-programmatic-seo.md) — Content strategy decision record
- [Directory Strategy Notes](../docs/business/directory-strategy-and-data-automation.md) — Programmatic SEO economics and automation playbook
- [ICP & Monetization](../docs/business/icp-and-monetization.md) — Customer profiles and revenue hypotheses

---

## Summary Dashboard

| Phase | Feature             | Status       | Spec                                                             |
| ----- | ------------------- | ------------ | ---------------------------------------------------------------- |
| 1     | Foundation          | ✅ Completed | [001-foundation](../specs/001-foundation/)                       |
| 2     | Theme Toggle        | ✅ Completed | [002-theme-toggle](../specs/002-theme-toggle/)                   |
| 3     | Data Ingestion      | ✅ Completed | [003-data-ingestion](../specs/003-data-ingestion/)               |
| 4     | Florida Harvest     | ✅ Completed | [004-florida-judge-harvest](../specs/004-florida-judge-harvest/) |
| 5     | State Expansion     | ✅ Completed | [008-state-expansion](../specs/008-state-expansion/)             |
| 6     | Search & Discovery  | 📋 Planned   | TBD                                                              |
| 7     | Display Ads         | 📋 Planned   | TBD                                                              |
| 8     | Attorney Placements | 📋 Planned   | TBD                                                              |

**Short Term (Now)**: Add search functionality to make 2,800+ judges discoverable; verify CA batch (1,769 NEEDS_REVIEW).

**Medium Term (Q2 2026)**: Resolve NY Cloudflare block; expand to 5 more states to reach 10,000+ judges.

**Long Term (Q3+ 2026)**: Enable monetization (ads, attorney placements), expand to nationwide coverage.
