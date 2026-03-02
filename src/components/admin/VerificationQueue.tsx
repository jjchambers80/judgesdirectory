"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";

interface JudgeRecord {
  id: string;
  fullName: string;
  court: string;
  county: string;
  state: string;
  sourceUrl: string | null;
  status: string;
  importBatchId: string | null;
  importBatchFileName: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface StateOption {
  id: string;
  name: string;
}

interface BatchOption {
  id: string;
  fileName: string;
}

interface VerificationQueueProps {
  onStatsChange?: (stats: { total: number; page: number }) => void;
}

export default function VerificationQueue({
  onStatsChange,
}: VerificationQueueProps) {
  const [judges, setJudges] = useState<JudgeRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [statusFilter, setStatusFilter] = useState("UNVERIFIED");
  const [stateId, setStateId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [states, setStates] = useState<StateOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);

  // Multi-select state for batch operations (US5)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchActionLoading, setBatchActionLoading] = useState(false);

  useEffect(() => {
    fetch("/api/admin/states")
      .then((r) => r.json())
      .then((d) => setStates(d.states || []))
      .catch(() => {});
    fetch("/api/admin/import?limit=50")
      .then((r) => r.json())
      .then((d) =>
        setBatches(
          (d.batches || []).map((b: { id: string; fileName: string }) => ({
            id: b.id,
            fileName: b.fileName,
          })),
        ),
      )
      .catch(() => {});
  }, []);

  const fetchQueue = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("status", statusFilter);
      if (stateId) params.set("stateId", stateId);
      if (batchId) params.set("batchId", batchId);

      try {
        const res = await fetch(`/api/admin/verification?${params}`);
        const data = await res.json();
        setJudges(data.judges || []);
        setPagination(data.pagination || pagination);
        setSelectedIds(new Set());
        onStatsChange?.({
          total: data.pagination?.total ?? 0,
          page: data.pagination?.page ?? 1,
        });
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    },
    [statusFilter, stateId, batchId, onStatsChange, pagination],
  );

  useEffect(() => {
    fetchQueue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, stateId, batchId]);

