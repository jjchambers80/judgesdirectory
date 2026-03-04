# Monetization Plan

**Last Updated**: 2026-03-02  
**Status**: Active Strategy  
**Replaces**: Scattered monetization hypotheses across business docs  
**Related**: [competitor-analysis-voterrecords.md](competitor-analysis-voterrecords.md), [icp-and-monetization.md](icp-and-monetization.md), [foia-vs-scraping-strategy.md](foia-vs-scraping-strategy.md)

---

## Core Thesis

The directory is the traffic engine. Monetization is the referral layer on top.

Visitors aren't searching for JudgesDirectory. They're searching for a judge. We answer that query, then connect them to what they actually need — a lawyer, legal research, court information — and get paid for that connection.

This is the same model proven at scale by VoterRecords.com (100M+ records, people-search affiliate revenue) adapted for a niche (legal) with 5–10x higher per-click value than voter data.

---

## Why Legal Traffic Is Exceptionally Valuable

Legal is one of the highest-value verticals in digital advertising:

| Metric | Legal Vertical | General Web |
|---|---|---|
| Google Ads CPC (display) | $5–$50+ | $0.50–$2 |
| Google Ads CPC (search) | $50–$200+ | $1–$5 |
| Display RPM | $15–$30 | $3–$8 |
| Affiliate payout per lead | $5–$50 | $0.50–$5 |

Someone searching "Judge Smith Broward County Florida" has **active legal intent**. They are likely:
- A defendant or plaintiff in an active case
- Searching before a hearing or trial
- Looking for representation
- A journalist covering a case
- An attorney researching opposing counsel's judge

This intent is the raw material for every revenue stream below.

---

## Revenue Stream 1: Display Advertising

**What**: Programmatic display ads via Google AdSense (early) → Mediavine or Raptive (at scale)

**How it works**:
- Drop a script tag on the site
- Ad networks serve contextually-targeted ads
- Legal advertisers bid high because legal keyword CPCs are $50–$200+

**Implementation effort**: Minimal — add script tag, configure ad placements

**Revenue model**: RPM (revenue per 1,000 pageviews)
- Legal traffic RPM: $15–$25 with AdSense, $20–$35 with Mediavine/Raptive
- Non-legal traffic RPM: $5–$10

**Projected revenue by traffic level**:

| Monthly Pageviews | AdSense (~$15 RPM) | Mediavine (~$25 RPM) |
|---|---|---|
| 10,000 | $150 | N/A (below threshold) |
| 50,000 | $750 | $1,250 |
| 100,000 | $1,500 | $2,500 |
| 500,000 | $7,500 | $12,500 |

**Thresholds**:
- AdSense: No minimum (can start immediately)
- Mediavine Journey: 5,000–10,000 sessions/month (starter program launched May 2024; accepts sites as low as 3K sessions)
- Mediavine (full): 50,000 sessions/month
- Raptive (formerly AdThrive): 100,000 pageviews/month

**Volatility note**: Display ad revenue is inherently volatile — daily swings of 35–100% are normal (e.g., $100 one day, $36 the next). This is acceptable for passive income but creates planning challenges. Sponsored listings (Revenue Stream 3) provide stability as a counterbalance.

**Ad placement strategy** (trust-preserving):
- No ads above the fold on judge profile pages — the profile content comes first
- Sidebar ad on desktop, in-content ads on long pages (county listings, state pages)
- No interstitials or pop-ups — these destroy trust for a reference site
- Clear separation between editorial content and ads

**When**: Day 1 of meaningful organic traffic

---

## Revenue Stream 2: Legal Service Affiliate Referrals

**What**: Contextual referral widgets connecting visitors to lawyer-finding services

**This is the VoterRecords.com model adapted for legal.**

VoterRecords.com shows "teaser" ads from people-search companies (BeenVerified, TruthFinder) on every voter record page. The visitor, already in "lookup mode," clicks through and VoterRecords.com earns a commission.

