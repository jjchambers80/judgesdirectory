# Pitfalls Research

**Domain:** Legal judge directory — monetization, multi-state expansion, programmatic SEO at scale
**Researched:** 2026-03-22
**Confidence:** HIGH (based on Google official documentation, FTC guidelines, project codebase review, and established programmatic SEO patterns)

---

## Critical Pitfalls

### Pitfall 1: Scaled Content Abuse Penalty from Thin Programmatic Pages

**What goes wrong:**
Google's spam policies explicitly target "scaled content abuse" — generating large numbers of pages that provide little value to users. When expanding from Florida (one state with verified data) to Texas and California, the temptation is to publish every URL in the hierarchy immediately (`/judges/texas/harris-county/district-court/`) even when judge coverage is 20% or the data is unverified. Google sees hundreds of near-empty pages with identical templates and classifies the site as scaled content abuse. The entire domain loses rankings — including the Florida pages that were performing well.

**Why it happens:**
Programmatic SEO rewards page count, so the instinct is "publish everything, fill in later." The state → county → court → judge hierarchy creates ~3,200 county pages × ~5 court types per county = ~16,000 skeleton pages per state. Publishing these with 0-3 judges each crosses the thin content line. Google's December 2024 and March 2025 core updates specifically cracked down on programmatic sites with automatically-generated low-value pages.

**How to avoid:**

- **Gate publishing on coverage thresholds**: Don't publish a county page until it has ≥5 verified judges. Don't publish a court-type page until it has ≥3 verified judges for that court. Use `noindex` for pages below threshold.
- **Implement the pillar page strategy** documented in [docs/architecture/pillar-pages-vs-programmatic-seo.md](../../docs/architecture/pillar-pages-vs-programmatic-seo.md): Start each new state with 5-10 high-coverage county pillar pages, then expand to programmatic depth as verification throughput proves sufficient.
- **Add a "page quality score"** that gates indexability: combine judge count, field completeness, source attribution, and freshness into a composite score. Below threshold → `noindex, follow`.

**Warning signs:**

- Google Search Console shows "Crawled - currently not indexed" or "Discovered - currently not indexed" climbing for new state pages
- Impressions per page dropping across the entire domain (not just new pages)
- Search Console Coverage report showing "Low quality page" or "Soft 404" warnings
- New state pages getting zero impressions after 30+ days despite being indexed

**Phase to address:**
Multi-state expansion phase. The expansion architecture must include publishing gates and quality thresholds as non-negotiable launch requirements, not post-launch optimizations.

---

### Pitfall 2: Ad Integration Destroys Core Web Vitals and Kills SEO Rankings

**What goes wrong:**
Adding AdSense or any display ad network introduces third-party JavaScript that directly degrades all three Core Web Vitals:

- **LCP (Largest Contentful Paint)**: Ad scripts block rendering; LCP regresses from <2.5s to >4s. Google's threshold is 2.5s.
- **CLS (Cumulative Layout Shift)**: Ads load asynchronously and push content down. Without reserved space, CLS jumps from 0.01 to >0.25. Google's threshold is 0.1.
- **INP (Interaction to Next Paint)**: Ad auction JavaScript runs on the main thread, blocking interactivity. INP degrades past the 200ms threshold.

Google uses Core Web Vitals as a ranking signal. A site that ranks well pre-ads can drop 10-30 positions after adding ads, wiping out the traffic that makes ads profitable in the first place. This is the #1 reason programmatic SEO sites fail at monetization: ads kill the rankings that generated the traffic.

**Why it happens:**
AdSense's default implementation loads synchronously and doesn't reserve layout space. Developers drop in the script tag, see revenue trickle in, and don't realize rankings are deteriorating over 2-4 weeks as CrUX data updates. By the time it's visible in Search Console, the damage is done.

**How to avoid:**

- **Reserve explicit dimensions for every ad slot** using CSS `min-height` and `aspect-ratio`. This prevents CLS. For AdSense auto-ads, use `ins` element styling to reserve space.
- **Lazy-load ads below the fold**: Use `loading="lazy"` or Intersection Observer. Only the first viewport ad should load eagerly.
- **Load ad scripts with `async` or `defer`**, never synchronous. Better: use `requestIdleCallback` or `setTimeout(fn, 3000)` to defer ad initialization until after LCP.
- **No ads above the fold on judge profile pages** (already specified in monetization plan — enforce this technically, not just as policy).
- **Measure before and after**: Run Lighthouse CI in the deployment pipeline. Set budgets: LCP < 2.5s, CLS < 0.1, INP < 200ms. Fail the deploy if ads push past thresholds.
- **Budget for Vercel Edge rendering**: SSR pages should have TTFB < 800ms with ads. If ad scripts add >500ms to TTFB, something is wrong.

