import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/harvest/[jobId]/stream
 *
 * Server-Sent Events stream for a single harvest job. Pushes live job stats
 * every 1.5 seconds until the job reaches a terminal state (COMPLETED/FAILED).
 *
 * Events:
 *   data: <JSON>   — job snapshot (same shape as GET /api/admin/harvest/[jobId])
 *   event: done    — job reached terminal state; stream will close
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> },
) {
  const { jobId } = await params;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (eventName: string | null, data: unknown) => {
        let chunk = "";
        if (eventName) chunk += `event: ${eventName}\n`;
        chunk += `data: ${JSON.stringify(data)}\n\n`;
        controller.enqueue(encoder.encode(chunk));
      };

      const POLL_MS = 1500;
      const TERMINAL = new Set(["COMPLETED", "FAILED"]);

      const poll = async () => {
        try {
          const job = await prisma.harvestJob.findUnique({
            where: { id: jobId },
          });

          if (!job) {
            send("error", { message: "Job not found" });
            controller.close();
            return;
          }

          send(null, {
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
            updatedAt: job.updatedAt.toISOString(),
          });

          if (TERMINAL.has(job.status)) {
            send("done", { status: job.status });
            controller.close();
            return;
          }

          // Schedule next poll (check if client disconnected)
          setTimeout(poll, POLL_MS);
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "Poll failed",
          });
          controller.close();
        }
      };

      // Send initial snapshot immediately
      await poll();
    },

    cancel() {
      // Client disconnected — ReadableStream cancel is called automatically.
      // Nothing explicit to clean up since setTimeout refs are not stored,
      // but the closed controller will prevent further enqueue calls.
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  });
}
