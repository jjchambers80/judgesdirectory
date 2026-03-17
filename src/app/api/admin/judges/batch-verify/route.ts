import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const { sourceUrl } = body as { sourceUrl?: string };

  if (!sourceUrl || typeof sourceUrl !== "string" || sourceUrl.trim() === "") {
    return NextResponse.json(
      { error: "sourceUrl is required" },
      { status: 422 },
    );
  }

  // Only promote UNVERIFIED judges — exclude NEEDS_REVIEW and REJECTED (FR-022)
  const result = await prisma.judge.updateMany({
    where: {
      sourceUrl: sourceUrl.trim(),
      status: "UNVERIFIED",
    },
    data: {
      status: "VERIFIED",
      verifiedAt: new Date(),
    },
  });

  if (result.count === 0) {
    return NextResponse.json(
      { error: "No unverified judges found for this source" },
      { status: 422 },
    );
  }

  return NextResponse.json({
    promoted: result.count,
    sourceUrl: sourceUrl.trim(),
  });
}
