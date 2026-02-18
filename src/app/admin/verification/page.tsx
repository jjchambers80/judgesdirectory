"use client";

import VerificationQueue from "@/components/admin/VerificationQueue";

export default function AdminVerificationPage() {
  return (
    <div>
      <h1 style={{ marginBottom: "1.5rem" }}>Verification Queue</h1>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
          marginBottom: "1.5rem",
        }}
      >
        Review imported judges against their source URLs. Verify accurate
        records to make them public, or reject inaccurate ones.
      </p>
      <VerificationQueue />
    </div>
  );
}
