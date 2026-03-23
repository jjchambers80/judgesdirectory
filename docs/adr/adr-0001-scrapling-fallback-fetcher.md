---
title: "ADR-0001: Scrapling as Fallback Fetcher for Anti-Bot and JS-Heavy Court Sites"
status: "Proposed"
date: "2026-03-19"
authors: "jjchambers"
tags: ["architecture", "decision", "scraping", "infrastructure"]
supersedes: ""
superseded_by: ""
---

# ADR-0001: Scrapling as Fallback Fetcher for Anti-Bot and JS-Heavy Court Sites

## Status

**Proposed** | Accepted | Rejected | Superseded | Deprecated

## Context

The judgesDirectory harvest pipeline uses native `fetch` + Cheerio + Turndown to scrape court websites and extract judge data. This stack works for static HTML sites and known SPA patterns (Next.js, Gatsby) but has two critical gaps as we scale beyond Florida:

1. **Anti-bot protection**: New York state courts (`nycourts.gov`, `iapps.courts.state.ny.us`) are behind Cloudflare Turnstile, which blocks all programmatic access — including headless Playwright. This leaves ~1,000+ NY judges inaccessible.

2. **JS-heavy rendering**: Some court sites require full browser JavaScript execution to render roster content. Our current pipeline has no browser rendering capability.

Commit `3ec8ccf` introduced two Scrapling wrapper files (`scrapling-fetcher.ts`, `hybrid-fetcher.ts`) as a potential solution. However, these files contain bugs (dead imports, type mismatches, unused code), Scrapling is not installed, and neither file is integrated into the harvest pipeline.

The existing research (`docs/research/web-scraping-tools.md`) evaluated Firecrawl, Crawl4AI, ScrapeGraphAI, and Bright Data but did not evaluate Scrapling. A decision is needed on whether Scrapling is the right tool to fill the anti-bot and JS-rendering gaps, or whether an alternative should be adopted instead.

**Technical constraints**:
- The pipeline is TypeScript/Node.js; Scrapling is a Python CLI tool invoked via `child_process.spawn`
- `trailingSlash: true` in Next.js config affects all internal API communication
- Court websites are public government sites; no authentication bypass is needed
- The fetcher must degrade gracefully when Scrapling is unavailable (CI, fresh dev environments)

## Decision

Adopt Scrapling as an **optional fallback fetcher** integrated into the harvest pipeline via a `hybridFetch()` dispatch layer. The native `fetchPage()` remains the default for all sites. Scrapling is invoked only when:

1. A court config explicitly sets `fetchMethod: 'scrapling'` (known anti-bot sites like NY)
2. Auto mode detects insufficient content from native fetch (<200 chars markdown) and Scrapling is available

**Rationale**:
- Scrapling's stealth mode (`stealthy-fetch`) uses browser fingerprint evasion specifically designed to bypass Cloudflare and similar protections — the exact blocker for NY courts
- It's open source and free, unlike Firecrawl ($16/mo+)
- The CLI interface is simple to shell out to from Node.js — no Python async runtime or complex IPC needed
- The hybrid pattern (native first, Scrapling fallback) preserves existing performance for working sites while adding capability for blocked ones
- Scrapling is a Python dependency, not a Node.js one, which keeps it fully isolated from the main application

## Consequences

### Positive

- **POS-001**: Unlocks NY state courts (~1,000+ judges) currently blocked by Cloudflare Turnstile
- **POS-002**: Adds JS rendering capability for court sites that require full browser execution
- **POS-003**: Zero impact on existing working states (FL, CA, TX, SC) — native fetch path is unchanged
- **POS-004**: No recurring cost — Scrapling is open source, runs locally
- **POS-005**: Graceful degradation — pipeline continues without Scrapling when it's not installed
- **POS-006**: Per-domain configuration via `SITE_CONFIGS` and `fetchMethod` gives fine-grained control

### Negative

