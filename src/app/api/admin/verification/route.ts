import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { VERIFICATION_PAGE_SIZE } from "@/lib/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    VERIFICATION_PAGE_SIZE,
    Math.max(1, parseInt(searchParams.get("limit") || String(VERIFICATION_PAGE_SIZE), 10)),
  );
  const stateId = searchParams.get("stateId") || undefined;
  const countyId = searchParams.get("countyId") || undefined;
  const batchId = searchParams.get("batchId") || undefined;
  const status = searchParams.get("status") || "UNVERIFIED";
  const sort = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const allowedSortFields = ["createdAt", "fullName", "updatedAt"];
  const sortField = allowedSortFields.includes(sort) ? sort : "createdAt";

  const where: Record<string, unknown> = {};

  if (status) {
    where.status = status;
  }
  if (batchId) {
    where.importBatchId = batchId;
  }
  if (countyId) {
    where.court = { countyId };
  } else if (stateId) {
    where.court = { county: { stateId } };
  }

  const [judges, total] = await Promise.all([
    prisma.judge.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sortField]: order },
      include: {
        court: {
          include: {
            county: {
              include: { state: true },
            },
          },
        },
        importBatch: {
          select: { id: true, fileName: true },
        },
      },
    }),
    prisma.judge.count({ where }),
  ]);

  const formatted = judges.map((j) => ({
    id: j.id,
    fullName: j.fullName,
    court: j.court.type,
    county: j.court.county.name,
    state: j.court.county.state.name,
    sourceUrl: j.sourceUrl,
    status: j.status,
    importBatchId: j.importBatch?.id ?? null,
    importBatchFileName: j.importBatch?.fileName ?? null,
    createdAt: j.createdAt.toISOString(),
  }));

  return NextResponse.json({
    judges: formatted,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
