/**
 * Database-driven URL configuration loader.
 *
 * Replaces JSON file-based config loading with queries against UrlCandidate table.
 *
 * @module scripts/harvest/db-config-loader
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface DbUrlConfig {
  id: string;
  url: string;
  domain: string;
  fetchMethod: string;
  extractionHints: Record<string, unknown> | null;
  suggestedType: string | null;
  suggestedLevel: string | null;
}

/**
 * Load approved, scrape-worthy URLs for a state from the database.
 * Returns URLs with status=APPROVED and scrapeWorthy != false (null or true).
 */
export async function loadUrlsFromDb(
  stateAbbr: string,
): Promise<DbUrlConfig[]> {
  const candidates = await prisma.urlCandidate.findMany({
    where: {
      stateAbbr: stateAbbr.toUpperCase(),
      status: "APPROVED",
      OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
    },
    orderBy: { url: "asc" },
  });

  return candidates.map((c) => ({
    id: c.id,
    url: c.url,
    domain: c.domain,
    fetchMethod: c.fetchMethod,
    extractionHints: c.extractionHints as Record<string, unknown> | null,
    suggestedType: c.suggestedType,
    suggestedLevel: c.suggestedLevel,
  }));
}

/**
 * Count approved, scrape-worthy URLs for a state.
 */
export async function countApprovedUrls(stateAbbr: string): Promise<number> {
  return prisma.urlCandidate.count({
    where: {
      stateAbbr: stateAbbr.toUpperCase(),
      status: "APPROVED",
      OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
    },
  });
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
