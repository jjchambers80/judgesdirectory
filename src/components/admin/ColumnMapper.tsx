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
  const [mapping, setMapping] =
    useState<Record<string, string>>(initialMapping);

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
      <h3 className="mb-3">Column Mapping</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Map CSV columns to judge record fields. Fields marked with * are
        required.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-border text-left">
              <th className="p-2">CSV Column</th>
              <th className="p-2">Maps To</th>
              <th className="p-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {columns.map((col) => {
              const targetValue = mapping[col] || "";
              const isRequired =
                targetValue && REQUIRED_FIELDS.includes(targetValue);

              return (
                <tr key={col} className="border-b border-border">
                  <td className="p-2 font-mono text-sm">{col}</td>
                  <td className="p-2">
                    <select
                      value={targetValue}
                      onChange={(e) => handleChange(col, e.target.value)}
                      aria-label={`Mapping for ${col}`}
                      className="px-2 py-1.5 border border-input rounded w-full max-w-64"
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
                  <td className="p-2 text-xs">
                    {isRequired && (
                      <span className="text-badge-success-text bg-badge-success-bg px-1.5 py-0.5 rounded-full">
                        Required ✓
                      </span>
                    )}
                    {targetValue && !isRequired && (
                      <span className="text-muted-foreground">Optional</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingRequired.length > 0 && (
        <div
          role="alert"
          className="mt-3 px-3 py-2 bg-badge-warning-bg text-badge-warning-text rounded-md text-sm"
        >
          Missing required mappings:{" "}
          <strong>{missingRequired.join(", ")}</strong>
        </div>
      )}
    </div>
  );
}
