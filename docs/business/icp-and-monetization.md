# judgesdirectory.org — ICP & Monetization

**Last Updated**: 2026-03-01
**Status**: Draft

## ICP (Ideal Customer Profiles)

This product is consumer-facing, but the likely paying customers are advertisers / partners who want visibility in front of high-intent legal traffic.

### ICP 1 — Local Law Firms (Practice-area + geography match)

**Who**: Small-to-mid law firms serving a county/metro area.

**Why they care**:
- Local legal clients often search judge names and court info during active cases.
- Strong “contextual” adjacency: a judge profile page is plausibly relevant to legal representation.

**What to sell**:
- Sponsored placements on jurisdiction/court/judge pages
- Practice-area ads (e.g., criminal defense, family law) targeted to county/court pages

**Target decision maker**: Managing partner, marketing director, office manager.

**Messaging angle**:
- “Reach people searching for court/judge information in your county.”

### ICP 2 — Legal Marketing Agencies

**Who**: Agencies managing SEO/PPC and lead gen for multiple law firms.

**Why they care**:
- They buy media/placements at scale.
- They can bring multiple end-clients quickly.

**What to sell**:
- Bulk packages (multi-county placements)
- Reporting/UTM tracking

**Target decision maker**: Agency owner, head of paid media.

### ICP 3 — Legal Tech / Research Platforms (Partner / data customer)

**Who**: Vendors serving attorneys (case management, research, docketing).

**Why they care**:
- Potential partnership distribution (“see judge profile” links)
- Potential data product in future (clean, verified judge directory)

**What to sell** (later):
- API access or licensed dataset (only if you can meet quality + update frequency)

**Target decision maker**: Partnerships lead, product manager, data lead.

### ICP 4 — Media / Journalism / Civic Orgs (Distribution partner)

**Who**: Local news, civic transparency orgs, legal education sites.

**Why they care**:
- Judge lookups are common in reporting.

**What to sell**:
- Not necessarily monetization-first; could be backlinks/distribution partnerships.

## Positioning: What You’re “Really Selling”

A credible, navigable, source-attributed “map” of the judiciary that search engines can index and people can trust.

Differentiators to emphasize (aligned with current specs/architecture):
- Source URL for every public profile
- Manual verification gate (publish verified only)
- Structured data + sitemaps for discoverability
- Scalable ingestion pipeline that doesn’t sacrifice provenance

## Monetization Hypotheses (Phase-Ordered)

### 1) Ads (lowest friction)

**Pros**: Simple, can start with low traffic.
**Cons**: Lower ARPU; can conflict with trust if too aggressive.

**Implementation note**: Keep ad density conservative; prefer “sponsored” blocks that don’t look deceptive.

### 2) Attorney Placements / Sponsorships (higher ARPU)

**Pros**: Higher value per page; aligns with local intent.
**Cons**: Requires sales/outreach + policy decisions (what placements are allowed).

**Critical rule**: Must not imply endorsement of legal services; keep disclaimers clear.

### 3) Data/API product (hardest, potentially defensible)

**Pros**: Potentially durable revenue if data becomes high-quality and updated.
**Cons**: Requires refresh cadence, provenance, and compliance posture.

## Sales Motion (Practical)

- Start with 1–2 counties in Florida as a “pilot inventory”:
  - sell a limited number of placements
  - validate conversion and advertiser satisfaction
- Expand inventory with state rollout once verification throughput is reliable.

## What to Validate Next (fastest learning)

1. **Demand**: Which pages get impressions/clicks (judge vs county vs court pages)?
2. **Intent**: Are visitors looking for representation, or just information?
3. **Pricing**: Are local firms willing to pay for contextual placements?
4. **Quality threshold**: What “accuracy bar” is required before advertisers will buy?
