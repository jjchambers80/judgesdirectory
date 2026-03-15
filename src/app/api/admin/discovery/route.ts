import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@prisma/client";

const STALE_DAYS = 30;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const state = searchParams.get("state");
  const status = searchParams.get("status");
  const sort = searchParams.get("sort") || "discoveredAt";
  const order = searchParams.get("order") || "desc";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );

  const skip = (page - 1) * limit;

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

  // Build orderBy
  const orderBy: Prisma.UrlCandidateOrderByWithRelationInput =
    sort === "confidenceScore"
      ? { confidenceScore: order === "asc" ? "asc" : "desc" }
      : { discoveredAt: order === "asc" ? "asc" : "desc" };

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
