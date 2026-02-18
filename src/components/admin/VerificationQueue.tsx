"use client";

import { useState, useEffect, useCallback } from "react";

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
          alert(`${data.succeeded} succeeded, ${data.failed} failed:\n${failedItems}`);
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
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "0.75rem",
          marginBottom: "1rem",
          alignItems: "center",
        }}
      >
        <select
          aria-label="Filter by status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: "0.375rem 0.5rem",
            border: "1px solid var(--color-input-border)",
            borderRadius: "0.375rem",
          }}
        >
          <option value="UNVERIFIED">Unverified</option>
          <option value="VERIFIED">Verified</option>
          <option value="REJECTED">Rejected</option>
        </select>

        <select
          aria-label="Filter by state"
          value={stateId}
          onChange={(e) => setStateId(e.target.value)}
          style={{
            padding: "0.375rem 0.5rem",
            border: "1px solid var(--color-input-border)",
            borderRadius: "0.375rem",
          }}
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
          style={{
            padding: "0.375rem 0.5rem",
            border: "1px solid var(--color-input-border)",
            borderRadius: "0.375rem",
          }}
        >
          <option value="">All Batches</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.fileName}
            </option>
          ))}
        </select>

        <span
          style={{
            fontSize: "0.8rem",
            color: "var(--color-text-muted)",
          }}
        >
          {pagination.total} records
        </span>
      </div>

      {/* Batch Actions (US5) */}
      {selectedIds.size > 0 && (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            marginBottom: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "var(--color-bg-secondary)",
            borderRadius: "0.375rem",
          }}
        >
          <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => handleBatchAction("verify")}
            disabled={batchActionLoading}
            style={{
              padding: "0.25rem 0.75rem",
              background: "var(--color-badge-success-bg)",
              color: "var(--color-badge-success-text)",
              border: "none",
              borderRadius: "0.25rem",
              cursor: batchActionLoading ? "not-allowed" : "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Verify Selected
          </button>
          <button
            onClick={() => handleBatchAction("reject")}
            disabled={batchActionLoading}
            style={{
              padding: "0.25rem 0.75rem",
              background: "var(--color-error-bg)",
              color: "var(--color-error-text)",
              border: "none",
              borderRadius: "0.25rem",
              cursor: batchActionLoading ? "not-allowed" : "pointer",
              fontSize: "0.75rem",
              fontWeight: 600,
            }}
          >
            Reject Selected
          </button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : judges.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)" }}>
          No records match the current filters.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.5rem", width: "2rem" }}>
                  <input
                    type="checkbox"
                    checked={
                      judges.length > 0 && selectedIds.size === judges.length
                    }
                    onChange={toggleSelectAll}
                    aria-label="Select all on page"
                  />
                </th>
                <th style={{ padding: "0.5rem" }}>Name</th>
                <th style={{ padding: "0.5rem" }}>Court</th>
                <th style={{ padding: "0.5rem" }}>County</th>
                <th style={{ padding: "0.5rem" }}>State</th>
                <th style={{ padding: "0.5rem" }}>Source</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => (
                <tr
                  key={j.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.5rem" }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(j.id)}
                      onChange={() => toggleSelect(j.id)}
                      aria-label={`Select ${j.fullName}`}
                    />
                  </td>
                  <td
                    style={{
                      padding: "0.5rem",
                      fontWeight: 500,
                      fontSize: "0.875rem",
                    }}
                  >
                    {j.fullName}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8rem" }}>
                    {j.court}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8rem" }}>
                    {j.county}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8rem" }}>
                    {j.state}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.8rem" }}>
                    {j.sourceUrl ? (
                      <a
                        href={j.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "var(--color-link)" }}
                      >
                        View Source
                      </a>
                    ) : (
                      <span style={{ color: "var(--color-text-muted)" }}>
                        —
                      </span>
                    )}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.125rem 0.375rem",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background:
                          j.status === "VERIFIED"
                            ? "var(--color-badge-success-bg)"
                            : j.status === "REJECTED"
                              ? "var(--color-error-bg)"
                              : "var(--color-badge-warning-bg)",
                        color:
                          j.status === "VERIFIED"
                            ? "var(--color-badge-success-text)"
                            : j.status === "REJECTED"
                              ? "var(--color-error-text)"
                              : "var(--color-badge-warning-text)",
                      }}
                    >
                      {j.status}
                    </span>
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <div style={{ display: "flex", gap: "0.375rem" }}>
                      {j.status === "UNVERIFIED" && (
                        <>
                          <button
                            onClick={() => handleAction(j.id, "verify")}
                            disabled={actionLoading === j.id}
                            style={{
                              padding: "0.2rem 0.5rem",
                              background: "var(--color-badge-success-bg)",
                              color: "var(--color-badge-success-text)",
                              border: "none",
                              borderRadius: "0.25rem",
                              cursor:
                                actionLoading === j.id
                                  ? "not-allowed"
                                  : "pointer",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                          >
                            Verify
                          </button>
                          <button
                            onClick={() => handleAction(j.id, "reject")}
                            disabled={actionLoading === j.id}
                            style={{
                              padding: "0.2rem 0.5rem",
                              background: "var(--color-error-bg)",
                              color: "var(--color-error-text)",
                              border: "none",
                              borderRadius: "0.25rem",
                              cursor:
                                actionLoading === j.id
                                  ? "not-allowed"
                                  : "pointer",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                            }}
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {(j.status === "VERIFIED" ||
                        j.status === "REJECTED") && (
                        <button
                          onClick={() => handleAction(j.id, "unverify")}
                          disabled={actionLoading === j.id}
                          style={{
                            padding: "0.2rem 0.5rem",
                            border: "1px solid var(--color-input-border)",
                            borderRadius: "0.25rem",
                            background: "var(--color-bg-primary)",
                            cursor:
                              actionLoading === j.id
                                ? "not-allowed"
                                : "pointer",
                            fontSize: "0.7rem",
                          }}
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
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.5rem",
            marginTop: "1rem",
          }}
        >
          <button
            disabled={pagination.page <= 1}
            onClick={() => fetchQueue(pagination.page - 1)}
            style={{
              padding: "0.375rem 0.75rem",
              border: "1px solid var(--color-input-border)",
              borderRadius: "0.375rem",
              background: "var(--color-bg-primary)",
              cursor: pagination.page <= 1 ? "not-allowed" : "pointer",
            }}
          >
            Previous
          </button>
          <span
            style={{
              padding: "0.375rem 0.5rem",
              fontSize: "0.875rem",
            }}
          >
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => fetchQueue(pagination.page + 1)}
            style={{
              padding: "0.375rem 0.75rem",
              border: "1px solid var(--color-input-border)",
              borderRadius: "0.375rem",
              background: "var(--color-bg-primary)",
              cursor:
                pagination.page >= pagination.totalPages
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
