import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/import/{batchId}
 * Get detailed information about a specific import batch.
 * Contract: api-routes.md §5
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      judges: {
        select: { status: true },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  const judgesByStatus = {
    verified: batch.judges.filter((j) => j.status === "VERIFIED").length,
    unverified: batch.judges.filter((j) => j.status === "UNVERIFIED").length,
    rejected: batch.judges.filter((j) => j.status === "REJECTED").length,
  };

  return NextResponse.json({
    id: batch.id,
    fileName: batch.fileName,
    totalRows: batch.totalRows,
    successCount: batch.successCount,
    skipCount: batch.skipCount,
    errorCount: batch.errorCount,
    status: batch.status,
    hasVerifiedJudges: judgesByStatus.verified > 0,
    createdAt: batch.createdAt.toISOString(),
    judges: judgesByStatus,
  });
}

/**
 * DELETE /api/admin/import/{batchId}
 * Rollback an entire import batch. Deletes all judge records created in this batch.
 * Contract: api-routes.md §6
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const { batchId } = await params;

  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      judges: {
        where: { status: "VERIFIED" },
        select: { id: true },
      },
    },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.status === "ROLLED_BACK") {
    return NextResponse.json(
      { error: "Batch already rolled back" },
      { status: 409 },
    );
  }

  if (batch.judges.length > 0) {
    return NextResponse.json(
      {
        error:
          "Batch has verified judges — must un-verify them before rollback",
      },
      { status: 409 },
    );
  }

  // Delete all judges from this batch and update status
  const deleted = await prisma.judge.deleteMany({
    where: { importBatchId: batchId },
  });

  await prisma.importBatch.update({
    where: { id: batchId },
    data: { status: "ROLLED_BACK" },
  });

  return NextResponse.json({
    batchId,
    status: "ROLLED_BACK",
    recordsDeleted: deleted.count,
  });
}
