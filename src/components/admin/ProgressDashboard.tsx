"use client";

import { useState, useEffect } from "react";

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
    return (
      <p style={{ color: "var(--color-text-muted)" }}>Loading dashboard…</p>
    );
  }

  if (!data) {
    return (
      <p style={{ color: "var(--color-error-text)" }}>
        Failed to load dashboard data.
      </p>
    );
  }

  const { totals, target, byState, recentBatches, milestoneReached } = data;
  const progressPct = Math.min(totals.percentComplete, 100);

  return (
    <div>
      {/* Milestone banner */}
      {milestoneReached && (
        <div
          role="status"
          style={{
            padding: "1rem",
            background: "var(--color-badge-success-bg)",
            color: "var(--color-badge-success-text)",
            borderRadius: "0.375rem",
            marginBottom: "1.5rem",
            textAlign: "center",
            fontWeight: 700,
            fontSize: "1.1rem",
          }}
        >
          🎉 Milestone reached! {totals.imported.toLocaleString()} judges
          imported — target of {target.toLocaleString()} met!
        </div>
      )}

      {/* Progress bar */}
      <div style={{ marginBottom: "1.5rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: "0.375rem",
            fontSize: "0.875rem",
          }}
        >
          <span>
            Progress: {totals.imported.toLocaleString()} /{" "}
            {target.toLocaleString()}
          </span>
          <span style={{ fontWeight: 600 }}>{progressPct}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Import progress toward pilot target"
          style={{
            width: "100%",
            height: "1.25rem",
            background: "var(--color-bg-secondary)",
            borderRadius: "9999px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${progressPct}%`,
              height: "100%",
              background: milestoneReached
                ? "var(--color-badge-success-text)"
                : "var(--color-btn-primary)",
              borderRadius: "9999px",
              transition: "width 0.5s ease",
            }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          marginBottom: "2rem",
        }}
      >
        <StatCard label="Total Imported" value={totals.imported} />
        <StatCard
          label="Verified"
          value={totals.verified}
          color="var(--color-badge-success-text)"
        />
        <StatCard
          label="Unverified"
          value={totals.unverified}
          color="var(--color-badge-warning-text)"
        />
        <StatCard
          label="Rejected"
          value={totals.rejected}
          color="var(--color-error-text)"
        />
      </div>

      {/* Per-state breakdown */}
      {byState.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
            By State
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.5rem" }}>State</th>
                <th style={{ padding: "0.5rem" }}>Imported</th>
                <th style={{ padding: "0.5rem" }}>Verified</th>
                <th style={{ padding: "0.5rem" }}>Unverified</th>
                <th style={{ padding: "0.5rem" }}>Rejected</th>
                <th style={{ padding: "0.5rem" }}>% of Target</th>
              </tr>
            </thead>
            <tbody>
              {byState.map((s) => (
                <tr
                  key={s.stateId}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.5rem", fontWeight: 500 }}>
                    {s.stateName}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {s.imported.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {s.verified.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {s.unverified.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    {s.rejected.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>{s.percentOfTarget}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Recent batches */}
      {recentBatches.length > 0 && (
        <div>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1.1rem" }}>
            Recent Imports
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.5rem" }}>File</th>
                <th style={{ padding: "0.5rem" }}>Records</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentBatches.map((b) => (
                <tr
                  key={b.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>
                    {b.fileName}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>
                    {b.successCount.toLocaleString()}
                  </td>
                  <td style={{ padding: "0.5rem" }}>
                    <span
                      style={{
                        padding: "0.125rem 0.375rem",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        background:
                          b.status === "COMPLETE"
                            ? "var(--color-badge-success-bg)"
                            : b.status === "ROLLED_BACK"
                              ? "var(--color-error-bg)"
                              : "var(--color-badge-warning-bg)",
                        color:
                          b.status === "COMPLETE"
                            ? "var(--color-badge-success-text)"
                            : b.status === "ROLLED_BACK"
                              ? "var(--color-error-text)"
                              : "var(--color-badge-warning-text)",
                      }}
                    >
                      {b.status}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.75rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    {new Date(b.createdAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid var(--color-border)",
        borderRadius: "0.375rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: color || "inherit",
        }}
      >
        {value.toLocaleString()}
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}