**Warning signs:**

- PageSpeed Insights mobile score drops below 70 after ad integration
- CrUX data in Search Console shows "Poor" URLs climbing
- Lighthouse CI reports CLS > 0.1 on pages with ads
- Ad revenue per session _decreases_ over time (fewer sessions because rankings dropped)

**Phase to address:**
Display ad integration phase. Must include a performance budget and automated testing gate. Consider a "canary" approach: deploy ads to 10% of pages first, monitor CWV for 2 weeks, then expand.

---

### Pitfall 3: Attorney Referral Compliance Violations in the Legal Vertical

**What goes wrong:**
The legal industry has the most regulated advertising rules of any vertical. Attorney referral services are specifically regulated by state bar associations. If JudgesDirectory's "Find an Attorney" widgets are classified as an attorney referral service (rather than advertising), the site could face:

- State bar complaints for operating an unlicensed lawyer referral service
- FTC enforcement for insufficient disclosure of material connections (affiliate commissions)
- Individual state UPL (unauthorized practice of law) claims if the site appears to "recommend" attorneys

The FTC's Endorsement Guides require clear disclosure of financial relationships. Google's ad policies require affiliate links to be clearly labeled. State bars (especially California, Florida, Texas) have specific rules about lawyer referral services that differ from general advertising.

**Why it happens:**
The line between "advertising" (legal) and "referral service" (regulated) depends on language. "Find an Attorney →" is usually fine. "We recommend these attorneys for your case" could be classified as a referral service requiring licensing. Practice-area targeting (showing criminal defense attorneys on criminal court pages) increases the risk of looking like a referral service because it implies matching.

**How to avoid:**

- **Use advertising language, not recommendation language**: "Sponsored Attorneys," "Legal Advertising," "Attorney Listings" — never "Recommended," "Our Pick," "Best Attorney for Your Case."
- **Always include the disclosure**: "Sponsored · We may earn a referral fee" (already in the monetization plan mockup — make this technically mandatory, not optional).
- **Mark all affiliate links with `rel="sponsored noopener"`**: This satisfies both Google's link spam policy and disclosure requirements.
- **Add a site-wide Legal Advertising Disclaimer page** explaining that sponsored listings are paid placements, not endorsements, and that JudgesDirectory does not evaluate or recommend attorneys.
- **Research each affiliate partner's compliance posture**: Avvo, LegalMatch, and FindLaw each have their own compliance requirements for affiliates. Get written terms before integration.
- **Review Florida Bar Rule 4-7.22** (Lawyer Referral Services) and equivalent rules in TX and CA before launching affiliate widgets in those states.

**Warning signs:**

- Affiliate partner rejects your application citing compliance concerns
- State bar inquiry or complaint letter
- Google AdSense policy violation notice for "deceptive labeling"
- User complaints about feeling "steered" toward specific attorneys

**Phase to address:**
Affiliate referral integration phase. Legal review of copy and placement must happen before the first widget goes live, not after. Budget 1-2 weeks for compliance review.

---

### Pitfall 4: Multi-State Scraping Pipeline Breaks on Court Website Diversity

**What goes wrong:**
Florida's court websites share significant structural similarity (many use the same CMS, and 19/27 sites work with deterministic extraction). Texas has 254 counties with court websites ranging from modern React apps to 1990s-era static HTML to county clerk PDF rosters to sites behind Cloudflare bot protection. California has 58 counties with similar diversity. The Florida-optimized pipeline — deterministic CSS/XPath patterns → LLM fallback → Scrapling browser automation — hits failure modes at scale:

- **Deterministic extractors cover <30%** of non-Florida sites (different CMSes, different HTML structures)
- **LLM costs explode**: If 70% of sites need LLM extraction instead of 30%, costs go from ~$5/state (Florida) to ~$25-50/state/run
- **Cloudflare/bot protection blocks**: More states = more sites blocking automated access. The Scrapling fallback (headless browser) helps but is slow and expensive at scale
- **Data format variance**: County-level courts in TX might list judges differently than state-level courts. Name formats, title variations ("Judge" vs "Hon." vs "Justice"), and court naming conventions differ wildly across states

