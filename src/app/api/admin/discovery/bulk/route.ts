import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(request: NextRequest) {
  const body = await request.json();

  const { ids, action, rejectionReason } = body as {
    ids: string[];
    action: "approve" | "reject";
    rejectionReason?: string;
  };

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json(
      { error: "No candidate IDs provided" },
      { status: 400 },
    );
  }

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

  const result = await prisma.urlCandidate.updateMany({
    where: { id: { in: ids } },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      rejectionReason: action === "reject" ? rejectionReason : null,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json({
    updated: result.count,
    action,
  });
}
