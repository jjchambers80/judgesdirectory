"use client";

import VerificationQueue from "@/components/admin/VerificationQueue";

export default function AdminVerificationPage() {
  return (
    <div>
      <h1 className="mb-6">Verification Queue</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Review imported judges against their source URLs. Verify accurate
        records to make them public, or reject inaccurate ones.
      </p>
      <VerificationQueue />
    </div>
  );
}
