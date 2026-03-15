import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import fs from "node:fs";
import path from "node:path";

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

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { stateAbbr } = body as { stateAbbr: string };

  if (!stateAbbr || typeof stateAbbr !== "string") {
    return NextResponse.json(
      { error: "stateAbbr is required" },
      { status: 400 },
    );
  }

  const abbr = stateAbbr.toUpperCase();
  const stateName = STATE_NAMES[abbr];
  if (!stateName) {
    return NextResponse.json(
      { error: `Unknown state abbreviation: ${abbr}` },
      { status: 400 },
    );
  }

  // Get approved candidates that haven't been promoted yet
  const candidates = await prisma.urlCandidate.findMany({
    where: { stateAbbr: abbr, status: "APPROVED", promotedAt: null },
  });

  if (candidates.length === 0) {
    return NextResponse.json(
      { error: `No approved candidates for state ${abbr}` },
      { status: 400 },
    );
  }

  const slug = stateName.toLowerCase().replace(/\s+/g, "-");
  const configPath = path.resolve(
    process.cwd(),
    `scripts/harvest/${slug}-courts.json`,
  );

  // Load existing config if present
  let existingCourts: Array<{ url: string; [key: string]: unknown }> = [];
  if (fs.existsSync(configPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
      existingCourts = raw.courts || [];
    } catch {
      // If existing config is invalid, start fresh
    }
  }
  const existingUrls = new Set(existingCourts.map((c) => c.url));

  // Build new court entries
  const newEntries = candidates
    .filter((c) => !existingUrls.has(c.url))
    .map((c) => ({
      url: c.url,
      courtType: c.suggestedType || "Unknown Court",
      level: c.suggestedLevel || "trial",
      label: `${c.suggestedType || "Court"} (${c.domain})`,
      counties: [],
      fetchMethod: "http",
      deterministic: false,
      notes: "Promoted from discovery — needs manual enrichment",
    }));

  const allCourts = [...existingCourts, ...newEntries];

  const config = {
    state: stateName,
    abbreviation: abbr,
    rateLimit: {
      fetchDelayMs: 2000,
      maxConcurrent: 1,
      requestTimeoutMs: 15000,
      maxRetries: 3,
    },
    courts: allCourts,
  };

  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

  // Mark candidates as promoted
  await prisma.urlCandidate.updateMany({
    where: { id: { in: candidates.map((c) => c.id) } },
    data: { promotedAt: new Date() },
  });

  return NextResponse.json({
    state: stateName,
    configPath: `scripts/harvest/${slug}-courts.json`,
    entriesAdded: newEntries.length,
    entriesExisting: existingCourts.length,
    entriesTotal: allCourts.length,
    candidatesPromoted: candidates.length,
  });
}
