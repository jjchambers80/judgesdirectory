import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/harvest/states
 *
 * Returns states that are eligible for harvesting (have approved, scrape-worthy URLs).
 */
export async function GET() {
  // Aggregate approved URLs per state
  const urlGroups = await prisma.urlCandidate.groupBy({
    by: ["stateAbbr"],
    where: {
      status: "APPROVED",
      OR: [{ scrapeWorthy: null }, { scrapeWorthy: true }],
    },
    _count: { id: true },
  });

  if (urlGroups.length === 0) {
    return NextResponse.json({ states: [] });
  }

  const stateAbbrs = urlGroups.map((g) => g.stateAbbr);

  // Get latest harvest job per state
  const latestJobs = await prisma.harvestJob.findMany({
    where: { stateAbbr: { in: stateAbbrs } },
    orderBy: { createdAt: "desc" },
    distinct: ["stateAbbr"],
    select: {
      id: true,
      stateAbbr: true,
      state: true,
      status: true,
      completedAt: true,
    },
  });

  // Get active jobs (QUEUED or RUNNING)
  const activeJobs = await prisma.harvestJob.findMany({
    where: {
      stateAbbr: { in: stateAbbrs },
      status: { in: ["QUEUED", "RUNNING"] },
    },
    select: { id: true, stateAbbr: true },
  });

  const latestJobMap = new Map(latestJobs.map((j) => [j.stateAbbr, j]));
  const activeJobMap = new Map(activeJobs.map((j) => [j.stateAbbr, j]));

  // Get state names from State table
  const stateRecords = await prisma.state.findMany({
    where: { abbreviation: { in: stateAbbrs } },
    select: { abbreviation: true, name: true },
  });
  const stateNameMap = new Map(
    stateRecords.map((s) => [s.abbreviation, s.name]),
  );

  const states = urlGroups.map((group) => {
    const latest = latestJobMap.get(group.stateAbbr);
    const active = activeJobMap.get(group.stateAbbr);
    return {
      stateAbbr: group.stateAbbr,
      state: stateNameMap.get(group.stateAbbr) ?? group.stateAbbr,
      approvedUrlCount: group._count.id,
      lastHarvestAt: latest?.completedAt?.toISOString() ?? null,
      lastHarvestStatus: latest?.status ?? null,
      hasActiveJob: !!active,
      activeJobId: active?.id ?? null,
    };
  });

  // Sort: active first, then by state name
  states.sort((a, b) => {
    if (a.hasActiveJob !== b.hasActiveJob) return a.hasActiveJob ? -1 : 1;
    return a.state.localeCompare(b.state);
  });

  return NextResponse.json({ states });
}
