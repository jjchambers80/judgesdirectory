/**
 * HTTP fetcher with rate limiting, retries, and HTML → Markdown cleaning.
 *
 * Uses native Node 20+ fetch. Strips noisy DOM elements via cheerio then
 * converts remaining HTML to Markdown via turndown to reduce Claude token
 * usage by ~60-70%.
 *
 * @module scripts/harvest/fetcher
 */

import * as cheerio from "cheerio";
import TurndownService from "turndown";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FetchResult {
  markdown: string;
  rawHtml: string;
  htmlSize: number;
  markdownSize: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_AGENT = "JudgesDirectory/1.0 (public court data research)";
const REQUEST_TIMEOUT_MS = 15_000;
const MIN_DELAY_MS = 1_500; // 1.5 s between requests (rate-limit courtesy)
const MAX_RETRIES = 3;
const BACKOFF_BASE_MS = 2_000; // linear backoff: 2s, 4s, 6s

/** Tags stripped before converting to Markdown */
const NOISE_SELECTORS =
  "script, style, nav, footer, header, iframe, noscript, svg, img, link[rel=stylesheet]";

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let lastFetchTime = 0;
const turndown = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Fetch a court page, clean the HTML, and return Markdown.
 *
 * Enforces a minimum delay between requests, retries with linear backoff on
 * transient errors, and sets a descriptive User-Agent header.
 *
 * For SPA sites (Next.js / Gatsby), falls back to structured data extraction
 * when the rendered HTML yields no meaningful Markdown.
 */
export async function fetchPage(url: string): Promise<FetchResult> {
  // Rate-limit: wait if needed
  const elapsed = Date.now() - lastFetchTime;
  if (elapsed < MIN_DELAY_MS) {
    await sleep(MIN_DELAY_MS - elapsed);
  }

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      lastFetchTime = Date.now();

      const response = await fetch(url, {
        headers: { "User-Agent": USER_AGENT },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        redirect: "follow",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const html = await response.text();
      let markdown = cleanHtml(html);

      // If standard cleaning yields empty/trivial output, try SPA fallbacks
      if (markdown.length < 50) {
        // Try Next.js __NEXT_DATA__ extraction (flcourts.gov sites)
        const nextDataMd = extractNextData(html);
        if (nextDataMd && nextDataMd.length > markdown.length) {
          markdown = nextDataMd;
        }

        // Try Gatsby page-data.json extraction (e.g., 1st Judicial Circuit)
        if (markdown.length < 50 && html.includes("___gatsby")) {
          const gatsbyMd = await fetchGatsbyPageData(url);
          if (gatsbyMd && gatsbyMd.length > markdown.length) {
            markdown = gatsbyMd;
          }
        }
      }

      return {
        markdown,
        rawHtml: html,
        htmlSize: Buffer.byteLength(html, "utf-8"),
        markdownSize: Buffer.byteLength(markdown, "utf-8"),
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt < MAX_RETRIES) {
        const backoff = BACKOFF_BASE_MS * attempt; // linear: 2s, 4s, 6s
        console.warn(
          `  Retry ${attempt}/${MAX_RETRIES} for ${url} — ${lastError.message} (waiting ${backoff}ms)`,
        );
        await sleep(backoff);
      }
    }
  }

  throw new Error(
    `Failed after ${MAX_RETRIES} retries: ${url} — ${lastError?.message}`,
  );
}

// ---------------------------------------------------------------------------
// HTML cleaning
// ---------------------------------------------------------------------------

/**
 * Strip noise elements from raw HTML then convert to Markdown.
 *
 * Standard HTML cleaning path — SPA fallbacks are handled in fetchPage().
 */
export function cleanHtml(html: string): string {
  const $ = cheerio.load(html);

  // Remove noisy elements
  $(NOISE_SELECTORS).remove();

  // Remove hidden elements
  $("[style*='display:none'], [style*='display: none'], [hidden]").remove();

  // Get cleaned body HTML (or entire document if no body)
  const bodyHtml = $("body").html() ?? $.html();

  // Convert to Markdown
  const markdown = turndown.turndown(bodyHtml);

  // Collapse excessive whitespace / blank lines
  return markdown
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Next.js SPA data extraction
// ---------------------------------------------------------------------------

/**
 * Extract structured data from Next.js __NEXT_DATA__ script tag.
 * Returns formatted Markdown if found, or null if not a Next.js page
 * or if no meaningful data can be extracted.
 */
function extractNextData(html: string): string | null {
  const match = html.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return null;

  try {
    const data = JSON.parse(match[1]);
    const pageProps = data.props?.pageProps;
    if (!pageProps) return null;

    const lines: string[] = [];

    // Extract page title
    const pageName =
      pageProps.pageData?.name || pageProps.urlAliasData?.props?.content?.name;
    if (pageName) {
      lines.push(`# ${pageName}`);
      lines.push("");
    }

    // Strategy 1: Extract from childrenInfos (flcourts.gov SC / DCA pattern)
    const children = pageProps.childrenInfos;
    if (Array.isArray(children)) {
      for (const child of children) {
        const content = child?.props?.content;
        if (!content) continue;

        const name = (content.name || "").trim();
        const type = content.typeIdentifier || "";
        const url = content.url || "";

        // Include entries whose name looks like a person (Justice/Judge/Chief)
        const looksLikePerson =
          /^(chief\s+)?justice\s/i.test(name) ||
          /^(chief\s+)?judge\s/i.test(name);

        // Also include "judge" type entries from DCA pages
        const isJudgeType = type === "judge";

        if (looksLikePerson || isJudgeType) {
          // Skip non-person folders
          if (
            /^(previous|former|current|retired|biograph)/i.test(name) ||
            /transition|chronological|merit|news/i.test(name)
          ) {
            continue;
          }

          // Extract short_description if available
          const shortDesc = content.fields?.short_description?.html5 || "";
          const descText = shortDesc
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          if (descText) {
            lines.push(`- **${name}**: ${descText.substring(0, 200)}`);
          } else {
            lines.push(`- ${name}`);
          }
        }
      }
    }

    // Strategy 2: Extract from subnavigation items as fallback
    if (lines.length <= 2) {
      const subnav = pageProps.extraData?.subnavigation?.items;
      if (Array.isArray(subnav)) {
        for (const item of subnav) {
          const name = (item.name || "").trim();
          if (
            /^(chief\s+)?justice\s/i.test(name) ||
            /^(chief\s+)?judge\s/i.test(name)
          ) {
            lines.push(`- ${name}`);
          }
        }
      }
    }

    // Strategy 3: Extract from pageData rich text content
    const pageData = pageProps.pageData;
    if (pageData?.content) {
      const richText = extractRichText(pageData.content);
      if (richText) {
        lines.push("");
        lines.push(richText);
      }
    }

    // Strategy 4: Extract from contentBlocks
    const contentBlocks = pageProps.extraData?.contentBlocks;
    if (Array.isArray(contentBlocks)) {
      for (const block of contentBlocks) {
        if (typeof block.content === "string") {
          const text = block.content
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          if (text.length > 20) {
            lines.push("");
            lines.push(text);
          }
        }
      }
    }

    const result = lines.join("\n").trim();
    return result.length > 0 ? result : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Gatsby page-data.json extraction
// ---------------------------------------------------------------------------

/**
 * Fetch Gatsby page-data.json for a given page URL and extract judge data.
 * Gatsby builds static JSON at /page-data/<path>/page-data.json.
 */
async function fetchGatsbyPageData(pageUrl: string): Promise<string | null> {
  try {
    const parsed = new URL(pageUrl);
    const path = parsed.pathname.replace(/\/$/, "") || "/index";
    const dataUrl = `${parsed.origin}/page-data${path}/page-data.json`;

    const response = await fetch(dataUrl, {
      headers: { "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const data = await response.json();
    const result = data?.result?.data;
    if (!result) return null;

    const lines: string[] = [];

    // Page title
    const pageTitle = result.page?.title || result.recordParent?.title;
    if (pageTitle) {
      lines.push(`# ${pageTitle}`);
      lines.push("");
    }

    // Extract judges grouped by county
    const judgesData = result.judges;
    if (judgesData?.group && Array.isArray(judgesData.group)) {
      lines.push("## Judges");
      lines.push("");
      for (const group of judgesData.group) {
        const county = group.fieldValue || "Unknown County";
        lines.push(`### ${county}`);
        if (Array.isArray(group.nodes)) {
          for (const node of group.nodes) {
            const name = node.title || node.name || "";
            if (name) lines.push(`- ${name}`);
          }
        }
        lines.push("");
      }
    }

    // Extract flat judges list (alternative structure)
    if (judgesData?.nodes && Array.isArray(judgesData.nodes)) {
      lines.push("## Judges");
      lines.push("");
      for (const node of judgesData.nodes) {
        const name = node.title || node.name || "";
        if (name) lines.push(`- ${name}`);
      }
      lines.push("");
    }

    // Extract magistrates
    const magistrates = result.magistrates;
    if (magistrates?.group && Array.isArray(magistrates.group)) {
      lines.push("## Magistrates");
      lines.push("");
      for (const group of magistrates.group) {
        if (Array.isArray(group.nodes)) {
          for (const node of group.nodes) {
            const name = node.title || node.name || "";
            if (name) lines.push(`- ${name}`);
          }
        }
      }
      lines.push("");
    }

    // Extract hearing officers
    const hearingOfficers = result.hearingOfficers;
    if (hearingOfficers?.group && Array.isArray(hearingOfficers.group)) {
      lines.push("## Hearing Officers");
      lines.push("");
      for (const group of hearingOfficers.group) {
        if (Array.isArray(group.nodes)) {
          for (const node of group.nodes) {
            const name = node.title || node.name || "";
            if (name) lines.push(`- ${name}`);
          }
        }
      }
      lines.push("");
    }

    // Extract locations (county info)
    const locations = result.locations;
    if (locations?.nodes && Array.isArray(locations.nodes)) {
      lines.push("## Locations");
      lines.push("");
      for (const node of locations.nodes) {
        if (node.county) lines.push(`- ${node.county}`);
      }
      lines.push("");
    }

    const text = lines.join("\n").trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

/**
 * Recursively extract text from rich-text content structures
 * commonly found in headless CMS data (eZ Platform used by flcourts.gov).
 */
function extractRichText(obj: unknown): string {
  if (!obj || typeof obj !== "object") return "";

  const record = obj as Record<string, unknown>;

  // Handle string fields that might contain HTML
  if (typeof record.xml === "string" || typeof record.html === "string") {
    const htmlContent = (record.xml || record.html) as string;
    const stripped = htmlContent.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    return stripped.trim();
  }

  // Recurse into nested objects
  const parts: string[] = [];
  for (const value of Object.values(record)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const text = extractRichText(item);
        if (text) parts.push(text);
      }
    } else if (typeof value === "object" && value !== null) {
      const text = extractRichText(value);
      if (text) parts.push(text);
    }
  }
  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
