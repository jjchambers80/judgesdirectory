"use client";

import { useState, useEffect, useCallback } from "react";

interface UrlHealth {
  id: string;
  url: string;
  domain: string;
  state: string;
  stateAbbr: string;
  healthScore: number;
  totalScrapes: number;
  successfulScrapes: number;
  lastYield: number;
  avgYield: number;
  yieldTrend: "IMPROVING" | "STABLE" | "DECLINING";
  anomalyDetected: boolean;
  anomalyMessage: string | null;
  lastScrapedAt: string | null;
  lastSuccessAt: string | null;
  source: "DISCOVERED" | "MANUAL";
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ScrapeLog {
  id: string;
  success: boolean;
  judgesFound: number;
  failureType: string | null;
  httpStatusCode: number | null;
  errorMessage: string | null;
  retryCount: number;
  scrapeDurationMs: number | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  scrapedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface Summary {
  total: number;
  healthy: number;
  moderate: number;
  unhealthy: number;
  anomalies: number;
  avgHealthScore: number;
}

const SCORE_COLORS = {
  healthy: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  moderate:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  unhealthy: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const TREND_ICONS: Record<string, { icon: string; label: string }> = {
  IMPROVING: { icon: "↑", label: "Improving" },
  STABLE: { icon: "→", label: "Stable" },
  DECLINING: { icon: "↓", label: "Declining" },
};

function scoreCategory(score: number): "healthy" | "moderate" | "unhealthy" {
  if (score >= 0.7) return "healthy";
  if (score >= 0.3) return "moderate";
  return "unhealthy";
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

const SORT_OPTIONS = [
  { value: "healthScore", label: "Health Score" },
  { value: "lastScrapedAt", label: "Last Scraped" },
  { value: "lastYield", label: "Last Yield" },
  { value: "avgYield", label: "Avg Yield" },
] as const;

const STATUS_OPTIONS = [
  { value: "", label: "All URLs" },
  { value: "healthy", label: "Healthy (≥0.7)" },
  { value: "moderate", label: "Moderate (0.3–0.7)" },
  { value: "unhealthy", label: "Unhealthy (<0.3)" },
  { value: "anomaly", label: "Anomalies" },
  { value: "inactive", label: "Inactive" },
] as const;

export default function AdminHealthPage() {
  const [urls, setUrls] = useState<UrlHealth[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    healthy: 0,
    moderate: 0,
    unhealthy: 0,
    anomalies: 0,
    avgHealthScore: 0,
  });
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sort, setSort] = useState("healthScore");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [scrapeHistory, setScrapeHistory] = useState<ScrapeLog[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stateFilter) params.set("state", stateFilter);
    if (statusFilter) params.set("status", statusFilter);
    params.set("sort", sort);
    params.set("order", order);
    params.set("page", String(pagination.page));
    params.set("limit", "50");

    const res = await fetch(`/api/admin/health?${params}`);
    const data = await res.json();
    setUrls(data.urls);
    setPagination(data.pagination);
    setSummary(data.summary);
    setLoading(false);
  }, [stateFilter, statusFilter, sort, order, pagination.page]);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  const toggleExpand = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      setScrapeHistory([]);
      return;
    }
    setExpandedId(id);
    setHistoryLoading(true);
    const res = await fetch(`/api/admin/health/${id}`);
    const data = await res.json();
    setScrapeHistory(data.scrapeHistory);
    setHistoryLoading(false);
  };

  const handleAction = async (
    id: string,
    action: "dismiss-anomaly" | "deactivate" | "reactivate",
  ) => {
    await fetch(`/api/admin/health/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchUrls();
  };

  const handleResolveLog = async (logId: string) => {
    await fetch(`/api/admin/health/scrape-logs/${logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolvedBy: "admin" }),
    });
    if (expandedId) {
      const res = await fetch(`/api/admin/health/${expandedId}`);
      const data = await res.json();
      setScrapeHistory(data.scrapeHistory);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">URL Health Dashboard</h1>

      {/* Summary cards */}
      <div
        className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6"
        role="region"
        aria-label="Health summary"
      >
        <SummaryCard label="Total URLs" value={summary.total} />
        <SummaryCard
          label="Healthy"
          value={summary.healthy}
          className="border-green-200 dark:border-green-800"
        />
        <SummaryCard
          label="Moderate"
          value={summary.moderate}
          className="border-yellow-200 dark:border-yellow-800"
        />
        <SummaryCard
          label="Unhealthy"
          value={summary.unhealthy}
          className="border-red-200 dark:border-red-800"
        />
        <SummaryCard
          label="Anomalies"
          value={summary.anomalies}
          className="border-orange-200 dark:border-orange-800"
        />
        <SummaryCard
          label="Avg Score"
          value={summary.avgHealthScore.toFixed(2)}
        />
      </div>

      {/* Filters and sort */}
      <div className="flex flex-wrap items-center gap-4" role="search">
        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">State:</span>
          <input
            type="text"
            className="rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            placeholder="e.g. FL"
            maxLength={2}
            value={stateFilter}
            onChange={(e) => {
              setStateFilter(e.target.value.toUpperCase());
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            aria-label="Filter by state abbreviation"
          />
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">Status:</span>
          <select
            className="rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            aria-label="Filter by health status"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex items-center gap-2">
          <span className="text-sm font-medium">Sort:</span>
          <select
            className="rounded border px-2 py-1 text-sm dark:border-gray-600 dark:bg-gray-800"
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Sort field"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <button
          className="rounded border px-2 py-1 text-sm dark:border-gray-600"
          onClick={() => setOrder(order === "asc" ? "desc" : "asc")}
          aria-label={`Sort direction: ${order === "asc" ? "ascending" : "descending"}`}
        >
          {order === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {/* URL Health table */}
      {loading ? (
        <p role="status">Loading…</p>
      ) : urls.length === 0 ? (
        <p>No URL health records found.</p>
      ) : (
        <div className="overflow-x-auto">
          <table
            className="w-full border-collapse text-sm"
            role="grid"
            aria-label="URL health records"
          >
            <thead>
              <tr className="border-b text-left dark:border-gray-700">
                <th className="px-3 py-2" scope="col">
                  URL
                </th>
                <th className="px-3 py-2" scope="col">
                  Score
                </th>
                <th className="px-3 py-2" scope="col">
                  Trend
                </th>
                <th className="px-3 py-2" scope="col">
                  Scrapes
                </th>
                <th className="px-3 py-2" scope="col">
                  Yield
                </th>
                <th className="px-3 py-2" scope="col">
                  Last Scraped
                </th>
                <th className="px-3 py-2" scope="col">
                  Status
                </th>
                <th className="px-3 py-2" scope="col">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {urls.map((url) => {
                const cat = scoreCategory(url.healthScore);
                const trend = TREND_ICONS[url.yieldTrend] || TREND_ICONS.STABLE;
                const isExpanded = expandedId === url.id;

                return (
                  <HealthRow
                    key={url.id}
                    url={url}
                    cat={cat}
                    trend={trend}
                    isExpanded={isExpanded}
                    onToggle={() => toggleExpand(url.id)}
                    onAction={(action) => handleAction(url.id, action)}
                    scrapeHistory={isExpanded ? scrapeHistory : []}
                    historyLoading={isExpanded && historyLoading}
                    onResolveLog={handleResolveLog}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div
          className="flex items-center justify-between"
          role="navigation"
          aria-label="Pagination"
        >
          <span className="text-sm">
            Page {pagination.page} of {pagination.totalPages} ({pagination.total}{" "}
            total)
          </span>
          <div className="flex gap-2">
            <button
              className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
              disabled={pagination.page <= 1}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page - 1 }))
              }
              aria-label="Previous page"
            >
              Previous
            </button>
            <button
              className="rounded border px-3 py-1 text-sm disabled:opacity-50 dark:border-gray-600"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() =>
                setPagination((p) => ({ ...p, page: p.page + 1 }))
              }
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  className = "",
}: {
  label: string;
  value: number | string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border p-4 dark:border-gray-700 ${className}`}
      role="group"
      aria-label={label}
    >
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  );
}

function HealthRow({
  url,
  cat,
  trend,
  isExpanded,
  onToggle,
  onAction,
  scrapeHistory,
  historyLoading,
  onResolveLog,
}: {
  url: UrlHealth;
  cat: "healthy" | "moderate" | "unhealthy";
  trend: { icon: string; label: string };
  isExpanded: boolean;
  onToggle: () => void;
  onAction: (action: "dismiss-anomaly" | "deactivate" | "reactivate") => void;
  scrapeHistory: ScrapeLog[];
  historyLoading: boolean;
  onResolveLog: (logId: string) => void;
}) {
  return (
    <>
      <tr
        className={`cursor-pointer border-b hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800 ${!url.active ? "opacity-50" : ""}`}
        onClick={onToggle}
        role="row"
        aria-expanded={isExpanded}
      >
        <td className="max-w-xs truncate px-3 py-2" title={url.url}>
          <div className="flex items-center gap-2">
            {url.anomalyDetected && (
              <span
                className="text-orange-500"
                role="img"
                aria-label="Anomaly detected"
                title={url.anomalyMessage || "Anomaly detected"}
              >
                ⚠️
              </span>
            )}
            <span className="truncate">{url.domain}</span>
          </div>
          <span className="block truncate text-xs text-gray-500">
            {url.url}
          </span>
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_COLORS[cat]}`}
          >
            {url.healthScore.toFixed(2)}
          </span>
        </td>
        <td className="px-3 py-2" title={trend.label}>
          <span
            className={`text-lg ${
              url.yieldTrend === "IMPROVING"
                ? "text-green-600"
                : url.yieldTrend === "DECLINING"
                  ? "text-red-600"
                  : "text-gray-500"
            }`}
            aria-label={`Trend: ${trend.label}`}
          >
            {trend.icon}
          </span>
        </td>
        <td className="px-3 py-2">
          {url.successfulScrapes}/{url.totalScrapes}
        </td>
        <td className="px-3 py-2">
          <span title={`Avg: ${url.avgYield.toFixed(1)}`}>
            {url.lastYield}
          </span>
        </td>
        <td className="px-3 py-2">{formatDate(url.lastScrapedAt)}</td>
        <td className="px-3 py-2">
          {!url.active ? (
            <span className="text-xs text-gray-500">Inactive</span>
          ) : (
            <span className="text-xs">{url.source}</span>
          )}
        </td>
        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1">
            {url.anomalyDetected && (
              <button
                className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200"
                onClick={() => onAction("dismiss-anomaly")}
                aria-label={`Dismiss anomaly for ${url.domain}`}
              >
                Dismiss
              </button>
            )}
            {url.active ? (
              <button
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                onClick={() => onAction("deactivate")}
                aria-label={`Deactivate ${url.domain}`}
              >
                Deactivate
              </button>
            ) : (
              <button
                className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200"
                onClick={() => onAction("reactivate")}
                aria-label={`Reactivate ${url.domain}`}
              >
                Reactivate
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={8} className="bg-gray-50 px-6 py-4 dark:bg-gray-900">
            <h3 className="mb-2 font-semibold">Scrape History</h3>
            {historyLoading ? (
              <p role="status">Loading history…</p>
            ) : scrapeHistory.length === 0 ? (
              <p className="text-sm text-gray-500">No scrape history.</p>
            ) : (
              <table className="w-full text-xs" aria-label="Scrape history">
                <thead>
                  <tr className="border-b dark:border-gray-700">
                    <th className="px-2 py-1 text-left" scope="col">
                      Date
                    </th>
                    <th className="px-2 py-1 text-left" scope="col">
                      Status
                    </th>
                    <th className="px-2 py-1 text-left" scope="col">
                      Judges
                    </th>
                    <th className="px-2 py-1 text-left" scope="col">
                      Type
                    </th>
                    <th className="px-2 py-1 text-left" scope="col">
                      Duration
                    </th>
                    <th className="px-2 py-1 text-left" scope="col">
                      Resolved
                    </th>
                    <th className="px-2 py-1 text-left" scope="col">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {scrapeHistory.map((log) => (
                    <tr
                      key={log.id}
                      className="border-b dark:border-gray-800"
                    >
                      <td className="px-2 py-1">
                        {formatDate(log.scrapedAt)}
                      </td>
                      <td className="px-2 py-1">
                        <span
                          className={
                            log.success
                              ? "text-green-600"
                              : "text-red-600"
                          }
                        >
                          {log.success ? "✓" : "✗"}
                        </span>
                      </td>
                      <td className="px-2 py-1">{log.judgesFound}</td>
                      <td className="px-2 py-1">
                        {log.failureType || "—"}
                      </td>
                      <td className="px-2 py-1">
                        {formatDuration(log.scrapeDurationMs)}
                      </td>
                      <td className="px-2 py-1">
                        {log.resolvedAt
                          ? `${formatDate(log.resolvedAt)} (${log.resolvedBy})`
                          : "—"}
                      </td>
                      <td className="px-2 py-1">
                        {!log.success && !log.resolvedAt && (
                          <button
                            className="rounded bg-blue-100 px-2 py-0.5 text-blue-800 hover:bg-blue-200 dark:bg-blue-900 dark:text-blue-200"
                            onClick={() => onResolveLog(log.id)}
                            aria-label="Resolve this scrape failure"
                          >
                            Resolve
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}
