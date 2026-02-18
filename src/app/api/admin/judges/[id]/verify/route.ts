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
  const { action } = body;

  const validActions = ["verify", "unverify"];
  if (!validActions.includes(action)) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: [{ field: "action", message: "action must be 'verify' or 'unverify'" }],
      },
      { status: 400 },
    );
  }

  const newStatus = action === "verify" ? "VERIFIED" : "UNVERIFIED";

  const judge = await prisma.judge.update({
    where: { id },
    data: { status: newStatus },
  });

  return NextResponse.json({
    judge: {
      id: judge.id,
      fullName: judge.fullName,
      status: judge.status,
      updatedAt: judge.updatedAt.toISOString(),
    },
  });
}
