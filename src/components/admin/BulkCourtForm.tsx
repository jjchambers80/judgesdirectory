"use client";

import { useState, FormEvent } from "react";

interface StateOption {
  id: string;
  name: string;
}

interface BulkCourtResult {
  stateId: string;
  stateName: string;
  totalCounties: number;
  courtsCreated: number;
  courtsSkipped: number;
  details: Array<{
    courtType: string;
    created: number;
    skipped: number;
  }>;
}

interface BulkCourtFormProps {
  states: StateOption[];
}

export default function BulkCourtForm({ states }: BulkCourtFormProps) {
  const [selectedStateId, setSelectedStateId] = useState("");
  const [courtTypesInput, setCourtTypesInput] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BulkCourtResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!selectedStateId) {
      setError("Please select a state.");
      return;
    }

    const courtTypes = courtTypesInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    if (courtTypes.length === 0) {
      setError("Enter at least one court type.");
      return;
    }

    if (courtTypes.length > 10) {
      setError("Maximum 10 court types per request.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/admin/courts/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateId: selectedStateId, courtTypes }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to create courts.");
        return;
      }

      const data: BulkCourtResult = await res.json();
      setResult(data);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="state-select"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}
          >
            State
          </label>
          <select
            id="state-select"
            value={selectedStateId}
            onChange={(e) => setSelectedStateId(e.target.value)}
            required
            style={{
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--color-input-border)",
              borderRadius: "0.375rem",
              width: "100%",
              maxWidth: "24rem",
            }}
          >
            <option value="">Select a state…</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label
            htmlFor="court-types"
            style={{ display: "block", marginBottom: "0.5rem", fontWeight: 600 }}
          >
            Court Types (comma-separated)
          </label>
          <input
            id="court-types"
            type="text"
            value={courtTypesInput}
            onChange={(e) => setCourtTypesInput(e.target.value)}
            placeholder="District Court, County Court, Justice of the Peace Court"
            required
            style={{
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--color-input-border)",
              borderRadius: "0.375rem",
              width: "100%",
            }}
          />
          <small style={{ color: "var(--color-text-muted)" }}>
            Max 10 court types per request
          </small>
        </div>

        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: "0.5rem 1.5rem",
            background: submitting
              ? "var(--color-text-muted)"
              : "var(--color-btn-primary)",
            color: "var(--color-btn-primary-text)",
            border: "none",
            borderRadius: "0.375rem",
            cursor: submitting ? "not-allowed" : "pointer",
            fontWeight: 600,
          }}
        >
          {submitting ? "Creating…" : "Create Courts"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          style={{
            marginTop: "1rem",
            padding: "0.75rem 1rem",
            background: "var(--color-error-bg)",
            color: "var(--color-error-text)",
            borderRadius: "0.375rem",
          }}
        >
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginTop: "1.5rem" }}>
          <h2 style={{ marginBottom: "0.75rem" }}>
            Results for {result.stateName}
          </h2>
          <p>
            <strong>{result.courtsCreated}</strong> courts created across{" "}
            <strong>{result.totalCounties}</strong> counties
            {result.courtsSkipped > 0 && (
              <> ({result.courtsSkipped} skipped — already existed)</>
            )}
          </p>

          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              marginTop: "1rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.5rem" }}>Court Type</th>
                <th style={{ padding: "0.5rem" }}>Created</th>
                <th style={{ padding: "0.5rem" }}>Skipped</th>
              </tr>
            </thead>
            <tbody>
              {result.details.map((d) => (
                <tr
                  key={d.courtType}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.5rem" }}>{d.courtType}</td>
                  <td style={{ padding: "0.5rem" }}>{d.created}</td>
                  <td style={{ padding: "0.5rem" }}>{d.skipped}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
