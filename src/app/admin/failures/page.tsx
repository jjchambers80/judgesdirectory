"use client";

import { useState, useEffect, useCallback } from "react";

interface ScrapeFailure {
  id: string;
  url: string;
  state: string;
  stateAbbr: string;
  failureType: string;
  httpStatusCode: number | null;
  errorMessage: string | null;
  retryCount: number;
  attemptedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Summary {
  totalUnresolved: number;
  byType: Record<string, number>;
}

const FAILURE_TYPE_COLORS: Record<string, string> = {
  HTTP_403: "bg-red-100 text-red-800",
  HTTP_429: "bg-orange-100 text-orange-800",
  TIMEOUT: "bg-yellow-100 text-yellow-800",
  CAPTCHA_DETECTED: "bg-purple-100 text-purple-800",
  SSL_ERROR: "bg-red-100 text-red-800",
  DNS_FAILURE: "bg-red-100 text-red-800",
  EMPTY_PAGE: "bg-gray-100 text-gray-800",
  PARSE_ERROR: "bg-blue-100 text-blue-800",
  UNKNOWN: "bg-gray-100 text-gray-800",
};

const FAILURE_TYPES = [
  "HTTP_403",
  "HTTP_429",
  "TIMEOUT",
  "CAPTCHA_DETECTED",
  "SSL_ERROR",
  "DNS_FAILURE",
  "EMPTY_PAGE",
  "PARSE_ERROR",
  "UNKNOWN",
];

export default function AdminFailuresPage() {
  const [failures, setFailures] = useState<ScrapeFailure[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState<Summary>({
    totalUnresolved: 0,
    byType: {},
  });
  const [stateFilter, setStateFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [resolvedFilter, setResolvedFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchFailures = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", "50");
      if (stateFilter) params.set("state", stateFilter);
      if (typeFilter) params.set("failureType", typeFilter);
      if (resolvedFilter) params.set("resolved", resolvedFilter);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);

      const res = await fetch(`/api/admin/failures?${params}`);
      const data = await res.json();
      setFailures(data.failures);
      setPagination(data.pagination);
      setSummary(data.summary);
      setLoading(false);
    },
    [stateFilter, typeFilter, resolvedFilter, dateFrom, dateTo],
  );

  useEffect(() => {
    fetchFailures(1);
  }, [fetchFailures]);

  const handleResolve = async (id: string) => {
    const notes = prompt("Resolution notes (optional):");
    if (notes === null) return; // User cancelled

    await fetch(`/api/admin/failures/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolutionNotes: notes || undefined }),
    });
    fetchFailures(pagination.page);
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const truncate = (str: string, max = 60) =>
    str.length > max ? str.slice(0, max) + "…" : str;

  return (
    <div>
      <h1 className="mb-6">Scrape Failures</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4 lg:grid-cols-5">
        <div className="p-4 border border-border rounded-lg">
          <div className="text-2xl font-bold">{summary.totalUnresolved}</div>
          <div className="text-sm text-muted-foreground">Total Unresolved</div>
        </div>
        {Object.entries(summary.byType).map(([type, count]) => (
          <div key={type} className="p-4 border border-border rounded-lg">
            <div className="text-xl font-bold">{count}</div>
            <div className="text-xs text-muted-foreground">
              {type.replace(/_/g, " ")}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 mb-6 sm:flex-row sm:flex-wrap sm:gap-4">
        <input
          type="text"
          placeholder="State (e.g. FL)"
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
          maxLength={2}
          aria-label="Filter by state"
          className="px-3 py-2 border border-border rounded-md text-sm w-24"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          aria-label="Filter by failure type"
          className="px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="">All Types</option>
          {FAILURE_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <select
          value={resolvedFilter}
          onChange={(e) => setResolvedFilter(e.target.value)}
          aria-label="Filter by resolution status"
          className="px-3 py-2 border border-border rounded-md text-sm"
        >
          <option value="">All</option>
          <option value="false">Unresolved</option>
          <option value="true">Resolved</option>
        </select>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="Date from"
          className="px-3 py-2 border border-border rounded-md text-sm"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="Date to"
          className="px-3 py-2 border border-border rounded-md text-sm"
        />
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : failures.length === 0 ? (
        <p className="text-muted-foreground">No failure records found.</p>
      ) : (
        <>
          <div className="overflow-x-auto border border-border rounded-lg">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="p-3 text-left">URL</th>
                  <th className="p-3 text-left">State</th>
                  <th className="p-3 text-left">Type</th>
                  <th className="p-3 text-left">HTTP</th>
                  <th className="p-3 text-left">Error</th>
                  <th className="p-3 text-left">Retries</th>
                  <th className="p-3 text-left">Attempted</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Actions</th>
                </tr>
              </thead>
              <tbody>
                {failures.map((f) => (
                  <tr key={f.id} className="border-b border-border">
                    <td className="p-3">
                      <a
                        href={f.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link hover:underline"
                        title={f.url}
                      >
                        {truncate(f.url)}
                      </a>
                    </td>
                    <td className="p-3">{f.stateAbbr}</td>
                    <td className="p-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          FAILURE_TYPE_COLORS[f.failureType] || ""
                        }`}
                      >
                        {f.failureType.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="p-3">{f.httpStatusCode ?? "—"}</td>
                    <td className="p-3 max-w-48">
                      {f.errorMessage ? (
                        <span title={f.errorMessage}>
                          {truncate(f.errorMessage, 40)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3">{f.retryCount}</td>
                    <td className="p-3 text-muted-foreground whitespace-nowrap">
                      {formatDate(f.attemptedAt)}
                    </td>
                    <td className="p-3">
                      {f.resolvedAt ? (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          Resolved
                        </span>
                      ) : (
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                          Unresolved
                        </span>
                      )}
                    </td>
                    <td className="p-3">
                      {!f.resolvedAt && (
                        <button
                          onClick={() => handleResolve(f.id)}
                          className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
                        >
                          Mark Resolved
                        </button>
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
                  onClick={() => fetchFailures(pagination.page - 1)}
                  disabled={pagination.page <= 1}
                  className="px-3 py-1 border border-border rounded disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => fetchFailures(pagination.page + 1)}
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
