import { NextResponse } from "next/server";
import { getImportStatus } from "@/lib/import-lock";

/**
 * GET /api/admin/import/status
 * Check whether an import is currently in progress.
 * Contract: api-routes.md §4
 */
export async function GET() {
  const status = getImportStatus();
  return NextResponse.json(status);
}
