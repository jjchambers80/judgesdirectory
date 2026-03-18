"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface HarvestState {
  stateAbbr: string;
  state: string;
  approvedUrlCount: number;
  lastHarvestAt: string | null;
  lastHarvestStatus: string | null;
  hasActiveJob: boolean;
  activeJobId: string | null;
}

interface HarvestJob {
  id: string;
  stateAbbr: string;
  state: string;
  status: string;
  triggeredBy: string;
  urlsTotal: number;
  urlsProcessed: number;
  urlsFailed: number;
  judgesFound: number;
  judgesNew: number;
  judgesUpdated: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<
    string,
    "default" | "secondary" | "destructive" | "outline"
  > = {
    QUEUED: "secondary",
    RUNNING: "default",
    COMPLETED: "outline",
    FAILED: "destructive",
  };
  return <Badge variant={variants[status] ?? "secondary"}>{status}</Badge>;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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

// ---------------------------------------------------------------------------
// LiveJobCard — driven by SSE data, includes a live elapsed timer
// ---------------------------------------------------------------------------

function LiveJobCard({ job }: { job: HarvestJob }) {
  const [elapsed, setElapsed] = useState(
    duration(job.startedAt, job.completedAt),
  );

  // Tick the elapsed timer every second while the job is running
  useEffect(() => {
    if (job.status !== "RUNNING") {
      setElapsed(duration(job.startedAt, job.completedAt));
      return;
    }

    const id = setInterval(() => {
      setElapsed(duration(job.startedAt, null));
    }, 1000);
    return () => clearInterval(id);
  }, [job.startedAt, job.completedAt, job.status]);

  const pct =
    job.urlsTotal > 0
      ? Math.round((job.urlsProcessed / job.urlsTotal) * 100)
      : 0;

  return (
    <Card className="border-primary/30 overflow-hidden">
      <CardContent className="pt-4 pb-4">
        {/* Header row */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {job.status === "RUNNING" && (
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary" />
              </span>
            )}
            <span className="font-semibold text-sm">{job.state} Harvest</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground tabular-nums">
              {elapsed}
            </span>
            <StatusBadge status={job.status} />
          </div>
        </div>

        {/* Progress bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
            <span>
              URLs: {job.urlsProcessed}/{job.urlsTotal}
              {job.urlsFailed > 0 && (
                <span className="text-destructive ml-1">
                  ({job.urlsFailed} failed)
                </span>
              )}
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
              {job.judgesFound}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              Judges found
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <div className="text-xl font-bold tabular-nums leading-none text-green-500">
              +{job.judgesNew}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              New
            </div>
          </div>
          <div className="rounded-md bg-muted/50 px-3 py-2 text-center">
            <div className="text-xl font-bold tabular-nums leading-none text-blue-400">
              {job.judgesUpdated}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">
              Updated
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function HarvestPage() {
  const [states, setStates] = useState<HarvestState[]>([]);
  const [selectedState, setSelectedState] = useState<string>("");
  const [jobs, setJobs] = useState<HarvestJob[]>([]);
  const [totalJobs, setTotalJobs] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [reportMarkdown, setReportMarkdown] = useState<string | null>(null);
  const [reportLoading, setReportLoading] = useState(false);

  // Live job data keyed by job id — updated via SSE
  const [liveJobs, setLiveJobs] = useState<Record<string, HarvestJob>>({});
  // Track which job IDs have active EventSource connections
  const eventSourcesRef = useRef<Record<string, EventSource>>({});
  // Fallback poll interval for job history table refresh
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchStates = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/harvest/states");
      if (!res.ok) throw new Error("Failed to load states");
      const data = await res.json();
      setStates(data.states);
    } catch (err) {
      console.error("Failed to fetch states:", err);
    }
  }, []);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/harvest?limit=20");
      if (!res.ok) throw new Error("Failed to load jobs");
      const data = await res.json();
      setJobs(data.jobs);
      setTotalJobs(data.total);
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
    }
  }, []);

  // Subscribe to SSE stream for a single job
  const subscribeToJob = useCallback(
    (jobId: string) => {
      if (eventSourcesRef.current[jobId]) return; // already subscribed

      const es = new EventSource(`/api/admin/harvest/${jobId}/stream`);

      es.onmessage = (e) => {
        try {
          const snapshot = JSON.parse(e.data) as HarvestJob;
          setLiveJobs((prev) => ({ ...prev, [jobId]: snapshot }));
        } catch {
          /* ignore parse errors */
        }
      };

      es.addEventListener("done", () => {
        es.close();
        delete eventSourcesRef.current[jobId];
        // Refresh job list + states once the job finishes
        fetchJobs();
        fetchStates();
      });

      es.onerror = () => {
        es.close();
        delete eventSourcesRef.current[jobId];
      };

      eventSourcesRef.current[jobId] = es;
    },
    [fetchJobs, fetchStates],
  );