  const handleAction = async (
    judgeId: string,
    action: "verify" | "reject" | "unverify",
  ) => {
    setActionLoading(judgeId);
    try {
      const res = await fetch(`/api/admin/verification/${judgeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchQueue(pagination.page);
      } else {
        const data = await res.json();
        alert(data.error || "Action failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setActionLoading(null);
    }
  };

  const handleBatchAction = async (action: "verify" | "reject") => {
    if (selectedIds.size === 0) return;
    setBatchActionLoading(true);
    try {
      const res = await fetch("/api/admin/verification/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judgeIds: Array.from(selectedIds),
          action,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.failed > 0) {
          const failedItems = data.results
            .filter((r: { error?: string }) => r.error)
            .map((r: { id: string; error: string }) => `${r.id}: ${r.error}`)
            .join("\n");
          alert(
            `${data.succeeded} succeeded, ${data.failed} failed:\n${failedItems}`,
          );
        }
        fetchQueue(pagination.page);
      } else {
        const data = await res.json();
        alert(data.error || "Batch action failed");
      }
    } catch {
      alert("Network error");
    } finally {
      setBatchActionLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === judges.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(judges.map((j) => j.id)));
    }
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-2 py-1.5 border border-input rounded-md"
        >
          <option value="UNVERIFIED">Unverified</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          aria-label="Filter by state"
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
          className="px-2 py-1.5 border border-input rounded-md"
        >
          <option value="">All States</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by import batch"
          value={batchId}
          onChange={(e) => setBatchId(e.target.value)}
          className="px-2 py-1.5 border border-input rounded-md"
        >
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.fileName}
            </option>
          ))}
        </select>

        <span className="text-xs text-muted-foreground">
          {pagination.total} records
        </span>
      </div>

      {/* Batch Actions (US5) */}
      {selectedIds.size > 0 && (
        <div className="flex gap-2 items-center mb-3 px-3 py-2 bg-secondary rounded-md">
          <span className="text-sm font-semibold">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => handleBatchAction("verify")}
            disabled={batchActionLoading}
            className={cn(
              "px-3 py-1 bg-badge-success-bg text-badge-success-text border-none rounded text-xs font-semibold",
              batchActionLoading
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer",
            )}
          >
            Verify Selected
          </button>
          <button
            onClick={() => handleBatchAction("reject")}
            disabled={batchActionLoading}
            className={cn(
              "px-3 py-1 bg-error-bg text-error-text border-none rounded text-xs font-semibold",
              batchActionLoading
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer",
            )}
          >
            Reject Selected
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : judges.length === 0 ? (
        <p className="text-muted-foreground">
          No records match the current filters.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-border text-left">
                <th className="p-2 w-8">
                  <input
                    type="checkbox"
                    checked={
                      judges.length > 0 && selectedIds.size === judges.length
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all on page"
                  />
                </th>
                <th className="p-2">Name</th>
                <th className="p-2">Court</th>
                <th className="p-2">County</th>
                <th className="p-2">State</th>
                <th className="p-2">Source</th>
                <th className="p-2">Status</th>
                <th className="p-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => (
                <tr key={j.id} className="border-b border-border">
                  <td className="p-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(j.id)}
                      onChange={() => toggleSelect(j.id)}
                      aria-label={`Select ${j.fullName}`}
                    />
                  </td>
                  <td className="p-2 font-medium text-sm">{j.fullName}</td>
                  <td className="p-2 text-xs">{j.court}</td>
                  <td className="p-2 text-xs">{j.county}</td>
                  <td className="p-2 text-xs">{j.state}</td>
                  <td className="p-2 text-xs">
                    {j.sourceUrl ? (
                      <a
                        href={j.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                      >
                        View Source
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-2">
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded-full text-[0.7rem] font-semibold",
                        j.status === "VERIFIED" &&
                          "bg-badge-success-bg text-badge-success-text",
                        j.status === "REJECTED" &&
                          "bg-error-bg text-error-text",
                        j.status === "UNVERIFIED" &&
                          "bg-badge-warning-bg text-badge-warning-text",
                      )}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td className="p-2">
                    <div className="flex gap-1.5">
                      {j.status === "UNVERIFIED" && (
                        <>
                          <button
                            onClick={() => handleAction(j.id, "verify")}
                            disabled={actionLoading === j.id}
                            className={cn(
                              "px-2 py-0.5 bg-badge-success-bg text-badge-success-text border-none rounded text-[0.7rem] font-semibold",
                              actionLoading === j.id
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer",
                            )}
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleAction(j.id, "reject")}
                            disabled={actionLoading === j.id}
                            className={cn(
                              "px-2 py-0.5 bg-error-bg text-error-text border-none rounded text-[0.7rem] font-semibold",
                              actionLoading === j.id
                                ? "cursor-not-allowed opacity-50"
                                : "cursor-pointer",
                            )}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(j.status === "VERIFIED" || j.status === "REJECTED") && (
                        <button
                          onClick={() => handleAction(j.id, "unverify")}
                          disabled={actionLoading === j.id}
                          className={cn(
                            "px-2 py-0.5 border border-input rounded bg-background text-[0.7rem]",
                            actionLoading === j.id
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer",
                          )}
                        >
                          Unverify
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchQueue(pagination.page - 1)}
            className={cn(
              "px-3 py-1.5 border border-input rounded-md bg-background",
              pagination.page <= 1
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer",
            )}
          >
            Previous
          </button>
          <span className="px-2 py-1.5 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchQueue(pagination.page + 1)}
            className={cn(
              "px-3 py-1.5 border border-input rounded-md bg-background",
              pagination.page >= pagination.totalPages
                ? "cursor-not-allowed opacity-50"
                : "cursor-pointer",
            )}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
