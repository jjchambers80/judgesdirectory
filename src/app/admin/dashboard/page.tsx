"use client";

import ProgressDashboard from "@/components/admin/ProgressDashboard";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Import Progress Dashboard</h1>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        Track progress toward the 1,500-judge pilot target across all states.
      </p>
      <ProgressDashboard />
    </div>
  );
}
