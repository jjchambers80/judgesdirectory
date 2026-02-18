/**
 * In-memory Promise-based mutex for sequential import processing.
 * Ensures only one import can run at a time (FR-019).
 * ~15 LOC per research.md §3.
 */

let currentImport: Promise<void> | null = null;
let currentBatchId: string | null = null;
let startedAt: Date | null = null;
let currentFileName: string | null = null;

export function isImporting(): boolean {
  return currentImport !== null;
}

export function getImportStatus() {
  return {
    importing: currentImport !== null,
    currentBatchId,
    fileName: currentFileName,
    startedAt: startedAt?.toISOString() ?? null,
  };
}

export async function acquireImportLock(
  batchId: string,
  fileName: string,
): Promise<() => void> {
  if (currentImport) {
    throw new Error("Another import is already in progress");
  }

  let resolve: () => void;
  currentImport = new Promise<void>((r) => {
    resolve = r;
  });
  currentBatchId = batchId;
  currentFileName = fileName;
  startedAt = new Date();

  return () => {
    currentImport = null;
    currentBatchId = null;
    currentFileName = null;
    startedAt = null;
    resolve!();
  };
}
