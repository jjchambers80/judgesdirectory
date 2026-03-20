"use client";

import { useState, useEffect, useCallback } from "react";

const US_STATES = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

interface StateSummary {
  stateAbbr: string;
  stateName: string;
  candidateCounts: {
    approved: number;
    discovered: number;
    rejected: number;
    total: number;
  };
  lastRun: {
    id: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    candidatesFound: number;
    candidatesNew: number;
  } | null;
  hasActiveRun: boolean;
}

interface DiscoveryRunTriggerProps {
  hasActiveRun: boolean;
  activeRunId: string | null;
  onRunTriggered: (runId: string) => void;
  onRunCancelled: () => void;
}

export function DiscoveryRunTrigger({
  hasActiveRun,
  activeRunId,
  onRunTriggered,
  onRunCancelled,
}: DiscoveryRunTriggerProps) {
  const [selectedState, setSelectedState] = useState("");
  const [summary, setSummary] = useState<StateSummary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const fetchSummary = useCallback(async (abbr: string) => {
    setLoadingSummary(true);
    setSummary(null);
    try {
      const res = await fetch(`/api/admin/discovery/summary/?state=${abbr}`);
      if (res.ok) {
        setSummary(await res.json());
      }
    } finally {
      setLoadingSummary(false);
    }
  }, []);

  useEffect(() => {
    if (selectedState) {
      fetchSummary(selectedState);
    } else {
      setSummary(null);
    }
  }, [selectedState, fetchSummary]);

  const handleTrigger = async () => {
    if (!selectedState || hasActiveRun) return;
    setTriggering(true);
    setMessage(null);

    try {
      const res = await fetch("/api/admin/discovery/runs/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stateAbbr: selectedState }),
      });

      const data = await res.json();

      if (res.status === 201) {
        setMessage({
          type: "success",
          text: `Discovery run started for ${data.state}`,
        });
        onRunTriggered(data.id);
        // Refresh summary
        fetchSummary(selectedState);
      } else if (res.status === 409) {
        setMessage({
          type: "error",
          text: `${data.error}. Active run: ${data.activeRunState}`,
        });
      } else if (res.status === 503) {
        setMessage({ type: "error", text: data.error });
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to start discovery",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Network error — could not reach server",
      });
    } finally {
      setTriggering(false);
    }
  };

  const handleCancel = async () => {
    if (!activeRunId) return;
    setCancelling(true);
    setMessage(null);

    try {
      const res = await fetch(`/api/admin/discovery/runs/${activeRunId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage({ type: "success", text: data.message });
        onRunCancelled();
      } else {
        setMessage({
          type: "error",
          text: data.error || "Failed to cancel run",
        });
      }
    } catch {
      setMessage({
        type: "error",
        text: "Network error — could not reach server",
      });
    } finally {
      setCancelling(false);
    }
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });

  return (
    <div className="rounded-lg border border-border bg-card p-6 space-y-4">
      <h2 className="text-lg font-semibold">Run Discovery</h2>

      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-xs">
          <label
            htmlFor="state-select"
            className="block text-sm font-medium mb-1"
          >
            Select State
          </label>
          <select
            id="state-select"
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
            aria-label="Select a US state for discovery"
          >
            <option value="">Choose a state…</option>
            {US_STATES.map((s) => (
              <option key={s.abbr} value={s.abbr}>
                {s.name} ({s.abbr})
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTrigger}
          disabled={!selectedState || hasActiveRun || triggering}
          className="h-9 px-4 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {triggering ? "Starting…" : "Run Discovery"}
        </button>

        {hasActiveRun && activeRunId && (
          <button
            onClick={handleCancel}
            disabled={cancelling}
            className="h-9 px-4 rounded-md bg-destructive text-destructive-foreground text-sm font-medium hover:bg-destructive/90 disabled:opacity-50"
          >
            {cancelling ? "Cancelling…" : "Cancel Run"}
          </button>
        )}
      </div>

      {/* Message toast */}
      {message && (
        <div
          role="alert"
          className={`text-sm px-3 py-2 rounded-md ${
            message.type === "success"
              ? "bg-green-100 text-green-800"
              : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* State summary card */}
      {loadingSummary && (
        <p className="text-sm text-muted-foreground">Loading state summary…</p>
      )}

      {summary && (
        <div className="rounded-md border border-border bg-muted/50 p-4">
          <h3 className="text-sm font-medium mb-2">
            {summary.stateName} — Candidate Summary
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">Approved</span>
              <p className="font-semibold text-green-700">
                {summary.candidateCounts.approved}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Discovered</span>
              <p className="font-semibold text-blue-700">
                {summary.candidateCounts.discovered}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Rejected</span>
              <p className="font-semibold text-red-700">
                {summary.candidateCounts.rejected}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Total</span>
              <p className="font-semibold">{summary.candidateCounts.total}</p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Last run:{" "}
            {summary.lastRun
              ? `${formatDate(summary.lastRun.startedAt)} — ${summary.lastRun.status} (${summary.lastRun.candidatesFound} found, ${summary.lastRun.candidatesNew} new)`
              : "Never"}
          </p>
        </div>
      )}
    </div>
  );
}
