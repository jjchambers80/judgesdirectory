import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();

  const { action, rejectionReason } = body as {
    action?: "approve" | "reject";
    rejectionReason?: string;
  };

  if (!action || !["approve", "reject"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be 'approve' or 'reject'." },
      { status: 400 },
    );
  }

  if (action === "reject" && !rejectionReason) {
    return NextResponse.json(
      { error: "Rejection reason is required" },
      { status: 400 },
    );
  }

  const candidate = await prisma.urlCandidate.findUnique({ where: { id } });
  if (!candidate) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const now = new Date();
  const updated = await prisma.urlCandidate.update({
    where: { id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      rejectionReason: action === "reject" ? rejectionReason : null,
      reviewedAt: now,
      // Approved URLs are immediately harvestable — no separate promote step needed.
      promotedAt: action === "approve" ? now : null,
    },
  });

  return NextResponse.json({
    id: updated.id,
    status: updated.status,
    rejectionReason: updated.rejectionReason,
    reviewedAt: updated.reviewedAt,
  });
}
