import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateUniqueJudgeSlug } from "@/lib/slugify";

const VALID_SORT_FIELDS = ["fullName", "createdAt", "status"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") || "50", 10)),
  );
  const search = searchParams.get("search") || undefined;
  const stateId = searchParams.get("stateId") || undefined;
  const countyId = searchParams.get("countyId") || undefined;
  const courtId = searchParams.get("courtId") || undefined;
  const status = searchParams.get("status") || undefined;
  const sortParam = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const sort: SortField = VALID_SORT_FIELDS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : "createdAt";

  const where: Record<string, unknown> = {};

  if (search) {
    where.fullName = { contains: search, mode: "insensitive" };
  }
  if (courtId) {
    where.courtId = courtId;
  } else if (countyId) {
    where.court = { countyId };
  } else if (stateId) {
    where.court = { county: { stateId } };
  }
  if (status) {
    where.status = status;
  }

  const [judges, total] = await Promise.all([
    prisma.judge.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sort]: order },
      include: {
        court: {
          include: {
            county: {
              include: {
                state: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    }),
    prisma.judge.count({ where }),
  ]);

  return NextResponse.json({
    judges: judges.map((j) => ({
      id: j.id,
      fullName: j.fullName,
      slug: j.slug,
      status: j.status,
      court: {
        id: j.court.id,
        type: j.court.type,
        county: {
          id: j.court.county.id,
          name: j.court.county.name,
          state: {
            id: j.court.county.state.id,
            name: j.court.county.state.name,
          },
        },
      },
      createdAt: j.createdAt.toISOString(),
      updatedAt: j.updatedAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    courtId,
    fullName,
    termStart,
    termEnd,
    selectionMethod,
    appointingAuthority,
    education,
    priorExperience,
    politicalAffiliation,
    sourceUrl,
  } = body;

  // Validate required fields
  const errors: Array<{ field: string; message: string }> = [];

  if (
    !fullName ||
    typeof fullName !== "string" ||
    fullName.trim().length === 0
  ) {
    errors.push({ field: "fullName", message: "Full name is required" });
  }
  if (!courtId || typeof courtId !== "string") {
    errors.push({ field: "courtId", message: "Court is required" });
  }
  if (
    !sourceUrl ||
    typeof sourceUrl !== "string" ||
    sourceUrl.trim().length === 0
  ) {
    errors.push({ field: "sourceUrl", message: "Source URL is required" });
  }

  if (errors.length > 0) {
    return NextResponse.json(
      { error: "Validation failed", details: errors },
      { status: 400 },
    );
  }

  // Verify court exists
  const court = await prisma.court.findUnique({ where: { id: courtId } });
  if (!court) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: [{ field: "courtId", message: "Court not found" }],
      },
      { status: 400 },
    );
  }

  const slug = await generateUniqueJudgeSlug(fullName.trim(), courtId);

  const judge = await prisma.judge.create({
    data: {
      courtId,
      fullName: fullName.trim(),
      slug,
      termStart: termStart ? new Date(termStart) : null,
      termEnd: termEnd ? new Date(termEnd) : null,
      selectionMethod: selectionMethod || null,
      appointingAuthority: appointingAuthority || null,
      education: education || null,
      priorExperience: priorExperience || null,
      politicalAffiliation: politicalAffiliation || null,
      sourceUrl: sourceUrl.trim(),
    },
  });

  return NextResponse.json(
    {
      judge: {
        id: judge.id,
        fullName: judge.fullName,
        slug: judge.slug,
        courtId: judge.courtId,
        status: judge.status,
        createdAt: judge.createdAt.toISOString(),
        updatedAt: judge.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}