**Why it happens:**
Florida was a best-case scenario for pipeline development: centralized court system, modern websites, consistent structure. Texas and California are worst-case: fragmented county systems, ancient infrastructure, aggressive bot protection. The pipeline works for Florida because Florida's courts are relatively uniform; that uniformity doesn't transfer.

**How to avoid:**

- **Reconnaissance before harvest**: Before commissioning a full state harvest, run a "site survey" on 10-20 representative court URLs. Categorize them: deterministic-ready, LLM-needed, browser-needed, blocked/inaccessible. Use this to estimate cost and timeline.
- **Build a court CMS fingerprint library**: Many county courts use a small number of CMS platforms (Tyler Technologies Odyssey, Granicus, custom WordPress themes). Identify the CMS and map to extraction patterns rather than building per-county patterns.
- **Budget LLM costs per state**: Track and cap LLM spend per harvest run. Set alerts at $10/state. If a state consistently exceeds budget, invest in deterministic extractors for its most common CMS patterns.
- **Accept partial coverage**: A state with 60% county coverage and 90% verification is better than rushing 100% coverage with 50% verification. Publish what's verified; mark the rest as "coming soon."
- **Implement circuit breakers**: If >50% of a state's URLs fail extraction in a single run, halt and investigate rather than burning through LLM tokens on broken extraction.

**Warning signs:**

- LLM API costs per state > 3x Florida's baseline
- Extraction success rate drops below 70% for a new state
- Scrapling browser automation runs exceeding 2 hours per state
- High rate of duplicate or malformed judge records in new states

**Phase to address:**
Multi-state expansion phase. The TX/CA pilot must include a reconnaissance step and cost-capping infrastructure. Don't assume Florida's patterns transfer.

---

### Pitfall 5: Premature Mediavine/Raptive Migration Causes Revenue Gap

**What goes wrong:**
The monetization plan calls for starting with AdSense then graduating to Mediavine (50K sessions/month) or Raptive (100K pageviews/month). The dangerous transition: removing AdSense ads, applying to Mediavine, waiting 2-6 weeks for approval, dealing with a rejection, then scrambling to re-enable AdSense — all while earning $0. Additionally, Mediavine's ad code is significantly heavier than AdSense and requires more aggressive CWV optimization. Sites that passed CWV with AdSense often fail with Mediavine's full ad stack.

**Why it happens:**
Once traffic hits threshold, the 40-60% RPM increase from Mediavine looks irresistible. The application seems simple. But Mediavine has content quality requirements (original, long-form content), traffic quality requirements (organic search >50%), and technical requirements (no interstitials, site speed standards). Programmatic SEO directories with templated pages are frequently rejected by Mediavine on content quality grounds, regardless of traffic volume.

**How to avoid:**

- **Don't remove AdSense until Mediavine is live and earning**. Mediavine allows a parallel test period. Use it.
- **Apply to Mediavine Journey early** (3-5K sessions threshold) to get feedback on content quality requirements before the main program. Journey acceptance at lower traffic is a green light for the full program.
- **Prepare pillar content** before applying: 10-15 long-form pages (state judicial system overviews, "understanding your judge" guides, court system explainers) that demonstrate original editorial content alongside the programmatic pages.
- **Test Mediavine's ad weight in staging** before cutover. Run Lighthouse with their test script to validate CWV.
- **Have a rollback plan**: Keep AdSense configuration in code behind a feature flag so you can revert within minutes if Mediavine underperforms or is rejected.

**Warning signs:**

- Mediavine Journey application rejected citing "insufficient original content"
- CWV scores drop >15 points after switching to Mediavine's ad script in staging
- Revenue per session declines in the first week of Mediavine (could indicate poor ad targeting for legal content)
- Application processing takes >4 weeks (typical for borderline sites)

**Phase to address:**
Display ad integration phase (initially AdSense) and a separate future phase for premium ad network migration. These should not be the same phase — validate AdSense + CWV first, then plan the Mediavine transition as a distinct milestone goal.

---

### Pitfall 6: Stale Data Erodes Trust and Triggers "Helpful Content" Demotion

