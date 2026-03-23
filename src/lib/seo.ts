import type { Metadata } from "next";
import { SITE_URL, SITE_NAME } from "@/lib/constants";

/**
 * Sanitize JSON-LD content to prevent XSS via script injection.
 */
export function sanitizeJsonLd(json: string): string {
  return json.replace(/</g, "\\u003c");
}

/**
 * Build Schema.org ItemList JSON-LD for listing pages.
 */
export function buildItemListJsonLd(
  items: Array<{ name: string; url: string; position?: number }>,
  listName: string,
  listUrl: string,
): object {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    url: `${SITE_URL}${listUrl}`,
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: item.position ?? index + 1,
      name: item.name,
      url: `${SITE_URL}${item.url}`,
    })),
  };
}

/**
 * Build Schema.org Person JSON-LD for judge profile pages.
 */
export function buildPersonJsonLd(judge: {
  fullName: string;
  court: {
    type: string;
    county: {
      name: string;
      state: { name: string };
    };
  };
  url: string;
  description?: string;
}): object {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    name: judge.fullName,
    jobTitle: `Judge, ${judge.court.type}`,
    worksFor: {
      "@type": "Organization",
      name: `${judge.court.type}, ${judge.court.county.name}, ${judge.court.county.state.name}`,
    },
    url: `${SITE_URL}${judge.url}`,
    ...(judge.description ? { description: judge.description } : {}),
  };
}

/**
 * Generate page title for states grid.
 */
export function statesGridTitle(): string {
  return "U.S. Judges Directory — Browse by State";
}

/**
 * Generate page title for county list.
 */
export function countyListTitle(stateName: string): string {
  return `Judges in ${stateName} — County Directory`;
}

/**
 * Generate page title for court types page.
 */
export function courtTypesTitle(countyName: string, stateName: string): string {
  return `Courts in ${countyName}, ${stateName} — ${SITE_NAME}`;
}

/**
 * Generate page title for judge list by court.
 */
export function judgeListTitle(
  courtType: string,
  countyName: string,
  stateName: string,
): string {
  return `${courtType} Judges in ${countyName}, ${stateName}`;
}

/**
 * Generate page title for individual judge profile.
 */
export function judgeProfileTitle(
  judgeName: string,
  courtType: string,
  countyName: string,
  stateName: string,
): string {
  return `Judge ${judgeName} — ${courtType}, ${countyName}, ${stateName}`;
}

/**
 * Build Open Graph metadata for any page template.
 */
export function buildOpenGraph(opts: {
  title: string;
  description: string;
  url: string;
  type?: "website" | "profile";
  imageUrl?: string;
}): Metadata["openGraph"] {
  return {
    title: opts.title,
    description: opts.description,
    url: opts.url,
    siteName: SITE_NAME,
    type: opts.type ?? "website",
    locale: "en_US",
    images: [
      {
        url: opts.imageUrl ?? `${SITE_URL}/og-default.png`,
        width: 1200,
        height: 630,
        alt: opts.title,
      },
    ],
  };
}

/**
 * Build Twitter Card metadata for any page template.
 */
export function buildTwitterCard(opts: {
  title: string;
  description: string;
  imageUrl?: string;
}): Metadata["twitter"] {
  return {
    card: opts.imageUrl ? "summary_large_image" : "summary",
    title: opts.title,
    description: opts.description,
    ...(opts.imageUrl
      ? { images: [{ url: opts.imageUrl, alt: opts.title }] }
      : {}),
  };
}
