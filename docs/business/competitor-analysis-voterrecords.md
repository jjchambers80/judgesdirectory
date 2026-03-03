# Competitor Analysis: VoterRecords.com

> **Analyzed:** March 2, 2026
> **URL:** https://voterrecords.com/
> **Relevance:** Public-records directory with programmatic SEO — directly comparable model to JudgesDirectory

---

## Overview

VoterRecords.com is a free political research tool that centralizes 100M+ voter registration records from ~20 U.S. states into a searchable directory. It generates massive organic traffic through programmatic SEO (one indexable page per voter record) and monetizes through affiliate referrals and display advertising.

---

## Data Sourcing

### Source
All data is sourced from **official government public records** obtained via **FOIA and state public records laws**.

### Acquisition Method
- Files FOIA / public-records requests with each state's Secretary of State or county elections offices
- States covered: Alaska, Arkansas, Colorado, Connecticut, DC, Florida, Idaho, Louisiana, Michigan, Mississippi, Nevada, New Jersey, North Carolina, Ohio, Oklahoma, Oregon, Rhode Island, Texas, Utah, Washington, Wisconsin
- Self-described: *"We have spent countless hours researching, collecting, and centralizing voter registration data from across the country"*

### Data Fields (per voter record)
- Full name
- Address (street, city, county, state, zip)
- Phone number
- Email address
- Date of birth / age
- Party affiliation
- Voting precinct / districts
- Voting history
- Related/associated records

### Acquisition Cost
**Low to near-zero.** Voter files are free or cost a few hundred dollars per state. Some states charge nominal fees ($0–$500) for bulk voter file exports.

### Update Cadence
Unknown — their FAQ states data is provided "as is" and may be outdated. They disclaim accuracy and direct users to official government sources for current data.

---

## Content & SEO Strategy

### Programmatic SEO at Scale
- **100M+ individual voter record pages** — each is a unique, indexable URL
- URL structure: `voterrecords.com/voter/{state}/{id}/{name}`
- Long-tail keyword capture: every person's name + location becomes a searchable page
- Additional SEO surface area via:
  - **State browse pages** (`/voters/{state}/`)
  - **Address search** (`/address-search`)
  - **Reverse phone lookup** (`/phone-search/`)
  - **Demographic charts** (`/charts`)
  - **Register to vote** (`/register-to-vote`)

### Traffic Drivers
- People searching their own name or others' names
- Curiosity/vanity searches
- Political researchers and campaigns
- Journalists and investigators
- People verifying voter registration status

---

## Monetization Model

### 1. Affiliate Referrals to People-Search Services (Primary Revenue)

**How it works:**
- When a user views a voter record, the page displays "teaser" ads from third-party people-search companies (e.g., BeenVerified, TruthFinder, Spokeo, Intelius)
- Teasers show enticing preview data: name, age, possible locations, associates
- Clicking through redirects the user to the affiliate partner's website
- VoterRecords.com earns a commission per click (CPC) or per signup/purchase (CPA)

**Why it works:**
- User has already demonstrated high intent (actively looking someone up)
- The free data whets the appetite; paid people-search promises "full reports"
- People-search companies pay premium CPAs ($2–$10+ per lead) because conversion rates from these warm referrals are high

**Evidence from privacy policy (Section 8B):**
> *"The Site also displays affiliate-sponsored links and teaser advertisements related to third-party people search websites. These teaser ads may display limited preview data points, such as a name, general locations, age, or possible associations."*

### 2. Display Advertising (Secondary Revenue)

**How it works:**
- Third-party ad networks (likely Google AdSense or similar) serve programmatic display/banner ads
- Ads use cookies and device identifiers for targeting and performance measurement

**Evidence from privacy policy (Section 8A):**
> *"The Site displays advertising supported by third-party advertising networks. These advertisements may use cookies, device identifiers, or similar technologies to display relevant ads and measure performance."*

