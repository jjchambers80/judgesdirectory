# Web Scraping Tools for AI-Powered Data Extraction

**Last Updated**: 2026-02-28  
**Status**: Active Research  
**Applies To**: Multi-state expansion planning

## Executive Summary

This document evaluates AI-powered web scraping tools for extracting judicial data from government websites. Our current custom implementation (cheerio + turndown + Claude) is optimal for the Florida pilot. This research informs future decisions as we scale to additional states.

## Current Implementation (Florida Pilot)

| Component | Technology | Purpose |
|-----------|------------|---------|
| HTTP Fetching | Native `fetch` | Rate-limited requests with retry logic |
| HTML Parsing | `cheerio` | DOM manipulation, noise removal |
| HTML → Markdown | `turndown` | Token reduction (~60-70% smaller) |
| SPA Handling | Custom extractors | Next.js `__NEXT_DATA__`, Gatsby `page-data.json` |
| LLM Extraction | Anthropic Claude | Structured JSON output via Zod schemas |

**Location**: `scripts/harvest/`

### Strengths
- Purpose-built for Florida court site patterns
- Full control over extraction logic
- No external service dependencies (beyond Claude API)
- Handles `flcourts.gov` Next.js SPA architecture

### Limitations
- No headless browser for heavy JS-rendered sites
- Manual adaptation needed per state's site architecture

---

## Tool Comparison Matrix

| Tool | Best For | Output | JS Rendering | Anti-Bot | Cost | Open Source |
|------|----------|--------|--------------|----------|------|-------------|
| **Firecrawl** | RAG pipelines, AI agents | Markdown/JSON | ✅ Built-in | ✅ Handled | $16/mo+ | ❌ |
| **ScrapeGraphAI** | Complex/changing layouts | Structured JSON | ✅ Built-in | Partial | $17/mo+ | Partial |
| **Crawl4AI** | Privacy, high volume | Markdown/JSON | ✅ Playwright | ❌ DIY | Free | ✅ |
| **Bright Data** | Enterprise scale | Any | ✅ Full | ✅ Enterprise | Usage-based | ❌ |
| **Custom (Current)** | Targeted extraction | Markdown/JSON | ❌ Basic | ❌ DIY | Claude API only | ✅ |

---

## Tool Deep Dives

### 1. Firecrawl

**Website**: firecrawl.dev  
**Pricing**: Free tier available; paid starts ~$16/month

**What it does**: Turns websites into clean Markdown or structured JSON optimized for LLM consumption. Handles JavaScript rendering, anti-bot measures, and recursive crawling automatically.

**When to use**:
- Scaling to 20+ states with diverse site technologies
- Sites with aggressive anti-bot protection
- Need "set and forget" crawling without site-specific code

**Integration pattern**:
```typescript
// Replace fetcher.ts with Firecrawl for problem sites
import Firecrawl from '@mendable/firecrawl-js';

const firecrawl = new Firecrawl({ apiKey: process.env.FIRECRAWL_API_KEY });
const result = await firecrawl.scrapeUrl(url, { formats: ['markdown'] });
// Pass result.markdown to existing extractor.ts
```

**Verdict**: Consider when expanding beyond 10 states or encountering sites that defeat our current fetcher.

---

### 2. ScrapeGraphAI

**Website**: scrapegraphai.com  
**Pricing**: Free tier; paid ~$17/month

**What it does**: Uses "graph logic" to understand website structure via natural language prompts. Adapts to layout changes without code updates.

**When to use**:
- Sites with frequently changing HTML structure
- Non-technical team members need to define extraction rules
- Complex nested data structures

**Example prompt**:
```
"Extract all judge names, their court assignments, and counties from this judicial roster page"
```

**Verdict**: Overkill for government sites (which rarely change structure). Better suited for e-commerce or news sites.

---

### 3. Crawl4AI (Recommended for Future)

**Website**: github.com/unclecode/crawl4ai  
**Pricing**: Free (open source)

**What it does**: Open-source async web crawler optimized for LLM data extraction. Uses Playwright for JS rendering. Can run entirely offline with local models.

**When to use**:
- High-volume scraping where API costs matter
- Sites requiring full browser rendering
- Privacy requirements (data stays local)
- States with modern React/Vue court websites

**Integration pattern**:
```python
# Python-based — would run as subprocess or separate service
from crawl4ai import AsyncWebCrawler

async with AsyncWebCrawler() as crawler:
    result = await crawler.arun(url=court_url)
    # result.markdown → pass to Claude extractor
```

**Node.js alternative**: Use Playwright directly in our fetcher:
```typescript
import { chromium } from 'playwright';

async function fetchWithBrowser(url: string): Promise<string> {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'networkidle' });
  const html = await page.content();
  await browser.close();
  return cleanHtml(html); // existing function
}
```

**Verdict**: **Top choice for expansion**. Add Playwright-based fetching as an optional mode in `fetcher.ts` for JS-heavy sites.

---

### 4. Bright Data

**Website**: brightdata.com  
**Pricing**: Usage-based (enterprise)

**What it does**: Enterprise-grade web data platform with proxy networks, CAPTCHA solving, and browser automation.

**When to use**:
- Scraping at massive scale (millions of pages)
- Sites with sophisticated bot detection
- Need residential/mobile proxies

**Verdict**: Unnecessary for government court websites. Reserve for extreme cases only.

---

## LLM Model Recommendations

| Model | Strengths | Best For |
|-------|-----------|----------|
| **Claude 3.5 Sonnet** | Long context, accuracy | Large HTML pages, complex rosters |
| **Claude 3.5 Haiku** | Speed, cost | Simple pages, high volume |
| **GPT-4o** | Structured output, reasoning | Interactive elements, validation |

**Current choice**: Claude Sonnet (claude-sonnet-4-5-20250929) — optimal balance for court page extraction.

---

## Expansion Roadmap

### Phase 1: Florida (Current)
- Custom fetcher with Next.js/Gatsby SPA support
- Claude Sonnet extraction
- No additional tools needed

### Phase 2: Southeast States (5-10 states)
- Audit each state's court website technology
- Add Playwright fallback to `fetcher.ts` for JS-heavy sites
- Consider Crawl4AI if volume justifies Python service

### Phase 3: National Scale (25+ states)
- Evaluate Firecrawl for states with anti-bot protection
- Implement site-specific adapter pattern
- Consider Haiku for high-volume, simple pages

---

## Decision Framework

```
Is the site a static HTML page?
  → Yes: Use current cheerio + turndown fetcher
  → No: Is it a Next.js/Gatsby SPA?
    → Yes: Use existing SPA extractors
    → No: Does it require full browser rendering?
      → Yes: Add Playwright to fetcher.ts
      → No: Does it have anti-bot protection?
        → Yes: Consider Firecrawl
        → No: Debug and extend current fetcher
```

---

## References

- [Firecrawl Documentation](https://docs.firecrawl.dev)
- [Crawl4AI GitHub](https://github.com/unclecode/crawl4ai)
- [ScrapeGraphAI](https://scrapegraphai.com)
- [Anthropic Claude API](https://docs.anthropic.com)

---

## Changelog

| Date | Change |
|------|--------|
| 2026-02-28 | Initial research document created |
