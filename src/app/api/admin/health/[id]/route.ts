import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const health = await prisma.urlHealth.findUnique({ where: { id } });
  if (!health) {
    return NextResponse.json(
      { error: "Health record not found" },
      { status: 404 },
    );
  }

  const scrapeHistory = await prisma.scrapeLog.findMany({
    where: { urlHealthId: id },
    orderBy: { scrapedAt: "desc" },
    take: 50,
    select: {
      id: true,
      success: true,
      judgesFound: true,
      failureType: true,
      httpStatusCode: true,
      errorMessage: true,
      retryCount: true,
      scrapeDurationMs: true,
      resolvedAt: true,
      resolvedBy: true,
      scrapedAt: true,
    },
  });

  return NextResponse.json({ health, scrapeHistory });
}

const VALID_ACTIONS = ["dismiss-anomaly", "deactivate", "reactivate"] as const;
type Action = (typeof VALID_ACTIONS)[number];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { action } = body as { action?: string };

  if (!action || !VALID_ACTIONS.includes(action as Action)) {
    return NextResponse.json(
      { error: `Invalid action. Must be one of: ${VALID_ACTIONS.join(", ")}` },
      { status: 400 },
    );
  }

  const health = await prisma.urlHealth.findUnique({ where: { id } });
  if (!health) {
    return NextResponse.json(
      { error: "Health record not found" },
      { status: 404 },
    );
  }

  let data: Record<string, unknown>;
  switch (action as Action) {
    case "dismiss-anomaly":
      data = { anomalyDetected: false, anomalyMessage: null };
      break;
    case "deactivate":
      data = { active: false };
      break;
    case "reactivate":
      data = { active: true };
      break;
  }

  const updated = await prisma.urlHealth.update({ where: { id }, data });
  return NextResponse.json(updated);
}
