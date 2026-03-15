/**
 * Database operations for URL candidates (UrlCandidate model).
 *
 * Uses Prisma client from the shared db module.
 *
 * @module scripts/discovery/candidate-store
 */

import { PrismaClient, CandidateStatus } from "@prisma/client";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UpsertCandidateInput {
  url: string;
  domain: string;
  state: string;
  stateAbbr: string;
  suggestedType?: string | null;
  suggestedLevel?: string | null;
  confidenceScore?: number | null;
  searchQuery: string;
  snippetText?: string | null;
  pageTitle?: string | null;
  discoveryRunId: string;
}

/** Staleness threshold in days */
const STALE_DAYS = 30;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upsert a candidate — skips if URL already exists (unique constraint).
 * Returns { created: true } for new records, { created: false } for duplicates.
 */
export async function upsertCandidate(
  input: UpsertCandidateInput,
): Promise<{ created: boolean }> {
  try {
    await prisma.urlCandidate.create({
      data: {
        url: input.url,
        domain: input.domain,
        state: input.state,
        stateAbbr: input.stateAbbr.toUpperCase(),
        suggestedType: input.suggestedType ?? null,
        suggestedLevel: input.suggestedLevel ?? null,
        confidenceScore: input.confidenceScore ?? null,
        searchQuery: input.searchQuery,
        snippetText: input.snippetText ?? null,
        pageTitle: input.pageTitle ?? null,
        discoveryRunId: input.discoveryRunId,
      },
    });
    return { created: true };
  } catch (err: unknown) {
    // Unique constraint violation — URL already exists
    if (
      err instanceof Error &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return { created: false };
    }
    throw err;
  }
}

/**
 * Get candidates filtered by state abbreviation.
 */
export async function getByState(stateAbbr: string) {
  return prisma.urlCandidate.findMany({
    where: { stateAbbr: stateAbbr.toUpperCase() },
    orderBy: { discoveredAt: "desc" },
  });
}

/**
 * Get candidates filtered by status.
 */
export async function getByStatus(status: CandidateStatus) {
  return prisma.urlCandidate.findMany({
    where: { status },
    orderBy: { discoveredAt: "desc" },
  });
}

/**
 * Update a single candidate's status (approve/reject).
 */
export async function updateStatus(
  id: string,
  action: "approve" | "reject",
  rejectionReason?: string,
) {
  return prisma.urlCandidate.update({
    where: { id },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      rejectionReason: action === "reject" ? rejectionReason : null,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Bulk update candidate statuses.
 */
export async function bulkUpdateStatus(
  ids: string[],
  action: "approve" | "reject",
  rejectionReason?: string,
) {
  return prisma.urlCandidate.updateMany({
    where: { id: { in: ids } },
    data: {
      status: action === "approve" ? "APPROVED" : "REJECTED",
      rejectionReason: action === "reject" ? rejectionReason : null,
      reviewedAt: new Date(),
    },
  });
}

/**
 * Compute staleness: returns true if status=DISCOVERED and age > 30 days.
 */
export function isStale(status: CandidateStatus, discoveredAt: Date): boolean {
  if (status !== "DISCOVERED") return false;
  const ageMs = Date.now() - discoveredAt.getTime();
  const ageDays = ageMs / (1000 * 60 * 60 * 24);
  return ageDays > STALE_DAYS;
}

/**
 * Disconnect the Prisma client. Call when done.
 */
export async function disconnect() {
  await prisma.$disconnect();
}

export { prisma };