**What goes wrong:**
Judges retire, get reassigned, lose elections, or pass away. If JudgesDirectory shows a judge as active 6 months after they left the bench, the site's core value proposition — accuracy and trust — collapses. At scale (50 states), the freshness problem becomes existential:

- A journalist cites an incorrect judge assignment → reputational damage
- An attorney relies on an outdated court roster → professional consequences and angry feedback
- Google's Helpful Content System detects that a significant percentage of pages contain stale information → site-wide demotion

Google's Helpful Content System evaluates whether content is "created for people" and whether it provides value. Programmatic pages with outdated information that doesn't match reality are the textbook definition of unhelpful content.

**Why it happens:**
Harvest pipelines are built to _populate_ data, not to refresh it. The initial focus is always "scrape everything" and freshness becomes an afterthought. Without automated refresh cycles, data rots silently. The longer a record goes without verification, the higher the probability it's wrong — and there's no visibility into which records are most likely stale.

**How to avoid:**

- **Implement automated refresh harvesting on a schedule**: Monthly for active states, quarterly for all states. The existing `lastHarvestAt` field enables staleness detection.
- **Display "Last verified" dates on public pages**: This sets user expectations and creates internal accountability. "Last verified: March 2026" is honest; showing no date when data is from 2024 is deceptive.
- **Build staleness alerts**: Records not refreshed in >90 days should be flagged in the admin dashboard. Records >180 days should trigger automatic demotion from VERIFIED to NEEDS_REVIEW.
- **Monitor source URL health**: The existing URL health system (spec 012) should trigger re-harvest when a source page changes significantly. A source URL returning 404 means the judge likely left.
- **Implement a "data freshness" quality signal** that feeds into the noindex gate: if >30% of records on a page are >180 days old, consider noindexing until refreshed.

**Warning signs:**

- User emails or social media complaints about incorrect judge information
- Source URLs returning 404/404-adjacent status (judge removed from court website)
- Search Console shows declining CTR on pages that previously performed well (users bounce when they see outdated info)
- `lastHarvestAt` audit shows >20% of records older than 90 days

**Phase to address:**
Must be addressed in the multi-state expansion phase as operational infrastructure, not deferred to a "maintenance" phase. Expansion without refresh automation creates a ticking bomb.

---

### Pitfall 7: AdSense Account Suspension from Programmatic Page Volume

**What goes wrong:**
Google AdSense has specific policies around "made-for-advertising" (MFA) sites — sites where the primary purpose appears to be displaying ads rather than providing value. Programmatic SEO directories are frequently flagged as MFA because they have:

- Thousands of templated pages with similar structure
- Relatively thin content per page (judge name, court, a few fields)
- Ads on every page
- High page count relative to content depth

An AdSense suspension is devastating: it typically takes 30+ days to appeal, during which revenue is $0, and Google holds the unpaid balance. Re-approval is not guaranteed.

**Why it happens:**
AdSense's automated review systems flag sites with high page-to-content ratios. A judge profile page with 200 words of content and 3 ad slots looks like MFA to an algorithm. The site legitimately provides value (verified government data with source attribution), but the automated system can't distinguish this from template spam.

**How to avoid:**

- **Increase content depth on ad-serving pages**: Add contextual content — court jurisdiction descriptions, how to find your case, local court contact information. 400+ words per page is the safety zone.
- **Don't place ads on every page**: Skip ads on very thin pages (< 200 words of content). Only show ads on pages that meet a minimum content threshold.
- **Use AdSense's "Auto ads" initially** rather than manual placements — Google's own system will avoid over-saturating thin pages, and it signals good faith.
- **Apply for AdSense before scaling to millions of pages**: Get approval with Florida's ~1,000 quality pages first. Don't bulk-add 50,000 pages and then apply — the spike looks suspicious.
- **Maintain a high organic:direct traffic ratio**: AdSense favors sites with >60% organic search traffic. If most traffic is direct or referral, the site looks more legitimate.

**Warning signs:**

- AdSense dashboard shows "Policy center" notifications
- "Limited ad serving" message appears (this is the pre-suspension warning)
- RPM drops suddenly without traffic changes (Google reducing ad quality/fill rate)
- Application rejected with "Insufficient content" or "Policy violation" message

**Phase to address:**
Display ad integration phase. Apply for AdSense with just the Florida dataset, with all pages meeting content depth requirements. Don't add ads to new states until they meet the same content standards.

