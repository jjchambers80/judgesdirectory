/**
 * Promote approved UrlCandidates into a state court configuration JSON file.
 *
 * @module scripts/discovery/config-promoter
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { StateConfigSchema } from "../harvest/state-config-schema";
import type { StateConfig } from "../harvest/state-config-schema";

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
  configPath: string;
  entriesAdded: number;
  entriesExisting: number;
  entriesTotal: number;
  candidatesPromoted: number;
}

/**
 * Promote approved candidates for a state into a court config JSON file.
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

  // Load existing config if present
  const slug = stateName.toLowerCase().replace(/\s+/g, "-");
  const configPath = path.resolve(__dirname, `../harvest/${slug}-courts.json`);
  let existingConfig: StateConfig | null = null;
  let existingUrls = new Set<string>();

  if (fs.existsSync(configPath)) {
    const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    const result = StateConfigSchema.safeParse(raw);
    if (result.success) {
      existingConfig = result.data;
      existingUrls = new Set(existingConfig.courts.map((c) => c.url));
    }
  }

  // Build new court entries from approved candidates
  const newEntries = candidates
    .filter((c) => !existingUrls.has(c.url))
    .map((c) => ({
      url: c.url,
      courtType: c.suggestedType || "Unknown Court",
      level: (c.suggestedLevel || "trial") as
        | "supreme"
        | "appellate"
        | "trial"
        | "specialized",
      label: `${c.suggestedType || "Court"} (${c.domain})`,
      counties: [] as string[],
      fetchMethod: "http" as const,
      deterministic: false,
      notes: "Promoted from discovery — needs manual enrichment",
    }));

  // Merge with existing or create new config
  const allCourts = [...(existingConfig?.courts ?? []), ...newEntries];

  const config = {
    state: stateName,
    abbreviation: abbr,
    rateLimit: existingConfig?.rateLimit ?? {
      fetchDelayMs: 2000,
      maxConcurrent: 1,
      requestTimeoutMs: 15000,
      maxRetries: 3,
    },
    courts: allCourts,
  };

  // Write the config file
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  // Mark candidates as promoted
  await prisma.urlCandidate.updateMany({
    where: {
      id: { in: candidates.map((c) => c.id) },
    },
    data: { promotedAt: new Date() },
  });

  return {
    state: stateName,
    configPath: `scripts/harvest/${slug}-courts.json`,
    entriesAdded: newEntries.length,
    entriesExisting: existingConfig?.courts.length ?? 0,
    entriesTotal: allCourts.length,
    candidatesPromoted: candidates.length,
  };
}

export async function disconnect() {
  await prisma.$disconnect();
}
