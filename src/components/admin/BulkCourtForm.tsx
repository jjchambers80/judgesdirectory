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
        <div className="mb-4">
          <label htmlFor="state-select" className="block mb-2 font-semibold">
            State
          </label>
          <select
            id="state-select"
            value={selectedStateId}
            onChange={(e) => setSelectedStateId(e.target.value)}
            required
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground w-full max-w-sm"
          >
            <option value="">Select a state…</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor="court-types" className="block mb-2 font-semibold">
            Court Types (comma-separated)
          </label>
          <input
            id="court-types"
            type="text"
            value={courtTypesInput}
            onChange={(e) => setCourtTypesInput(e.target.value)}
            placeholder="District Court, County Court, Justice of the Peace Court"
            required
            className="px-3 py-2 border border-input rounded-md bg-background text-foreground placeholder:text-muted-foreground w-full"
          />
          <small className="text-muted-foreground">
            Max 10 court types per request
          </small>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className={
            submitting
              ? "px-6 py-2 bg-btn-primary-disabled text-btn-primary-text border-none rounded-md cursor-not-allowed font-semibold"
              : "px-6 py-2 bg-primary text-btn-primary-text border-none rounded-md cursor-pointer font-semibold hover:bg-primary/90 transition-colors"
          }
        >
          {submitting ? "Creating…" : "Create Courts"}
        </button>
      </form>

      {error && (
        <div
          role="alert"
          className="mt-4 px-4 py-3 bg-error-bg text-error-text rounded-md"
        >
          {error}
        </div>
      )}

      {result && (
        <div className="mt-6">
          <h2 className="mb-3">Results for {result.stateName}</h2>
          <p>
            <strong>{result.courtsCreated}</strong> courts created across{" "}
            <strong>{result.totalCounties}</strong> counties
            {result.courtsSkipped > 0 && (
              <> ({result.courtsSkipped} skipped — already existed)</>
            )}
          </p>

          <div className="overflow-x-auto mt-4">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="p-2">Court Type</th>
                  <th className="p-2">Created</th>
                  <th className="p-2">Skipped</th>
                </tr>
              </thead>
              <tbody>
                {result.details.map((d) => (
                  <tr key={d.courtType} className="border-b border-border">
                    <td className="p-2">{d.courtType}</td>
                    <td className="p-2">{d.created}</td>
                    <td className="p-2">{d.skipped}</td>
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
