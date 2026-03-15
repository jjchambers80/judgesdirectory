import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
  const records = await prisma.urlHealth.findMany({
    select: {
      stateAbbr: true,
      state: true,
      healthScore: true,
      anomalyDetected: true,
      active: true,
      lastScrapedAt: true,
    },
  });

  // Group by state
  const stateMap = new Map<
    string,
    {
      stateAbbr: string;
      state: string;
      totalUrls: number;
      healthy: number;
      moderate: number;
      unhealthy: number;
      scoreSum: number;
      anomalies: number;
      lastHarvestAt: Date | null;
    }
  >();

  for (const r of records) {
    let entry = stateMap.get(r.stateAbbr);
    if (!entry) {
      entry = {
        stateAbbr: r.stateAbbr,
        state: r.state,
        totalUrls: 0,
        healthy: 0,
        moderate: 0,
        unhealthy: 0,
        scoreSum: 0,
        anomalies: 0,
        lastHarvestAt: null,
      };
      stateMap.set(r.stateAbbr, entry);
    }

    entry.totalUrls++;
    entry.scoreSum += r.healthScore;
    if (r.anomalyDetected) entry.anomalies++;

    if (r.active) {
      if (r.healthScore >= 0.7) entry.healthy++;
      else if (r.healthScore >= 0.3) entry.moderate++;
      else entry.unhealthy++;
    }

    if (
      r.lastScrapedAt &&
      (!entry.lastHarvestAt || r.lastScrapedAt > entry.lastHarvestAt)
    ) {
      entry.lastHarvestAt = r.lastScrapedAt;
    }
  }

  const states = Array.from(stateMap.values()).map((s) => ({
    stateAbbr: s.stateAbbr,
    state: s.state,
    totalUrls: s.totalUrls,
    healthy: s.healthy,
    moderate: s.moderate,
    unhealthy: s.unhealthy,
    avgHealthScore:
      s.totalUrls > 0
        ? Math.round((s.scoreSum / s.totalUrls) * 100) / 100
        : 0,
    anomalies: s.anomalies,
    lastHarvestAt: s.lastHarvestAt,
  }));

  return NextResponse.json({ states });
}
