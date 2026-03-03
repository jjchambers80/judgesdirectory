# Data Sourcing Strategy: FOIA vs. Web Scraping

**Last Updated**: 2026-03-02  
**Status**: Strategic Decision  
**Related**: [data-harvesting.md](../architecture/data-harvesting.md), [competitor-analysis-voterrecords.md](competitor-analysis-voterrecords.md), [directory-strategy-and-data-automation.md](directory-strategy-and-data-automation.md)

---

## TL;DR

**Web scraping is the right primary approach. FOIA is the right enrichment layer.**

Scraping gives us speed, freshness, and rich biographical data. FOIA gives us legal defensibility, historical depth, and data fields that don't exist on court websites. The combination creates a moat.

---

## Context: The VoterRecords.com Model

VoterRecords.com runs entirely on FOIA-sourced bulk voter files. This works because voter registration data is:

- Explicitly mandated as public records in nearly every state
- Available as standardized **bulk exports** (CSV/fixed-width) — single request per state
- Cheap ($0–$500 per state for millions of records)
- Structurally simple — name, address, party, voting history

**Judicial data is fundamentally different.** It's higher value per record but scattered across more agencies and not available as standardized bulk exports.

---

## Why FOIA-First Doesn't Work for Judicial Data

### Problem 1: Data is fragmented across agencies

VoterRecords.com files **one request** per state to the Secretary of State and gets everything. For judges, you'd potentially need:

| Agency | What They Have | FOIA Applicability |
|---|---|---|
| State Administrative Office of Courts (AOC) | Roster, court assignments, term dates | **Yes** — good candidate |
| Governor's Office | Appointment records, appointing authority | **Yes** — but separate request |
| State Bar Association | Bar numbers, education, law school | **Often no** — many bar associations are private entities, not subject to FOIA |
| Individual Court Districts | Bio pages, case assignments | **Varies** — some maintain own records |
| Campaign Finance Board | Contributions for elected judges | **Yes** — but yet another agency |
| State Comptroller / HR | Judge salary, benefits | **Yes** — public employee records |

That's 3–6 requests per state, to different agencies, with different formats, timelines, and response quality.

### Problem 2: Response time destroys velocity

| Metric | Web Scraping | FOIA |
|---|---|---|
| Time to new state data | Hours to days | 2–12 weeks typical |
| Florida to production | Already done | Would still be waiting |
| Texas expansion | Days (add JSON config, run pipeline) | Weeks–months across 254 counties |
| Update cycle | Re-run harvester anytime | Re-file requests, wait again |
| Blocked request | Try different extraction approach | Appeal → months of delay |

### Problem 3: FOIA returns less rich data than court websites

The irony: the **public-facing court websites** often contain more useful data than what you'd get back from a FOIA request, because:

- **Bio pages** include education, career history, community involvement, photos — these aren't in administrative databases
- **Roster pages** are already the state's published output of what FOIA would return
- **Profile photos** exist only on websites
- **Narrative descriptions** (judicial philosophy, notable cases) are editorial content, not records

A FOIA response for "list of active judges" would typically return a CSV/spreadsheet with: name, court, appointment date, term expiration — data we already scrape more efficiently.

### Problem 4: No standardized format

Each state's AOC returns data differently:
- Florida might send an Excel file
- Texas might send a PDF
- California might send a MySQL dump
- New York might send a paper printout and charge for copying

Each response requires custom parsing — the same per-state engineering effort as scraping, but without the ability to iterate quickly.

---

## Why Web Scraping Remains Primary

Our current pipeline (`fetch → extract → normalize → deduplicate → output`) wins on every operational dimension:

| Factor | Assessment |
|---|---|
| **Speed** | New state in days, not months |
| **Freshness** | On-demand re-runs, detect changes automatically |
| **Data richness** | Full bio pages, photos, career history |
| **Iteration** | Fix extraction bugs in minutes, re-run immediately |
| **Cost** | LLM API costs ~$5–20/state — cheaper than FOIA admin overhead |
| **Scalability** | State-agnostic config (007-state-expansion) enables rapid growth |
| **Already working** | Florida pipeline is production-proven |

### Legal note on scraping government websites

Government court websites are **public information by design**. Unlike scraping private platforms (where ToS violations are a concern), government websites are:

- Funded by taxpayers specifically to publish this information
- Generally don't have restrictive Terms of Service
- Often explicitly encourage public access
- Protected under First Amendment case law for journalistic/research use

Our scraping is polite (rate-limited, respectful of robots.txt), attributes sources, and adds editorial value. This is well within accepted norms.

---

## Where FOIA Adds Unique Value (Enrichment Layer)

FOIA becomes powerful for data that **doesn't appear on court websites**:

### Tier 1 — High value, straightforward requests

| Data | Source Agency | Value to Directory |
|---|---|---|
| **Official roster with appointment dates** | State AOC | Cross-validation of scraped data |
| **Judge salary / compensation** | State comptroller or HR | Unique data point, high search interest |
| **Historical judges** (retired/deceased) | State AOC archives | SEO depth — pages for judges not on current websites |
| **Judicial vacancies** | State AOC or Governor's office | Timely content, lawyer audience interest |

### Tier 2 — Medium value, more effort

| Data | Source Agency | Value to Directory |
|---|---|---|
| **Campaign finance records** (elected judges) | State election commission | Political transparency angle, journalism citations |
| **Caseload statistics** | State AOC | Aggregate analytics content, chart pages |
| **Financial disclosures** | Ethics commission (where required) | High-value niche content |
| **Disciplinary actions** | Judicial conduct commissions | Important for judicial accountability narrative |