Our version: visitors on judge profile pages are shown contextual prompts to find legal representation, and we earn referral commissions.

### Affiliate partners to pursue

| Partner | What They Do | Commission Model | Estimated Payout |
|---|---|---|---|
| **Avvo** | Lawyer directory + reviews | Per lead/click | $5–$20/lead |
| **LegalMatch** | Lawyer-client matching | Per qualified lead | $20–$50/lead |
| **FindLaw** (Thomson Reuters) | Lawyer directory | Per click/lead | $5–$15/lead |
| **Justia** | Legal information + directory | Per click | $2–$10/click |
| **LegalZoom** | Legal document services | Per sale | $10–$50/sale |
| **Rocket Lawyer** | Legal services subscription | Per trial signup | $15–$30/signup |

### How it appears on the site

On every judge profile page, below the judge's information:

```
┌─────────────────────────────────────────────────┐
│  Need a Lawyer for [Court Type] in [County]?    │
│                                                 │
│  Find experienced [practice area] attorneys     │
│  who practice in [County] courts.               │
│                                                 │
│  [Find an Attorney →]                           │
│                                                 │
│  Sponsored · We may earn a referral fee         │
└─────────────────────────────────────────────────┘
```

On court/county listing pages:

```
┌─────────────────────────────────────────────────┐
│  Featured: [Practice Area] Attorneys in [County]│
│                                                 │
│  Compare top-rated lawyers near [Courthouse].   │
│                                                 │
│  [Compare Attorneys →]                          │
│                                                 │
│  Sponsored                                      │
└─────────────────────────────────────────────────┘
```

### Revenue math

| Monthly Pageviews | Click-through rate | Clicks | Avg payout | Monthly Revenue |
|---|---|---|---|---|
| 10,000 | 2% | 200 | $10 | $2,000 |
| 50,000 | 2% | 1,000 | $10 | $10,000 |
| 100,000 | 2% | 2,000 | $10 | $20,000 |
| 500,000 | 1.5% | 7,500 | $10 | $75,000 |

These numbers are realistic for legal intent traffic. VoterRecords.com achieves similar or better conversion rates to people-search affiliates, and legal CPAs are higher than people-search CPAs.

**This is likely our highest-revenue channel.**

**When**: Month 1–3 after traffic begins. Requires affiliate agreements with 2–3 partners.

---

## Revenue Stream 3: Sponsored Attorney Listings

**What**: Paid placements for law firms on county, court, and judge pages

**How it works**:
- On each county or court-type page, offer 1–3 "Featured Attorney" slots
- Clearly labeled "Sponsored" — never implied as editorial endorsement
- Targeted by county + practice area (family law, criminal defense, personal injury, etc.)
- Law firms pay a monthly fee for placement visibility

### Pricing model

| Placement Tier | Where It Appears | Price |
|---|---|---|
| **County page** | `/judges/{state}/{county}` | $79–$149/month |
| **Court-type page** | `/judges/{state}/{county}/{court-type}` | $49–$99/month |
| **Judge profile sidebar** | Individual judge pages in that county | $99–$199/month |
| **State page** | `/judges/{state}` | $199–$499/month |
| **Bundle** | All pages in a county | $199–$399/month |

### Why this pricing works for law firms

A criminal defense attorney in Miami-Dade County spends $2,000–$10,000/month on Google Ads. A $99/month placement on the page where their potential clients are already researching the judge assigned to their case is trivially cheap for the firm and pure margin for us.

**Benchmark**: Sober Nation (rehab directory) charges ~$129/month for featured listings. Our pricing is in line with proven directory economics.

**Stability advantage**: Unlike display ads (which can swing 35–100% daily), sponsored listings provide predictable MRR. 20 law firms at $99/month = ~$2K stable MRR.

### Revenue math

| Counties Active | Avg Slots Sold | Avg Price | Monthly Revenue |
|---|---|---|---|
| 10 (FL pilot) | 2 per county | $99 | $1,980 |
| 67 (all FL) | 2 per county | $99 | $13,266 |
| 200 (multi-state) | 2 per county | $99 | $39,600 |
| 500 (national) | 2.5 per county | $119 | $148,750 |