- **NEG-001**: Adds Python as a system dependency — developers and CI must have Python 3.9+ and `pip install scrapling`
- **NEG-002**: Scrapling stealth mode adds ~5-15s latency per page vs ~1-2s for native fetch
- **NEG-003**: CLI interface is a brittle integration point — output format changes in Scrapling updates could break parsing
- **NEG-004**: Scrapling is a younger project with less ecosystem maturity than Playwright or Crawl4AI
- **NEG-005**: Anti-bot bypass effectiveness is not guaranteed — Cloudflare Turnstile evolves and may detect Scrapling in future versions

## Alternatives Considered

### Firecrawl (SaaS)

- **ALT-001**: **Description**: Cloud-based scraping service that handles anti-bot, JS rendering, and returns clean markdown. Ranked ⭐⭐⭐⭐ in existing research. Has a Node.js SDK (`@mendable/firecrawl-js`).
- **ALT-002**: **Rejection Reason**: Paid service ($16/mo minimum), adds external service dependency, data transits third-party servers. Scrapling provides equivalent capability for free, locally.

### Crawl4AI (Open Source Python)

- **ALT-003**: **Description**: Open-source async web crawler using Playwright for JS rendering. Ranked ⭐⭐⭐⭐ in research. Fully offline-capable.
- **ALT-004**: **Rejection Reason**: Heavier integration — requires a running Python async process or subprocess with more complex IPC than a simple CLI call. Does not include anti-bot stealth features; Playwright alone was already tested and failed against NY Cloudflare Turnstile. Remains a strong backup if Scrapling proves insufficient.

### Playwright Directly in fetcher.ts

- **ALT-005**: **Description**: Add Playwright as a Node.js dependency to `fetcher.ts` for browser-rendered fetching. Recommended in web-scraping-tools.md research for Phase 2 expansion.
- **ALT-006**: **Rejection Reason**: Playwright headless mode was already tested against NY courts and failed — Cloudflare Turnstile specifically detects and blocks headless Playwright, even with anti-detection flags. Adding Playwright solves JS rendering but not the anti-bot gap.

### Do Nothing

- **ALT-007**: **Description**: Keep native fetch only, skip blocked sites, defer anti-bot capability to future.
- **ALT-008**: **Rejection Reason**: NY represents ~1,000+ judges permanently blocked. As state expansion continues, more sites with anti-bot protection will be encountered. The problem grows with scale.

### Manual Data Entry

- **ALT-009**: **Description**: Human operators manually copy judge data from blocked court websites.
- **ALT-010**: **Rejection Reason**: Labor-intensive, error-prone, doesn't scale, defeats the purpose of an automated pipeline.

## Implementation Notes

- **IMP-001**: Phase 2 of the implementation plan (`plan/feature-scrapling-integration-1.md`) is the critical validation gate — if Scrapling cannot bypass NY Cloudflare Turnstile, the integration is limited to bug fixes and availability guard only (no pipeline wiring)
- **IMP-002**: The `fetchMethod` field in court configs provides explicit per-site control: `'native'` (default), `'scrapling'` (force Scrapling), `'auto'` (try native, fall back to Scrapling). This avoids blanket behavior changes.
- **IMP-003**: Success criteria: NY Court of Appeals roster URL returns parseable markdown with judge names via `scrapling extract stealthy-fetch`. Measure by comparing extracted judge count against known NY judiciary size.
- **IMP-004**: Scrapling version should be pinned in install documentation to avoid breaking CLI interface changes

## References

- **REF-001**: [plan/feature-scrapling-integration-1.md](../../plan/feature-scrapling-integration-1.md) — Implementation plan with 5 phases and 23 tasks
- **REF-002**: [docs/research/web-scraping-tools.md](../research/web-scraping-tools.md) — Tool comparison matrix evaluating Firecrawl, Crawl4AI, ScrapeGraphAI, Bright Data
- **REF-003**: [docs/research/new-york-cloudflare-block.md](../research/new-york-cloudflare-block.md) — NY Cloudflare Turnstile investigation documenting all failed bypass attempts
- **REF-004**: [Scrapling GitHub — github.com/D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling) — Project repository and documentation
- **REF-005**: [specs/008-state-expansion/](../../specs/008-state-expansion/) — State expansion feature that first identified the NY court blocker