### Tier 3 — Future / at scale

| Data | Source Agency | Value to Directory |
|---|---|---|
| **Sentencing data** (aggregate) | State court CMS or AOC | Very high value but very hard to get |
| **Courtroom technology** | Individual courts | Niche usefulness for practicing attorneys |
| **Jury pool statistics** | Clerk of Court | Niche research use |

---

## Recommended Strategy: Hybrid Pipeline

```
PRIMARY PATH (scraping — fast, rich, operational)
┌────────────────────────────────────────────────────────────────┐
│  Court Websites → Fetch → Extract → Normalize → Deduplicate   │
│  Bio Pages → Fetch → Extract → Merge                          │
│  Ballotpedia → Fetch → Extract → Merge                        │
│  Florida Bar → Fetch → Extract → Merge                        │
│                                                                │
│  Output: Rich judge profiles with bios, education, photos      │
│  Cadence: Weekly–monthly re-runs per state                     │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
ENRICHMENT PATH (FOIA — slow, unique, defensible)
┌────────────────────────────────────────────────────────────────┐
│  State AOC → Official roster CSV → Validation audit            │
│  Comptroller → Salary data → Merge into profiles               │
│  Governor → Historical appointments → Backfill retired judges  │
│  Election Commission → Campaign finance → Political context    │
│                                                                │
│  Output: Verified badge, salary, historical depth, finance     │
│  Cadence: Quarterly–annual bulk requests                       │
└────────────────────────────────────────────────────────────────┘
                          │
                          ▼
TRUST LAYER (competitive moat)
┌────────────────────────────────────────────────────────────────┐
│  "Verified against official records" badge on judge profiles   │
│  Source attribution: "Official salary data via FOIA request    │
│    to Florida Comptroller, received 2026-04-15"                │
│  Historical data: profiles for 10,000+ retired judges          │
│  Unique data: salary, campaign finance, caseload stats         │
└────────────────────────────────────────────────────────────────┘
```

---

## FOIA Enrichment Implementation Plan

### Phase 1 — Validation (start now, Florida only)

**Goal**: Use FOIA to validate scraped data and earn a "verified" badge.

1. File a FOIA request with the **Florida Office of the State Courts Administrator** for:
   - Complete list of active judges (all court levels)
   - Appointment dates and term expiration dates
   - Court assignments and county jurisdictions
2. When received, build a **validation script** that cross-references the FOIA roster against our scraped data
3. Mark judges as "verified" where FOIA data matches
4. Flag discrepancies for manual review
5. Display "Verified against official records" on matched profiles

**Estimated timeline**: 2–6 weeks for response, 1–2 days to build validation script  
**Cost**: Free–$25 (Florida has low/no FOIA fees for electronic records)

### Phase 2 — Salary Enrichment (after Phase 1)

**Goal**: Add unique data that competitors don't have.

1. Request **judge salary records** from the Florida Comptroller (public employee compensation is a standard FOIA fulfillment)
2. Parse and merge into judge profiles
3. Create programmatic "Judge Salary in [State]" pages (high search volume)

**SEO opportunity**: "How much do judges make in Florida" is a high-volume query with thin competition.

### Phase 3 — Historical Depth (during state expansion)

**Goal**: Create profiles for judges no longer on court websites.

1. For each new state, include a FOIA request for **historical judicial appointments** (past 20 years)
2. Create archival profiles with a clear "Former Judge" designation
3. Adds thousands of indexable pages per state that scraping can never produce

### Phase 4 — Campaign Finance (for elected-judge states)

**Goal**: Differentiated content for the judicial accountability audience.

1. For states with elected judges (TX, OH, PA, etc.), pull campaign finance records
2. Create "Campaign Contributions" sections on judge profiles
3. Build aggregate analysis pages ("Top Campaign Contributors to Texas Judges")

---

## Decision Matrix: When to Scrape vs. FOIA

| I need... | Use |
|---|---|
| Current roster of active judges | **Scrape** |
| Judge bio, education, career history | **Scrape** |
| Profile photos | **Scrape** |
| Quick expansion to new state | **Scrape** |
| Validation of scraped data accuracy | **FOIA** |
| Judge salary / compensation | **FOIA** |
| Historical / retired judge records | **FOIA** |
| Campaign finance data | **FOIA** |
| Caseload statistics | **FOIA** |
| Financial disclosures | **FOIA** |
| "Verified" trust badge | **FOIA** (to validate scraped data) |

---

## Competitive Advantage of the Hybrid Approach

Most judicial directories do **only one**:
- Government websites just publish their own roster (no cross-state search)
- Ballotpedia relies on editorial/volunteer effort (doesn't scale)
- Legal research platforms (Westlaw, LexisNexis) have data but behind expensive paywalls

By combining scraping (speed + richness) with FOIA (verification + unique data), JudgesDirectory becomes:

1. **Faster to market** than FOIA-only approaches
2. **Richer** than FOIA-only data (bios, photos, career narratives)
3. **More trustworthy** than scraping-only (verified badge, source attribution)
4. **Uniquely deep** with data no one else publishes free (salary, campaign finance, historical records)

The trust story — *"We scrape for speed, verify against official records, and enrich with data you can't find anywhere else"* — is a genuine differentiator.
