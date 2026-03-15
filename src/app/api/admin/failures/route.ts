import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma, FailureType } from "@prisma/client";

const FAILURE_TYPES: string[] = Object.values(FailureType);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const failureType = searchParams.get("failureType");
  const resolved = searchParams.get("resolved");
  const dateFrom = searchParams.get("dateFrom");
  const dateTo = searchParams.get("dateTo");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const skip = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ScrapeFailureWhereInput = {};

  if (state) where.stateAbbr = state.toUpperCase();

  if (failureType && FAILURE_TYPES.includes(failureType)) {
    where.failureType = failureType as FailureType;
  }

  if (resolved === "true") {
    where.resolvedAt = { not: null };
  } else if (resolved === "false") {
    where.resolvedAt = null;
  }

  if (dateFrom || dateTo) {
    where.attemptedAt = {};
    if (dateFrom) where.attemptedAt.gte = new Date(dateFrom);
    if (dateTo) where.attemptedAt.lte = new Date(dateTo);
  }

  const [failures, total] = await Promise.all([
    prisma.scrapeFailure.findMany({
      where,
      orderBy: { attemptedAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.scrapeFailure.count({ where }),
  ]);

  // Summary: count unresolved by type
  const unresolvedCounts = await prisma.scrapeFailure.groupBy({
    by: ["failureType"],
    where: { resolvedAt: null },
    _count: true,
  });

  const byType: Record<string, number> = {};
  let totalUnresolved = 0;
  for (const group of unresolvedCounts) {
    byType[group.failureType] = group._count;
    totalUnresolved += group._count;
  }

  return NextResponse.json({
    failures,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
    summary: {
      totalUnresolved,
      byType,
    },
  });
}
