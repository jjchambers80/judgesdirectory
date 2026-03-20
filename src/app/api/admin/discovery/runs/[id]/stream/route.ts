import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

/**
 * GET /api/admin/discovery/runs/[id]/stream
 *
 * Server-Sent Events stream for a single discovery run. Pushes live run stats
 * every 1.5 seconds until the run reaches a terminal state (COMPLETED/FAILED).
 *
 * Events:
 *   data: <JSON>   — run snapshot
 *   event: done    — run reached terminal state; stream will close
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

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
          const run = await prisma.discoveryRun.findUnique({
            where: { id },
          });

          if (!run) {
            send("error", { message: "Run not found" });
            controller.close();
            return;
          }

          send(null, {
            id: run.id,
            stateAbbr: run.stateAbbr,
            state: run.state,
            status: run.status,
            queriesTotal: run.queriesTotal,
            queriesRun: run.queriesRun,
            candidatesFound: run.candidatesFound,
            candidatesNew: run.candidatesNew,
            startedAt: run.startedAt?.toISOString() ?? null,
            completedAt: run.completedAt?.toISOString() ?? null,
            errorMessage: run.errorMessage,
            updatedAt: run.updatedAt.toISOString(),
          });

          if (TERMINAL.has(run.status)) {
            send("done", { status: run.status });
            controller.close();
            return;
          }

          setTimeout(poll, POLL_MS);
        } catch (err) {
          send("error", {
            message: err instanceof Error ? err.message : "Poll failed",
          });
          controller.close();
        }
      };

      await poll();
    },

    cancel() {
      // Client disconnected — nothing explicit to clean up
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
