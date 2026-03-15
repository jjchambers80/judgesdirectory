import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json();
  const { resolvedBy, resolutionNotes } = body as {
    resolvedBy?: string;
    resolutionNotes?: string;
  };

  const scrapeLog = await prisma.scrapeLog.findUnique({ where: { id } });
  if (!scrapeLog) {
    return NextResponse.json(
      { error: "Scrape log not found" },
      { status: 404 },
    );
  }

  if (scrapeLog.resolvedAt) {
    return NextResponse.json({ error: "Already resolved" }, { status: 409 });
  }

  const updated = await prisma.scrapeLog.update({
    where: { id },
    data: {
      resolvedAt: new Date(),
      resolvedBy: resolvedBy || "admin",
      resolutionNotes: resolutionNotes ?? null,
    },
  });

  return NextResponse.json(updated);
}
