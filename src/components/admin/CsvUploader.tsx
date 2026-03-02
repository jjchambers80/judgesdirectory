"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import { MAX_FILE_SIZE_BYTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface CsvUploaderProps {
  stateSlug: string;
  onUploadComplete: (data: UploadResult) => void;
  disabled?: boolean;
}

export interface UploadResult {
  batchId: string;
  fileName: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columns: string[];
  columnMapping: Record<string, string>;
  preview: Array<{
    row: number;
    data: Record<string, string>;
    status: "valid" | "invalid" | "duplicate";
    errors?: string[];
    reason?: string;
  }>;
  unmatchedStates: string[];
  unmatchedCounties: string[];
  courtsToCreate: Array<{
    courtType: string;
    countyName: string;
    stateName: string;
  }>;
  csvData: string;
}

export default function CsvUploader({
  stateSlug,
  onUploadComplete,
  disabled,
}: CsvUploaderProps) {
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvDataRef = useRef<string>("");

  const processFile = async (file: File) => {
    setError(null);
    setFileName(file.name);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setError(
        `File exceeds 5 MB limit (${(file.size / 1024 / 1024).toFixed(1)} MB)`,
      );
      return;
    }

    if (!file.name.toLowerCase().endsWith(".csv")) {
      setError("Please upload a CSV file.");
      return;
    }

    setUploading(true);

    try {
      // Read file text for re-sending with confirm
      const csvText = await file.text();
      csvDataRef.current = csvText;

      const formData = new FormData();
      formData.append("file", file);
      formData.append("state", stateSlug);

      const res = await fetch("/api/admin/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Upload failed");
        return;
      }

      onUploadComplete({ ...data, csvData: csvText });
    } catch {
      setError("Network error — please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        aria-label="Upload CSV file"
        className={cn(
          "p-8 border-2 border-dashed rounded-lg text-center transition-[border-color,background] duration-200",
          dragging ? "border-link bg-secondary" : "border-input bg-transparent",
          disabled || uploading
            ? "cursor-not-allowed opacity-60"
            : "cursor-pointer",
        )}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          disabled={disabled || uploading}
          className="hidden"
          aria-hidden="true"
        />

        {uploading ? (
          <p>Uploading and parsing {fileName}…</p>
        ) : (
          <>
            <p className="font-semibold mb-2">
              Drop a CSV file here or click to browse
            </p>
            <p className="text-sm text-muted-foreground">
              Maximum file size: 5 MB · Maximum rows: 10,000
            </p>
          </>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-3 px-4 py-3 bg-error-bg text-error-text rounded-md text-sm"
        >
          {error}
        </div>
      )}
    </div>
  );
}
