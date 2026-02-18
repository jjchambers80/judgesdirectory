"use client";

import { useState } from "react";

const TARGET_FIELDS = [
  { value: "", label: "— Skip —" },
  { value: "fullName", label: "Full Name *" },
  { value: "courtType", label: "Court Type" },
  { value: "countyName", label: "County Name" },
  { value: "stateName", label: "State Name" },
  { value: "sourceUrl", label: "Source URL *" },
  { value: "selectionMethod", label: "Selection Method" },
  { value: "appointingAuthority", label: "Appointing Authority" },
  { value: "education", label: "Education" },
  { value: "priorExperience", label: "Prior Experience" },
  { value: "politicalAffiliation", label: "Political Affiliation" },
];

const REQUIRED_FIELDS = ["fullName", "sourceUrl"];

interface ColumnMapperProps {
  columns: string[];
  initialMapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export default function ColumnMapper({
  columns,
  initialMapping,
  onMappingChange,
}: ColumnMapperProps) {
  const [mapping, setMapping] = useState<Record<string, string>>(initialMapping);

  const handleChange = (csvColumn: string, targetField: string) => {
    const updated = { ...mapping };
    if (targetField === "") {
      delete updated[csvColumn];
    } else {
      updated[csvColumn] = targetField;
    }
    setMapping(updated);
    onMappingChange(updated);
  };

  const mappedValues = Object.values(mapping);
  const missingRequired = REQUIRED_FIELDS.filter(
    (f) => !mappedValues.includes(f),
  );

  return (
    <div>
      <h3 style={{ marginBottom: "0.75rem" }}>Column Mapping</h3>
      <p
        style={{
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
          marginBottom: "1rem",
        }}
      >
        Map CSV columns to judge record fields. Fields marked with * are
        required.
      </p>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr
            style={{
              borderBottom: "2px solid var(--color-border)",
              textAlign: "left",
            }}
          >
            <th style={{ padding: "0.5rem" }}>CSV Column</th>
            <th style={{ padding: "0.5rem" }}>Maps To</th>
            <th style={{ padding: "0.5rem" }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {columns.map((col) => {
            const targetValue = mapping[col] || "";
            const isRequired =
              targetValue && REQUIRED_FIELDS.includes(targetValue);

            return (
              <tr
                key={col}
                style={{ borderBottom: "1px solid var(--color-border)" }}
              >
                <td
                  style={{
                    padding: "0.5rem",
                    fontFamily: "monospace",
                    fontSize: "0.875rem",
                  }}
                >
                  {col}
                </td>
                <td style={{ padding: "0.5rem" }}>
                  <select
                    value={targetValue}
                    onChange={(e) => handleChange(col, e.target.value)}
                    aria-label={`Mapping for ${col}`}
                    style={{
                      padding: "0.375rem 0.5rem",
                      border: "1px solid var(--color-input-border)",
                      borderRadius: "0.25rem",
                      width: "100%",
                      maxWidth: "16rem",
                    }}
                  >
                    {TARGET_FIELDS.map((f) => (
                      <option
                        key={f.value}
                        value={f.value}
                        disabled={
                          f.value !== "" &&
                          f.value !== targetValue &&
                          mappedValues.includes(f.value)
                        }
                      >
                        {f.label}
                        {f.value !== "" &&
                        f.value !== targetValue &&
                        mappedValues.includes(f.value)
                          ? " (already mapped)"
                          : ""}
                      </option>
                    ))}
                  </select>
                </td>
                <td style={{ padding: "0.5rem", fontSize: "0.75rem" }}>
                  {isRequired && (
                    <span
                      style={{
                        color: "var(--color-badge-success-text)",
                        background: "var(--color-badge-success-bg)",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "9999px",
                      }}
                    >
                      Required ✓
                    </span>
                  )}
                  {targetValue && !isRequired && (
                    <span style={{ color: "var(--color-text-muted)" }}>
                      Optional
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {missingRequired.length > 0 && (
        <div
          role="alert"
          style={{
            marginTop: "0.75rem",
            padding: "0.5rem 0.75rem",
            background: "var(--color-badge-warning-bg)",
            color: "var(--color-badge-warning-text)",
            borderRadius: "0.375rem",
            fontSize: "0.875rem",
          }}
        >
          Missing required mappings:{" "}
          <strong>{missingRequired.join(", ")}</strong>
        </div>
      )}
    </div>
  );
}
