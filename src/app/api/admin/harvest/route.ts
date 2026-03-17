import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/db";

// Valid US state abbreviations for input validation
const VALID_STATE_ABBRS = new Set([
  "AL",
  "AK",
  "AZ",
  "AR",
  "CA",
  "CO",
  "CT",
  "DE",
  "FL",
  "GA",
  "HI",
  "ID",
  "IL",
  "IN",
  "IA",
  "KS",
  "KY",
  "LA",
  "ME",
  "MD",
  "MA",
  "MI",
  "MN",
  "MS",
  "MO",
  "MT",
  "NE",
  "NV",
  "NH",
  "NJ",
  "NM",
  "NY",
  "NC",
  "ND",
  "OH",
  "OK",
  "OR",
  "PA",
  "RI",
  "SC",
  "SD",
  "TN",
  "TX",
  "UT",
  "VT",
  "VA",
  "WA",
  "WV",
  "WI",
  "WY",
]);

/**
 * POST /api/admin/harvest
 *
 * Trigger a new harvest job for a state. Validates no active job exists,
 * checks approved URLs, creates HarvestJob, spawns background runner.
 */
export async function POST(request: NextRequest) {
  let body: { stateAbbr?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { stateAbbr } = body;
  if (!stateAbbr || typeof stateAbbr !== "string") {
    return NextResponse.json(
      { error: "stateAbbr is required" },
      { status: 400 },
    );
  }

  const abbr = stateAbbr.toUpperCase();
  if (!VALID_STATE_ABBRS.has(abbr)) {
    return NextResponse.json(
      { error: "Invalid state abbreviation", stateAbbr: abbr },
      { status: 400 },
    );
  }

  // Check for active jobs (FR-010)
  const activeJob = await prisma.harvestJob.findFirst({
    where: {
      stateAbbr: abbr,
      status: { in: ["QUEUED", "RUNNING"] },
    },
  });

  if (activeJob) {
    const stateName = activeJob.state;
    return NextResponse.json(
      {
        error: "HARVEST_ALREADY_ACTIVE",
        message: `A harvest job is already running for ${stateName}`,
        activeJobId: activeJob.id,
        activeJobStatus: activeJob.status,
      },
      { status: 409 },
    );
  }

  // Check for approved URLs (FR-011)
  const approvedUrlCount = await prisma.urlCandidate.count({
    where: {
      stateAbbr: abbr,
      status: "APPROVED",
      OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
    },
  });

  if (approvedUrlCount === 0) {
    return NextResponse.json(
      {
        error: "NO_APPROVED_URLS",
        message: `No approved URLs found for ${abbr}. Run discovery first.`,
      },
      { status: 422 },
    );
  }

  // Look up state name
  const stateRecord = await prisma.state.findUnique({
    where: { abbreviation: abbr },
    select: { name: true },
  });
  const stateName = stateRecord?.name ?? abbr;

  // Create HarvestJob
  const job = await prisma.harvestJob.create({
    data: {
      stateAbbr: abbr,
      state: stateName,
      status: "QUEUED",
      triggeredBy: "ADMIN",
    },
  });

  // Spawn background runner
  const runnerPath = path.join(process.cwd(), "scripts/harvest/runner.ts");
  const child = spawn("npx", ["tsx", runnerPath, "--job-id", job.id], {
    detached: true,
    stdio: "ignore",
    env: process.env as NodeJS.ProcessEnv,
  });
  child.unref();

  return NextResponse.json(
    {
      id: job.id,
      stateAbbr: job.stateAbbr,
      state: job.state,
      status: job.status,
      triggeredBy: job.triggeredBy,
      createdAt: job.createdAt.toISOString(),
    },
    { status: 201 },
  );
}

/**
 * GET /api/admin/harvest
 *
 * List harvest jobs with optional filtering.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const stateAbbrFilter = searchParams.get("stateAbbr");
  const statusFilter = searchParams.get("status");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);
  const offset = parseInt(searchParams.get("offset") ?? "0", 10);

  // Parse comma-separated status values
  const statusValues = statusFilter
    ? statusFilter
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter(Boolean)
    : null;

  const where = {
    ...(stateAbbrFilter ? { stateAbbr: stateAbbrFilter.toUpperCase() } : {}),
    ...(statusValues
      ? {
          status: {
            in: statusValues as (
              | "QUEUED"
              | "RUNNING"
              | "COMPLETED"
              | "FAILED"
            )[],
          },
        }
      : {}),
  };

  const [jobs, total] = await Promise.all([
    prisma.harvestJob.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        stateAbbr: true,
        state: true,
        status: true,
        triggeredBy: true,
        urlsTotal: true,
        urlsProcessed: true,
        urlsFailed: true,
        judgesFound: true,
        judgesNew: true,
        judgesUpdated: true,
        startedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.harvestJob.count({ where }),
  ]);

  // Stale-job detection: RUNNING jobs with no progress for >2 hours (T034)
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  for (const job of jobs) {
    if (job.status === "RUNNING" && job.updatedAt < twoHoursAgo) {
      await prisma.harvestJob.update({
        where: { id: job.id },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "Job timed out — no progress in 2 hours",
        },
      });
      // Reflect the update in the response
      (job as Partial<typeof job> & { status: string }).status = "FAILED";
    }
  }

  return NextResponse.json({
    jobs: jobs.map((j) => ({
      ...j,
      startedAt: j.startedAt?.toISOString() ?? null,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    })),
    total,
  });
}
