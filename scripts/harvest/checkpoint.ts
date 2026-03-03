/**
 * Checkpoint management for resumable harvesting.
 *
 * Saves progress to a JSON file after each successfully processed URL so
 * interrupted runs can resume without re-fetching.  Uses atomic writes
 * (write .tmp → rename) to prevent corruption on unexpected termination.
 *
 * Supports per-state checkpoint paths: output/{state-slug}/checkpoints/
 *
 * @module scripts/harvest/checkpoint
 */

import fs from "node:fs";
import path from "node:path";
import type { Checkpoint } from "./config";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CHECKPOINT_FILENAME = "harvest-checkpoint.json";
const CHECKPOINTS_DIR = "checkpoints";

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Load an existing checkpoint or return a fresh one.
 *
 * @param outputDir Base output directory
 * @param stateSlug Optional state slug for per-state checkpoint paths
 */
export function loadCheckpoint(
  outputDir: string,
  stateSlug?: string,
): Checkpoint {
  const filePath = checkpointPath(outputDir, stateSlug);

  if (!fs.existsSync(filePath)) {
    return freshCheckpoint();
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data: Checkpoint = JSON.parse(raw);
    console.log(
      `Loaded checkpoint: ${data.completedUrls.length} URL(s) completed, ` +
        `${data.totalJudges} judge(s) found so far`,
    );
    return data;
  } catch (err) {
    console.warn(
      "Checkpoint file is corrupted — starting fresh:",
      err instanceof Error ? err.message : err,
    );
    return freshCheckpoint();
  }
}

/**
 * Persist checkpoint to disk using atomic write (tmp + rename).
 *
 * @param outputDir Base output directory
 * @param data Checkpoint data to persist
 * @param stateSlug Optional state slug for per-state checkpoint paths
 */
export function saveCheckpoint(
  outputDir: string,
  data: Checkpoint,
  stateSlug?: string,
): void {
  const filePath = checkpointPath(outputDir, stateSlug);
  const dir = path.dirname(filePath);

  // Ensure directory exists
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const tmpPath = filePath + ".tmp";
  const json = JSON.stringify(data, null, 2);

  fs.writeFileSync(tmpPath, json, "utf-8");
  fs.renameSync(tmpPath, filePath);
}

/**
 * Delete the checkpoint file so the next run starts fresh.
 *
 * @param outputDir Base output directory
 * @param stateSlug Optional state slug for per-state checkpoint paths
 */
export function resetCheckpoint(outputDir: string, stateSlug?: string): void {
  const filePath = checkpointPath(outputDir, stateSlug);

  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    console.log("Checkpoint cleared — will start fresh");
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function checkpointPath(outputDir: string, stateSlug?: string): string {
  if (stateSlug) {
    return path.join(
      outputDir,
      stateSlug,
      CHECKPOINTS_DIR,
      CHECKPOINT_FILENAME,
    );
  }
  return path.join(outputDir, CHECKPOINTS_DIR, CHECKPOINT_FILENAME);
}

function freshCheckpoint(): Checkpoint {
  return {
    startedAt: new Date().toISOString(),
    lastUpdated: new Date().toISOString(),
    completedUrls: [],
    results: {},
    totalJudges: 0,
  };
}
