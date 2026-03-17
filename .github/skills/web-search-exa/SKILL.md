# Exa — Neural Web Search & Research

Neural web search, content extraction, company and people research, code search,
and deep research via the Exa MCP server. Use when you need to: (1) search the
web for information, (2) find code examples or documentation, (3) research
companies or people, (4) extract content from URLs, or (5) run deep multi-step
research tasks.

Exa is a neural search engine. Unlike keyword-based search, it understands
meaning — you describe the page you're looking for and it finds it. Returns clean,
LLM-ready content with no scraping needed.

MCP server: `https://mcp.exa.ai/mcp`
Free tier: generous rate limits, no key needed for basic tools
API key: [dashboard.exa.ai/api-keys](https://dashboard.exa.ai/api-keys) — unlocks higher limits + all tools
Docs: [exa.ai/docs](https://exa.ai/docs)
GitHub: [github.com/exa-labs/exa-mcp-server](https://github.com/exa-labs/exa-mcp-server)

## Setup

Add the MCP server to your agent config:

```json
{
  "mcpServers": {
    "exa": {
      "url": "https://mcp.exa.ai/mcp"
    }
  }
}
```

To unlock all tools and remove rate limits, append your API key:

```
https://mcp.exa.ai/mcp?exaApiKey=YOUR_EXA_KEY
```

To enable specific optional tools:

```
https://mcp.exa.ai/mcp?exaApiKey=YOUR_KEY&tools=web_search_exa,web_search_advanced_exa,people_search_exa,crawling_exa,company_research_exa,get_code_context_exa,deep_researcher_start,deep_researcher_check,deep_search_exa
```

## Tool Reference

### Default tools (available without API key)

| Tool | Description |
|------|-------------|
| web_search_exa | General-purpose web search — clean content, fast |
| get_code_context_exa | Code examples + docs from GitHub, Stack Overflow, official docs |
| company_research_exa | Company overview, news, funding, competitors |

### Optional tools (enable via `tools` param, need API key for some)

| Tool | Description |
|------|-------------|
| web_search_advanced_exa | Full-control search: domain filters, date ranges, categories, content modes |
| crawling_exa | Extract full page content from a known URL — handles JS, PDFs, complex layouts |
| people_search_exa | Find LinkedIn profiles, professional backgrounds, experts |
| deep_researcher_start | Kick off an async multi-step research agent → detailed report |
| deep_researcher_check | Poll status / retrieve results from deep research |
| deep_search_exa | Single-call deep search with synthesized answer + citations (needs API key) |

## web_search_exa

Fast general search. Describe what you're looking for in natural language.

Parameters:

- `query` (string, required) — describe the page you want to find
- `numResults` (int) — number of results, default 10
- `type` — `auto` (best quality), `fast` (lower latency), `deep` (multi-step reasoning)
- `livecrawl` — `fallback` (default) or `preferred` (always fetch fresh)
- `contextMaxCharacters` (int) — cap the returned content size

```json
{
  "query": "blog posts about using vector databases for recommendation systems",
  "numResults": 8
}
```

## web_search_advanced_exa

The power-user tool. Everything `web_search_exa` does, plus domain filters, date filters, category targeting, and content extraction modes.

Extra parameters beyond basic search:

| Parameter | Type | Description |
|-----------|------|-------------|
| includeDomains | string[] | Only return results from these domains (max 1200) |
| excludeDomains | string[] | Block results from these domains |
| category | string | Target content type — see table below |
| startPublishedDate | string | ISO date, results published after this |
| endPublishedDate | string | ISO date, results published before this |
| maxAgeHours | int | Content freshness — 0 = always livecrawl, -1 = cache only, 24 = cache if <24h |
| contents.highlights | object | Extractive snippets relevant to query. Set maxCharacters to control size |
| contents.text | object | Full page as clean markdown. Set maxCharacters to cap |
| contents.summary | object | LLM-generated summary. Supports query and JSON schema for structured extraction |

Categories:

| Category | Description |
|----------|-------------|
| company | Company pages, LinkedIn company profiles |
| people | LinkedIn profiles, professional bios, personal sites |
| research paper | arXiv, academic papers, peer-reviewed research |
| news | Current events, journalism |
| tweet | Posts from X/Twitter |
| personal site | Blogs, personal pages |
| financial report | SEC filings, earnings reports |

## company_research_exa

One-call company research. Returns business overview, recent news, funding, and competitive landscape.

```json
{ "query": "Stripe payments company overview and recent news" }
```

## people_search_exa

Find professionals by role, company, location, expertise. Returns LinkedIn profiles and bios.

```json
{ "query": "VP of Engineering at healthcare startups in San Francisco" }
```

## get_code_context_exa

Search GitHub repos, Stack Overflow, and documentation for code examples and API usage patterns.

```json
{ "query": "how to implement rate limiting in Express.js with Redis" }
```

## crawling_exa

Extract clean content from a specific URL. Handles JavaScript-rendered pages, PDFs, and complex layouts. Returns markdown.

```json
{ "url": "https://arxiv.org/abs/2301.07041" }
```

Good for when you already have the URL and want to read the page.

## deep_researcher_start + deep_researcher_check

Long-running async research. Exa's research agent searches, reads, and compiles a detailed report.

Start a research task:

```json
{
  "query": "competitive landscape of AI code generation tools in 2026 — key players, pricing, technical approaches, market share"
}
```

Check status (use the researchId from the start response):

```json
{ "researchId": "abc123..." }
```

Poll `deep_researcher_check` until status is `completed`. The final response includes the full report.

## deep_search_exa

Single-call deep search: expands your query across multiple angles, searches, reads results, and returns a synthesized answer with grounded citations. Requires API key.

```json
{ "query": "what are the leading approaches to multimodal RAG in production systems" }
```

## Query Craft

Exa is neural — it matches on meaning, not keywords. Write queries like you'd describe the ideal page to a colleague.

- Do: "blog post about using embeddings for product recommendations at scale"
- Don't: "embeddings product recommendations"
- Do: "Stripe payments company San Francisco fintech"
- Don't: "Stripe" (too ambiguous)

Use `category` when you know the content type — it makes a big difference.
For broader coverage, run 2-3 query variations in parallel and deduplicate results.
For agentic workflows, use `highlights` instead of full `text` — it's 10x more token-efficient while keeping the relevant parts.

## Token Efficiency

| Content Mode | Best For |
|-------------|----------|
| highlights | Agent workflows, factual lookups, multi-step pipelines — most token-efficient |
| text | Deep analysis, when you need full page context |
| summary | Quick overviews, structured extraction with JSON schema |

Set `maxCharacters` on any content mode to control output size.

## When to Reach for Which Tool

| Scenario | Tool |
|----------|------|
| Quick web lookup | web_search_exa |
| Research papers, academic search | web_search_advanced_exa + category: "research paper" |
| Company intel, competitive analysis | company_research_exa or advanced + category: "company" |
| Find people, candidates, experts | people_search_exa or advanced + category: "people" |
| Code examples, API docs | get_code_context_exa |
| Read a specific URL | crawling_exa |
| Find pages similar to a URL | web_search_advanced_exa with URL as query |
| Recent news / tweets | Advanced + category: "news" or "tweet" + maxAgeHours |
| Detailed research report | deep_researcher_start → deep_researcher_check |
| Quick answer with citations | deep_search_exa |
