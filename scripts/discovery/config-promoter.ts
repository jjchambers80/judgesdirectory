/**
 * Promote approved UrlCandidates — DB-only status update.
 *
 * Previously wrote JSON config files; now sets promotedAt and seeds UrlHealth.
 *
 * @module scripts/discovery/config-promoter
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// US state name lookup
// ---------------------------------------------------------------------------

const STATE_NAMES: Record<string, string> = {
  AL: "Alabama",
  AK: "Alaska",
  AZ: "Arizona",
  AR: "Arkansas",
  CA: "California",
  CO: "Colorado",
  CT: "Connecticut",
  DE: "Delaware",
  FL: "Florida",
  GA: "Georgia",
  HI: "Hawaii",
  ID: "Idaho",
  IL: "Illinois",
  IN: "Indiana",
  IA: "Iowa",
  KS: "Kansas",
  KY: "Kentucky",
  LA: "Louisiana",
  ME: "Maine",
  MD: "Maryland",
  MA: "Massachusetts",
  MI: "Michigan",
  MN: "Minnesota",
  MS: "Mississippi",
  MO: "Missouri",
  MT: "Montana",
  NE: "Nebraska",
  NV: "Nevada",
  NH: "New Hampshire",
  NJ: "New Jersey",
  NM: "New Mexico",
  NY: "New York",
  NC: "North Carolina",
  ND: "North Dakota",
  OH: "Ohio",
  OK: "Oklahoma",
  OR: "Oregon",
  PA: "Pennsylvania",
  RI: "Rhode Island",
  SC: "South Carolina",
  SD: "South Dakota",
  TN: "Tennessee",
  TX: "Texas",
  UT: "Utah",
  VT: "Vermont",
  VA: "Virginia",
  WA: "Washington",
  WV: "West Virginia",
  WI: "Wisconsin",
  WY: "Wyoming",
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface PromoteResult {
  state: string;
  entriesPromoted: number;
  healthSeeded: number;
}

/**
 * Promote approved candidates for a state — DB-only status update.
 * Sets promotedAt and seeds UrlHealth records.
 */
export async function promoteToConfig(
  stateAbbr: string,
): Promise<PromoteResult> {
  const abbr = stateAbbr.toUpperCase();
  const stateName = STATE_NAMES[abbr];
  if (!stateName) throw new Error(`Unknown state abbreviation: ${abbr}`);

  // Get approved candidates that haven't been promoted yet
  const candidates = await prisma.urlCandidate.findMany({
    where: {
      stateAbbr: abbr,
      status: "APPROVED",
      promotedAt: null,
    },
  });

  if (candidates.length === 0) {
    throw new Error(`No approved candidates for state ${abbr}`);
  }

  // Mark candidates as promoted
  await prisma.urlCandidate.updateMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
    },
    data: { promotedAt: new Date() },
  });

  // Seed UrlHealth records for promoted URLs
  let healthSeeded = 0;
  for (const candidate of candidates) {
    try {
      await prisma.urlHealth.upsert({
        where: { url: candidate.url },
        create: {
          url: candidate.url,
          domain: new URL(candidate.url).hostname.replace(/^www\./, ""),
          state: stateName,
          stateAbbr: abbr,
          healthScore: 0.5,
          source: "DISCOVERED",
        },
        update: {},
      });
      healthSeeded++;
    } catch (err) {
      console.warn(
        `[Promoter] Failed to seed UrlHealth for ${candidate.url}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return {
    state: stateName,
    entriesPromoted: candidates.length,
    healthSeeded,
  };
}

export async function disconnect() {
  await prisma.$disconnect();
}
