import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { resolutionNotes } = body as { resolutionNotes?: string };

  const failure = await prisma.scrapeFailure.findUnique({ where: { id } });
  if (!failure) {
    return NextResponse.json(
      { error: "Failure record not found" },
      { status: 404 },
    );
  }

  if (failure.resolvedAt) {
    return NextResponse.json({ error: "Already resolved" }, { status: 409 });
  }

  const updated = await prisma.scrapeFailure.update({
    where: { id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: "manual",
      resolutionNotes: resolutionNotes ?? null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    resolvedAt: updated.resolvedAt,
    resolvedBy: updated.resolvedBy,
    resolutionNotes: updated.resolutionNotes,
  });
}
