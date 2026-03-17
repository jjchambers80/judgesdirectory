"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ColumnDef,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { DataTableToolbarConfig } from "@/components/ui/data-table-toolbar";
import { useColumnVisibility } from "@/hooks/use-column-visibility";

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
  scrapeWorthy: boolean | null;
  autoClassifiedAt: string | null;
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
  STALE: "bg-orange-100 text-orange-800",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

const truncateUrl = (url: string, max = 50) =>
  url.length > max ? url.slice(0, max) + "…" : url;

export default function AdminDiscoveryPage() {
  const [candidates, setCandidates] = useState<UrlCandidate[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "discoveredAt", desc: true },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [columnVisibility, setColumnVisibility] = useColumnVisibility(
    "discovery",
    {
      suggestedType: false,
      suggestedLevel: false,
    },
  );
  const [stateFilter, setStateFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
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
      params.set("limit", String(pagination.limit));
      if (sorting.length > 0) {
        params.set("sort", sorting[0].id);
        params.set("order", sorting[0].desc ? "desc" : "asc");
      }
      if (stateFilter) params.set("state", stateFilter);
      if (statusFilter) params.set("status", statusFilter);

      const res = await fetch(`/api/admin/discovery?${params}`);
      const data = await res.json();
      setCandidates(data.candidates);
      setPagination(data.pagination);
      setRowSelection({});
      setLoading(false);
    },
    [stateFilter, statusFilter, sorting, pagination.limit],
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

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .map((idx) => candidates[parseInt(idx)]?.id)
        .filter(Boolean),
    [rowSelection, candidates],
  );

  const handleBulkAction = async (
    action: "approve" | "reject",
    reason?: string,
  ) => {
    if (selectedIds.length === 0) return;
    await fetch("/api/admin/discovery/bulk", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ids: selectedIds,
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

  const columns: ColumnDef<UrlCandidate>[] = useMemo(
    () => [
      {
        id: "select",
        header: ({ table }) => (
          <Checkbox
            checked={
              table.getIsAllPageRowsSelected() ||
              (table.getIsSomePageRowsSelected() && "indeterminate")
            }
            onCheckedChange={(value) =>
              table.toggleAllPageRowsSelected(!!value)
            }
            aria-label="Select all"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.url}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "url",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="URL" />
        ),
        cell: ({ row }) => (
          <div>
            <a
              href={row.original.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link hover:underline"
              title={row.original.url}
            >
              {truncateUrl(row.original.url)}
            </a>
            <div className="text-xs text-muted-foreground">
              {row.original.domain}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "stateAbbr",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="State" />
        ),
      },
      {
        accessorKey: "suggestedType",
        header: "Type",
        cell: ({ row }) => row.original.suggestedType || "—",
        enableSorting: false,
      },
      {
        accessorKey: "suggestedLevel",
        header: "Level",
        cell: ({ row }) => row.original.suggestedLevel || "—",
        enableSorting: false,
      },
      {
        accessorKey: "confidenceScore",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Confidence" />
        ),
        cell: ({ row }) => {
          const score = row.original.confidenceScore;
          if (score === null) return "—";
          const color =
            score >= 0.8
              ? "bg-green-100 text-green-800"
              : score >= 0.5
                ? "bg-yellow-100 text-yellow-800"
                : "bg-red-100 text-red-800";
          return (
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${color}`}
            >
              {score.toFixed(2)}
            </span>
          );
        },
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => {
          const displayStatus = row.original.isStale
            ? "STALE"
            : row.original.status;
          return (
            <span
              className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[displayStatus] || ""}`}
            >
              {displayStatus}
            </span>
          );
        },
      },
      {
        accessorKey: "discoveredAt",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Discovered" />
        ),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {formatDate(row.original.discoveredAt)}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => {
          if (row.original.status !== "DISCOVERED") return null;
          return (
            <div className="flex gap-1">
              <button
                onClick={() => handleApprove(row.original.id)}
                className="px-2 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  const reason = prompt("Rejection reason:");
                  if (reason) handleReject(row.original.id, reason);
                }}
                className="px-2 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          );
        },
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const stateOptions = useMemo(() => {
    const states = Array.from(
      new Set(candidates.map((c) => c.stateAbbr)),
    ).sort();
    return states.map((s) => ({ label: s, value: s }));
  }, [candidates]);

  const toolbarConfig: DataTableToolbarConfig = useMemo(
    () => ({
      facetedFilters: [
        {
          columnId: "stateAbbr",
          title: "State",
          options: stateOptions,
        },
        {
          columnId: "status",
          title: "Status",
          options: [
            { label: "Discovered", value: "DISCOVERED" },
            { label: "Approved", value: "APPROVED" },
            { label: "Rejected", value: "REJECTED" },
            { label: "Stale", value: "STALE" },
          ],
        },
      ],
      enableColumnVisibility: true,
    }),
    [stateOptions],
  );

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

      {/* Bulk actions */}
      {selectedIds.length > 0 && (
        <div className="flex gap-2 mb-4 items-center text-sm">
          <span className="text-muted-foreground">
            {selectedIds.length} selected
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

      {/* DataTable */}
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : candidates.length === 0 && !stateFilter && !statusFilter ? (
        <p className="text-muted-foreground">
          No candidates found. Run{" "}
          <code>npx tsx scripts/discovery/discover.ts --state FL</code> to
          discover URLs.
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={candidates}
          toolbarConfig={toolbarConfig}
          toolbarLeadingContent={
            <>
              <input
                type="text"
                placeholder="State abbr (e.g. FL)"
                value={stateFilter}
                onChange={(e) => setStateFilter(e.target.value.toUpperCase())}
                maxLength={2}
                aria-label="Filter by state"
                className="h-8 w-40 rounded-md border border-border px-3 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filter by status"
                className="h-8 rounded-md border border-border px-3 text-sm"
              >
                <option value="">All Statuses</option>
                <option value="DISCOVERED">Needs Review</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </>
          }
          manualSorting
          manualFiltering
          manualPagination
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableRowSelection
          columnVisibility={columnVisibility}
          onColumnVisibilityChange={setColumnVisibility}
          pageCount={pagination.totalPages}
          currentPage={pagination.page}
          onPageChange={(page) => fetchCandidates(page)}
          onPageSizeChange={(size) => {
            setPagination((prev) => ({ ...prev, limit: size }));
          }}
        />
      )}
    </div>
  );
}