  // Watch job list for new active jobs — subscribe to SSE for each
  useEffect(() => {
    jobs.forEach((job) => {
      if (job.status === "QUEUED" || job.status === "RUNNING") {
        subscribeToJob(job.id);
      }
    });
  }, [jobs, subscribeToJob]);

  // Kick off a light poll for the history table (catches new jobs started elsewhere)
  useEffect(() => {
    fetchStates();
    fetchJobs();

    pollIntervalRef.current = setInterval(() => {
      fetchJobs();
    }, 10_000);

    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      // Close all open EventSources on unmount
      Object.values(eventSourcesRef.current).forEach((es) => es.close());
      eventSourcesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startHarvest() {
    if (!selectedState) return;
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/harvest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateAbbr: selectedState }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 409) {
          setError(
            `A harvest job is already active for this state (job: ${data.activeJobId})`,
          );
        } else if (res.status === 422) {
          setError(data.message);
        } else {
          setError(data.error ?? "Failed to start harvest");
        }
        return;
      }

      await fetchJobs();
      await fetchStates();
      setSelectedState("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start harvest");
    } finally {
      setIsLoading(false);
    }
  }

  async function viewReport(jobId: string) {
    setSelectedJobId(jobId);
    setReportMarkdown(null);
    setReportLoading(true);

    try {
      const res = await fetch(`/api/admin/harvest/${jobId}`);
      const data = await res.json();
      setReportMarkdown(
        data.reportMarkdown ?? "No report available for this job.",
      );
    } catch {
      setReportMarkdown("Failed to load report.");
    } finally {
      setReportLoading(false);
    }
  }

  const activeState = selectedState
    ? states.find((s) => s.stateAbbr === selectedState)
    : null;
  const isDisabled =
    isLoading ||
    !selectedState ||
    (activeState?.hasActiveJob ?? false) ||
    (activeState?.approvedUrlCount ?? 0) === 0;

  // Merge SSE live data over the fetched job list for active jobs
  const activeJobs = jobs
    .filter((j) => j.status === "QUEUED" || j.status === "RUNNING")
    .map((j) => liveJobs[j.id] ?? j);

  // For history table, also apply live data if available
  const displayJobs = jobs.map((j) => liveJobs[j.id] ?? j);

  return (
    <div>
      <h1 className="mb-2">Harvest Management</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Trigger and monitor state-level judge data harvests.
      </p>

      {/* Trigger Section */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Trigger New Harvest</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1 block">
                Select State
              </label>
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a state..." />
                </SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem
                      key={s.stateAbbr}
                      value={s.stateAbbr}
                      disabled={s.hasActiveJob || s.approvedUrlCount === 0}
                    >
                      {s.state} ({s.stateAbbr}) — {s.approvedUrlCount} URL
                      {s.approvedUrlCount !== 1 ? "s" : ""}
                      {s.hasActiveJob ? " [Active]" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={startHarvest} disabled={isDisabled}>
              {isLoading ? "Starting..." : "Start Harvest"}
            </Button>
          </div>

          {activeState && (
            <div className="mt-3 text-sm text-muted-foreground">
              {activeState.lastHarvestAt
                ? `Last harvest: ${formatDate(activeState.lastHarvestAt)} (${activeState.lastHarvestStatus})`
                : "Never harvested"}
            </div>
          )}

          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        </CardContent>
      </Card>

      {/* Active Jobs — live via SSE */}
      {activeJobs.length > 0 && (
        <div className="mb-6 space-y-3">
          {activeJobs.map((job) => (
            <LiveJobCard key={job.id} job={job} />
          ))}
        </div>
      )}

      {/* Job History Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job History {totalJobs > 0 && `(${totalJobs})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No harvest jobs yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>State</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead>Judges</TableHead>
                  <TableHead>URLs</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayJobs.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-medium">
                      {job.state} ({job.stateAbbr})
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {job.triggeredBy}
                    </TableCell>
                    <TableCell>
                      {job.judgesFound > 0 ? (
                        <span>
                          {job.judgesFound}{" "}
                          <span className="text-muted-foreground text-xs">
                            ({job.judgesNew} new, {job.judgesUpdated} upd)
                          </span>
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell>
                      {job.urlsProcessed}/{job.urlsTotal}
                      {job.urlsFailed > 0 && (
                        <span className="text-destructive text-xs ml-1">
                          ({job.urlsFailed} failed)
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm">
                      {duration(job.startedAt, job.completedAt)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDate(job.startedAt)}
                    </TableCell>
                    <TableCell>
                      {job.status === "COMPLETED" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => viewReport(job.id)}
                        >
                          View Report
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Report Modal */}
      {selectedJobId && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedJobId(null)}
        >
          <Card
            className="max-w-3xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Harvest Report</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedJobId(null)}
              >
                ✕
              </Button>
            </CardHeader>
            <CardContent>
              {reportLoading ? (
                <p className="text-muted-foreground">Loading report...</p>
              ) : (
                <pre className="text-sm whitespace-pre-wrap font-mono bg-muted p-4 rounded-md overflow-auto">
                  {reportMarkdown}
                </pre>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
