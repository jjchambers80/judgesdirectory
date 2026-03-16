"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ColumnDef,
  SortingState,
  RowSelectionState,
} from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { DataTableToolbarConfig } from "@/components/ui/data-table-toolbar";

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
  const [sorting, setSorting] = useState<SortingState>([
    { id: "fullName", desc: false },
  ]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [statusFilter, setStatusFilter] = useState("UNVERIFIED");
  const [stateId, setStateId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [states, setStates] = useState<StateOption[]>([]);
  const [batches, setBatches] = useState<BatchOption[]>([]);
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
      if (sorting.length > 0) {
        params.set("sort", sorting[0].id);
        params.set("order", sorting[0].desc ? "desc" : "asc");
      }

      try {
        const res = await fetch(`/api/admin/verification?${params}`);
        const data = await res.json();
        setJudges(data.judges || []);
        setPagination(data.pagination || pagination);
        setRowSelection({});
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
    [statusFilter, stateId, batchId, sorting, onStatsChange, pagination],
  );

  useEffect(() => {
    fetchQueue(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, stateId, batchId, sorting]);

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

  const selectedIds = useMemo(
    () =>
      Object.keys(rowSelection)
        .map((idx) => judges[parseInt(idx)]?.id)
        .filter(Boolean),
    [rowSelection, judges],
  );

  const handleBatchAction = async (action: "verify" | "reject") => {
    if (selectedIds.length === 0) return;
    setBatchActionLoading(true);
    try {
      const res = await fetch("/api/admin/verification/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          judgeIds: selectedIds,
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

  const columns: ColumnDef<JudgeRecord>[] = useMemo(
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
            aria-label="Select all on page"
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={`Select ${row.original.fullName}`}
          />
        ),
        enableSorting: false,
        enableHiding: false,
      },
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => (
          <span className="font-medium text-sm">{row.original.fullName}</span>
        ),
      },
      {
        accessorKey: "court",
        header: "Court",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.court}</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "county",
        header: "County",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.county}</span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "state",
        header: "State",
        cell: ({ row }) => (
          <span className="text-xs">{row.original.state}</span>
        ),
        enableSorting: false,
      },
      {
        id: "sourceUrl",
        accessorKey: "sourceUrl",
        header: "Source",
        cell: ({ row }) =>
          row.original.sourceUrl ? (
            <a
              href={row.original.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-link text-xs"
            >
              View Source
            </a>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        enableSorting: false,
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <span
            className={cn(
              "px-1.5 py-0.5 rounded-full text-[0.7rem] font-semibold",
              row.original.status === "VERIFIED" &&
                "bg-badge-success-bg text-badge-success-text",
              row.original.status === "REJECTED" &&
                "bg-error-bg text-error-text",
              row.original.status === "UNVERIFIED" &&
                "bg-badge-warning-bg text-badge-warning-text",
            )}
          >
            {row.original.status}
          </span>
        ),
        enableSorting: false,
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-1.5">
            {row.original.status === "UNVERIFIED" && (
              <>
                <button
                  onClick={() => handleAction(row.original.id, "verify")}
                  disabled={actionLoading === row.original.id}
                  className={cn(
                    "px-2 py-0.5 bg-badge-success-bg text-badge-success-text border-none rounded text-[0.7rem] font-semibold",
                    actionLoading === row.original.id
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer",
                  )}
                >
                  Verify
                </button>
                <button
                  onClick={() => handleAction(row.original.id, "reject")}
                  disabled={actionLoading === row.original.id}
                  className={cn(
                    "px-2 py-0.5 bg-error-bg text-error-text border-none rounded text-[0.7rem] font-semibold",
                    actionLoading === row.original.id
                      ? "cursor-not-allowed opacity-50"
                      : "cursor-pointer",
                  )}
                >
                  Reject
                </button>
              </>
            )}
            {(row.original.status === "VERIFIED" ||
              row.original.status === "REJECTED") && (
              <button
                onClick={() => handleAction(row.original.id, "unverify")}
                disabled={actionLoading === row.original.id}
                className={cn(
                  "px-2 py-0.5 border border-input rounded bg-background text-[0.7rem]",
                  actionLoading === row.original.id
                    ? "cursor-not-allowed opacity-50"
                    : "cursor-pointer",
                )}
              >
                Unverify
              </button>
            )}
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [actionLoading],
  );

  const toolbarConfig: DataTableToolbarConfig = useMemo(
    () => ({
      textFilters: [{ columnId: "fullName", placeholder: "Search by name…" }],
      facetedFilters: [
        {
          columnId: "status",
          title: "Status",
          options: [
            { label: "Unverified", value: "UNVERIFIED" },
            { label: "Verified", value: "VERIFIED" },
            { label: "Rejected", value: "REJECTED" },
          ],
        },
      ],
      enableColumnVisibility: false,
    }),
    [],
  );

  const serverFilters = (
    <>
      <select
        aria-label="Filter by status"
        value={statusFilter}
        onChange={(e) => setStatusFilter(e.target.value)}
        className="h-8 px-2 border border-input rounded-md bg-background text-foreground text-sm"
      >
        <option value="UNVERIFIED">Unverified</option>
        <option value="VERIFIED">Verified</option>
        <option value="REJECTED">Rejected</option>
      </select>
      <select
        aria-label="Filter by state"
        value={stateId}
        onChange={(e) => setStateId(e.target.value)}
        className="h-8 px-2 border border-input rounded-md bg-background text-foreground text-sm"
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
        className="h-8 px-2 border border-input rounded-md bg-background text-foreground text-sm"
      >
        <option value="">All Batches</option>
        {batches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.fileName}
          </option>
        ))}
      </select>
    </>
  );

  const recordCount = (
    <span className="text-xs text-muted-foreground whitespace-nowrap ml-auto">
      {pagination.total} records
    </span>
  );

  return (
    <div>
      {/* Batch Actions */}
      {selectedIds.length > 0 && (
        <div className="flex gap-2 items-center mb-3 px-3 py-2 bg-secondary rounded-md">
          <span className="text-sm font-semibold">
            {selectedIds.length} selected
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

      {/* DataTable */}
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : judges.length === 0 ? (
        <p className="text-muted-foreground">
          No records match the current filters.
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={judges}
          toolbarConfig={toolbarConfig}
          toolbarLeadingContent={serverFilters}
          toolbarTrailingContent={recordCount}
          manualSorting
          manualFiltering
          manualPagination
          sorting={sorting}
          onSortingChange={setSorting}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
          enableRowSelection
          pageCount={pagination.totalPages}
          currentPage={pagination.page}
          onPageChange={(page) => fetchQueue(page)}
          onPageSizeChange={(size) =>
            setPagination((prev) => ({ ...prev, limit: size }))
          }
        />
      )}
    </div>
  );
}
