import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ stateId: string }> },
) {
  const { stateId } = await params;

  const state = await prisma.state.findUnique({ where: { id: stateId } });
  if (!state) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }

  const counties = await prisma.county.findMany({
    where: { stateId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
    },
  });

  return NextResponse.json({ counties });
}
