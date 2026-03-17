#!/usr/bin/env ts-node
/**
 * Re-Score Judges — recalculates confidence scores and promotes eligible
 * UNVERIFIED / flag-cleared NEEDS_REVIEW judges using the new
 * source-authority-aware confidence formula.
 *
 * Usage:
 *   npx tsx scripts/maintenance/rescore-judges.ts [options]
 *
 * Options:
 *   --dry-run       Preview impact without database changes (default)
 *   --apply         Apply changes to database
 *   --batch-size N  Records per transaction batch (default: 100)
 *   --state XX      Limit to judges in a specific state (2-letter abbreviation)
 *
 * @module scripts/maintenance/rescore-judges
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import { PrismaClient, SourceAuthority } from "@prisma/client";
import path from "node:path";
import fs from "node:fs";
import {
  classifySourceAuthority,
  buildStateConfigsMap,
} from "../harvest/source-classifier";
import type { CourtEntry } from "../harvest/state-config-schema";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// CLI flag parsing (T012)
// ---------------------------------------------------------------------------

interface RescoreFlags {
  dryRun: boolean;
  apply: boolean;
  batchSize: number;
  state: string | null;
}

function parseFlags(): RescoreFlags {
  const args = process.argv.slice(2);
  const flags: RescoreFlags = {
    dryRun: false,
    apply: false,
    batchSize: 100,
    state: null,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--apply":
        flags.apply = true;
        break;
      case "--batch-size":
        flags.batchSize = parseInt(args[++i], 10);
        if (isNaN(flags.batchSize) || flags.batchSize < 1) {
          console.error("Error: --batch-size must be a positive integer");
          process.exit(1);
        }
        break;
      case "--state":
        flags.state = args[++i]?.toUpperCase() || null;
        if (flags.state && !/^[A-Z]{2}$/.test(flags.state)) {
          console.error("Error: --state must be a 2-letter abbreviation");
          process.exit(1);
        }
        break;
    }
  }

  // Mutually exclusive: if neither specified, default to dry-run
  if (flags.dryRun && flags.apply) {
    console.error("Error: --dry-run and --apply are mutually exclusive");
    process.exit(1);
  }
  if (!flags.dryRun && !flags.apply) {
    flags.dryRun = true;
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Source authority bases and thresholds (per data-model.md)
// ---------------------------------------------------------------------------

const SOURCE_AUTHORITY_BASES: Record<string, number> = {
  OFFICIAL_GOV: 0.65,
  COURT_WEBSITE: 0.55,
  ELECTION_RECORDS: 0.55,
  SECONDARY: 0.45,
};

const SOURCE_THRESHOLDS: Record<string, number> = {
  OFFICIAL_GOV: 0.70,
  COURT_WEBSITE: 0.75,
  ELECTION_RECORDS: 0.75,
  SECONDARY: 0.80,
};

const DEFAULT_THRESHOLD = 0.80;
const CONFIDENCE_CAP = 0.95;

// ---------------------------------------------------------------------------
// Load state configs for classification
// ---------------------------------------------------------------------------

function loadAllStateConfigs(): Map<string, CourtEntry[]> {
  const harvestDir = path.resolve(__dirname, "../harvest");
  const files = fs.readdirSync(harvestDir).filter((f) => f.endsWith("-courts.json"));

  const configs: Array<{ slug: string; courts: CourtEntry[] }> = [];
  for (const file of files) {
    const slug = file.replace("-courts.json", "");
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(harvestDir, file), "utf-8"));
      if (raw.courts && Array.isArray(raw.courts)) {
        configs.push({ slug, courts: raw.courts });
      }
    } catch {
      // Skip invalid config files
    }
  }

  return buildStateConfigsMap(configs);
}

// ---------------------------------------------------------------------------
// Bio field counting — proxy for enrichment level on existing records
// ---------------------------------------------------------------------------

const BIO_FIELDS = [
  "photoUrl",
  "termStart",
  "termEnd",
  "appointingAuthority",
  "education",
  "priorExperience",
  "courthouseAddress",
  "courthousePhone",
] as const;

function countPopulatedBioFields(judge: Record<string, unknown>): number {
  let count = 0;
  for (const field of BIO_FIELDS) {
    const val = judge[field];
    if (val !== null && val !== undefined && val !== "") {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// Candidate query (T013)
// ---------------------------------------------------------------------------

async function fetchCandidates(flags: RescoreFlags) {
  // Status IN (UNVERIFIED, NEEDS_REVIEW)
  // For NEEDS_REVIEW, only include if anomalyFlags is empty (cleared flags)
  const stateFilter = flags.state
    ? {
        court: {
          county: {
            state: {
              abbreviation: flags.state,
            },
          },
        },
      }
    : {};

  const candidates = await prisma.judge.findMany({
    where: {
      OR: [
        { status: "UNVERIFIED", ...stateFilter },
        { status: "NEEDS_REVIEW", anomalyFlags: { isEmpty: true }, ...stateFilter },
      ],
    },
    select: {
      id: true,
      sourceUrl: true,
      extractionMethod: true,
      confidenceScore: true,
      status: true,
      anomalyFlags: true,
      photoUrl: true,
      termStart: true,
      termEnd: true,
      appointingAuthority: true,
      education: true,
      priorExperience: true,
      courthouseAddress: true,
      courthousePhone: true,
      court: {
        select: {
          county: {
            select: {
              state: {
                select: { abbreviation: true },
              },
            },
          },
        },
      },
    },
  });

  return candidates;
}

// ---------------------------------------------------------------------------
// Compute new confidence score
// ---------------------------------------------------------------------------

function computeNewConfidence(
  sourceAuthority: SourceAuthority,
  extractionMethod: string | null,
  bioFieldCount: number,
): number {
  const base = SOURCE_AUTHORITY_BASES[sourceAuthority] ?? 0.45;
  // No extraction bonus for existing records with null extractionMethod
  const extractionBonus = extractionMethod === "deterministic" ? 0.10 : 0;
  return Math.min(CONFIDENCE_CAP, base + extractionBonus + bioFieldCount * 0.05);
}

// ---------------------------------------------------------------------------
// Dry-run summary (T014)
// ---------------------------------------------------------------------------

interface RescoreResult {
  id: string;
  sourceAuthority: SourceAuthority;
  oldScore: number;
  newScore: number;
  wouldPromote: boolean;
  status: string;
  stateAbbr: string;
}

async function dryRun(flags: RescoreFlags): Promise<void> {
  console.log("Re-Scoring Preview (DRY RUN)");
  console.log("=============================");
  if (flags.state) console.log(`State: ${flags.state}`);

  const stateConfigs = loadAllStateConfigs();
  const candidates = await fetchCandidates(flags);

  console.log(`Total candidates: ${candidates.length}`);
  const unverifiedCount = candidates.filter((c) => c.status === "UNVERIFIED").length;
  const needsReviewCount = candidates.filter((c) => c.status === "NEEDS_REVIEW").length;
  console.log(`  UNVERIFIED: ${unverifiedCount}`);
  console.log(`  NEEDS_REVIEW (flags cleared): ${needsReviewCount}`);
  console.log("");

  const results: RescoreResult[] = [];

  for (const candidate of candidates) {
    const sourceAuthority = classifySourceAuthority(candidate.sourceUrl, stateConfigs);
    const bioFieldCount = countPopulatedBioFields(candidate as unknown as Record<string, unknown>);
    const newScore = computeNewConfidence(sourceAuthority, candidate.extractionMethod, bioFieldCount);
    const threshold = SOURCE_THRESHOLDS[sourceAuthority] ?? DEFAULT_THRESHOLD;
    const wouldPromote = newScore >= threshold;
    const stateAbbr = candidate.court.county.state.abbreviation;

    results.push({
      id: candidate.id,
      sourceAuthority,
      oldScore: candidate.confidenceScore ?? 0,
      newScore,
      wouldPromote,
      status: candidate.status,
      stateAbbr,
    });
  }

  // Summary by source authority
  const byAuthority: Record<string, { total: number; promote: number }> = {};
  for (const r of results) {
    if (!byAuthority[r.sourceAuthority]) {
      byAuthority[r.sourceAuthority] = { total: 0, promote: 0 };
    }
    byAuthority[r.sourceAuthority].total++;
    if (r.wouldPromote) byAuthority[r.sourceAuthority].promote++;
  }

  console.log("Would promote by source authority:");
  for (const [authority, counts] of Object.entries(byAuthority)) {
    const pct = counts.total > 0 ? ((counts.promote / counts.total) * 100).toFixed(1) : "0.0";
    console.log(
      `  ${authority.padEnd(16)} ${String(counts.promote).padStart(5)} of ${String(counts.total).padStart(5)} (${pct}%)`,
    );
  }

  // Summary by state
  const byState: Record<string, { total: number; promote: number }> = {};
  for (const r of results) {
    if (!byState[r.stateAbbr]) {
      byState[r.stateAbbr] = { total: 0, promote: 0 };
    }
    byState[r.stateAbbr].total++;
    if (r.wouldPromote) byState[r.stateAbbr].promote++;
  }

  if (Object.keys(byState).length > 1) {
    console.log("\nWould promote by state:");
    for (const [state, counts] of Object.entries(byState).sort(([a], [b]) => a.localeCompare(b))) {
      const pct = counts.total > 0 ? ((counts.promote / counts.total) * 100).toFixed(1) : "0.0";
      console.log(
        `  ${state.padEnd(4)} ${String(counts.promote).padStart(5)} of ${String(counts.total).padStart(5)} (${pct}%)`,
      );
    }
  }

  const totalPromote = results.filter((r) => r.wouldPromote).length;
  const totalPct = candidates.length > 0 ? ((totalPromote / candidates.length) * 100).toFixed(1) : "0.0";
  console.log(`\nTotal would promote: ${totalPromote} of ${candidates.length} (${totalPct}%)`);
  console.log("No database changes made.");
}

// ---------------------------------------------------------------------------
// Apply mode with batched transactions (T015)
// ---------------------------------------------------------------------------

async function applyChanges(flags: RescoreFlags): Promise<void> {
  console.log("Re-Scoring (APPLY MODE)");
  console.log("========================");
  if (flags.state) console.log(`State: ${flags.state}`);

  const stateConfigs = loadAllStateConfigs();
  const candidates = await fetchCandidates(flags);

  console.log(`Total candidates: ${candidates.length}`);
  if (candidates.length === 0) {
    console.log("No candidates to process.");
    return;
  }

  const batchSize = flags.batchSize;
  const totalBatches = Math.ceil(candidates.length / batchSize);
  let totalPromoted = 0;
  let totalSkipped = 0;
  const startTime = Date.now();

  for (let i = 0; i < totalBatches; i++) {
    const batch = candidates.slice(i * batchSize, (i + 1) * batchSize);
    let batchPromoted = 0;
    let batchSkipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const candidate of batch) {
        const sourceAuthority = classifySourceAuthority(candidate.sourceUrl, stateConfigs);
        const bioFieldCount = countPopulatedBioFields(candidate as unknown as Record<string, unknown>);
        const newScore = computeNewConfidence(sourceAuthority, candidate.extractionMethod, bioFieldCount);
        const threshold = SOURCE_THRESHOLDS[sourceAuthority] ?? DEFAULT_THRESHOLD;
        const shouldPromote = newScore >= threshold;

        if (shouldPromote) {
          await tx.judge.update({
            where: { id: candidate.id },
            data: {
              status: "VERIFIED",
              confidenceScore: newScore,
              sourceAuthority,
              autoVerified: true,
              verifiedAt: new Date(),
            },
          });
          batchPromoted++;
        } else {
          // Update score and sourceAuthority even if not promoting
          await tx.judge.update({
            where: { id: candidate.id },
            data: {
              confidenceScore: newScore,
              sourceAuthority,
            },
          });
          batchSkipped++;
        }
      }
    });

    totalPromoted += batchPromoted;
    totalSkipped += batchSkipped;
    console.log(
      `Processing batch ${i + 1}/${totalBatches} (${batch.length} records)...`,
    );
    console.log(`  Promoted: ${batchPromoted} | Skipped: ${batchSkipped}`);
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const remained = {
    unverified: candidates.filter((c) => c.status === "UNVERIFIED").length - totalPromoted,
    needsReview: candidates.filter((c) => c.status === "NEEDS_REVIEW").length,
  };

  console.log("\nSummary:");
  console.log(`  Total processed: ${candidates.length}`);
  console.log(`  Promoted to VERIFIED: ${totalPromoted}`);
  console.log(`  Remained UNVERIFIED: ${Math.max(0, remained.unverified)}`);
  console.log(`  Remained NEEDS_REVIEW: ${remained.needsReview}`);
  console.log(`  Duration: ${duration}s`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseFlags();

  if (flags.apply) {
    await applyChanges(flags);
  } else {
    await dryRun(flags);
  }
}

main()
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
