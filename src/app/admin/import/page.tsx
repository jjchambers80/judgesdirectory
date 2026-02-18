"use client";

import { useState, useEffect, useCallback } from "react";
import CsvUploader, { UploadResult } from "@/components/admin/CsvUploader";
import ColumnMapper from "@/components/admin/ColumnMapper";
import ImportSummary from "@/components/admin/ImportSummary";

type Step = "select-state" | "upload" | "preview" | "confirming" | "complete";

interface StateOption {
  id: string;
  name: string;
  slug: string;
}

interface BatchRecord {
  id: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  skipCount: number;
  errorCount: number;
  status: string;
  hasVerifiedJudges: boolean;
  createdAt: string;
}

interface ImportResult {
  batchId: string;
  status: string;
  successCount: number;
  skipCount: number;
  errorCount: number;
  courtsCreated: number;
  summary: {
    duplicatesSkipped: Array<{ row: number; fullName: string; court: string }>;
    errorsDetail: Array<{ row: number; errors: string[] }>;
  };
}

export default function AdminImportPage() {
  const [step, setStep] = useState<Step>("select-state");
  const [states, setStates] = useState<StateOption[]>([]);
  const [selectedState, setSelectedState] = useState<StateOption | null>(null);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>(
    {},
  );
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [batches, setBatches] = useState<BatchRecord[]>([]);
  const [rollingBack, setRollingBack] = useState<string | null>(null);

  // Fetch states on mount
  useEffect(() => {
    fetch("/api/admin/states")
      .then((r) => r.json())
      .then((data) => setStates(data.states || []))
      .catch(() => {});
  }, []);

  const fetchBatches = useCallback(() => {
    fetch("/api/admin/import?limit=20")
      .then((r) => r.json())
      .then((data) => setBatches(data.batches || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  const handleStateSelect = (stateId: string) => {
    const state = states.find((s) => s.id === stateId);
    if (state) {
      setSelectedState(state);
      setStep("upload");
    }
  };

  const handleUploadComplete = (data: UploadResult) => {
    setUploadResult(data);
    setColumnMapping(data.columnMapping);
    setStep("preview");
  };

  const handleConfirm = async () => {
    if (!uploadResult || !selectedState) return;

    setConfirming(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/import/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: uploadResult.batchId,
          columnMapping,
          state: selectedState.slug,
          csvData: uploadResult.csvData,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Import failed");
        setConfirming(false);
        return;
      }

      setImportResult(data);
      setStep("complete");
      fetchBatches();
    } catch {
      setError("Network error — please try again.");
    } finally {
      setConfirming(false);
    }
  };

  const handleRollback = async (batchId: string) => {
    if (
      !confirm(
        "Are you sure you want to rollback this import? All imported judge records will be deleted.",
      )
    )
      return;

    setRollingBack(batchId);

    try {
      const res = await fetch(`/api/admin/import/${batchId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Rollback failed");
        return;
      }

      fetchBatches();
      if (importResult?.batchId === batchId) {
        resetFlow();
      }
    } catch {
      alert("Network error");
    } finally {
      setRollingBack(null);
    }
  };

  const resetFlow = () => {
    setStep("select-state");
    setSelectedState(null);
    setUploadResult(null);
    setColumnMapping({});
    setImportResult(null);
    setError(null);
  };

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
        }}
      >
        <h1>CSV Import</h1>
        {step !== "select-state" && (
          <button
            onClick={resetFlow}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--color-input-border)",
              borderRadius: "0.375rem",
              background: "var(--color-bg-primary)",
              color: "var(--color-text-primary)",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            New Import
          </button>
        )}
      </div>

      {/* Step 1: Select State */}
      {step === "select-state" && (
        <div style={{ marginBottom: "2rem" }}>
          <label
            htmlFor="import-state-select"
            style={{
              display: "block",
              marginBottom: "0.5rem",
              fontWeight: 600,
            }}
          >
            Select the state for this import
          </label>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-muted)",
              marginBottom: "0.75rem",
            }}
          >
            All rows in the CSV will be attributed to this state.
          </p>
          <select
            id="import-state-select"
            value=""
            onChange={(e) => handleStateSelect(e.target.value)}
            style={{
              padding: "0.5rem 0.75rem",
              border: "1px solid var(--color-input-border)",
              borderRadius: "0.375rem",
              width: "100%",
              maxWidth: "24rem",
            }}
          >
            <option value="">Choose a state…</option>
            {states.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Step 2: Upload CSV */}
      {step === "upload" && selectedState && (
        <div style={{ marginBottom: "2rem" }}>
          <p style={{ marginBottom: "1rem" }}>
            Importing judges for <strong>{selectedState.name}</strong>
          </p>
          <CsvUploader
            stateSlug={selectedState.slug}
            onUploadComplete={handleUploadComplete}
          />
        </div>
      )}

      {/* Step 3: Preview & Map Columns */}
      {step === "preview" && uploadResult && (
        <div style={{ marginBottom: "2rem" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.5rem",
            }}
          >
            <MiniStat label="Total Rows" value={uploadResult.totalRows} />
            <MiniStat
              label="Valid"
              value={uploadResult.validRows}
              color="var(--color-badge-success-text)"
            />
            <MiniStat
              label="Invalid"
              value={uploadResult.invalidRows}
              color="var(--color-error-text)"
            />
            <MiniStat
              label="Duplicates"
              value={uploadResult.duplicateRows}
              color="var(--color-badge-warning-text)"
            />
          </div>

          {uploadResult.unmatchedCounties.length > 0 && (
            <div
              role="alert"
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--color-badge-warning-bg)",
                color: "var(--color-badge-warning-text)",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            >
              Unmatched counties: {uploadResult.unmatchedCounties.join(", ")}
            </div>
          )}

          {uploadResult.courtsToCreate.length > 0 && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                background: "var(--color-bg-secondary)",
                borderRadius: "0.375rem",
                fontSize: "0.875rem",
                marginBottom: "1rem",
              }}
            >
              {uploadResult.courtsToCreate.length} court(s) will be auto-created
              during import.
            </div>
          )}

          <ColumnMapper
            columns={uploadResult.columns}
            initialMapping={uploadResult.columnMapping}
            onMappingChange={setColumnMapping}
          />

          {/* Preview table */}
          {uploadResult.preview.length > 0 && (
            <details style={{ marginTop: "1rem" }}>
              <summary
                style={{
                  cursor: "pointer",
                  fontWeight: 600,
                  marginBottom: "0.5rem",
                }}
              >
                Preview ({uploadResult.preview.length} rows)
              </summary>
              <div style={{ overflowX: "auto" }}>
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: "0.8rem",
                  }}
                >
                  <thead>
                    <tr
                      style={{
                        borderBottom: "2px solid var(--color-border)",
                        textAlign: "left",
                      }}
                    >
                      <th style={{ padding: "0.375rem" }}>Row</th>
                      <th style={{ padding: "0.375rem" }}>Status</th>
                      <th style={{ padding: "0.375rem" }}>Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.preview.map((p) => (
                      <tr
                        key={p.row}
                        style={{
                          borderBottom: "1px solid var(--color-border)",
                        }}
                      >
                        <td style={{ padding: "0.375rem" }}>{p.row}</td>
                        <td style={{ padding: "0.375rem" }}>
                          <span
                            style={{
                              padding: "0.125rem 0.375rem",
                              borderRadius: "9999px",
                              fontSize: "0.7rem",
                              fontWeight: 600,
                              background:
                                p.status === "valid"
                                  ? "var(--color-badge-success-bg)"
                                  : p.status === "invalid"
                                    ? "var(--color-error-bg)"
                                    : "var(--color-badge-warning-bg)",
                              color:
                                p.status === "valid"
                                  ? "var(--color-badge-success-text)"
                                  : p.status === "invalid"
                                    ? "var(--color-error-text)"
                                    : "var(--color-badge-warning-text)",
                            }}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.375rem",
                            fontSize: "0.75rem",
                          }}
                        >
                          {p.errors && p.errors.join("; ")}
                          {p.reason}
                          {p.status === "valid" && p.data.fullName}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}

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

          <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem" }}>
            <button
              onClick={handleConfirm}
              disabled={confirming || uploadResult.validRows === 0}
              style={{
                padding: "0.5rem 1.5rem",
                background:
                  confirming || uploadResult.validRows === 0
                    ? "var(--color-text-muted)"
                    : "var(--color-btn-primary)",
                color: "var(--color-btn-primary-text)",
                border: "none",
                borderRadius: "0.375rem",
                cursor:
                  confirming || uploadResult.validRows === 0
                    ? "not-allowed"
                    : "pointer",
                fontWeight: 600,
              }}
            >
              {confirming
                ? "Importing…"
                : `Confirm Import (${uploadResult.validRows} records)`}
            </button>
            <button
              onClick={resetFlow}
              style={{
                padding: "0.5rem 1rem",
                border: "1px solid var(--color-input-border)",
                borderRadius: "0.375rem",
                background: "var(--color-bg-primary)",
                color: "var(--color-text-primary)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirming */}
      {step === "confirming" && (
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <p>Processing import…</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === "complete" && importResult && (
        <div style={{ marginBottom: "2rem" }}>
          <ImportSummary
            result={importResult}
            onRollback={() => handleRollback(importResult.batchId)}
            rollingBack={rollingBack === importResult.batchId}
          />
        </div>
      )}

      {/* Batch History */}
      <div style={{ marginTop: "2rem" }}>
        <h2 style={{ marginBottom: "1rem" }}>Import History</h2>
        {batches.length === 0 ? (
          <p style={{ color: "var(--color-text-muted)" }}>No imports yet.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.5rem" }}>File</th>
                <th style={{ padding: "0.5rem" }}>Rows</th>
                <th style={{ padding: "0.5rem" }}>Result</th>
                <th style={{ padding: "0.5rem" }}>Status</th>
                <th style={{ padding: "0.5rem" }}>Date</th>
                <th style={{ padding: "0.5rem" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr
                  key={b.id}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td
                    style={{
                      padding: "0.5rem",
                      fontSize: "0.875rem",
                      maxWidth: "12rem",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {b.fileName}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.875rem" }}>
                    {b.totalRows}
                  </td>
                  <td style={{ padding: "0.5rem", fontSize: "0.75rem" }}>
                    {b.successCount} ok / {b.skipCount} skip / {b.errorCount}{" "}
                    err
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
                  <td style={{ padding: "0.5rem" }}>
                    {b.status === "COMPLETE" && !b.hasVerifiedJudges && (
                      <button
                        onClick={() => handleRollback(b.id)}
                        disabled={rollingBack === b.id}
                        style={{
                          padding: "0.25rem 0.5rem",
                          border: "1px solid var(--color-input-border-error)",
                          borderRadius: "0.25rem",
                          background: "var(--color-error-bg)",
                          color: "var(--color-error-text)",
                          cursor:
                            rollingBack === b.id ? "not-allowed" : "pointer",
                          fontSize: "0.7rem",
                        }}
                      >
                        {rollingBack === b.id ? "…" : "Rollback"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function MiniStat({
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
        padding: "0.75rem",
        border: "1px solid var(--color-border)",
        borderRadius: "0.375rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "1.25rem",
          fontWeight: 700,
          color: color || "inherit",
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--color-text-muted)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
