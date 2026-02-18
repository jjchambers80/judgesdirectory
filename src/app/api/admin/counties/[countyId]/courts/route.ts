import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateUniqueCourtSlug } from "@/lib/slugify";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ countyId: string }> },
) {
  const { countyId } = await params;

  const county = await prisma.county.findUnique({ where: { id: countyId } });
  if (!county) {
    return NextResponse.json({ error: "County not found" }, { status: 404 });
  }

  const courts = await prisma.court.findMany({
    where: { countyId },
    orderBy: { type: "asc" },
    select: {
      id: true,
      type: true,
      slug: true,
    },
  });

  return NextResponse.json({ courts });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ countyId: string }> },
) {
  const { countyId } = await params;

  const county = await prisma.county.findUnique({ where: { id: countyId } });
  if (!county) {
    return NextResponse.json({ error: "County not found" }, { status: 404 });
  }

  const body = await request.json();
  const { type } = body;

  if (!type || typeof type !== "string" || type.trim().length === 0) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: [{ field: "type", message: "Court type is required" }],
      },
      { status: 400 },
    );
  }

  const slug = await generateUniqueCourtSlug(type.trim(), countyId);

  try {
    const court = await prisma.court.create({
      data: {
        countyId,
        type: type.trim(),
        slug,
      },
    });

    return NextResponse.json({ court }, { status: 201 });
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "Court type slug collision", details: [] },
        { status: 409 },
      );
    }
    throw error;
  }
}
