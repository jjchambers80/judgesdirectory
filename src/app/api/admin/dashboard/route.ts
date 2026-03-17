import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { PILOT_TARGET } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pilotStatesParam = searchParams.get("pilotStates") || "";
  const pilotSlugs = pilotStatesParam
    ? pilotStatesParam
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : [];

  // Build state filter if pilot states are specified
  const stateFilter =
    pilotSlugs.length > 0
      ? { court: { county: { state: { slug: { in: pilotSlugs } } } } }
      : {};

  const [imported, verified, unverified, rejected] = await Promise.all([
    prisma.judge.count({ where: { ...stateFilter } }),
    prisma.judge.count({ where: { status: "VERIFIED", ...stateFilter } }),
    prisma.judge.count({ where: { status: "UNVERIFIED", ...stateFilter } }),
    prisma.judge.count({ where: { status: "REJECTED", ...stateFilter } }),
  ]);

  // By-state breakdown using aggregate SQL — avoids loading individual judge rows
  interface StateCount {
    id: string;
    name: string;
    slug: string;
    total: bigint;
    verified: bigint;
    unverified: bigint;
    rejected: bigint;
  }

  const slugFilter =
    pilotSlugs.length > 0
      ? Prisma.sql`AND s.slug IN (${Prisma.join(pilotSlugs)})`
      : Prisma.empty;

  const stateCountsRaw = await prisma.$queryRaw<StateCount[]>`
    SELECT
      s.id,
      s.name,
      s.slug,
      COUNT(j.id)                                                    AS total,
      SUM(CASE WHEN j.status = 'VERIFIED'   THEN 1 ELSE 0 END)      AS verified,
      SUM(CASE WHEN j.status = 'UNVERIFIED' THEN 1 ELSE 0 END)      AS unverified,
      SUM(CASE WHEN j.status = 'REJECTED'   THEN 1 ELSE 0 END)      AS rejected
    FROM states s
    JOIN counties co ON co."stateId" = s.id
    JOIN courts   ct ON ct."countyId" = co.id
    JOIN judges   j  ON j."courtId"  = ct.id
    WHERE 1=1 ${slugFilter}
    GROUP BY s.id, s.name, s.slug
    ORDER BY total DESC
  `;

  const byState = stateCountsRaw.map((s) => ({
    stateId: s.id,
    stateName: s.name,
    stateSlug: s.slug,
    imported: Number(s.total),
    verified: Number(s.verified),
    unverified: Number(s.unverified),
    rejected: Number(s.rejected),
    percentOfTarget: Number(
      ((Number(s.total) / PILOT_TARGET) * 100).toFixed(1),
    ),
  }));

  // Recent harvest jobs (replacing importBatch)
  const recentHarvestJobs = await prisma.harvestJob.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      stateAbbr: true,
      state: true,
      status: true,
      triggeredBy: true,
      judgesNew: true,
      judgesUpdated: true,
      judgesFound: true,
      completedAt: true,
      createdAt: true,
    },
  });

  // Per-state harvest summary: last harvest date + staleness (FR-023)
  const STALE_DAYS = 90;
  const staleThreshold = new Date(
    Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000,
  );

  const latestJobsPerState = await prisma.harvestJob.findMany({
    where: { status: "COMPLETED" },
    orderBy: { completedAt: "desc" },
    distinct: ["stateAbbr"],
    select: { stateAbbr: true, completedAt: true, judgesFound: true },
  });

  const harvestStatusByState = new Map(
    latestJobsPerState.map((j) => [
      j.stateAbbr,
      {
        lastHarvestAt: j.completedAt,
        isStale: !j.completedAt || j.completedAt < staleThreshold,
      },
    ]),
  );

  // Augment byState with harvest info
  const byStateWithHarvest = byState.map((s) => {
    const abbr = s.stateSlug.toUpperCase().slice(0, 2);
    const harvestInfo = harvestStatusByState.get(abbr);
    return {
      ...s,
      lastHarvestAt: harvestInfo?.lastHarvestAt?.toISOString() ?? null,
      harvestStatus: harvestInfo
        ? harvestInfo.isStale
          ? "stale"
          : "fresh"
        : "never",
    };
  });

  const percentComplete = Number(((imported / PILOT_TARGET) * 100).toFixed(1));

  return NextResponse.json({
    target: PILOT_TARGET,
    totals: {
      imported,
      verified,
      unverified,
      rejected,
      percentComplete,
    },
    byState: byStateWithHarvest,
    recentHarvestJobs: recentHarvestJobs.map((j) => ({
      id: j.id,
      stateAbbr: j.stateAbbr,
      state: j.state,
      status: j.status,
      triggeredBy: j.triggeredBy,
      judgesNew: j.judgesNew ?? 0,
      judgesUpdated: j.judgesUpdated ?? 0,
      judgesFound: j.judgesFound ?? 0,
      completedAt: j.completedAt?.toISOString() ?? null,
      createdAt: j.createdAt.toISOString(),
    })),
    milestoneReached: imported >= PILOT_TARGET,
  });
}
