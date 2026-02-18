import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { generateSlug } from "@/lib/slugify";

/**
 * POST /api/admin/courts/bulk
 * Create court types across all counties in a state.
 * Contract: api-routes.md §10
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { stateId, courtTypes } = body;

  // Validate stateId
  if (!stateId || typeof stateId !== "string") {
    return NextResponse.json({ error: "stateId is required" }, { status: 422 });
  }

  // Validate courtTypes
  if (
    !Array.isArray(courtTypes) ||
    courtTypes.length === 0 ||
    courtTypes.length > 10
  ) {
    return NextResponse.json(
      { error: "courtTypes must be an array of 1–10 strings" },
      { status: 422 },
    );
  }

  // Verify state exists
  const state = await prisma.state.findUnique({
    where: { id: stateId },
    select: { id: true, name: true },
  });
  if (!state) {
    return NextResponse.json({ error: "State not found" }, { status: 404 });
  }

  // Get all counties for the state
  const counties = await prisma.county.findMany({
    where: { stateId },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  // Get existing courts for all counties to detect duplicates
  const existingCourts = await prisma.court.findMany({
    where: {
      countyId: { in: counties.map((c) => c.id) },
    },
    select: { countyId: true, slug: true },
  });

  const existingSet = new Set(
    existingCourts.map((c) => `${c.countyId}:${c.slug}`),
  );

  // Build court records to create
  const details: Array<{
    courtType: string;
    created: number;
    skipped: number;
  }> = [];

  const courtsToCreate: Array<{
    countyId: string;
    type: string;
    slug: string;
  }> = [];

  for (const courtType of courtTypes) {
    if (typeof courtType !== "string" || courtType.trim().length === 0) {
      continue;
    }

    const trimmed = courtType.trim();
    const slug = generateSlug(trimmed);
    let created = 0;
    let skipped = 0;

    for (const county of counties) {
      const key = `${county.id}:${slug}`;
      if (existingSet.has(key)) {
        skipped++;
      } else {
        courtsToCreate.push({
          countyId: county.id,
          type: trimmed,
          slug,
        });
        existingSet.add(key); // prevent duplicates within this request
        created++;
      }
    }

    details.push({ courtType: trimmed, created, skipped });
  }

  // Bulk insert all courts
  if (courtsToCreate.length > 0) {
    await prisma.court.createMany({
      data: courtsToCreate,
      skipDuplicates: true,
    });
  }

  const totalCreated = details.reduce((sum, d) => sum + d.created, 0);
  const totalSkipped = details.reduce((sum, d) => sum + d.skipped, 0);

  return NextResponse.json({
    stateId: state.id,
    stateName: state.name,
    totalCounties: counties.length,
    courtsCreated: totalCreated,
    courtsSkipped: totalSkipped,
    details,
  });
}
