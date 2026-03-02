"use client";

import { useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
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
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1>CSV Import</h1>
        {step !== "select-state" && (
          <button
            onClick={resetFlow}
            className="px-4 py-2 border border-input rounded-md bg-background text-foreground text-sm cursor-pointer hover:bg-muted transition-colors"
          >
            New Import
          </button>
        )}
      </div>

      {/* Step 1: Select State */}
      {step === "select-state" && (
        <div className="mb-8">
          <label
            htmlFor="import-state-select"
            className="block mb-2 font-semibold"
          >
            Select the state for this import
          </label>
          <p className="text-sm text-muted-foreground mb-3">
            All rows in the CSV will be attributed to this state.
          </p>
          <select
            id="import-state-select"
            value=""
            onChange={(e) => handleStateSelect(e.target.value)}
            className="px-3 py-2 border border-input rounded-md w-full max-w-96"
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
        <div className="mb-8">
          <p className="mb-4">
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
        <div className="mb-8">
          <div className="grid grid-cols-2 gap-3 mb-6 sm:grid-cols-4">
            <MiniStat label="Total Rows" value={uploadResult.totalRows} />
            <MiniStat
              label="Valid"
              value={uploadResult.validRows}
              colorClass="text-badge-success-text"
            />
            <MiniStat
              label="Invalid"
              value={uploadResult.invalidRows}
              colorClass="text-error-text"
            />
            <MiniStat
              label="Duplicates"
              value={uploadResult.duplicateRows}
              colorClass="text-badge-warning-text"
            />
          </div>

          {uploadResult.unmatchedCounties.length > 0 && (
            <div
              role="alert"
              className="px-3 py-2 bg-badge-warning-bg text-badge-warning-text rounded-md text-sm mb-4"
            >
              Unmatched counties: {uploadResult.unmatchedCounties.join(", ")}
            </div>
          )}

          {uploadResult.courtsToCreate.length > 0 && (
            <div className="px-3 py-2 bg-secondary rounded-md text-sm mb-4">
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
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold mb-2">
                Preview ({uploadResult.preview.length} rows)
              </summary>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b-2 border-border text-left">
                      <th className="p-1.5">Row</th>
                      <th className="p-1.5">Status</th>
                      <th className="p-1.5">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {uploadResult.preview.map((p) => (
                      <tr key={p.row} className="border-b border-border">
                        <td className="p-1.5">{p.row}</td>
                        <td className="p-1.5">
                          <span
                            className={cn(
                              "inline-block px-1.5 py-0.5 rounded-full text-[0.7rem] font-semibold",
                              p.status === "valid"
                                ? "bg-badge-success-bg text-badge-success-text"
                                : p.status === "invalid"
                                  ? "bg-error-bg text-error-text"
                                  : "bg-badge-warning-bg text-badge-warning-text",
                            )}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="p-1.5 text-xs">
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
              className="mt-4 px-4 py-3 bg-error-bg text-error-text rounded-md"
            >
              {error}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              onClick={handleConfirm}
              disabled={confirming || uploadResult.validRows === 0}
              className={cn(
                "px-6 py-2 border-none rounded-md font-semibold text-btn-primary-text",
                confirming || uploadResult.validRows === 0
                  ? "bg-muted-foreground cursor-not-allowed"
                  : "bg-primary cursor-pointer hover:bg-primary/90",
              )}
            >
              {confirming
                ? "Importing…"
                : `Confirm Import (${uploadResult.validRows} records)`}
            </button>
            <button
              onClick={resetFlow}
              className="px-4 py-2 border border-input rounded-md bg-background text-foreground cursor-pointer hover:bg-muted transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Confirming */}
      {step === "confirming" && (
        <div className="text-center py-8">
          <p>Processing import…</p>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === "complete" && importResult && (
        <div className="mb-8">
          <ImportSummary
            result={importResult}
            onRollback={() => handleRollback(importResult.batchId)}
            rollingBack={rollingBack === importResult.batchId}
          />
        </div>
      )}

      {/* Batch History */}
      <div className="mt-8">
        <h2 className="mb-4">Import History</h2>
        {batches.length === 0 ? (
          <p className="text-muted-foreground">No imports yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="p-2">File</th>
                  <th className="p-2">Rows</th>
                  <th className="p-2">Result</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((b) => (
                  <tr key={b.id} className="border-b border-border">
                    <td className="p-2 text-sm max-w-48 overflow-hidden text-ellipsis whitespace-nowrap">
                      {b.fileName}
                    </td>
                    <td className="p-2 text-sm">{b.totalRows}</td>
                    <td className="p-2 text-xs">
                      {b.successCount} ok / {b.skipCount} skip / {b.errorCount}{" "}
                      err
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
                    <td className="p-2">
                      {b.status === "COMPLETE" && !b.hasVerifiedJudges && (
                        <button
                          onClick={() => handleRollback(b.id)}
                          disabled={rollingBack === b.id}
                          className={cn(
                            "px-2 py-1 border border-error-text rounded bg-error-bg text-error-text text-[0.7rem]",
                            rollingBack === b.id
                              ? "cursor-not-allowed opacity-50"
                              : "cursor-pointer",
                          )}
                        >
                          {rollingBack === b.id ? "…" : "Rollback"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass?: string;
}) {
  return (
    <div className="p-3 border border-border rounded-md text-center">
      <div className={cn("text-xl font-bold", colorClass)}>
        {value.toLocaleString()}
      </div>
      <div className="text-[0.7rem] text-muted-foreground">{label}</div>
    </div>
  );
}
