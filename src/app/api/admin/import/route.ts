import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { parseCsv, CsvParseError } from "@/lib/csv";
import { isImporting } from "@/lib/import-lock";

/**
 * POST /api/admin/import
 * Upload + parse CSV. Creates a PENDING ImportBatch and returns preview.
 * Contract: api-routes.md §1
 */
export async function POST(request: NextRequest) {
  // Check import lock (FR-019)
  if (isImporting()) {
    return NextResponse.json(
      { error: "Import already in progress" },
      { status: 409 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const stateSlug = formData.get("state") as string | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  if (!stateSlug) {
    return NextResponse.json({ error: "State is required" }, { status: 400 });
  }

  // Validate file size (FR-001)
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: "File exceeds 5 MB limit" },
      { status: 413 },
    );
  }

  let csvText: string;
  try {
    csvText = await file.text();
  } catch {
    return NextResponse.json({ error: "Could not read file" }, { status: 422 });
  }

  try {
    const result = await parseCsv(csvText, stateSlug);

    // Create PENDING ImportBatch
    const batch = await prisma.importBatch.create({
      data: {
        fileName: file.name,
        totalRows: result.totalRows,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      batchId: batch.id,
      fileName: file.name,
      totalRows: result.totalRows,
      validRows: result.validRows,
      invalidRows: result.invalidRows,
      duplicateRows: result.duplicateRows,
      columns: result.columns,
      columnMapping: result.columnMapping,
      preview: result.preview,
      unmatchedStates: result.unmatchedStates,
      unmatchedCounties: result.unmatchedCounties,
      courtsToCreate: result.courtsToCreate,
    });
  } catch (err) {
    if (err instanceof CsvParseError) {
      return NextResponse.json(
        { error: err.message },
        { status: err.statusCode },
      );
    }
    throw err;
  }
}

const VALID_SORT_FIELDS = ["createdAt", "status", "totalRows"] as const;
type SortField = (typeof VALID_SORT_FIELDS)[number];

/**
 * GET /api/admin/import
 * List import batches with pagination.
 * Contract: api-routes.md §3
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") || "20", 10)),
  );
  const status = searchParams.get("status") || undefined;
  const sortParam = searchParams.get("sort") || "createdAt";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const sort: SortField = VALID_SORT_FIELDS.includes(sortParam as SortField)
    ? (sortParam as SortField)
    : "createdAt";

  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [batches, total] = await Promise.all([
    prisma.importBatch.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { [sort]: order },
      include: {
        judges: {
          where: { status: "VERIFIED" },
          select: { id: true },
        },
      },
    }),
    prisma.importBatch.count({ where }),
  ]);

  return NextResponse.json({
    batches: batches.map((b) => ({
      id: b.id,
      fileName: b.fileName,
      totalRows: b.totalRows,
      successCount: b.successCount,
      skipCount: b.skipCount,
      errorCount: b.errorCount,
      status: b.status,
      hasVerifiedJudges: b.judges.length > 0,
      createdAt: b.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
