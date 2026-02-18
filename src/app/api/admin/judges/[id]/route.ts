import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateUniqueJudgeSlug } from "@/lib/slugify";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.judge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Judge not found" }, { status: 404 });
  }

  const body = await request.json();
  const {
    fullName,
    courtId,
    termStart,
    termEnd,
    selectionMethod,
    appointingAuthority,
    education,
    priorExperience,
    politicalAffiliation,
    sourceUrl,
  } = body;

  const data: Record<string, unknown> = {};

  // If fullName changes, regenerate slug
  if (fullName !== undefined) {
    if (typeof fullName !== "string" || fullName.trim().length === 0) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: [
            { field: "fullName", message: "Full name cannot be empty" },
          ],
        },
        { status: 400 },
      );
    }
    data.fullName = fullName.trim();
    const targetCourtId = courtId || existing.courtId;
    data.slug = await generateUniqueJudgeSlug(
      fullName.trim(),
      targetCourtId,
      id,
    );
  }

  if (courtId !== undefined) data.courtId = courtId;
  if (termStart !== undefined)
    data.termStart = termStart ? new Date(termStart) : null;
  if (termEnd !== undefined) data.termEnd = termEnd ? new Date(termEnd) : null;
  if (selectionMethod !== undefined)
    data.selectionMethod = selectionMethod || null;
  if (appointingAuthority !== undefined)
    data.appointingAuthority = appointingAuthority || null;
  if (education !== undefined) data.education = education || null;
  if (priorExperience !== undefined)
    data.priorExperience = priorExperience || null;
  if (politicalAffiliation !== undefined)
    data.politicalAffiliation = politicalAffiliation || null;
  if (sourceUrl !== undefined) data.sourceUrl = sourceUrl || null;

  const judge = await prisma.judge.update({
    where: { id },
    data,
  });

  return NextResponse.json({
    judge: {
      id: judge.id,
      fullName: judge.fullName,
      slug: judge.slug,
      status: judge.status,
      updatedAt: judge.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.judge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Judge not found" }, { status: 404 });
  }

  await prisma.judge.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
