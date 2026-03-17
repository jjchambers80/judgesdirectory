/**
 * Source authority classifier — determines the trust level of a source URL
 * based on domain TLD and state court configuration allowlists.
 *
 * Classification rules (per research R1, data-model.md):
 *   1. null/empty URL → SECONDARY
 *   2. .gov domain → OFFICIAL_GOV
 *   3. Domain in any state court config JSON → COURT_WEBSITE
 *   4. Otherwise → SECONDARY
 *
 * @module scripts/harvest/source-classifier
 */

import type { SourceAuthority } from "@prisma/client";
import type { CourtEntry } from "./state-config-schema";

/**
 * Classify the source authority of a URL based on its domain.
 *
 * @param url - The source URL to classify (bio page or roster URL)
 * @param stateConfigs - Map of state slug → array of court entries from config JSONs
 * @returns The appropriate SourceAuthority classification
 */
export function classifySourceAuthority(
  url: string | null | undefined,
  stateConfigs: Map<string, CourtEntry[]>,
): SourceAuthority {
  if (!url || url.trim() === "") {
    return "SECONDARY";
  }

  let hostname: string;
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    return "SECONDARY";
  }

  // .gov domains → OFFICIAL_GOV
  if (hostname.endsWith(".gov")) {
    return "OFFICIAL_GOV";
  }

  // Check if domain appears in any state court config JSON
  for (const courts of Array.from(stateConfigs.values())) {
    for (const court of courts) {
      try {
        const configHostname = new URL(court.url).hostname.toLowerCase();
        if (configHostname === hostname) {
          return "COURT_WEBSITE";
        }
      } catch {
        // Skip invalid URLs in config
      }
    }
  }

  return "SECONDARY";
}

/**
 * Build a stateConfigs map from loaded state configurations.
 * Convenience function for callers that already have config data.
 */
export function buildStateConfigsMap(
  configs: Array<{ slug: string; courts: CourtEntry[] }>,
): Map<string, CourtEntry[]> {
  const map = new Map<string, CourtEntry[]>();
  for (const config of configs) {
    map.set(config.slug, config.courts);
  }
  return map;
}