### Sales motion

**Phase 1 — Pilot (2–5 FL counties)**:
- Cold email 10 law firms per county
- Offer first month free as a pilot
- Measure impressions delivered and clicks generated
- Use pilot data to set pricing

**Phase 2 — Florida Rollout**:
- Self-serve signup page: pick your county, practice area, enter firm info, pay monthly
- Outbound to legal marketing agencies (they manage placements for multiple firms)

**Phase 3 — Scale**:
- Expand with each new state
- Inventory grows linearly with state expansion

### Critical rules

- **Clear "Sponsored" label** on every placement — no ambiguity
- **No endorsement language** — never imply the attorney is recommended by the directory
- **No influence on editorial content** — sponsored status never affects judge profile accuracy
- **Disclaimer**: "Sponsored listings are paid advertisements and do not constitute an endorsement"

**When**: Month 3–6 after launch. Requires: (1) meaningful pageviews to demonstrate value, (2) a simple self-serve or manual listing workflow.

---

## Revenue Stream 4: Data & API Licensing

**What**: Structured, verified judge dataset available via API or bulk export

**Who pays**:
- Legal tech companies (case management, analytics, docketing platforms)
- Political research firms and PACs
- Academic researchers
- Journalism organizations (ProPublica, The Marshall Project, local newsrooms)

**What they get**:
- Clean, deduplicated judge records with stable IDs
- Court hierarchy and jurisdiction mappings
- Appointment, term, education, and selection method data
- FOIA-verified records where available
- Regular update cadence (monthly or quarterly)

### Pricing tiers

| Tier | Access | Price | Target Customer |
|---|---|---|---|
| **Researcher** | Read-only API, 1,000 requests/month, single state | $99/month | Academics, journalists |
| **Professional** | Full API, 10,000 requests/month, all states | $499/month | Legal tech companies |
| **Enterprise** | Bulk export, unlimited API, custom fields, SLA | $2,000–$5,000/month | Large platforms, political research |

### Why this is defensible

- No one else offers a clean, structured, nationwide judge directory with API access
- FOIA-verified data adds a trust layer that can't be easily replicated
- Identity-based deduplication and stable IDs make the data integration-friendly
- The harvesting + verification pipeline is the moat — it's expensive to build from scratch

### Revenue math

| Customers | Avg Price | Monthly Revenue |
|---|---|---|
| 5 (early) | $250 | $1,250 |
| 20 | $400 | $8,000 |
| 50 | $500 | $25,000 |

**When**: Month 6–12. Requires: (1) multi-state coverage, (2) FOIA validation for credibility, (3) API infrastructure.

---

## Revenue Sequence & Timeline

```
PHASE 1: Build & Index (Now → Traffic)
├── Focus: Get Florida pages indexed, expand to TX/CA/NY
├── Revenue: $0
└── Goal: 10,000+ indexed pages, organic impressions growing

PHASE 2: First Revenue (Month 1–3 of traffic)
├── Turn on: AdSense → Mediavine Journey (at 5K sessions)
├── Add: 2–3 legal affiliate partners
├── Revenue: $500–$5,000/month
└── Goal: Validate CTR on affiliate widgets, measure RPM

PHASE 3: Direct Sales (Month 3–6)
├── Turn on: Sponsored attorney listings (pilot in 2–5 FL counties)
├── Revenue: $2,000–$10,000/month
└── Goal: Prove advertiser ROI, build self-serve listing flow

PHASE 4: Scale (Month 6–12)
├── Scale: Multi-state expansion, Mediavine upgrade, expand listings
├── Revenue: $10,000–$30,000/month
└── Goal: 200+ counties with inventory, 100K+ monthly pageviews

PHASE 5: Data Product (Year 2)
├── Launch: API access, bulk data licensing
├── Revenue: $5,000–$25,000/month (additive)
└── Goal: 10+ paying data customers, enterprise deals

PHASE 6: Strategic Options (Year 2+)
├── Consider: Direct lead generation (capture forms → sell leads to law firms)
├── Consider: SaaS product funnel (court date tracker, case reminder tool, attorney matching marketplace)
├── Revenue: Variable — depends on product-market fit
└── Goal: Evaluate whether directory traffic supports a higher-margin product
```

