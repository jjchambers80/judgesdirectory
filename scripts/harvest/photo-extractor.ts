/**
 * Deterministic photo extraction from raw HTML.
 *
 * Handles Wikipedia infobox images, court site portraits, and general
 * photo patterns. Runs via Cheerio — no LLM needed.
 *
 * @module scripts/harvest/photo-extractor
 */

import * as cheerio from "cheerio";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Extract the most likely portrait / headshot photo URL from raw HTML.
 *
 * Site-specific selectors (e.g. Wikipedia infobox) are tried first,
 * then generic "portrait-like img" heuristics.
 *
 * @param html     Raw HTML of the page
 * @param sourceUrl  Page URL (used for resolving relative URLs and site detection)
 * @returns Absolute image URL, or null if nothing suitable found
 */
export function extractPhotoFromHtml(
  html: string,
  sourceUrl: string,
): string | null {
  if (!html || html.length < 100) return null;

  const $ = cheerio.load(html);

  let hostname: string;
  try {
    hostname = new URL(sourceUrl).hostname.toLowerCase();
  } catch {
    return null;
  }

  // Site-specific extractors
  if (hostname.includes("wikipedia.org")) {
    return extractWikipediaInfoboxPhoto($, sourceUrl);
  }

  if (hostname.includes("ballotpedia.org")) {
    return extractBallotpediaPhoto($, sourceUrl);
  }

  // Fallback: general portrait heuristics
  return extractGeneralPortrait($, sourceUrl);
}

// ---------------------------------------------------------------------------
// Wikipedia
// ---------------------------------------------------------------------------

/**
 * Wikipedia infobox photos live inside `table.infobox` or `table.vcard`.
 * The first `<img>` inside the infobox is the main portrait.
 *
 * Structure:
 *   <table class="infobox vcard">
 *     <tbody>
 *       <tr><td><a class="image"><img src="//upload.wikimedia.org/..." /></a></td></tr>
 *     </tbody>
 *   </table>
 */
function extractWikipediaInfoboxPhoto(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
): string | null {
  const selectors = [
    "table.infobox img",
    "table.vcard img",
    "table.biography.vcard img",
    ".infobox img",
  ];

  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length === 0) continue;

    const src = img.attr("src");
    if (!src) continue;

    // Skip tiny icons (e.g. edit icons, flags)
    const width = parseInt(img.attr("width") || "0", 10);
    if (width > 0 && width < 50) continue;

    return resolveImageUrl(src, sourceUrl);
  }

  return null;
}

// ---------------------------------------------------------------------------
// Ballotpedia
// ---------------------------------------------------------------------------

/**
 * Ballotpedia puts the main portrait in a div.infobox or div with
 * class containing "officeholder" — first large img.
 */
function extractBallotpediaPhoto(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
): string | null {
  const selectors = [
    ".infobox img",
    ".officeholder-info img",
    ".widget-row img",
    "table.infobox img",
  ];

  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length === 0) continue;

    const src = img.attr("src");
    if (!src) continue;
    if (isNoiseImage(src)) continue;

    return resolveImageUrl(src, sourceUrl);
  }

  return null;
}

// ---------------------------------------------------------------------------
// General portrait heuristics
// ---------------------------------------------------------------------------

interface ImageCandidate {
  url: string;
  score: number;
}

function extractGeneralPortrait(
  $: cheerio.CheerioAPI,
  sourceUrl: string,
): string | null {
  const candidates: ImageCandidate[] = [];

  $("img").each((_, el) => {
    const img = $(el);
    const src = img.attr("src");
    if (!src) return;
    if (isNoiseImage(src)) return;

    const alt = (img.attr("alt") || "").toLowerCase();
    const className = (img.attr("class") || "").toLowerCase();
    const parentClass = (img.parent().attr("class") || "").toLowerCase();
    const width = parseInt(img.attr("width") || "0", 10);
    const height = parseInt(img.attr("height") || "0", 10);

    // Skip tiny images (icons, spacers)
    if (width > 0 && width < 50) return;
    if (height > 0 && height < 50) return;

    let score = 0;

    // Strong signals in alt text
    if (/portrait|headshot|official\s*photo/.test(alt)) score += 5;
    if (/\bjudge\b|\bjustice\b/.test(alt)) score += 3;
    if (/\bphoto\b|\bpicture\b|\bimage\b/.test(alt)) score += 2;

    // Strong signals in class/parent class
    if (/portrait|headshot|profile-photo|judge-photo/.test(className)) score += 4;
    if (/portrait|headshot|profile-photo|judge-photo/.test(parentClass)) score += 3;

    // Reasonable dimensions for a portrait
    if (width >= 100 && height >= 120) score += 1;
    if (width >= 150 && height >= 180) score += 1;

    if (score > 0) {
      candidates.push({ url: resolveImageUrl(src, sourceUrl), score });
    }
  });

  candidates.sort((a, b) => b.score - a.score);
  return candidates[0]?.url ?? null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Images that are definitely NOT portraits */
function isNoiseImage(src: string): boolean {
  return /logo|icon|banner|sprite|button|arrow|spacer|pixel|badge|seal|crest|favicon/i.test(
    src,
  );
}

/** Resolve a possibly-relative image URL to an absolute one. */
function resolveImageUrl(src: string, baseUrl: string): string {
  if (src.startsWith("//")) return `https:${src}`;
  if (src.startsWith("http://") || src.startsWith("https://")) return src;
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
