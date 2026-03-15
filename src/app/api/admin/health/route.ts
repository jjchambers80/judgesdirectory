import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

const VALID_SORT_FIELDS = [
  "healthScore",
  "lastScrapedAt",
  "lastYield",
  "avgYield",
] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const status = searchParams.get("status");
  const failuresOnly = searchParams.get("failuresOnly") === "true";
  const sortParam = searchParams.get("sort") || "healthScore";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const skip = (page - 1) * limit;

  const sort: SortField = VALID_SORT_FIELDS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : "healthScore";

  // Build where clause
  const where: Prisma.UrlHealthWhereInput = {};

  if (state) where.stateAbbr = state.toUpperCase();

  if (status === "healthy") {
    where.healthScore = { gte: 0.7 };
    where.active = true;
  } else if (status === "moderate") {
    where.healthScore = { gte: 0.3, lt: 0.7 };
    where.active = true;
  } else if (status === "unhealthy") {
    where.healthScore = { lt: 0.3 };
    where.active = true;
  } else if (status === "anomaly") {
    where.anomalyDetected = true;
  } else if (status === "inactive") {
    where.active = false;
  }

  if (failuresOnly) {
    where.scrapeLogs = {
      some: {
        success: false,
        resolvedAt: null,
      },
    };
  }

  const [urls, total] = await Promise.all([
    prisma.urlHealth.findMany({
      where,
      orderBy: { [sort]: order },
      skip,
      take: limit,
    }),
    prisma.urlHealth.count({ where }),
  ]);

  // Inline summary for current filter scope
  const allForSummary = state
    ? { stateAbbr: state.toUpperCase() }
    : {};
  const summaryRecords = await prisma.urlHealth.findMany({
    where: allForSummary,
    select: { healthScore: true, anomalyDetected: true, active: true },
  });

  let healthy = 0;
  let moderate = 0;
  let unhealthy = 0;
  let anomalies = 0;
  let scoreSum = 0;

  for (const r of summaryRecords) {
    scoreSum += r.healthScore;
    if (r.anomalyDetected) anomalies++;
    if (!r.active) continue;
    if (r.healthScore >= 0.7) healthy++;
    else if (r.healthScore >= 0.3) moderate++;
    else unhealthy++;
  }

  return NextResponse.json({
    urls,
    summary: {
      total: summaryRecords.length,
      healthy,
      moderate,
      unhealthy,
      anomalies,
      avgHealthScore:
        summaryRecords.length > 0
          ? Math.round((scoreSum / summaryRecords.length) * 100) / 100
          : 0,
    },
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
