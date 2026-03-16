"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ColumnDef, SortingState, Row } from "@tanstack/react-table";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { DataTableToolbarConfig } from "@/components/ui/data-table-toolbar";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

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
  const [sorting, setSorting] = useState<SortingState>([
    { id: "healthScore", desc: true },
  ]);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [scrapeHistoryMap, setScrapeHistoryMap] = useState<
    Record<string, ScrapeLog[]>
  >({});
  const [historyLoadingId, setHistoryLoadingId] = useState<string | null>(null);

  const [columnVisibility, setColumnVisibility] = useColumnVisibility("health");

  const fetchUrls = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (stateFilter) params.set("state", stateFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (sorting.length > 0) {
      params.set("sort", sorting[0].id);
      params.set("order", sorting[0].desc ? "desc" : "asc");
    }
    params.set("page", String(pagination.page));
    params.set("limit", String(pagination.limit));

    const res = await fetch(`/api/admin/health?${params}`);
    const data = await res.json();
    setUrls(data.urls);
    setPagination(data.pagination);
    setSummary(data.summary);
    setLoading(false);
  }, [stateFilter, statusFilter, sorting, pagination.page, pagination.limit]);

  useEffect(() => {
    fetchUrls();
  }, [fetchUrls]);

  const fetchScrapeHistory = async (id: string) => {
    setHistoryLoadingId(id);
    const res = await fetch(`/api/admin/health/${id}`);
    const data = await res.json();
    setScrapeHistoryMap((prev) => ({ ...prev, [id]: data.scrapeHistory }));
    setHistoryLoadingId(null);
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

  const handleResolveLog = async (logId: string, healthId: string) => {
    await fetch(`/api/admin/health/scrape-logs/${logId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ resolvedBy: "admin" }),
    });
    // Refresh the scrape history for this row
    const res = await fetch(`/api/admin/health/${healthId}`);
    const data = await res.json();
    setScrapeHistoryMap((prev) => ({
      ...prev,
      [healthId]: data.scrapeHistory,
    }));
  };

  const columns: ColumnDef<UrlHealth>[] = useMemo(
    () => [
      {
        accessorKey: "url",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="URL" />
        ),
        cell: ({ row }) => (
          <div
            className={`max-w-xs truncate cursor-pointer ${!row.original.active ? "opacity-50" : ""}`}
            onClick={() => {
              row.toggleExpanded();
              if (!row.getIsExpanded() && !scrapeHistoryMap[row.original.id]) {
                fetchScrapeHistory(row.original.id);
              }
            }}
          >
            <div className="flex items-center gap-2">
              {row.original.anomalyDetected && (
                <span
                  className="text-orange-500"
                  role="img"
                  aria-label="Anomaly detected"
                  title={row.original.anomalyMessage || "Anomaly detected"}
                >
                  ⚠️
                </span>
              )}
              <span className="truncate">{row.original.domain}</span>
            </div>
            <span className="block truncate text-xs text-gray-500">
              {row.original.url}
            </span>
          </div>
        ),
      },
      {
        accessorKey: "healthScore",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Score" />
        ),
        cell: ({ row }) => {
          const cat = scoreCategory(row.original.healthScore);
          return (
            <span
              className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${SCORE_COLORS[cat]}`}
            >
              {row.original.healthScore.toFixed(2)}
            </span>
          );
        },
      },
      {
        accessorKey: "yieldTrend",
        header: "Trend",
        cell: ({ row }) => {
          const trend =
            TREND_ICONS[row.original.yieldTrend] || TREND_ICONS.STABLE;
          return (
            <span
              className={`text-lg ${
                row.original.yieldTrend === "IMPROVING"
                  ? "text-green-600"
                  : row.original.yieldTrend === "DECLINING"
                    ? "text-red-600"
                    : "text-gray-500"
              }`}
              aria-label={`Trend: ${trend.label}`}
            >
              {trend.icon}
            </span>
          );
        },
        enableSorting: false,
      },
      {
        accessorKey: "totalScrapes",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Scrapes" />
        ),
        cell: ({ row }) => (
          <span>
            {row.original.successfulScrapes}/{row.original.totalScrapes}
          </span>
        ),
      },
      {
        accessorKey: "lastYield",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Yield" />
        ),
        cell: ({ row }) => (
          <span title={`Avg: ${(row.original.avgYield ?? 0).toFixed(1)}`}>
            {row.original.lastYield ?? 0}
          </span>
        ),
      },
      {
        accessorKey: "lastScrapedAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Last Scraped" />
        ),
        cell: ({ row }) => formatDate(row.original.lastScrapedAt),
      },
      {
        accessorKey: "stateAbbr",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="State" />
        ),
      },
      {
        id: "status",
        header: "Status",
        cell: ({ row }) => {
          if (!row.original.active) {
            return <span className="text-xs text-gray-500">Inactive</span>;
          }
          return <span className="text-xs">{row.original.source}</span>;
        },
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
            {row.original.anomalyDetected && (
              <button
                className="rounded bg-orange-100 px-2 py-0.5 text-xs text-orange-800 hover:bg-orange-200 dark:bg-orange-900 dark:text-orange-200"
                onClick={() => handleAction(row.original.id, "dismiss-anomaly")}
                aria-label={`Dismiss anomaly for ${row.original.domain}`}
              >
                Dismiss
              </button>
            )}
            {row.original.active ? (
              <button
                className="rounded bg-gray-100 px-2 py-0.5 text-xs text-gray-800 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200"
                onClick={() => handleAction(row.original.id, "deactivate")}
                aria-label={`Deactivate ${row.original.domain}`}
              >
                Deactivate
              </button>
            ) : (
              <button
                className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-800 hover:bg-green-200 dark:bg-green-900 dark:text-green-200"
                onClick={() => handleAction(row.original.id, "reactivate")}
                aria-label={`Reactivate ${row.original.domain}`}
              >
                Reactivate
              </button>
            )}
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrapeHistoryMap],
  );

  const toolbarConfig: DataTableToolbarConfig = useMemo(
    () => ({
      facetedFilters: [
        {
          columnId: "yieldTrend",
          title: "Trend",
          options: [
            { label: "Improving", value: "IMPROVING" },
            { label: "Stable", value: "STABLE" },
            { label: "Declining", value: "DECLINING" },
          ],
        },
      ],
      enableColumnVisibility: true,
    }),
    [],
  );

  const renderScrapeHistory = useCallback(
    ({ row }: { row: Row<UrlHealth> }) => {
      const history = scrapeHistoryMap[row.original.id];
      const isLoading = historyLoadingId === row.original.id;

      return (
        <div className="bg-gray-50 px-6 py-4 dark:bg-gray-900">
          <h3 className="mb-2 font-semibold">Scrape History</h3>
          {isLoading ? (
            <p role="status">Loading history…</p>
          ) : !history || history.length === 0 ? (
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
                {history.map((log) => (
                  <tr key={log.id} className="border-b dark:border-gray-800">
                    <td className="px-2 py-1">{formatDate(log.scrapedAt)}</td>
                    <td className="px-2 py-1">
                      <span
                        className={
                          log.success ? "text-green-600" : "text-red-600"
                        }
                      >
                        {log.success ? "✓" : "✗"}
                      </span>
                    </td>
                    <td className="px-2 py-1">{log.judgesFound}</td>
                    <td className="px-2 py-1">{log.failureType || "—"}</td>
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
                          onClick={() =>
                            handleResolveLog(log.id, row.original.id)
                          }
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
        </div>
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [scrapeHistoryMap, historyLoadingId],
  );

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

      {/* Server-side filters (state + status sent as API params) */}
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
      </div>

      {/* DataTable */}
      {loading ? (
        <p role="status">Loading…</p>
      ) : urls.length === 0 ? (
        <p>No URL health records found.</p>
      ) : (
        <DataTable
          columns={columns}
          data={urls}
          toolbarConfig={toolbarConfig}
          manualSorting
          manualFiltering
          manualPagination
          sorting={sorting}
          onSortingChange={setSorting}
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          pageCount={pagination.totalPages}
          currentPage={pagination.page}
          onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
          onPageSizeChange={(size) =>
            setPagination((p) => ({ ...p, limit: size, page: 1 }))
          }
          renderSubComponent={renderScrapeHistory}
        />
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
