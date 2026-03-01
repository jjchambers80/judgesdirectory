# Pillar Pages vs Programmatic SEO Pages

**Last Updated**: 2026-03-01  
**Status**: Proposed

This document explains two content/template strategies for JudgesDirectory:

1. **Programmatic SEO pages** (many pages, consistent template, driven by structured data)
2. **Pillar pages** (fewer pages, long-form, highly curated, designed to concentrate authority)

The goal is to make this a deliberate product and publishing decision, not an accident of implementation.

## Definitions

### Programmatic SEO (pSEO)

- Many pages created from a structured dataset.
- In JudgesDirectory, this is the state → county → court type → judge hierarchy.
- Strengths: coverage, scale, internal linking, long-tail capture.
- Risks: thin pages, duplicates, stale/incorrect data, “templated” footprint.

### Pillar pages

- Fewer pages with a lot of content per page.
- Typically target the highest-intent, highest-volume location queries.
- Strengths: concentrated relevance, easier quality control, can rank even with small datasets.
- Risks: less coverage, harder to keep organized, can become “everything on one page” bloat.

## Why this matters for JudgesDirectory

JudgesDirectory has two realities at once:

- The directory structure is inherently programmatic.
- The trust requirement is high (legal/civic info), so thin or low-confidence pages are actively harmful.

Pillar pages can be a quality lever early. Programmatic pages become the scaling lever later.

## When to prefer pillar pages

Use pillar pages when any of these are true:

- **Early coverage**: the dataset is small or uneven, so many programmatic pages would be empty/thin.
- **High-stakes jurisdictions**: you want to control wording tightly and avoid template-like repetition.
- **Search intent is location-first**: users search “judges in {county} {state}” more than individual names.
- **You need a quality beachhead**: one excellent page per state/county can establish topical authority.

### Pillar page examples (JudgesDirectory)

- “Judges in Miami-Dade County, Florida” (single page listing courts + judges, with sources)
- “Florida Circuit Court judges directory” (overview + links into deeper pages)

## When to prefer programmatic pages

Use programmatic pages when these are true:

- **Coverage is real**: you can populate most pages with meaningful content.
- **Data quality is controlled**: identity + dedupe + verification gating is stable.
- **Internal linking matters**: you want a crawlable, hierarchical information architecture.
- **Update cadence exists**: you can refresh rosters predictably (monthly/quarterly).

## Strategy: combine them intentionally

The most robust approach is often:

1. **Pillar pages as “authority hubs”** for top jurisdictions and early-state launches
2. **Programmatic pages as “depth pages”** once coverage and verification throughput are strong

This combination hedges against:

- Thin-content penalties (pillar pages carry more substance)
- Data churn (pillar pages can be stricter about what is included)
- Early-stage scarcity (you still publish something useful while the dataset ramps)

## Quality rules (non-negotiable for both strategies)

### Verification gating

- If a judge record is not verified, it should not be publicly listed.
- If a field cannot be sourced, it should not be stated as fact.

### Canonical identity

- Avoid duplicated judges across pages.
- Prefer stable IDs and merge logic before expanding page count.

### Provenance

- Every roster page and judge profile must have official source attribution.
- If enrichment sources are used (e.g., Ballotpedia), store the source URL separately from official sources.

## Decision checklist (quick)

Answer these before launching a new state/jurisdiction:

- Do we have verified coverage for the majority of target jurisdictions?
- Will most pages have enough content to be useful?
- Is our update cadence defined (and realistic for ops)?
- Is our identity/dedupe stable enough to prevent duplicate pages?

If “no” to any of the above, start with a pillar page and link into whatever programmatic depth is ready.

## Implementation implications (JudgesDirectory)

This is not a UI spec. It’s an architecture constraint.

- **Pillar pages** can be:
  - curated Markdown/MDX content (if added later), or
  - admin-authored “jurisdiction overview” fields stored in the DB.
- **Programmatic pages** remain driven by DB records and templates.
- Both should keep:
  - consistent canonical URLs,
  - structured data (Schema.org),
  - and sitemap coverage.

## Related documents

- [docs/business/directory-playbook-frey-podcast-notes.md](../business/directory-playbook-frey-podcast-notes.md)
- [docs/business/directory-playbook-2025-notes.md](../business/directory-playbook-2025-notes.md)
- [docs/business/directory-strategy-and-data-automation.md](../business/directory-strategy-and-data-automation.md)
- [docs/architecture/data-harvesting.md](data-harvesting.md)
