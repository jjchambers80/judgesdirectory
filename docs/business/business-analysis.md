# judgesdirectory.org — Business Analysis

**Last Updated**: 2026-03-01
**Status**: Draft

## Executive Summary

JudgesDirectory is a programmatic SEO website that publishes structured judge directory pages (state → county → court type → judge profile) with strong crawlability (SSR), Schema.org JSON-LD, and sitemap coverage. The core business lever is **distribution via organic search** plus **monetization on high-intent legal traffic** (explicitly called out in the foundation spec as ads and attorney placements in later phases).

The main operational risk (and also the main moat) is **data quality**: the project’s constitution/specs require source attribution and manual verification before publication, and the repo already includes an AI-assisted harvesting pipeline to scale data ingestion while preserving human review.

## What the Product Is

### User-facing product (public)

- A hierarchical directory:
  - `/judges`
  - `/judges/{state}`
  - `/judges/{state}/{county}`
  - `/judges/{state}/{county}/{court-type}`
  - `/judges/{state}/{county}/{court-type}/{judge}`
- Judge profile pages with structured fields (term dates, selection method, education, experience, etc.)
- Strong SEO fundamentals:
  - Server-side rendering
  - Schema.org JSON-LD (`ItemList` for listings, `Person` for profiles)
  - XML sitemaps and canonicalization

### Internal product (ops/admin)

- Admin ingestion and verification workflow:
  - Bulk CSV import to create records as unverified
  - Verification queue to publish only after manual validation
  - Court seeding tools to enable structured imports
- Data harvesting tooling (Florida “production” pipeline) that performs:
  - Fetch → extract → enrich → normalize → deduplicate → output
  - Deterministic extraction for known site patterns (free)
  - LLM extraction fallback (OpenAI/Anthropic)
  - Identity-based deduplication and checkpoint/resume

## Core Value Proposition

### For visitors

- Quickly find “who is the judge” for a jurisdiction/court.
- Get a structured overview of a judge’s background (where available).
- Navigate easily via geographic hierarchy.

### For the business

- Capture long-tail, high-intent search queries (e.g., “{Judge Name} {County}”, “judges in {County} {State}”, “{Court Type} judges {County}”).
- Create a scalable content engine: every verified judge record creates multiple indexable pages across the hierarchy.

## Differentiation (What’s Distinctive Here)

Grounded in the repo’s specs and architecture:

1. **Verification-first publishing**
   - Only `verified = true` records appear publicly.
   - Every judge record requires a `sourceUrl` pointing to an official government source.

2. **Pipeline built for messy government web**
   - Built-in support for Next.js/Gatsby government sites via `__NEXT_DATA__` and `page-data.json` extraction.
   - Deterministic extractor reduces LLM costs and improves reliability.

3. **Structured data as a first-class feature**
   - The system is designed around Schema.org entities and sitemap coverage, not added later.

4. **Identity-based deduplication**
   - Stable IDs + confidence levels help merge duplicates across sources and pages.

## Customer / Stakeholder Map

Even though the site is consumer-facing, the “customer” depends on monetization path:

- **Primary users**: general public, litigants, journalists, students.
- **Monetization customers (likely)**:
  - Legal advertisers and legal marketing buyers (law firms, agencies)
  - Potentially legal research/tools partners (if an API or data product emerges)

## Go-to-Market Hypotheses

- SEO-first launch in a single state (Florida) to validate:
  - Crawl/index performance
  - Search demand / impressions
  - Content quality and legal risk posture
- Expand state-by-state using the harvesting + verification pipeline.

## Key Risks & Mitigations

1. **Accuracy / reputational risk**
   - Mitigation: source attribution + verification gating + clear disclaimer.

2. **Coverage risk (thin content early on)**
   - Mitigation: focus on one state deeply; ensure hierarchy pages handle “no data yet” gracefully.

3. **Operational load (verification bottleneck)**
   - Mitigation: batch verification (Phase 2), clear queue UX, quality reports that reduce manual work.

4. **LLM extraction cost / variance**
   - Mitigation: deterministic extractor first, cheaper models by default, checkpointing and retry control.

5. **Legal/compliance risk** (defamation/privacy expectations)
   - Mitigation: publish only from official sources, avoid subjective claims, maintain an audit trail of sources.

## Metrics to Track (Practical MVP Dashboard)

- Content supply:
  - total judges ingested
  - total judges verified
  - verification throughput (verified/day)
  - % of judges with enriched bios/education/experience
- SEO:
  - indexed pages count (Search Console)
  - impressions/clicks per template type (state, county, court, judge)
  - crawl errors and canonical issues
- Quality:
  - % of records with valid source URL
  - dedupe rate and identity-confidence distribution
- Monetization readiness:
  - pageviews on judge profile pages (primary surface)
  - top jurisdictions by traffic

## Near-Term “Business Next Steps” (repo-aligned)

1. Finish Phase 2 ingestion UX (CSV import + verification queue) and use Florida harvest output to populate.
2. Instrument basic analytics + Search Console to validate indexing and query demand.
3. Decide on the first monetization experiment (ads vs. attorney placements), but keep it behind the verification-first content model.
4. Add a repeatable “state expansion playbook” (tech + ops) once Florida is stable.
