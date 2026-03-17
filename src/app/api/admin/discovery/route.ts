import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

const STALE_DAYS = 30;

const VALID_SORT_FIELDS = [
  "discoveredAt",
  "confidenceScore",
  "stateAbbr",
  "status",
  "url",
] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const status = searchParams.get("status");
  const scrapeWorthyParam = searchParams.get("scrapeWorthy");
  const sortParam = searchParams.get("sort") || "discoveredAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );

  const skip = (page - 1) * limit;

  const sort: SortField = VALID_SORT_FIELDS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : "discoveredAt";

  // Build where clause
  const where: Prisma.UrlCandidateWhereInput = {};

  if (state) {
    where.stateAbbr = state.toUpperCase();
  }

  const staleDate = new Date(Date.now() - STALE_DAYS * 24 * 60 * 60 * 1000);

  if (status === "STALE") {
    where.status = "DISCOVERED";
    where.discoveredAt = { lt: staleDate };
  } else if (status) {
    where.status = status as "DISCOVERED" | "APPROVED" | "REJECTED";
  }

  if (scrapeWorthyParam === "true") {
    where.scrapeWorthy = true;
  } else if (scrapeWorthyParam === "false") {
    where.scrapeWorthy = false;
  } else if (scrapeWorthyParam === "null") {
    where.scrapeWorthy = null;
  }

  // Build orderBy from validated sort field
  const orderBy: Prisma.UrlCandidateOrderByWithRelationInput = {
    [sort]: order,
  };

  const [candidates, total] = await Promise.all([
    prisma.urlCandidate.findMany({
      where,
      orderBy,
      skip,
      take: limit,
    }),
    prisma.urlCandidate.count({ where }),
  ]);

  // Compute isStale for each candidate
  const enriched = candidates.map((c) => ({
    ...c,
    isStale: c.status === "DISCOVERED" && c.discoveredAt < staleDate,
  }));

  return NextResponse.json({
    candidates: enriched,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
