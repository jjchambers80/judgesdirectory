# Directory Strategy + Automated Data Collection (Applied to JudgesDirectory)

**Last Updated**: 2026-03-01  
**Status**: Draft (Actionable)

This note distills ideas from the transcript **“Automating Data Collection for Real Estate”** and applies them to JudgesDirectory (a programmatic SEO directory with a verification-first ingestion pipeline).

Related: [docs/business/directory-playbook-2025-notes.md](directory-playbook-2025-notes.md) for broader directory business strategy (AI search risk, monetization, timelines).
Related: [docs/business/directory-playbook-frey-podcast-notes.md](directory-playbook-frey-podcast-notes.md) for niche discovery + validation + “pillar page” tactics.

## The Big Idea: directories win when data collection becomes cheap

- A directory is just a structured set of pages people already search for. If you can publish _a lot_ of those pages, you get organic traffic.
- The hard part is almost never “build the website.” The hard part is “get the data and keep it updated.”
- LLM-assisted extraction flips the economics. The work that used to be 80 hours of manual copy/paste becomes a background job you monitor.

## Programmatic SEO, explained like a builder

- The pattern is simple: make a URL for every meaningful combination people search.
- For pickleball, it’s “courts in {city} {state}.”
- For JudgesDirectory, it’s already basically “judges in {county} {state}” plus court types and judge names.
- The trap is thin pages. The win is pages that answer a real question quickly, and have provenance.

### What this suggests for JudgesDirectory templates

- Keep the hierarchy pages (state/county/court) as the programmatic scaffolding.
- Make sure those pages earn their keep with:
  - clear “what is this court / jurisdiction?” context,
  - high-quality lists (no duplicates),
  - and tight internal linking to judge profiles.
- Put “verified only” front and center. Trust is the moat.

## The modern scraping pattern: seed → crawl → extract → enrich

The transcript’s approach is a solid general template:

1. **Seed** a dataset from a standardized source (e.g., Google Maps categories) to get names + canonical URLs.
2. **Crawl** the canonical URL (and sometimes its internal links) to find contact/details.
3. **Extract** into a strict schema (JSON) and store it.
4. **Enrich** from secondary sources.
5. **Publish** programmatic pages.

### How that maps to JudgesDirectory (without forcing a Google-Maps-shaped solution)

- Our “seed” is not Google Maps. It’s official court system rosters, court directories, and structured court site index pages.
- Our “crawl” is the roster page plus judge bio/profile pages.
- Our “extract” is already schema-based (Zod) and checkpointed.
- Our “enrich” is already in the architecture (bios + Ballotpedia + Florida Bar).
- Our “publish” is gated by manual verification.

In other words: the app is already aligned with the playbook. The opportunity is to **formalize it as a repeatable state expansion loop**.

## Cost is a feature (and model choice is a product decision)

Two transcript points matter operationally:

- Different models are good at different tasks.
- Cost differences are big enough that “default model choice” changes whether a project is viable.

### Practical translation for JudgesDirectory

- Prefer the cheapest model that reliably returns valid JSON for the majority case.
- Keep a “high accuracy / long context” fallback for nasty pages.
- Invest in deterministic extraction for known patterns because it’s effectively free and often more correct.

We already do most of this (deterministic extractor + multi-provider abstraction). The mental model to keep:

- Every scraping decision is either:
  - “Spend engineer time to make it deterministic,” or
  - “Spend model tokens forever.”

## Speed: why it can take a week (and why that’s still fine)

- Big crawls are slow because the dataset is huge, not because the AI is “slow.”
- The limiting factor becomes compute + concurrency + politeness (rate limits).
- A seven-day background run is still radically cheaper than humans doing the same thing.

### What this suggests for our harvesting ops

- Keep checkpointing and resumability as first-class.
- Treat harvesting like a batch job with observability:
  - success/failure counts,
  - field coverage,
  - dedupe rates,
  - and “unknown / low confidence” queues.

(This aligns with [docs/architecture/data-harvesting.md](../architecture/data-harvesting.md).)

## Where AI really helps: it follows links like a human would

The important shift described in the transcript:

- Before LLMs, scrapers needed hard-coded selectors.
- With LLM-enabled crawling, you can say “find me the phone number” and it can navigate to “Contact” or “About” pages.

### The JudgesDirectory version of that prompt

- “Find the roster table of active judges for this jurisdiction.”
- “Find each judge’s bio/profile link.”
- “Extract education, prior experience, term dates, and selection method.”
- “Return the source URLs for every extracted field.”

This is exactly the kind of work where an LLM is doing _clerical reading_, not creative writing.

## The moat: provenance + verification, not just volume

The transcript is bullish on directories because volume is now cheap.

JudgesDirectory should be bullish for a slightly different reason:

- Volume matters, but **trust matters more** in legal/civic info.
- “Verified only” plus “source URL everywhere” is the difference between a directory people use and a directory people side-eye.

## Concrete application: a “state expansion loop” checklist

If we wanted to turn the transcript’s strategy into a repeatable process for new states:

1. **Seed**
   - Collect the authoritative court system entry points (official directories, rosters, PDFs, etc.).
   - Store as a state config file (like Florida’s `florida-courts.json`).
2. **Fetch**
   - Start with our lightweight fetcher.
   - Add browser rendering only for the sites that require it.
3. **Extract**
   - Deterministic first.
   - LLM fallback.
   - Strict schema validation.
4. **Enrich**
   - Add state-specific enrichers where there’s a high-quality secondary source.
5. **Identity + Dedupe**
   - Ensure stable IDs early so duplicates don’t explode page counts.
6. **Quality Gate**
   - Produce a coverage report and push low-confidence records into the verification queue.
7. **Publish**
   - Only verified goes live.
   - Keep an update cadence (monthly/quarterly) depending on state churn.

## Quotes / lines that matter (from the transcript)

- “The hard part is gathering the data. The website is the easy part.”
- “You’re basically getting like a college level graduate and all you’re doing is pulling data out.”
- “Previously you had to hardcode everything… now it can decide which page to go to.”
- “It takes seven days, but I don’t have to do anything.” (This is the right mental model for our batch harvest runs.)

---

## One-Sentence Takeaway

Directories become viable businesses when you can turn data collection into a cheap, resumable background job.

## If You Only Have 2 Minutes

- Programmatic SEO is the distribution engine. Data pipelines are the constraint.
- Seed from structured sources. Then crawl canonical URLs for depth.
- Use deterministic extraction whenever you can. Tokens are forever.
- Pick the cheapest model that reliably returns valid JSON.
- Treat harvesting like ops: checkpointing, quality reports, and a verification queue.
- JudgesDirectory’s moat is provenance + verified publishing, not raw volume.

## References & Rabbit Holes

- **Outscraper** — seeding locations from Google Maps; conceptually similar to seeding courts from authoritative indexes.
- **Firecrawl** — LLM-friendly crawling that follows links; see also our evaluation in [docs/research/web-scraping-tools.md](../research/web-scraping-tools.md).
- **Browse.ai** — no-code “scrape this site for these fields” workflow.
- **Operator** (OpenAI) — generalized browser agent; slower, but shows the direction.
- **Lovable / Bolt / Replit / Cursor** — “build without coding” tools; more relevant for fast internal tooling than for harvesting itself.
