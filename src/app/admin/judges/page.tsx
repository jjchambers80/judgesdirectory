"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { ColumnDef, SortingState } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { DataTableToolbarConfig } from "@/components/ui/data-table-toolbar";
import { useDebounce } from "@/hooks/use-debounce";

interface JudgeRecord {
  id: string;
  fullName: string;
  slug: string;
  status: "UNVERIFIED" | "VERIFIED" | "REJECTED";
  court: {
    id: string;
    type: string;
    county: {
      id: string;
      name: string;
      state: { id: string; name: string };
    };
  };
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function AdminJudgesPage() {
  const [judges, setJudges] = useState<JudgeRecord[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 50,
    total: 0,
    totalPages: 0,
  });
  const [sorting, setSorting] = useState<SortingState>([
    { id: "createdAt", desc: true },
  ]);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const fetchJudges = useCallback(
    async (page: number) => {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("limit", String(pagination.limit));
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (statusFilter) params.set("status", statusFilter);
      if (sorting.length > 0) {
        params.set("sort", sorting[0].id);
        params.set("order", sorting[0].desc ? "desc" : "asc");
      }

      const res = await fetch(`/api/admin/judges?${params}`);
      const data = await res.json();
      setJudges(data.judges);
      setPagination(data.pagination);
      setLoading(false);
    },
    [debouncedSearch, statusFilter, sorting, pagination.limit],
  );

  useEffect(() => {
    fetchJudges(1);
  }, [fetchJudges]);

  const handleVerify = async (id: string, currentStatus: string) => {
    const action = currentStatus === "VERIFIED" ? "unverify" : "verify";
    await fetch(`/api/admin/judges/${id}/verify`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    fetchJudges(pagination.page);
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete judge "${name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/judges/${id}`, { method: "DELETE" });
    fetchJudges(pagination.page);
  };

  const columns: ColumnDef<JudgeRecord>[] = useMemo(
    () => [
      {
        accessorKey: "fullName",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Name" />
        ),
        cell: ({ row }) => <strong>{row.original.fullName}</strong>,
      },
      {
        id: "courtType",
        accessorFn: (row) => row.court.type,
        header: "Court",
        enableSorting: false,
      },
      {
        id: "location",
        accessorFn: (row) =>
          `${row.court.county.name}, ${row.court.county.state.name}`,
        header: "Location",
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">
            {row.original.court.county.name},{" "}
            {row.original.court.county.state.name}
          </span>
        ),
        enableSorting: false,
      },
      {
        accessorKey: "status",
        header: ({ column }) => (
          <DataTableColumnHeader column={column} title="Status" />
        ),
        cell: ({ row }) => (
          <span
            className={cn(
              "inline-block px-2 py-1 rounded-full text-xs font-semibold",
              row.original.status === "VERIFIED"
                ? "bg-badge-success-bg text-badge-success-text"
                : row.original.status === "REJECTED"
                  ? "bg-error-bg text-error-text"
                  : "bg-badge-warning-bg text-badge-warning-text",
            )}
          >
            {row.original.status === "VERIFIED"
              ? "Verified"
              : row.original.status === "REJECTED"
                ? "Rejected"
                : "Unverified"}
          </span>
        ),
      },
      {
        id: "actions",
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex gap-2 text-sm">
            <button
              onClick={() => handleVerify(row.original.id, row.original.status)}
              className="px-2 py-1 border border-input rounded bg-background text-foreground cursor-pointer text-xs hover:bg-muted transition-colors"
            >
              {row.original.status === "VERIFIED" ? "Unverify" : "Verify"}
            </button>
            <button
              onClick={() =>
                handleDelete(row.original.id, row.original.fullName)
              }
              className="px-2 py-1 border border-error-text rounded bg-error-bg text-error-text cursor-pointer text-xs"
            >
              Delete
            </button>
          </div>
        ),
        enableSorting: false,
        enableHiding: false,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const toolbarConfig: DataTableToolbarConfig = useMemo(
    () => ({
      textFilters: [{ columnId: "fullName", placeholder: "Search by name…" }],
      enableColumnVisibility: false,
    }),
    [],
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1>Judge Records</h1>
        <Link
          href="/admin/judges/new/"
          className="no-link-style px-4 py-2 bg-primary text-white rounded-md no-underline text-sm font-medium hover:bg-primary/90 hover:no-underline transition-colors"
        >
          + Add Judge
        </Link>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : judges.length === 0 && !debouncedSearch && !statusFilter ? (
        <p className="text-muted-foreground">
          No judges found.{" "}
          <Link href="/admin/judges/new/" className="text-link hover:underline">
            Create the first judge record
          </Link>
          .
        </p>
      ) : (
        <DataTable
          columns={columns}
          data={judges}
          toolbarConfig={toolbarConfig}
          toolbarLeadingContent={
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by status"
              className="h-8 rounded-md border border-border px-3 text-sm"
            >
              <option value="">All Status</option>
              <option value="VERIFIED">Verified</option>
              <option value="UNVERIFIED">Unverified</option>
              <option value="REJECTED">Rejected</option>
            </select>
          }
          manualSorting
          manualFiltering
          manualPagination
          sorting={sorting}
          onSortingChange={setSorting}
          textFilterValue={search}
          onTextFilterChange={setSearch}
          pageCount={pagination.totalPages}
          currentPage={pagination.page}
          onPageChange={(page) => fetchJudges(page)}
          onPageSizeChange={(size) =>
            setPagination((prev) => ({ ...prev, limit: size }))
          }
        />
      )}
    </div>
  );
}
