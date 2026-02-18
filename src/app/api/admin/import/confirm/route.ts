import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { acquireImportLock, isImporting } from "@/lib/import-lock";
import { generateSlug } from "@/lib/slugify";
import { parseCsv, CsvParseError, normalizeCountyName } from "@/lib/csv";

/**
 * POST /api/admin/import/confirm
 * Execute a previously parsed import batch.
 * Contract: api-routes.md §2
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { batchId, columnMapping, state: stateSlug } = body;

  if (!batchId || !columnMapping || !stateSlug) {
    return NextResponse.json(
      { error: "batchId, columnMapping, and state are required" },
      { status: 422 },
    );
  }

  // Validate required mapped fields
  if (
    !columnMapping.fullName &&
    !Object.values(columnMapping).includes("fullName")
  ) {
    return NextResponse.json(
      { error: "Column mapping must include fullName" },
      { status: 422 },
    );
  }
  if (
    !columnMapping.sourceUrl &&
    !Object.values(columnMapping).includes("sourceUrl")
  ) {
    return NextResponse.json(
      { error: "Column mapping must include sourceUrl" },
      { status: 422 },
    );
  }

  // Validate batch
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.status !== "PENDING") {
    return NextResponse.json(
      { error: "Batch already confirmed or rolled back" },
      { status: 409 },
    );
  }

  // Check import lock (FR-019)
  if (isImporting()) {
    return NextResponse.json(
      { error: "Another import is in progress" },
      { status: 409 },
    );
  }

  let releaseLock: (() => void) | null = null;

  try {
    releaseLock = await acquireImportLock(batchId, batch.fileName);

    // Update batch to PROCESSING
    await prisma.importBatch.update({
      where: { id: batchId },
      data: { status: "PROCESSING" },
    });

    // Re-read the CSV (we need the raw file content)
    // Since we stored it as a batch, we'll re-parse from the stored data
    // In practice, the frontend should send the file again or we store it
    // For now, we use the batch metadata and the state to process

    // Fetch state with counties and courts
    const state = await prisma.state.findUnique({
      where: { slug: stateSlug },
      include: {
        counties: {
          include: {
            courts: { select: { id: true, type: true, slug: true } },
          },
        },
      },
    });

    if (!state) {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: { status: "PENDING" },
      });
      return NextResponse.json({ error: "State not found" }, { status: 422 });
    }

    // Build set of acceptable state name variants for CSV cross-check
    const stateAliases = new Set([
      state.name.toLowerCase(),
      state.slug.toLowerCase(),
      state.abbreviation.toLowerCase(),
    ]);

    // Get the uploaded file from the request (re-uploaded with confirm)
    // The frontend re-sends the file data along with the confirm request
    const { csvData } = body;

    if (!csvData || typeof csvData !== "string") {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: { status: "PENDING" },
      });
      return NextResponse.json(
        { error: "csvData is required for confirm" },
        { status: 422 },
      );
    }

    // Re-parse to get all rows
    let parseResult;
    try {
      parseResult = await parseCsv(csvData, stateSlug);
    } catch (err) {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: { status: "PENDING" },
      });
      if (err instanceof CsvParseError) {
        return NextResponse.json(
          { error: err.message },
          { status: err.statusCode },
        );
      }
      throw err;
    }

    // Build county lookup — index by normalized name for flexible matching
    const countyByName = new Map(
      state.counties.map((c) => [normalizeCountyName(c.name), c]),
    );

    // Build existing judges set for duplicate detection
    const existingJudges = await prisma.judge.findMany({
      where: {
        court: { county: { stateId: state.id } },
      },
      select: { fullName: true, courtId: true },
    });

    const existingSet = new Set(
      existingJudges.map((j) => `${j.fullName.toLowerCase()}:${j.courtId}`),
    );

    // Apply column mapping to build the actual mapping
    const reverseMapping: Record<string, string> = {};
    for (const [csvCol, targetField] of Object.entries(
      columnMapping as Record<string, string>,
    )) {
      reverseMapping[csvCol] = targetField;
    }

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;
    let courtsCreated = 0;
    const duplicatesSkipped: Array<{
      row: number;
      fullName: string;
      court: string;
    }> = [];
    const errorsDetail: Array<{ row: number; errors: string[] }> = [];

    // Track courts created in this import
    const courtCache = new Map<string, string>(); // key -> courtId

    // Process valid rows from parseResult.rawData
    for (let i = 0; i < parseResult.rawData.length; i++) {
      const raw = parseResult.rawData[i];
      const mapped: Record<string, string> = {};

      for (const [csvCol, targetField] of Object.entries(reverseMapping)) {
        if (raw[csvCol] !== undefined) {
          mapped[targetField] = raw[csvCol].trim();
        }
      }

      // Validate
      const rowErrors: string[] = [];

      // Validate state matches dropdown selection (if State column is present)
      if (mapped.stateName && mapped.stateName.length > 0) {
        if (!stateAliases.has(mapped.stateName.toLowerCase())) {
          rowErrors.push(
            `State "${mapped.stateName}" does not match selected state "${state.name}"`,
          );
        }
      }

      if (!mapped.fullName || mapped.fullName.length === 0) {
        rowErrors.push("fullName is required");
      }
      if (!mapped.sourceUrl || mapped.sourceUrl.length === 0) {
        rowErrors.push("sourceUrl is required");
      }

      if (rowErrors.length > 0) {
        errorCount++;
        errorsDetail.push({ row: i + 1, errors: rowErrors });
        continue;
      }

      // Resolve county (case-insensitive, strips suffixes like "County", "Parish")
      const countyName = mapped.countyName || "";
      const county = countyByName.get(normalizeCountyName(countyName));

      if (!county) {
        errorCount++;
        errorsDetail.push({
          row: i + 1,
          errors: [`County "${countyName}" not found in ${state.name}`],
        });
        continue;
      }

      const courtType = mapped.courtType || "";
      if (!courtType) {
        errorCount++;
        errorsDetail.push({
          row: i + 1,
          errors: ["courtType is required"],
        });
        continue;
      }

      // Find or create court
      const courtSlug = generateSlug(courtType);
      const courtKey = `${county.id}:${courtSlug}`;
      let courtId = courtCache.get(courtKey);

      if (!courtId) {
        // Check existing courts
        const existingCourt = county.courts.find((c) => c.slug === courtSlug);
        if (existingCourt) {
          courtId = existingCourt.id;
        } else {
          // Auto-create court in transaction
          const newCourt = await prisma.court.create({
            data: {
              countyId: county.id,
              type: courtType.trim(),
              slug: courtSlug,
            },
          });
          courtId = newCourt.id;
          courtsCreated++;
        }
        courtCache.set(courtKey, courtId);
      }

      // Check for duplicate
      const dedupKey = `${mapped.fullName.toLowerCase()}:${courtId}`;
      if (existingSet.has(dedupKey)) {
        skipCount++;
        duplicatesSkipped.push({
          row: i + 1,
          fullName: mapped.fullName,
          court: `${courtType}, ${county.name}`,
        });
        continue;
      }

      // Generate slug for judge
      const judgeSlug = generateSlug(mapped.fullName);

      // Create judge
      try {
        await prisma.judge.create({
          data: {
            courtId,
            fullName: mapped.fullName,
            slug: judgeSlug,
            sourceUrl: mapped.sourceUrl,
            selectionMethod: mapped.selectionMethod || null,
            appointingAuthority: mapped.appointingAuthority || null,
            education: mapped.education || null,
            priorExperience: mapped.priorExperience || null,
            politicalAffiliation: mapped.politicalAffiliation || null,
            status: "UNVERIFIED",
            importBatchId: batchId,
          },
        });
        successCount++;
        existingSet.add(dedupKey);
      } catch (err: unknown) {
        // Handle unique constraint violations (duplicate slug)
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          err.code === "P2002"
        ) {
          // Try with suffix
          let suffixNum = 2;
          let created = false;
          while (suffixNum <= 10) {
            try {
              await prisma.judge.create({
                data: {
                  courtId,
                  fullName: mapped.fullName,
                  slug: `${judgeSlug}-${suffixNum}`,
                  sourceUrl: mapped.sourceUrl,
                  selectionMethod: mapped.selectionMethod || null,
                  appointingAuthority: mapped.appointingAuthority || null,
                  education: mapped.education || null,
                  priorExperience: mapped.priorExperience || null,
                  politicalAffiliation: mapped.politicalAffiliation || null,
                  status: "UNVERIFIED",
                  importBatchId: batchId,
                },
              });
              successCount++;
              existingSet.add(dedupKey);
              created = true;
              break;
            } catch {
              suffixNum++;
            }
          }
          if (!created) {
            errorCount++;
            errorsDetail.push({
              row: i + 1,
              errors: ["Could not create unique slug"],
            });
          }
        } else {
          errorCount++;
          errorsDetail.push({
            row: i + 1,
            errors: ["Database error"],
          });
        }
      }
    }

    // Update batch
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: "COMPLETE",
        successCount,
        skipCount,
        errorCount,
      },
    });

    return NextResponse.json({
      batchId,
      status: "COMPLETE",
      successCount,
      skipCount,
      errorCount,
      courtsCreated,
      summary: {
        duplicatesSkipped,
        errorsDetail,
      },
    });
  } catch (err) {
    // Reset batch to PENDING on failure
    try {
      await prisma.importBatch.update({
        where: { id: batchId },
        data: { status: "PENDING" },
      });
    } catch {
      // ignore
    }
    throw err;
  } finally {
    if (releaseLock) releaseLock();
  }
}