### 3. Ad-Tech Data Sharing (Tertiary Revenue)

- Online identifiers (cookies, device IDs, IP addresses) are disclosed to third-party advertising partners
- Some state privacy laws classify this as a "sale" of personal information
- The site's opt-out page explicitly addresses this

**Evidence from privacy policy (Section 9):**
> *"Certain advertising activities may involve the disclosure of online identifiers (such as cookies or IP addresses) to third parties."*

---

## Revenue Model Summary

| Component | Details |
|---|---|
| **Data acquisition cost** | Near-zero — voter files cost $0–$500/state via FOIA |
| **Content strategy** | Programmatic SEO — 100M+ unique pages from bulk data |
| **Primary revenue** | Affiliate commissions from people-search sites |
| **Secondary revenue** | Display ads via third-party ad networks |
| **Tertiary revenue** | Ad-tech data sharing (cookie/identifier monetization) |
| **User cost** | Free — no accounts, no paywalls |
| **Infrastructure** | Cloudflare for CDN/security, standard web stack |

---

## Strengths

- **Massive SEO moat** — 100M+ indexable pages create enormous organic traffic
- **Near-zero data cost** — government records are free/cheap
- **High-intent traffic** — people actively searching names convert well on affiliate offers
- **No user accounts needed** — zero friction means maximum traffic
- **Multiple monetization layers** — affiliate + ads + data sharing diversify revenue
- **Legal protection** — heavy Terms of Service with liquidated damages clauses deter scraping and commercial reuse

## Weaknesses

- **Data freshness** — records may be outdated; no real-time sync with government sources
- **No editorial value-add** — pure data display with no original content, analysis, or curation
- **Single data type** — entirely voter records; no expansion into other public record categories
- **Reputation risk** — privacy-conscious users resent their data appearing publicly
- **Opt-out overhead** — must handle removal requests, which increases operational burden
- **Cloudflare dependency** — aggressive bot protection suggests scraping/abuse is a constant issue

---

## Lessons for JudgesDirectory

### What to Emulate
1. **Programmatic SEO from structured data** — every judge record should be a unique, indexable page optimized for `[Judge Name] + [Court]` searches
2. **Low-cost government data acquisition** — judicial records, court appointments, and campaign finance data are similarly available via public records
3. **Affiliate monetization** — partner with legal research services (Westlaw, LexisNexis, Casetext), legal directories, or attorney referral services for referral revenue
4. **Demographic/statistical content** — charts and aggregate data pages (judges by appointment type, by state, by court level) create additional SEO surface area
5. **Free access, no paywall** — maximize traffic and monetize through ads/affiliates rather than subscriptions

### What to Improve Upon
1. **Add editorial value** — judicial profiles with rulings, career timelines, and sentencing patterns are far more valuable than raw voter data
2. **Data freshness** — implement automated harvesting (already in progress) to keep records current
3. **Richer data model** — combine multiple data sources (court records, campaign finance, bar associations, news) rather than relying on a single government file
4. **B2B monetization** — legal professionals will pay for premium data access (API, bulk exports, alerts) — a revenue stream VoterRecords.com explicitly prohibits
5. **Community/trust** — build reputation as an authoritative judicial reference rather than a privacy-concerning data dump

### Key Takeaway
VoterRecords.com proves the **free public-records directory → programmatic SEO → affiliate/ad monetization** model works at scale. JudgesDirectory can follow the same playbook with a higher-value niche (judicial data), richer content, and additional B2B revenue streams that VoterRecords.com's terms explicitly forbid.

---

## Technical Notes

- **Protection:** Cloudflare WAF — blocks headless browsers and automated scraping
- **Jurisdiction:** Incorporated in Florida (Orange County)
- **Not a CRA:** Explicitly disclaims being a consumer reporting agency under FCRA
- **Terms last updated:** January 12, 2018
- **Privacy policy last updated:** January 2, 2026
