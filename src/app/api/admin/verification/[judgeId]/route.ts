import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  UNVERIFIED: { verify: "VERIFIED", reject: "REJECTED" },
  VERIFIED: { unverify: "UNVERIFIED" },
  REJECTED: { unverify: "UNVERIFIED" },
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ judgeId: string }> },
) {
  const { judgeId } = await params;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { action } = body;

  if (!action || !["verify", "reject", "unverify"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be verify, reject, or unverify." },
      { status: 422 },
    );
  }

  const judge = await prisma.judge.findUnique({
    where: { id: judgeId },
  });

  if (!judge) {
    return NextResponse.json({ error: "Judge not found" }, { status: 404 });
  }

  const currentStatus = judge.status;
  const transitions = VALID_TRANSITIONS[currentStatus];
  const newStatus = transitions?.[action];

  if (!newStatus) {
    return NextResponse.json(
      {
        error: `Invalid status transition: cannot ${action} from ${currentStatus}`,
      },
      { status: 409 },
    );
  }

  const updated = await prisma.judge.update({
    where: { id: judgeId },
    data: { status: newStatus as "VERIFIED" | "UNVERIFIED" | "REJECTED" },
  });

  return NextResponse.json({
    id: updated.id,
    fullName: updated.fullName,
    status: updated.status,
  });
}