---

## Technical Debt Patterns

| Shortcut                               | Immediate Benefit                                  | Long-term Cost                                                                                                  | When Acceptable                                                            |
| -------------------------------------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Inline ad scripts in page components   | Fast to implement, ads visible immediately         | CWV degradation, no A/B testing capability, hard to swap ad networks                                            | Never — always abstract ads behind a component with lazy loading           |
| Hardcoded affiliate partner URLs       | Ship affiliate widgets in a day                    | Changing partners requires code deploys across hundreds of pages; broken links if partner changes URL structure | Never — use a partner configuration table and resolve URLs at render time  |
| Skip `noindex` gating for new states   | More pages indexed faster, looks like rapid growth | Thin pages dilute domain authority; potential scaled content penalty                                            | Only if coverage is >80% verified judges per page                          |
| Single LLM provider for all extraction | Simpler code, one API key                          | Provider outage = pipeline stops; no cost comparison                                                            | First 2 states only — add fallback provider before state #3                |
| No automated CWV monitoring            | Save $20/month on monitoring tools                 | Rankings silently degrade for weeks before noticed                                                              | Never — even PageSpeed Insights API (free) on a cron is sufficient         |
| Deferring data refresh automation      | Ship new states faster                             | Data rots within 6 months; trust collapses; Helpful Content demotion                                            | Only for states in "beta" with explicit "data may be outdated" disclaimers |

## Integration Gotchas

| Integration                    | Common Mistake                                                                                            | Correct Approach                                                                                                                                               |
| ------------------------------ | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google AdSense**             | Placing ads on pages before they're indexed; triggering MFA review                                        | Apply with core pages indexed and organically ranking. Wait for stable AdSense approval before expanding ad presence to new states.                            |
| **Avvo/LegalMatch affiliates** | Using affiliate links without `rel="sponsored"` attribute                                                 | All affiliate links must use `rel="sponsored noopener"` — Google's link spam policy explicitly requires this for paid links. Failing this = link spam penalty. |
| **Google Search Console**      | Submitting sitemaps with 50K+ URLs before content is ready                                                | Submit sitemaps incrementally. Start with state-level and high-coverage counties. Add new URLs as verification completes, not as pages exist.                  |
| **Vercel deployment**          | SSR pages with ad scripts exceeding Vercel's serverless function timeout (10s default)                    | Ad scripts must load client-side, never in SSR. Vercel Edge Functions have a 25ms CPU limit — ad auction JS must never run server-side.                        |
| **Mediavine/Raptive**          | Assuming approval because traffic threshold is met                                                        | These networks manually review content quality. Prepare 10+ editorial pages and ensure site passes their internal CWV audit before applying.                   |
| **Analytics (GA4/Vercel)**     | Adding analytics tracking after ads, making it impossible to establish a pre-ads performance baseline     | Instrument analytics _first_, collect 30 days of baseline CWV + traffic data, _then_ add ads. Without baseline, you can't measure ad impact.                   |
| **Prisma/PostgreSQL**          | Running expensive aggregate queries (judge counts, coverage stats) on every page render for stats widgets | Pre-compute aggregates in a materialized view or cron job. Render-time aggregation works for Florida but will timeout at 50-state scale.                       |

## Performance Traps

| Trap                                           | Symptoms                                                                                                                      | Prevention                                                                                                                                                                                  | When It Breaks                                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **N+1 queries on county pages**                | Page load time scales linearly with judge count per county; TTFB > 3s on large counties                                       | Eager-load judges with court relationships in a single Prisma query using `include`. Add database indexes on `(stateId, countyId, status)`.                                                 | >50 judges per page (e.g., Los Angeles County, Harris County TX)                              |
| **Sitemap generation at request time**         | `/sitemap.xml` times out as page count grows; Google stops crawling new pages                                                 | Pre-generate sitemaps as static files during build. Use sitemap index with per-state sitemaps. Vercel's 10s function timeout = crash at ~10K URLs.                                          | >5,000 total published pages                                                                  |
| **Unoptimized judge photos**                   | Adding photos to profile pages increases page weight by 200-500KB; LCP regresses                                              | Use Next.js `Image` component with automatic WebP/AVIF, fixed dimensions, `priority` only for above-fold hero. Serve from Vercel's image CDN.                                               | When judge photo pipeline ships — every photo without optimization is a CWV regression        |
| **Full-text search without pagination limits** | `pg_trgm` search scans entire table; response time degrades as record count grows                                             | Add `LIMIT` clauses, paginate results, and add a composite index on `(status, name)`. Consider `tsvector` full-text search at >100K records.                                                | >50,000 total judge records                                                                   |
| **Client-side hydration with ads**             | React hydration + ad script initialization = 2-3 second main thread block on mobile                                           | Defer ad initialization until after hydration completes. Use `useEffect` with `requestIdleCallback` for ad slot rendering.                                                                  | On any page with ads on a mid-range mobile device (the 75th percentile CWV target)            |
| **Database connection pool exhaustion**        | Serverless functions each open new DB connections; concurrent requests during crawl events exhaust Postgres connection limits | Use Prisma's connection pooling with PgBouncer or Prisma Accelerate. Set `connection_limit` in the Prisma schema. Vercel's concurrent function limit × DB connection limit must be modeled. | >50 concurrent serverless function invocations (Google crawling new state pages aggressively) |

