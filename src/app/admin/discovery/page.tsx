"use client";

import { useState, useEffect, useCallback } from "react";

interface UrlCandidate {
  id: string;
  url: string;
  domain: string;
  state: string;
  stateAbbr: string;
  suggestedType: string | null;
  suggestedLevel: string | null;
  confidenceScore: number | null;
  status: "DISCOVERED" | "APPROVED" | "REJECTED";
  isStale: boolean;
  rejectionReason: string | null;
  reviewedAt: string | null;
  promotedAt: string | null;
  discoveredAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

const STATUS_COLORS: Record<string, string> = {
  DISCOVERED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
};

export default function AdminDiscoveryPage() {
  const [candidates, setCandidates] = useState<UrlCandidate[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortField, setSortField] = useState("discoveredAt");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | null>(
    null,
  );
  const [promoting, setPromoting] = useState(false);

  const fetchCandidates = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      params.set("sort", sortField);
      params.set("order", "desc");
      if (stateFilter) params.set("state", stateFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/discovery?${params}`);
      const data = await res.json();
      setCandidates(data.candidates);
      setPagination(data.pagination);
      setSelected(new Set());
      setLoading(false);
    },
    [stateFilter, statusFilter, sortField],
  );

  useEffect(() => {
    fetchCandidates(1);
  }, [fetchCandidates]);

  const handleApprove = async (id: string) => {
    await fetch(`/api/admin/discovery/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve" }),
    });
    fetchCandidates(pagination.page);
  };

  const handleReject = async (id: string, reason: string) => {
    await fetch(`/api/admin/discovery/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", rejectionReason: reason }),
    });
    fetchCandidates(pagination.page);
  };

  const handleBulkAction = async (
    action: "approve" | "reject",
    reason?: string,
  ) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;

    await fetch("/api/admin/discovery/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids,
        action,
        ...(action === "reject" ? { rejectionReason: reason } : {}),
      }),
    });
    fetchCandidates(pagination.page);
  };

  const handlePromote = async () => {
    if (!stateFilter) return;
    setPromoting(true);
    try {
      const res = await fetch("/api/admin/discovery/promote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateAbbr: stateFilter }),
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `Promoted ${data.candidatesPromoted} candidate(s). ${data.entriesAdded} new entries added to ${data.configPath}. Total: ${data.entriesTotal}`,
        );
        fetchCandidates(pagination.page);
      } else {
        alert(`Error: ${data.error}`);
      }
    } finally {
      setPromoting(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === candidates.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(candidates.map((c) => c.id)));
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const truncateUrl = (url: string, max = 50) =>
    url.length > max ? url.slice(0, max) + "…" : url;

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1>URL Discovery</h1>
        {stateFilter && (
          <button
            onClick={handlePromote}
            disabled={promoting}
            className="px-4 py-2 bg-primary text-btn-primary-text rounded-md text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {promoting ? "Promoting…" : `Promote ${stateFilter} to Config`}
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:gap-4">
        <input
          type="text"
          placeholder="State abbr (e.g. FL)"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
          maxLength={2}
          aria-label="Filter by state"
          className="px-3 py-2 border border-border rounded-md text-sm w-24"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="">All Statuses</option>
          <option value="DISCOVERED">Discovered</option>
          <option value="STALE">Stale</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
        <select
          value={sortField}
          onChange={(e) => setSortField(e.target.value)}
          aria-label="Sort by"
          className="px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="discoveredAt">Date</option>
          <option value="confidenceScore">Confidence</option>
        </select>
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="flex gap-2 mb-4 items-center text-sm">
          <span className="text-muted-foreground">
            {selected.size} selected
          </span>
          <button
            onClick={() => handleBulkAction("approve")}
            className="px-3 py-1 bg-green-600 text-white rounded text-sm hover:bg-green-700"
          >
            Bulk Approve
          </button>
          <button
            onClick={() => {
              setBulkAction("reject");
              setShowRejectModal(true);
            }}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Bulk Reject
          </button>
        </div>
      )}

      {/* Reject reason modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-background border border-border rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-3">Rejection Reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection…"
              aria-label="Rejection reason"
              className="w-full px-3 py-2 border border-border rounded-md text-sm mb-4"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason("");
                  setBulkAction(null);
                }}
                className="px-3 py-1 border border-border rounded text-sm"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!rejectReason.trim()) return;
                  if (bulkAction === "reject") {
                    handleBulkAction("reject", rejectReason);
                  }
                  setShowRejectModal(false);
                  setRejectReason("");
                  setBulkAction(null);
                }}
                disabled={!rejectReason.trim()}
                className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : candidates.length === 0 ? (
        <p className="text-muted-foreground">
          No candidates found. Run{" "}
          <code>npx tsx scripts/discovery/discover.ts --state FL</code> to
          discover URLs.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === candidates.length}
                      onChange={toggleSelectAll}
                      aria-label="Select all"
                    />
                  </th>
                  <th className="p-3 text-left">URL</th>
                  <th className="p-3 text-left">State</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">Level</th>
                  <th className="p-3 text-left">Confidence</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Discovered</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map((c) => (
                  <tr key={c.id} className="border-b border-border">
                    <td className="p-3">
                      <input
                        type="checkbox"
                        checked={selected.has(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        aria-label={`Select ${c.url}`}
                      />
                    </td>
                    <td className="p-3">
                      <a
                        href={c.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline"
                        title={c.url}
                      >
                        {truncateUrl(c.url)}
                      </a>
                      <div className="text-xs text-muted-foreground">
                        {c.domain}
                      </div>
                    </td>
                    <td className="p-3">{c.stateAbbr}</td>
                    <td className="p-3">{c.suggestedType || "—"}</td>
                    <td className="p-3">{c.suggestedLevel || "—"}</td>
                    <td className="p-3">
                      {c.confidenceScore !== null ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                            c.confidenceScore >= 0.8
                              ? "bg-green-100 text-green-800"
                              : c.confidenceScore >= 0.5
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-red-100 text-red-800"
                          }`}
                        >
                          {c.confidenceScore.toFixed(2)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          c.isStale
                            ? "bg-orange-100 text-orange-800"
                            : STATUS_COLORS[c.status] || ""
                        }`}
                      >
                        {c.isStale ? "STALE" : c.status}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {formatDate(c.discoveredAt)}
                    </td>
                    <td className="p-3">
                      {c.status === "DISCOVERED" && (
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleApprove(c.id)}
                            className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              const reason = prompt("Rejection reason:");
                              if (reason) handleReject(c.id, reason);
                            }}
                            className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-muted-foreground">
                Page {pagination.page} of {pagination.totalPages} (
                {pagination.total} total)
              </span>
              <div className="flex gap-2">
                <button
                  onClick={() => fetchCandidates(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchCandidates(pagination.page + 1)}
                  disabled={pagination.page >= pagination.totalPages}
                  className="px-3 py-1 border border-border rounded disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
