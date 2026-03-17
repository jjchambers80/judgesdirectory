"use client";

import ProgressDashboard from "@/components/admin/ProgressDashboard";

export default function AdminDashboardPage() {
  return (
    <div>
      <h1 className="mb-6">Harvest Progress Dashboard</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Track harvest progress toward the 1,500-judge pilot target across all
        states.
      </p>
      <ProgressDashboard />
    </div>
  );
}