## Phase-Specific Warnings

| Phase Topic                          | Likely Pitfall                                                                             | Mitigation                                                                                                                           |
| ------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| **Analytics Instrumentation**        | Adding analytics without establishing CWV baseline first                                   | Deploy analytics 30+ days before any monetization changes                                                                            |
| **Display Ad Integration (AdSense)** | CLS from ads loading without reserved space; LCP regression from ad scripts                | Reserved ad slot dimensions, lazy loading, deferred script initialization, Lighthouse CI budgets                                     |
| **Affiliate Referral Widgets**       | Unlicensed attorney referral risk; missing FTC disclosures; missing `rel="sponsored"`      | Legal copy review, mandatory disclosure component, `rel="sponsored noopener"` on all affiliate links                                 |
| **Sponsored Attorney Listings**      | Blurring the line between editorial content and paid placements                            | Technical enforcement: sponsored content rendered from a separate data source with mandatory "Sponsored" badge                       |
| **Multi-State Expansion (TX/CA)**    | Thin content penalty; pipeline cost explosion; stale data without refresh automation       | Coverage gating, CMS fingerprinting, cost caps, staleness alerting, reconnaissance before full harvest                               |
| **Design System Completion**         | Mid-monetization UI changes break ad slot positioning and CWV measurements                 | Complete the shadcn/ui migration _before_ adding ads. Ad slots designed for the old CSS variable system will break during migration. |
| **Performance Optimization**         | Optimizing before knowing what's slow (no analytics yet)                                   | Analytics + CWV monitoring must precede optimization work. Optimize based on data, not assumptions.                                  |
| **Judge Photo Pipeline**             | Unoptimized images tank LCP on profile pages                                               | Next.js Image with fixed dimensions, lazy loading for below-fold photos, WebP/AVIF format                                            |
| **Pillar Pages**                     | Building pillar pages that duplicate programmatic page content instead of complementing it | Pillar pages should aggregate and editorialize, not repeat. Clear canonical strategy to prevent self-cannibalization.                |

---

## Sources

- Google Spam Policies (updated 2025-12-10): Scaled content abuse, thin affiliation, doorway abuse policies — https://developers.google.com/search/docs/essentials/spam-policies
- Google Web Vitals (updated 2024-10-31): LCP < 2.5s, INP < 200ms, CLS < 0.1 thresholds — https://web.dev/articles/vitals
- Google AdSense Ad Placement Policies: MFA detection, accidental clicks, deceptive labeling — https://support.google.com/adsense/answer/1346295
- FTC Endorsement Guides: Affiliate disclosure requirements — https://www.ftc.gov/business-guidance/resources/disclosures-101-social-media-influencers
- Project monetization plan: [docs/business/monetization-plan.md](../../docs/business/monetization-plan.md)
- Project pillar page strategy: [docs/architecture/pillar-pages-vs-programmatic-seo.md](../../docs/architecture/pillar-pages-vs-programmatic-seo.md)
- Project competitor analysis: [docs/business/competitor-analysis-voterrecords.md](../../docs/business/competitor-analysis-voterrecords.md)
- Project data harvesting architecture: [docs/architecture/data-harvesting.md](../../docs/architecture/data-harvesting.md)
- Project directory playbook notes: [docs/business/directory-playbook-2025-notes.md](../../docs/business/directory-playbook-2025-notes.md)
