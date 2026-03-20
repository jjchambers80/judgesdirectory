"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

interface DiscoveryRunSnapshot {
  id: string;
  stateAbbr: string;
  state: string;
  status: string;
  queriesTotal: number;
  queriesRun: number;
  candidatesFound: number;
  candidatesNew: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

function duration(
  startedAt: string | null,
  completedAt: string | null,
): string {
  if (!startedAt) return "—";
  const end = completedAt ? new Date(completedAt) : new Date();
  const sec = Math.floor(
    (end.getTime() - new Date(startedAt).getTime()) / 1000,
  );
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ${sec % 60}s`;
  return `${Math.floor(min / 60)}h ${min % 60}m`;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    RUNNING: "default",
    COMPLETED: "outline",
    FAILED: "destructive",
    CANCELLED: "secondary",
  };
  return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
}

interface LiveDiscoveryCardProps {
  runId: string;
  onComplete: () => void;
  onCancel: () => void;
}

export function LiveDiscoveryCard({
  runId,
  onComplete,
  onCancel,
}: LiveDiscoveryCardProps) {
  const [run, setRun] = useState<DiscoveryRunSnapshot | null>(null);
  const [elapsed, setElapsed] = useState("—");
  const [cancelling, setCancelling] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource(`/api/admin/discovery/runs/${runId}/stream/`);
    esRef.current = es;

    es.onmessage = (e) => {
      try {
        const snapshot = JSON.parse(e.data) as DiscoveryRunSnapshot;
        setRun(snapshot);
      } catch {
        /* ignore parse errors */
      }
    };

    es.addEventListener("done", () => {
      es.close();
      esRef.current = null;
      onComplete();
    });

    es.onerror = () => {
      es.close();
      esRef.current = null;
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [runId, onComplete]);

  // Tick elapsed timer every second while running
  useEffect(() => {
    if (!run) return;
    if (run.status !== "RUNNING") {
      setElapsed(duration(run.startedAt, run.completedAt));
      return;
    }

    const id = setInterval(() => {
      setElapsed(duration(run.startedAt, null));
    }, 1000);
    return () => clearInterval(id);
  }, [run]); // run object is replaced on each SSE message

  const handleCancel = useCallback(async () => {
    setCancelling(true);
    try {
      await fetch(`/api/admin/discovery/runs/${runId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      onCancel();
    } catch {
      /* network error — SSE will detect status change */
    } finally {
      setCancelling(false);
    }
  }, [runId, onCancel]);

  if (!run) {
    return (
      <Card className="border-primary/30 overflow-hidden animate-pulse">
        <CardContent className="pt-4 pb-4">
          <div className="h-4 w-48 bg-muted rounded mb-3" />
          <div className="h-2 w-full bg-muted rounded mb-3" />
          <div className="grid grid-cols-3 gap-2">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const pct =
    run.queriesTotal > 0
      ? Math.round((run.queriesRun / run.queriesTotal) * 100)
      : 0;

  const isTerminal = run.status !== "RUNNING" && run.status !== "CANCELLED";

  return (
    <Card
      className={`overflow-hidden transition-colors duration-300 ${
        run.status === "RUNNING"
          ? "border-primary/30"
          : run.status === "COMPLETED"
            ? "border-green-500/30"
            : "border-destructive/30"
      }`}
    >
      <CardContent className="pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {run.status === "RUNNING" && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            )}
            <span className="font-semibold text-sm">
              {run.state} Discovery
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {elapsed}
            </span>
            <StatusBadge status={run.status} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              Queries: {run.queriesRun}/{run.queriesTotal}
            </span>
            <span className="tabular-nums font-medium text-foreground">
              {pct}%
            </span>
          </div>
          <Progress
            value={pct}
            className="h-2 transition-all duration-700 ease-out"
          />
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <div className="text-xl font-bold tabular-nums leading-none">
              {run.candidatesFound}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              URLs found
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <div className="text-xl font-bold tabular-nums leading-none text-green-500">
              +{run.candidatesNew}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              New
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <div className="text-xl font-bold tabular-nums leading-none text-blue-400">
              {run.queriesRun}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              Searched
            </div>
          </div>
        </div>

        {/* Error message */}
        {run.errorMessage && isTerminal && (
          <div className="mt-3 text-xs text-destructive bg-destructive/10 rounded-md px-3 py-2">
            {run.errorMessage}
          </div>
        )}

        {/* Cancel button */}
        {run.status === "RUNNING" && (
          <div className="mt-3 flex justify-end">
            <button
              onClick={handleCancel}
              disabled={cancelling}
              className="h-7 px-3 rounded-md bg-destructive text-destructive-foreground text-xs font-medium hover:bg-destructive/90 disabled:opacity-50"
            >
              {cancelling ? "Cancelling…" : "Cancel Run"}
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
