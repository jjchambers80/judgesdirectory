import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/harvest/[jobId]
 *
 * Returns full job details including reportMarkdown.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const job = await prisma.harvestJob.findUnique({
    where: { id: jobId },
  });

  if (!job) {
    return NextResponse.json(
      {
        error: "JOB_NOT_FOUND",
        message: `Harvest job ${jobId} not found`,
      },
      { status: 404 },
    );
  }

  return NextResponse.json({
    id: job.id,
    stateAbbr: job.stateAbbr,
    state: job.state,
    status: job.status,
    triggeredBy: job.triggeredBy,
    urlsTotal: job.urlsTotal,
    urlsProcessed: job.urlsProcessed,
    urlsFailed: job.urlsFailed,
    judgesFound: job.judgesFound,
    judgesNew: job.judgesNew,
    judgesUpdated: job.judgesUpdated,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    errorMessage: job.errorMessage,
    reportMarkdown: job.reportMarkdown,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
  });
}
