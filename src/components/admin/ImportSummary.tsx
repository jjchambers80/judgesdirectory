"use client";

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
      <h3 style={{ marginBottom: "1rem" }}>Import Complete</h3>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "1rem",
          marginBottom: "1.5rem",
        }}
      >
        <StatCard label="Total Processed" value={total} />
        <StatCard
          label="Imported"
          value={result.successCount}
          color="var(--color-badge-success-text)"
        />
        <StatCard
          label="Skipped (Duplicates)"
          value={result.skipCount}
          color="var(--color-badge-warning-text)"
        />
        <StatCard
          label="Errors"
          value={result.errorCount}
          color="var(--color-error-text)"
        />
        {result.courtsCreated > 0 && (
          <StatCard label="Courts Created" value={result.courtsCreated} />
        )}
      </div>

      {result.summary.duplicatesSkipped.length > 0 && (
        <details style={{ marginBottom: "1rem" }}>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Duplicates Skipped ({result.summary.duplicatesSkipped.length})
          </summary>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.875rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.375rem 0.5rem" }}>Row</th>
                <th style={{ padding: "0.375rem 0.5rem" }}>Name</th>
                <th style={{ padding: "0.375rem 0.5rem" }}>Court</th>
              </tr>
            </thead>
            <tbody>
              {result.summary.duplicatesSkipped.map((d) => (
                <tr
                  key={d.row}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.375rem 0.5rem" }}>{d.row}</td>
                  <td style={{ padding: "0.375rem 0.5rem" }}>{d.fullName}</td>
                  <td style={{ padding: "0.375rem 0.5rem" }}>{d.court}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {result.summary.errorsDetail.length > 0 && (
        <details style={{ marginBottom: "1rem" }}>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            Errors ({result.summary.errorsDetail.length})
          </summary>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "0.875rem",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "2px solid var(--color-border)",
                  textAlign: "left",
                }}
              >
                <th style={{ padding: "0.375rem 0.5rem" }}>Row</th>
                <th style={{ padding: "0.375rem 0.5rem" }}>Errors</th>
              </tr>
            </thead>
            <tbody>
              {result.summary.errorsDetail.map((e) => (
                <tr
                  key={e.row}
                  style={{ borderBottom: "1px solid var(--color-border)" }}
                >
                  <td style={{ padding: "0.375rem 0.5rem" }}>{e.row}</td>
                  <td style={{ padding: "0.375rem 0.5rem" }}>
                    {e.errors.join("; ")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}

      {onRollback && (
        <button
          onClick={onRollback}
          disabled={rollingBack}
          style={{
            padding: "0.5rem 1rem",
            border: "1px solid var(--color-input-border-error)",
            borderRadius: "0.375rem",
            background: "var(--color-error-bg)",
            color: "var(--color-error-text)",
            cursor: rollingBack ? "not-allowed" : "pointer",
            fontSize: "0.875rem",
          }}
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
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        padding: "1rem",
        border: "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: color || "inherit",
        }}
      >
        {value.toLocaleString()}
      </div>
      <div
        style={{
          fontSize: "0.75rem",
          color: "var(--color-text-muted)",
          marginTop: "0.25rem",
        }}
      >
        {label}
      </div>
    </div>
  );
}
