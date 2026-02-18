import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const existing = await prisma.judge.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Judge not found" }, { status: 404 });
  }

  const body = await request.json();
  const { verified } = body;

  if (typeof verified !== "boolean") {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: [{ field: "verified", message: "verified must be a boolean" }],
      },
      { status: 400 },
    );
  }

  const judge = await prisma.judge.update({
    where: { id },
    data: { verified },
  });

  return NextResponse.json({
    judge: {
      id: judge.id,
      fullName: judge.fullName,
      verified: judge.verified,
      updatedAt: judge.updatedAt.toISOString(),
    },
  });
}
