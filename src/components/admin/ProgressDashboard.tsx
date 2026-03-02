"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

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
  }>;
  recentBatches: Array<{
    id: string;
    fileName: string;
    successCount: number;
    status: string;
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

  const { totals, target, byState, recentBatches, milestoneReached } = data;
  const progressPct = Math.min(totals.percentComplete, 100);

  return (
    <div>
      {/* Milestone banner */}
      {milestoneReached && (
        <div
          role="status"
          className="p-4 bg-badge-success-bg text-badge-success-text rounded-md mb-6 text-center font-bold text-lg"
        >
          🎉 Milestone reached! {totals.imported.toLocaleString()} judges
          imported — target of {target.toLocaleString()} met!
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
          aria-label="Import progress toward pilot target"
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
        <StatCard label="Total Imported" value={totals.imported} />
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
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="p-2">State</th>
                  <th className="p-2">Imported</th>
                  <th className="p-2">Verified</th>
                  <th className="p-2">Unverified</th>
                  <th className="p-2">Rejected</th>
                  <th className="p-2">% of Target</th>
                </tr>
              </thead>
              <tbody>
                {byState.map((s) => (
                  <tr key={s.stateId} className="border-b border-border">
                    <td className="p-2 font-medium">{s.stateName}</td>
                    <td className="p-2">{s.imported.toLocaleString()}</td>
                    <td className="p-2">{s.verified.toLocaleString()}</td>
                    <td className="p-2">{s.unverified.toLocaleString()}</td>
                    <td className="p-2">{s.rejected.toLocaleString()}</td>
                    <td className="p-2">{s.percentOfTarget}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent batches */}
      {recentBatches.length > 0 && (
        <div>
          <h2 className="mb-3 text-lg">Recent Imports</h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="p-2">File</th>
                  <th className="p-2">Records</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentBatches.map((b) => (
                  <tr key={b.id} className="border-b border-border">
                    <td className="p-2 text-sm">{b.fileName}</td>
                    <td className="p-2 text-sm">
                      {b.successCount.toLocaleString()}
                    </td>
                    <td className="p-2">
                      <span
                        className={cn(
                          "inline-block px-1.5 py-0.5 rounded-full text-[0.7rem] font-semibold",
                          b.status === "COMPLETE"
                            ? "bg-badge-success-bg text-badge-success-text"
                            : b.status === "ROLLED_BACK"
                              ? "bg-error-bg text-error-text"
                              : "bg-badge-warning-bg text-badge-warning-text",
                        )}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-2 text-xs text-muted-foreground">
                      {new Date(b.createdAt).toLocaleDateString()}
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
