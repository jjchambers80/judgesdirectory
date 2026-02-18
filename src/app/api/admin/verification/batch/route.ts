import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

const VALID_TRANSITIONS: Record<string, Record<string, string>> = {
  UNVERIFIED: { verify: "VERIFIED", reject: "REJECTED" },
  VERIFIED: { unverify: "UNVERIFIED" },
  REJECTED: { unverify: "UNVERIFIED" },
};

const MAX_BATCH_SIZE = 50;

export async function PATCH(request: NextRequest) {
  let body: { judgeIds?: string[]; action?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { judgeIds, action } = body;

  if (!action || !["verify", "reject", "unverify"].includes(action)) {
    return NextResponse.json(
      { error: "Invalid action. Must be verify, reject, or unverify." },
      { status: 422 },
    );
  }

  if (!judgeIds || !Array.isArray(judgeIds) || judgeIds.length === 0) {
    return NextResponse.json(
      { error: "judgeIds must be a non-empty array." },
      { status: 422 },
    );
  }

  if (judgeIds.length > MAX_BATCH_SIZE) {
    return NextResponse.json(
      { error: `Maximum ${MAX_BATCH_SIZE} judges per batch request.` },
      { status: 422 },
    );
  }

  const judges = await prisma.judge.findMany({
    where: { id: { in: judgeIds } },
    select: { id: true, fullName: true, status: true },
  });

  const judgeMap = new Map(judges.map((j) => [j.id, j]));
  const results: Array<{ id: string; status?: string; error?: string }> = [];
  let succeeded = 0;
  let failed = 0;

  for (const id of judgeIds) {
    const judge = judgeMap.get(id);
    if (!judge) {
      results.push({ id, error: "Judge not found" });
      failed++;
      continue;
    }

    const transitions = VALID_TRANSITIONS[judge.status];
    const newStatus = transitions?.[action];

    if (!newStatus) {
      results.push({
        id,
        error: `Invalid status transition: cannot ${action} from ${judge.status}`,
      });
      failed++;
      continue;
    }

    try {
      await prisma.judge.update({
        where: { id },
        data: { status: newStatus as "VERIFIED" | "UNVERIFIED" | "REJECTED" },
      });
      results.push({ id, status: newStatus });
      succeeded++;
    } catch {
      results.push({ id, error: "Update failed" });
      failed++;
    }
  }

  return NextResponse.json({
    total: judgeIds.length,
    succeeded,
    failed,
    results,
  });
}
