import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const stateId = searchParams.get("stateId") || undefined;
  const countyId = searchParams.get("countyId") || undefined;

  // Build filter for state/county
  const courtFilter: Record<string, unknown> = {};
  if (countyId) {
    courtFilter.court = { countyId };
  } else if (stateId) {
    courtFilter.court = { county: { stateId } };
  }

  // Get all judges matching filter, grouped by sourceUrl
  const allJudges = await prisma.judge.findMany({
    where: {
      sourceUrl: { not: null },
      ...courtFilter,
    },
    select: {
      sourceUrl: true,
      sourceAuthority: true,
      status: true,
    },
  });

  // Aggregate by sourceUrl
  const sourceMap = new Map<
    string,
    {
      sourceUrl: string;
      sourceAuthority: string | null;
      total: number;
      verified: number;
      unverified: number;
      needsReview: number;
    }
  >();

  for (const judge of allJudges) {
    const url = judge.sourceUrl!;
    if (!sourceMap.has(url)) {
      sourceMap.set(url, {
        sourceUrl: url,
        sourceAuthority: judge.sourceAuthority,
        total: 0,
        verified: 0,
        unverified: 0,
        needsReview: 0,
      });
    }
    const entry = sourceMap.get(url)!;
    entry.total++;
    if (judge.status === "VERIFIED") entry.verified++;
    else if (judge.status === "UNVERIFIED") entry.unverified++;
    else if (judge.status === "NEEDS_REVIEW") entry.needsReview++;
  }

  // Sort by total descending, paginate
  const allSources = Array.from(sourceMap.values()).sort(
    (a, b) => b.total - a.total,
  );
  const total = allSources.length;
  const paginatedSources = allSources.slice(
    (page - 1) * limit,
    page * limit,
  );

  return NextResponse.json({
    sources: paginatedSources,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
