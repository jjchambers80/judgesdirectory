import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
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
 * GET /api/admin/discovery/runs
 *
 * List discovery runs with optional state filter and pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const stateFilter = searchParams.get("state")?.toUpperCase() || undefined;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)),
  );
  const skip = (page - 1) * limit;

  const where = stateFilter ? { stateAbbr: stateFilter } : {};

  const [runs, total, activeRun] = await Promise.all([
    prisma.discoveryRun.findMany({
      where,
      orderBy: { startedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.discoveryRun.count({ where }),
    prisma.discoveryRun.findFirst({
      where: { status: "RUNNING" },
    }),
  ]);

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      state: r.state,
      stateAbbr: r.stateAbbr,
      status: r.status,
      queriesTotal: r.queriesTotal,
      queriesRun: r.queriesRun,
      candidatesFound: r.candidatesFound,
      candidatesNew: r.candidatesNew,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
      errorMessage: r.errorMessage,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    hasActiveRun: activeRun !== null,
    activeRunId: activeRun?.id ?? null,
  });
}

/**
 * POST /api/admin/discovery/runs
 *
 * Trigger a new discovery run for a state.
 */
export async function POST(request: NextRequest) {
  let body: { stateAbbr?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const abbr = body.stateAbbr?.toUpperCase();
  if (!abbr || !US_STATES[abbr]) {
    return NextResponse.json(
      { error: "Invalid state abbreviation" },
      { status: 400 },
    );
  }

  // Check env vars before spawning (503)
  if (!process.env.BRAVE_SEARCH_API_KEY) {
    return NextResponse.json(
      {
        error:
          "External search service is not configured. Check BRAVE_SEARCH_API_KEY environment variable.",
      },
      { status: 503 },
    );
  }

  // Check for active run (409) — only RUNNING blocks new runs
  const activeRun = await prisma.discoveryRun.findFirst({
    where: { status: "RUNNING" },
  });

  if (activeRun) {
    return NextResponse.json(
      {
        error: "A discovery run is already in progress",
        activeRunId: activeRun.id,
        activeRunState: activeRun.state,
      },
      { status: 409 },
    );
  }

  const stateName = US_STATES[abbr];

  // Pre-create DiscoveryRun record
  const run = await prisma.discoveryRun.create({
    data: {
      state: stateName,
      stateAbbr: abbr,
      status: "RUNNING",
    },
  });

  // Spawn background discovery process (detached, fire-and-forget)
  const scriptPath = path.join(process.cwd(), "scripts/discovery/discover.ts");
  const child = spawn(
    "npx",
    ["tsx", scriptPath, "--state", abbr, "--run-id", run.id],
    {
      detached: true,
      stdio: "ignore",
      env: process.env as NodeJS.ProcessEnv,
    },
  );

  // If the spawn itself fails, mark the run as FAILED so the UI doesn't hang
  child.on("error", async (err) => {
    console.error(`[Discovery] Spawn error for run ${run.id}:`, err);
    await prisma.discoveryRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        errorMessage: `Spawn failed: ${err.message}`,
        completedAt: new Date(),
      },
    });
  });

  child.unref();

  return NextResponse.json(
    {
      id: run.id,
      state: run.state,
      stateAbbr: run.stateAbbr,
      status: run.status,
      startedAt: run.startedAt.toISOString(),
    },
    { status: 201 },
  );
}
