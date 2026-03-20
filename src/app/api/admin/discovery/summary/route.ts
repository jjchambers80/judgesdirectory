import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const US_STATES: Record<string, string> = {
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

/**
 * GET /api/admin/discovery/summary
 *
 * Get candidate counts and last run info for a state.
 */
export async function GET(request: NextRequest) {
  const stateAbbr = request.nextUrl.searchParams.get("state")?.toUpperCase();

  if (!stateAbbr || !US_STATES[stateAbbr]) {
    return NextResponse.json(
      { error: "Invalid state abbreviation" },
      { status: 400 },
    );
  }

  const [candidateGroups, lastRun, activeRun] = await Promise.all([
    prisma.urlCandidate.groupBy({
      by: ["status"],
      where: { stateAbbr },
      _count: { _all: true },
    }),
    prisma.discoveryRun.findFirst({
      where: { stateAbbr },
      orderBy: { startedAt: "desc" },
    }),
    prisma.discoveryRun.findFirst({
      where: { stateAbbr, status: "RUNNING" },
    }),
  ]);

  const counts = { approved: 0, discovered: 0, rejected: 0, total: 0 };
  for (const group of candidateGroups) {
    const key = group.status.toLowerCase() as keyof typeof counts;
    if (key in counts) {
      counts[key] = group._count._all;
    }
    counts.total += group._count._all;
  }

  return NextResponse.json({
    stateAbbr,
    stateName: US_STATES[stateAbbr],
    candidateCounts: counts,
    lastRun: lastRun
      ? {
          id: lastRun.id,
          status: lastRun.status,
          startedAt: lastRun.startedAt.toISOString(),
          completedAt: lastRun.completedAt?.toISOString() ?? null,
          candidatesFound: lastRun.candidatesFound,
          candidatesNew: lastRun.candidatesNew,
        }
      : null,
    hasActiveRun: activeRun !== null,
  });
}
