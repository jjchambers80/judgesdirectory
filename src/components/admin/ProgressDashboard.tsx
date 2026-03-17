"use client";

import { useState, useEffect } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/ui/data-table";
import { DataTableColumnHeader } from "@/components/ui/data-table-column-header";
import type { DataTableToolbarConfig } from "@/components/ui/data-table-toolbar";

interface DashboardData {
  target: number;
  totals: {
    imported: number;
    verified: number;
    unverified: number;
    rejected: number;
    percentComplete: number;
  };
  byState: Array<{
    stateId: string;
    stateName: string;
    stateSlug: string;
    imported: number;
    verified: number;
    unverified: number;
    rejected: number;
    percentOfTarget: number;
    lastHarvestAt: string | null;
    harvestStatus: "fresh" | "stale" | "never";
  }>;
  recentHarvestJobs: Array<{
    id: string;
    stateAbbr: string;
    state: string;
    status: string;
    triggeredBy: string;
    judgesNew: number;
    judgesUpdated: number;
    judgesFound: number;
    completedAt: string | null;
    createdAt: string;
  }>;
  milestoneReached: boolean;
}

export default function ProgressDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/dashboard")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p className="text-muted-foreground">Loading dashboard…</p>;
  }

  if (!data) {
    return <p className="text-error-text">Failed to load dashboard data.</p>;
  }

  const { totals, target, byState, recentHarvestJobs, milestoneReached } = data;
  const progressPct = Math.min(totals.percentComplete, 100);

  type StateRow = DashboardData["byState"][number];

  const stateColumns: ColumnDef<StateRow>[] = [
    {
      accessorKey: "stateName",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="State" />
      ),
      cell: ({ row }) => (
        <span className="font-medium">{row.original.stateName}</span>
      ),
    },
    {
      accessorKey: "imported",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Judges" />
      ),
      cell: ({ row }) => row.original.imported.toLocaleString(),
    },
    {
      accessorKey: "verified",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Verified" />
      ),
      cell: ({ row }) => row.original.verified.toLocaleString(),
    },
    {
      accessorKey: "lastHarvestAt",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Last Harvest" />
      ),
      cell: ({ row }) =>
        row.original.lastHarvestAt ? (
          new Date(row.original.lastHarvestAt).toLocaleDateString()
        ) : (
          <span className="text-muted-foreground">Never</span>
        ),
    },
    {
      accessorKey: "harvestStatus",
      header: ({ column }) => (
        <DataTableColumnHeader column={column} title="Freshness" />
      ),
      cell: ({ row }) => {
        const s = row.original.harvestStatus;
        return (
          <span
            className={cn(
              "inline-block px-1.5 py-0.5 rounded-full text-[0.7rem] font-semibold",
              s === "fresh"
                ? "bg-badge-success-bg text-badge-success-text"
                : s === "stale"
                  ? "bg-badge-warning-bg text-badge-warning-text"
                  : "bg-secondary text-muted-foreground",
            )}
          >
            {s === "fresh"
              ? "Fresh"
              : s === "stale"
                ? "Stale"
                : "Never harvested"}
          </span>
        );
      },
    },
  ];

  const stateToolbarConfig: DataTableToolbarConfig = {
    textFilters: [{ columnId: "stateName", placeholder: "Search states…" }],
    enableColumnVisibility: false,
  };

  return (
    <div>
      {/* Milestone banner */}
      {milestoneReached && (
        <div
          role="status"
          className="p-4 bg-badge-success-bg text-badge-success-text rounded-md mb-6 text-center font-bold text-lg"
        >
          🎉 Milestone reached! {totals.imported.toLocaleString()} judges
          harvested — target of {target.toLocaleString()} met!
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex justify-between mb-1.5 text-sm">
          <span>
            Progress: {totals.imported.toLocaleString()} /{" "}
            {target.toLocaleString()}
          </span>
          <span className="font-semibold">{progressPct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Harvest progress toward pilot target"
          className="w-full h-5 bg-secondary rounded-full overflow-hidden"
        >
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500 ease-in-out",
              milestoneReached ? "bg-badge-success-text" : "bg-primary",
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8 sm:grid-cols-4">
        <StatCard label="Total Judges" value={totals.imported} />
        <StatCard
          label="Verified"
          value={totals.verified}
          colorClass="text-badge-success-text"
        />
        <StatCard
          label="Unverified"
          value={totals.unverified}
          colorClass="text-badge-warning-text"
        />
        <StatCard
          label="Rejected"
          value={totals.rejected}
          colorClass="text-error-text"
        />
      </div>

      {/* Per-state breakdown */}
      {byState.length > 0 && (
        <div className="mb-8">
          <h2 className="mb-3 text-lg">By State</h2>
          <DataTable
            columns={stateColumns}
            data={byState}
            toolbarConfig={stateToolbarConfig}
          />
        </div>
      )}

      {/* Recent harvest jobs */}
      {recentHarvestJobs.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg">Recent Harvests</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="p-2">State</th>
                  <th className="p-2">New</th>
                  <th className="p-2">Updated</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentHarvestJobs.map((j) => (
                  <tr key={j.id} className="border-b border-border">
                    <td className="p-2 text-sm font-medium">{j.state}</td>
                    <td className="p-2 text-sm">
                      {j.judgesNew.toLocaleString()}
                    </td>
                    <td className="p-2 text-sm">
                      {j.judgesUpdated.toLocaleString()}
                    </td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "inline-block px-1.5 py-0.5 rounded-full text-[0.7rem] font-semibold",
                          j.status === "COMPLETED"
                            ? "bg-badge-success-bg text-badge-success-text"
                            : j.status === "FAILED"
                              ? "bg-error-bg text-error-text"
                              : j.status === "RUNNING"
                                ? "bg-badge-info-bg text-badge-info-text"
                                : "bg-badge-warning-bg text-badge-warning-text",
                        )}
                      >
                        {j.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {j.completedAt
                        ? new Date(j.completedAt).toLocaleDateString()
                        : new Date(j.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass?: string;
}) {
  return (
    <div className="p-4 border border-border rounded-md text-center">
      <div className={cn("text-2xl font-bold", colorClass)}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}
