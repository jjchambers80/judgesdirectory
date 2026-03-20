import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * PATCH /api/admin/discovery/runs/[id]
 *
 * Cancel a running discovery run.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  let body: { action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (body.action !== "cancel") {
    return NextResponse.json(
      { error: "Invalid action. Must be 'cancel'." },
      { status: 400 },
    );
  }

  const run = await prisma.discoveryRun.findUnique({ where: { id } });

  if (!run) {
    return NextResponse.json(
      { error: "Discovery run not found" },
      { status: 404 },
    );
  }

  if (run.status !== "RUNNING") {
    return NextResponse.json(
      { error: "Run is not in RUNNING state", currentStatus: run.status },
      { status: 409 },
    );
  }

  await prisma.discoveryRun.update({
    where: { id },
    data: { status: "CANCELLED" },
  });

  return NextResponse.json({
    id,
    status: "CANCELLED",
    message:
      "Run cancellation requested. The process will stop at the next query checkpoint.",
  });
}