---

## Combined Revenue Projections

### Conservative scenario (50K monthly pageviews, 1 state)

| Stream | Monthly Revenue |
|---|---|
| Display ads (AdSense) | $750 |
| Legal affiliate referrals | $5,000 |
| Sponsored listings (20 counties) | $3,960 |
| **Total** | **$9,710/month** |

### Growth scenario (200K monthly pageviews, 4 states)

| Stream | Monthly Revenue |
|---|---|
| Display ads (Mediavine) | $5,000 |
| Legal affiliate referrals | $20,000 |
| Sponsored listings (100 counties) | $19,800 |
| Data/API (10 customers) | $4,000 |
| **Total** | **$48,800/month** |

### Scale scenario (500K+ monthly pageviews, 10+ states)

| Stream | Monthly Revenue |
|---|---|
| Display ads (Raptive) | $15,000 |
| Legal affiliate referrals | $50,000 |
| Sponsored listings (300 counties) | $59,400 |
| Data/API (30 customers) | $15,000 |
| **Total** | **$139,400/month** |

---

## Key Assumptions & Risks

### Assumptions
- Legal traffic RPMs remain high ($15–$30)
- Affiliate partners accept us (requires some traffic baseline for most)
- Law firms will pay $50–$200/month for contextual placements
- Organic search remains the primary traffic driver (AI search doesn't fully cannibalize)

### Risks & mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| AI search eats organic clicks | All revenue streams depend on traffic | Trust + source attribution makes us the verification layer even if discovery shifts |
| Low affiliate conversion | Revenue Stream 2 underperforms | Diversify across 3–4 affiliate partners; A/B test placement designs |
| Law firms won't buy listings | Revenue Stream 3 stalls | Start with free pilots to prove value; lean on agencies who buy in bulk |
| Legal/ethical backlash | "Monetizing judicial data" criticism | Conservative ad density, clear disclaimers, never imply endorsement, maintain editorial independence |
| Slow indexing | Delays all revenue | Strong technical SEO (already built), sitemaps, structured data |

---

## What We Learned from VoterRecords.com

| Their Model | Our Adaptation |
|---|---|
| Affiliate referrals to people-search sites | Affiliate referrals to legal service marketplaces |
| Free bulk FOIA data → millions of SEO pages | Free court website data → thousands of SEO pages |
| Display advertising via third-party networks | Same — legal RPMs are even higher |
| No B2B offering (ToS bans commercial use) | **We add**: sponsored listings + data/API product |
| No editorial value (raw data dump) | **We add**: verified profiles, structured bios, trust badges |
| No direct sales | **We add**: attorney placement sales motion |

The core insight: VoterRecords.com proves the model at massive scale. We operate in a higher-value niche with more monetization layers. We don't need 100M records — we need 30,000 judge records done well.

---

## Implementation Priorities

### Build now (before traffic)
- [ ] Decide on 2–3 affiliate partners to apply to
- [ ] Design ad placement zones in the page templates (reserve space, don't serve yet)
- [ ] Design sponsored listing component (visual mockup)

### Turn on at first traffic
- [ ] AdSense account setup + integration
- [ ] Affiliate widget integration on judge profile and court pages
- [ ] Basic analytics: track pageviews, affiliate clicks, RPM

### Build for Phase 3
- [ ] Sponsored listing self-serve flow (or manual sales process)
- [ ] Stripe integration for monthly billing
- [ ] Advertiser dashboard (impressions, clicks delivered)

### Build for Phase 5
- [ ] API endpoint for judge data
- [ ] API key management and rate limiting
- [ ] Usage-based billing integration
