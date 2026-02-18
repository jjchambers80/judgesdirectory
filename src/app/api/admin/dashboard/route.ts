import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { PILOT_TARGET } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const pilotStatesParam = searchParams.get("pilotStates") || "";
  const pilotSlugs = pilotStatesParam
    ? pilotStatesParam.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  // Build state filter if pilot states are specified
  const stateFilter = pilotSlugs.length > 0
    ? { court: { county: { state: { slug: { in: pilotSlugs } } } } }
    : {};

  const [imported, verified, unverified, rejected] = await Promise.all([
    prisma.judge.count({ where: { ...stateFilter } }),
    prisma.judge.count({ where: { status: "VERIFIED", ...stateFilter } }),
    prisma.judge.count({ where: { status: "UNVERIFIED", ...stateFilter } }),
    prisma.judge.count({ where: { status: "REJECTED", ...stateFilter } }),
  ]);

  // By-state breakdown — only states that have judges
  const statesWithJudges = await prisma.state.findMany({
    where: pilotSlugs.length > 0 ? { slug: { in: pilotSlugs } } : undefined,
    include: {
      counties: {
        include: {
          courts: {
            include: {
              _count: { select: { judges: true } },
              judges: {
                select: { status: true },
              },
            },
          },
        },
      },
    },
  });

  const byState = statesWithJudges
    .map((state) => {
      let stateImported = 0;
      let stateVerified = 0;
      let stateUnverified = 0;
      let stateRejected = 0;

      for (const county of state.counties) {
        for (const court of county.courts) {
          stateImported += court._count.judges;
          for (const judge of court.judges) {
            if (judge.status === "VERIFIED") stateVerified++;
            else if (judge.status === "UNVERIFIED") stateUnverified++;
            else if (judge.status === "REJECTED") stateRejected++;
          }
        }
      }

      return {
        stateId: state.id,
        stateName: state.name,
        stateSlug: state.slug,
        imported: stateImported,
        verified: stateVerified,
        unverified: stateUnverified,
        rejected: stateRejected,
        percentOfTarget: Number(
          ((stateImported / PILOT_TARGET) * 100).toFixed(1),
        ),
      };
    })
    .filter((s) => s.imported > 0)
    .sort((a, b) => b.imported - a.imported);

  // Recent batches
  const recentBatches = await prisma.importBatch.findMany({
    take: 5,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      fileName: true,
      successCount: true,
      status: true,
      createdAt: true,
    },
  });

  const percentComplete = Number(
    ((imported / PILOT_TARGET) * 100).toFixed(1),
  );

  return NextResponse.json({
    target: PILOT_TARGET,
    totals: {
      imported,
      verified,
      unverified,
      rejected,
      percentComplete,
    },
    byState,
    recentBatches: recentBatches.map((b) => ({
      id: b.id,
      fileName: b.fileName,
      successCount: b.successCount,
      status: b.status,
      createdAt: b.createdAt.toISOString(),
    })),
    milestoneReached: imported >= PILOT_TARGET,
  });
}
