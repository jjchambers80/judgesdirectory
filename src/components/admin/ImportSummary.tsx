"use client";

import { cn } from "@/lib/utils";

interface ImportResult {
  batchId: string;
  status: string;
  successCount: number;
  skipCount: number;
  errorCount: number;
  courtsCreated: number;
  summary: {
    duplicatesSkipped: Array<{
      row: number;
      fullName: string;
      court: string;
    }>;
    errorsDetail: Array<{
      row: number;
      errors: string[];
    }>;
  };
}

interface ImportSummaryProps {
  result: ImportResult;
  onRollback?: () => void;
  rollingBack?: boolean;
}

export default function ImportSummary({
  result,
  onRollback,
  rollingBack,
}: ImportSummaryProps) {
  const total = result.successCount + result.skipCount + result.errorCount;

  return (
    <div>
      <h3 className="mb-4">Import Complete</h3>

      <div className="grid grid-cols-2 gap-4 mb-6 sm:grid-cols-4">
        <StatCard label="Total Processed" value={total} />
        <StatCard
          label="Imported"
          value={result.successCount}
          colorClass="text-badge-success-text"
        />
        <StatCard
          label="Skipped (Duplicates)"
          value={result.skipCount}
          colorClass="text-badge-warning-text"
        />
        <StatCard
          label="Errors"
          value={result.errorCount}
          colorClass="text-error-text"
        />
        {result.courtsCreated > 0 && (
          <StatCard label="Courts Created" value={result.courtsCreated} />
        )}
      </div>

      {result.summary.duplicatesSkipped.length > 0 && (
        <details className="mb-4">
          <summary className="cursor-pointer font-semibold mb-2">
            Duplicates Skipped ({result.summary.duplicatesSkipped.length})
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="py-1.5 px-2">Row</th>
                  <th className="py-1.5 px-2">Name</th>
                  <th className="py-1.5 px-2">Court</th>
                </tr>
              </thead>
              <tbody>
                {result.summary.duplicatesSkipped.map((d) => (
                  <tr key={d.row} className="border-b border-border">
                    <td className="py-1.5 px-2">{d.row}</td>
                    <td className="py-1.5 px-2">{d.fullName}</td>
                    <td className="py-1.5 px-2">{d.court}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {result.summary.errorsDetail.length > 0 && (
        <details className="mb-4">
          <summary className="cursor-pointer font-semibold mb-2">
            Errors ({result.summary.errorsDetail.length})
          </summary>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-border text-left">
                  <th className="py-1.5 px-2">Row</th>
                  <th className="py-1.5 px-2">Errors</th>
                </tr>
              </thead>
              <tbody>
                {result.summary.errorsDetail.map((e) => (
                  <tr key={e.row} className="border-b border-border">
                    <td className="py-1.5 px-2">{e.row}</td>
                    <td className="py-1.5 px-2">{e.errors.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}

      {onRollback && (
        <button
          onClick={onRollback}
          disabled={rollingBack}
          className={cn(
            "px-4 py-2 border border-error-text rounded-md bg-error-bg text-error-text text-sm",
            rollingBack ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          )}
        >
          {rollingBack ? "Rolling back…" : "Rollback Import"}
        </button>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  colorClass,
}: {
  label: string;
  value: number;
  colorClass?: string;
}) {
  return (
    <div className="p-4 border border-border rounded-lg text-center">
      <div className={cn("text-2xl font-bold", colorClass)}>
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}
