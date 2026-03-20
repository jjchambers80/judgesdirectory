"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface DiscoveryRun {
  id: string;
  stateAbbr: string;
  state: string;
  status: "RUNNING" | "COMPLETED" | "FAILED" | "CANCELLED";
  startedAt: string;
  completedAt: string | null;
  queriesRun: number;
  candidatesFound: number;
  candidatesNew: number;
  errorMessage: string | null;
}

interface RunsResponse {
  runs: DiscoveryRun[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  hasActiveRun: boolean;
  activeRunId: string | null;
}

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

const STATUS_BADGE: Record<string, { className: string; label: string }> = {
  RUNNING: { className: "bg-blue-100 text-blue-800", label: "Running" },
  COMPLETED: { className: "bg-green-100 text-green-800", label: "Completed" },
  FAILED: { className: "bg-red-100 text-red-800", label: "Failed" },
  CANCELLED: { className: "bg-orange-100 text-orange-800", label: "Cancelled" },
};

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface DiscoveryRunHistoryProps {
  refreshKey: number;
  onActiveRunChange: (hasActive: boolean, activeId: string | null) => void;
}

export function DiscoveryRunHistory({
  refreshKey,
  onActiveRunChange,
}: DiscoveryRunHistoryProps) {
  const [data, setData] = useState<RunsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [stateFilter, setStateFilter] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchRuns = useCallback(
    async (p: number, state: string) => {
      const params = new URLSearchParams();
      params.set("page", String(p));
      params.set("limit", "20");
      if (state) params.set("state", state);

      try {
        const res = await fetch(`/api/admin/discovery/runs/?${params}`);
        if (res.ok) {
          const json: RunsResponse = await res.json();
          setData(json);
          onActiveRunChange(json.hasActiveRun, json.activeRunId);
          return json.hasActiveRun;
        }
      } catch {
        // Silently handle network errors during polling
      } finally {
        setLoading(false);
      }
      return false;
    },
    [onActiveRunChange],
  );

  // Fetch on mount / page / filter / refreshKey changes
  useEffect(() => {
    setLoading(true);
    fetchRuns(page, stateFilter);
  }, [page, stateFilter, refreshKey, fetchRuns]);

  // Auto-poll every 5s while there's an active run
  useEffect(() => {
    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = setInterval(async () => {
        const hasActive = await fetchRuns(page, stateFilter);
        if (!hasActive && pollRef.current) {
          clearInterval(pollRef.current);
          pollRef.current = null;
        }
      }, 5_000);
    };

    if (data?.hasActiveRun) {
      startPolling();
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [data?.hasActiveRun, page, stateFilter, fetchRuns]);

  const pag = data?.pagination;

  return (
    <div className="rounded-lg border border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 className="text-lg font-semibold">Discovery Run History</h2>
        <select
          value={stateFilter}
          onChange={(e) => {
            setStateFilter(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-md border border-border bg-background px-2 text-sm"
          aria-label="Filter runs by state"
        >
          <option value="">All States</option>
          {US_STATES.map((s) => (
            <option key={s.abbr} value={s.abbr}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div aria-live="polite" aria-atomic="false">
        {loading && !data ? (
          <p className="p-4 text-sm text-muted-foreground">Loading runs…</p>
        ) : data && data.runs.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">
            {stateFilter
              ? `No discovery runs found for ${US_STATES.find((s) => s.abbr === stateFilter)?.name ?? stateFilter}. Select the state above and click "Run Discovery" to get started.`
              : 'No discovery runs yet. Select a state and click "Run Discovery" to begin.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-2 font-medium">State</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Started</th>
                  <th className="px-4 py-2 font-medium">Completed</th>
                  <th className="px-4 py-2 font-medium text-right">Queries</th>
                  <th className="px-4 py-2 font-medium text-right">Found</th>
                  <th className="px-4 py-2 font-medium text-right">New</th>
                  <th className="px-4 py-2 font-medium">Error</th>
                </tr>
              </thead>
              <tbody>
                {data?.runs.map((run) => {
                  const badge = STATUS_BADGE[run.status] ?? {
                    className: "bg-gray-100 text-gray-800",
                    label: run.status,
                  };
                  return (
                    <tr
                      key={run.id}
                      className="border-b border-border last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-2 font-medium">{run.state}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
                        >
                          {run.status === "RUNNING" && (
                            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-blue-600" />
                          )}
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {relativeTime(run.startedAt)}
                      </td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {run.completedAt ? relativeTime(run.completedAt) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {run.queriesRun}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {run.candidatesFound}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {run.candidatesNew}
                      </td>
                      <td className="px-4 py-2 text-red-600 max-w-[200px] truncate">
                        {run.errorMessage ?? ""}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pag && pag.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-4 py-2 text-sm text-muted-foreground">
          <span>
            Page {pag.page} of {pag.totalPages} ({pag.total} total)
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={pag.page <= 1}
              className="h-7 px-2 rounded border border-border text-xs hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pag.totalPages, p + 1))}
              disabled={pag.page >= pag.totalPages}
              className="h-7 px-2 rounded border border-border text-xs hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
