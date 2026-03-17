import { NextRequest, NextResponse } from "next/server";
import { spawn } from "node:child_process";
import path from "node:path";
import { prisma } from "@/lib/db";

// States are stale if last COMPLETED harvest was more than 11 months ago
const FRESHNESS_MONTHS = 11;

/**
 * POST /api/cron/harvest
 *
 * Vercel Cron endpoint for annual delta harvests (FR-016, FR-017, FR-018).
 * Triggers harvest jobs for all states that are stale (>11 months since last
 * completed harvest) and have approved URLs. Skips states with active jobs.
 *
 * Schedule: "0 3 1 * *" — 3:00 AM UTC on the 1st of every month.
 */
export async function POST(request: NextRequest) {
  // Validate Authorization: Bearer {CRON_SECRET} (FR-017)
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "CRON_SECRET is not configured" },
      { status: 401 },
    );
  }

  const authHeader = request.headers.get("authorization");
  const expectedToken = `Bearer ${cronSecret}`;
  if (!authHeader || authHeader !== expectedToken) {
    return NextResponse.json(
      { error: "UNAUTHORIZED", message: "Invalid or missing cron secret" },
      { status: 401 },
    );
  }

  const threshold = new Date();
  threshold.setMonth(threshold.getMonth() - FRESHNESS_MONTHS);

  // Query all states with approved URLs (scrapeWorthy != false)
  const statesWithUrls = await prisma.urlCandidate.groupBy({
    by: ["stateAbbr"],
    where: {
      status: "APPROVED",
      OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
    },
    _count: { stateAbbr: true },
  });

  const statesChecked = statesWithUrls.length;
  let statesStale = 0;
  const jobsCreated: Array<{ id: string; stateAbbr: string; state: string }> =
    [];
  const statesSkipped: Array<{
    stateAbbr: string;
    reason: "fresh" | "active_job";
    lastHarvestAt: string | null;
  }> = [];

  for (const stateGroup of statesWithUrls) {
    const abbr = stateGroup.stateAbbr;

    // Check for active job
    const activeJob = await prisma.harvestJob.findFirst({
      where: {
        stateAbbr: abbr,
        status: { in: ["QUEUED", "RUNNING"] },
      },
    });

    if (activeJob) {
      statesSkipped.push({
        stateAbbr: abbr,
        reason: "active_job",
        lastHarvestAt: null,
      });
      continue;
    }

    // Check staleness (FR-018)
    const lastJob = await prisma.harvestJob.findFirst({
      where: { stateAbbr: abbr, status: "COMPLETED" },
      orderBy: { completedAt: "desc" },
    });

    const isStale =
      !lastJob || !lastJob.completedAt || lastJob.completedAt < threshold;

    if (!isStale) {
      statesSkipped.push({
        stateAbbr: abbr,
        reason: "fresh",
        lastHarvestAt: lastJob?.completedAt?.toISOString() ?? null,
      });
      continue;
    }

    statesStale++;

    // Look up state name
    const stateRecord = await prisma.state.findUnique({
      where: { abbreviation: abbr },
      select: { name: true },
    });
    const stateName = stateRecord?.name ?? abbr;

    // Create QUEUED job with CRON trigger
    const job = await prisma.harvestJob.create({
      data: {
        stateAbbr: abbr,
        state: stateName,
        status: "QUEUED",
        triggeredBy: "CRON",
      },
    });

    // Spawn runner sequentially (FR-020): each runner is detached so
    // the cron endpoint doesn't block. Actual sequencing ensures no
    // simultaneous state-level contention.
    const runnerPath = path.join(process.cwd(), "scripts/harvest/runner.ts");
    const child = spawn("npx", ["tsx", runnerPath, "--job-id", job.id], {
      detached: true,
      stdio: "ignore",
      env: process.env as NodeJS.ProcessEnv,
    });
    child.unref();

    jobsCreated.push({ id: job.id, stateAbbr: abbr, state: stateName });
  }

  return NextResponse.json({
    statesChecked,
    statesStale,
    jobsCreated,
    statesSkipped,
  });
}
