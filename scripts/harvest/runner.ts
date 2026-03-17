#!/usr/bin/env ts-node
/**
 * Harvest Runner — core pipeline logic extracted from index.ts.
 *
 * Accepts --job-id and --state CLI args.
 * Manages HarvestJob lifecycle: QUEUED → RUNNING → COMPLETED/FAILED.
 * Integrates checkpoint.ts for resumable runs.
 *
 * Orchestrates: db-config-loader → fetcher → extractor → enrichers →
 * normalizer → deduplicator → db-writer
 *
 * @module scripts/harvest/runner
 */

// Load .env from project root
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { loadUrlsFromDb, type DbUrlConfig } from "./db-config-loader";
import { writeJudgesToDb, disconnect as disconnectWriter } from "./db-writer";
import {
  parseFlags,
  validateEnv,
  type CliFlags,
  type EnrichedJudgeRecord,
  type CourtUrlEntry,
  type Checkpoint,
} from "./config";
import { loadCheckpoint, saveCheckpoint, resetCheckpoint } from "./checkpoint";
import { fetchPage } from "./fetcher";
import { extractJudges } from "./extractor";
import { enrichWithBioPages } from "./bio-enricher";
import { enrichAllWithBallotpedia } from "./ballotpedia-enricher";
import { enrichAllWithExa } from "./exa-enricher";
import { normalizeJudgeName, canonicalizeCourtType } from "./normalizer";
import { deduplicateEnrichedJudges } from "./deduplicator";
import { generateEnrichedReport, type EnrichedReportStats } from "./reporter";
import {
  getLLMConfig,
  validateLLMConfig,
  describeLLMConfig,
} from "./llm-provider";
import {
  classifyFailure,
  recordFailure,
  resolveFailuresForUrl,
} from "./failure-tracker";
import { recordScrape } from "./health-recorder";
import { classifySourceAuthority } from "./source-classifier";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// File-based logging (copied from index.ts)
// ---------------------------------------------------------------------------

let logStream: fs.WriteStream | null = null;

function setupLogging(outputDir: string, slug?: string): void {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const prefix = slug || "harvest";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const logPath = path.join(outputDir, `${prefix}-harvest-${timestamp}.log`);
  logStream = fs.createWriteStream(logPath, { flags: "a" });

  const origLog = console.log;
  const origWarn = console.warn;
  const origError = console.error;

  console.log = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origLog(...args);
    writeLog("INFO", msg);
  };
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origWarn(...args);
    writeLog("WARN", msg);
  };
  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    origError(...args);
    writeLog("ERROR", msg);
  };
}

function writeLog(level: string, message: string): void {
  if (!logStream) return;
  const ts = new Date().toISOString();
  logStream.write(`[${ts}] [${level}] ${message}\n`);
}

function closeLogging(): void {
  if (logStream) {
    logStream.end();
    logStream = null;
  }
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface RunnerArgs {
  jobId: string | null;
  state: string | null;
  resume: boolean;
}

function parseRunnerArgs(argv: string[] = process.argv.slice(2)): RunnerArgs {
  const args: RunnerArgs = { jobId: null, state: null, resume: true };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--job-id":
        args.jobId = argv[++i];
        break;
      case "--state":
        args.state = argv[++i];
        break;
      case "--resume":
        args.resume = true;
        break;
      case "--reset":
        args.resume = false;
        break;
    }
  }

  return args;
}

// ---------------------------------------------------------------------------
// Convert DbUrlConfig to CourtUrlEntry for pipeline compatibility
// ---------------------------------------------------------------------------

function toCourtUrlEntry(dbUrl: DbUrlConfig): CourtUrlEntry {
  const hints = dbUrl.extractionHints as Record<string, unknown> | null;
  return {
    url: dbUrl.url,
    courtType: dbUrl.suggestedType || "Unknown Court",
    level: (dbUrl.suggestedLevel || "trial") as string,
    counties: [],
    label: `${dbUrl.suggestedType || "Court"} (${dbUrl.domain})`,
    fetchMethod: (dbUrl.fetchMethod || "http") as "http" | "browser" | "manual",
    deterministic: hints?.pattern ? true : false,
    selectorHint: hints?.selector ? String(hints.selector) : null,
  };
}

// ---------------------------------------------------------------------------
// Record expansion (same as index.ts)
// ---------------------------------------------------------------------------

function expandEnrichedRecords(
  records: EnrichedJudgeRecord[],
  entry: CourtUrlEntry,
  stateAbbreviation?: string,
): EnrichedJudgeRecord[] {
  const expanded: EnrichedJudgeRecord[] = [];
  const isAppellateOrSupreme =
    entry.level === "supreme" || entry.level === "appellate";

  for (const record of records) {
    const normalizedName = normalizeJudgeName(record.fullName);
    const courtType = canonicalizeCourtType(
      record.courtType,
      stateAbbreviation,
    );
    const baseRecord: EnrichedJudgeRecord = {
      ...record,
      fullName: normalizedName,
      courtType,
    };

    if (record.county || isAppellateOrSupreme || entry.deterministic) {
      expanded.push(baseRecord);
    } else if (entry.counties.length > 0) {
      for (const county of entry.counties) {
        expanded.push({ ...baseRecord, county });
      }
    } else {
      expanded.push(baseRecord);
    }
  }

  return expanded;
}

// ---------------------------------------------------------------------------
// Checkpoint helper
// ---------------------------------------------------------------------------

function updateCheckpoint(
  checkpoint: Checkpoint,
  url: string,
  judgesFound: number,
  errors: string[],
  outputDir: string,
  stateSlug?: string,
): void {
  if (!checkpoint.completedUrls.includes(url)) {
    checkpoint.completedUrls.push(url);
  }
  checkpoint.results[url] = { url, judgesFound, errors };
  checkpoint.totalJudges += judgesFound;
  checkpoint.lastUpdated = new Date().toISOString();
  saveCheckpoint(outputDir, checkpoint, stateSlug);
}

// ---------------------------------------------------------------------------
// Progress update (every N URLs)
// ---------------------------------------------------------------------------

const PROGRESS_INTERVAL = 5;

async function updateJobProgress(
  jobId: string,
  urlsProcessed: number,
  judgesFound: number,
  judgesNew: number,
  judgesUpdated: number,
  urlsFailed: number,
): Promise<void> {
  await prisma.harvestJob.update({
    where: { id: jobId },
    data: { urlsProcessed, judgesFound, judgesNew, judgesUpdated, urlsFailed },
  });
}

// ---------------------------------------------------------------------------
// Main runner
// ---------------------------------------------------------------------------

async function run(): Promise<void> {
  const args = parseRunnerArgs();
  const flags = parseFlags();
  validateEnv(flags);

  // Determine state from job or CLI
  let stateAbbr: string;
  let jobId: string;

  if (args.jobId) {
    // Running with a pre-created HarvestJob
    const job = await prisma.harvestJob.findUnique({
      where: { id: args.jobId },
    });
    if (!job) {
      console.error(`Error: HarvestJob ${args.jobId} not found`);
      process.exit(1);
    }
    stateAbbr = job.stateAbbr;
    jobId = job.id;
  } else if (args.state) {
    // CLI mode: create a HarvestJob from state
    stateAbbr = args.state.toUpperCase();

    // Look up state name
    const stateRecord = await prisma.state.findUnique({
      where: { abbreviation: stateAbbr },
    });
    const stateName = stateRecord?.name ?? stateAbbr;

    const newJob = await prisma.harvestJob.create({
      data: {
        stateAbbr,
        state: stateName,
        status: "QUEUED",
        triggeredBy: "CLI",
      },
    });
    jobId = newJob.id;
    console.log(`Created HarvestJob ${jobId} for ${stateName}`);
  } else {
    console.error("Error: --job-id or --state is required");
    process.exit(1);
  }

  // Transition: QUEUED → RUNNING
  await prisma.harvestJob.update({
    where: { id: jobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  const slug = stateAbbr.toLowerCase();
  const outputDir = path.resolve(process.cwd(), "scripts/harvest/output");
  const stateOutputDir = path.join(outputDir, slug);
  if (!fs.existsSync(stateOutputDir)) {
    fs.mkdirSync(stateOutputDir, { recursive: true });
  }

  setupLogging(stateOutputDir, slug);
  console.log(`Harvest runner started for ${stateAbbr} (job: ${jobId})`);

  try {
    // Validate LLM
    const llmConfig = getLLMConfig();
    validateLLMConfig(llmConfig);
    console.log(`LLM Provider: ${describeLLMConfig()}`);

    // Reload job to get triggeredBy
    const currentJob = await prisma.harvestJob.findUnique({
      where: { id: jobId },
    });
    const triggeredBy = currentJob?.triggeredBy ?? "CLI";

    // Load URLs from database
    const allDbUrls = await loadUrlsFromDb(stateAbbr);
    if (allDbUrls.length === 0) {
      throw new Error(`No approved URLs for state ${stateAbbr}`);
    }

    // Delta filtering for CRON runs (FR-019): skip URLs whose lastSuccessAt
    // is within the freshness window (365 days).
    const FRESHNESS_DAYS = 365;
    let dbUrls = allDbUrls;
    if (triggeredBy === "CRON") {
      const freshnessThreshold = new Date(
        Date.now() - FRESHNESS_DAYS * 24 * 60 * 60 * 1000,
      );
      const freshUrls: string[] = [];
      const filteredDbUrls: typeof allDbUrls = [];

      for (const dbUrl of allDbUrls) {
        const health = await prisma.urlHealth.findUnique({
          where: { url: dbUrl.url },
          select: { lastSuccessAt: true },
        });
        if (
          health?.lastSuccessAt &&
          health.lastSuccessAt > freshnessThreshold
        ) {
          freshUrls.push(dbUrl.url);
        } else {
          filteredDbUrls.push(dbUrl);
        }
      }

      if (freshUrls.length > 0) {
        console.log(
          `Delta filter: skipping ${freshUrls.length} URL(s) fresh within ${FRESHNESS_DAYS} days`,
        );
        for (const url of freshUrls) {
          console.log(`  [fresh-skip] ${url}`);
        }
      }
      dbUrls = filteredDbUrls;
    }

    const courtUrls = dbUrls.map(toCourtUrlEntry);
    console.log(`Loaded ${courtUrls.length} URL(s) from database\n`);

    // Update total URLs in job
    await prisma.harvestJob.update({
      where: { id: jobId },
      data: { urlsTotal: courtUrls.length },
    });

    // Checkpoint support
    if (!args.resume) {
      resetCheckpoint(stateOutputDir, slug);
    }
    const checkpoint = loadCheckpoint(stateOutputDir, slug);

    // Run extraction pipeline
    const allRecords: EnrichedJudgeRecord[] = [];
    const completedSet = new Set(checkpoint.completedUrls);
    let processed = 0;
    let failed = 0;
    let skipped = 0;

    const bioStats = {
      bioPagesFetched: 0,
      bioPagesSucceeded: 0,
      bioPagesFailed: 0,
      fieldsEnriched: {} as Record<string, number>,
    };

    // Map from URL to judge count for yield tracking
    const urlYieldMap = new Map<string, { id: string; judgesFound: number }>();

    for (let idx = 0; idx < courtUrls.length; idx++) {
      const entry = courtUrls[idx];
      const dbUrl = dbUrls[idx];

      // Resume support
      if (completedSet.has(entry.url)) {
        skipped++;
        continue;
      }

      // Skip unsupported fetch methods
      if (entry.fetchMethod === "browser" || entry.fetchMethod === "manual") {
        console.warn(`[skip:${entry.fetchMethod}] ${entry.label}`);
        continue;
      }

      processed++;
      console.log(
        `\n[${processed}/${courtUrls.length - skipped}] Fetching: ${entry.label}`,
      );
      console.log(`  URL: ${entry.url}`);

      try {
        const fetchResult = await fetchPage(entry.url);
        console.log(
          `  Fetched: ${formatBytes(fetchResult.htmlSize)} HTML → ${formatBytes(fetchResult.markdownSize)} Markdown`,
        );

        const result = await extractJudges(fetchResult.markdown, {
          label: entry.label,
          courtType: entry.courtType,
          counties: entry.counties,
          rawHtml: fetchResult.rawHtml,
          url: entry.url,
          deterministic: entry.deterministic,
          selectorHint: entry.selectorHint,
          stateAbbreviation: stateAbbr,
        });

        console.log(`  Extracted: ${result.judges.length} judge(s)`);

        // Track yield per URL for zero-yield auto-downgrade
        urlYieldMap.set(entry.url, {
          id: dbUrl.id,
          judgesFound: result.judges.length,
        });

        // Record health/failure tracking
        if (result.judges.length === 0) {
          await recordFailure(
            entry.url,
            stateAbbr,
            stateAbbr,
            "EMPTY_PAGE",
            200,
            `Zero judges extracted from ${entry.label}`,
          );
        } else {
          await recordScrape({
            url: entry.url,
            state: stateAbbr,
            stateAbbr,
            success: true,
            judgesFound: result.judges.length,
          });
          await resolveFailuresForUrl(entry.url);
        }

        // Source authority classification
        const sourceAuthority = classifySourceAuthority(entry.url, new Map());
        const extractionMethod = result.extractionMethod;

        // Bio enrichment
        const enrichResult = await enrichWithBioPages(result.judges, entry, {
          skipBioFetch: flags.skipBio,
          stateAbbreviation: stateAbbr,
          onProgress: (current, total, name) => {
            if (!flags.skipBio) {
              console.log(`  [${current}/${total}] Enriching: ${name}`);
            }
          },
        });

        // Apply source authority + confidence
        const SOURCE_AUTHORITY_BASES: Record<string, number> = {
          OFFICIAL_GOV: 0.65,
          COURT_WEBSITE: 0.55,
          SECONDARY: 0.45,
        };
        const baseScore = SOURCE_AUTHORITY_BASES[sourceAuthority] ?? 0.45;
        const extractionBonus = extractionMethod === "deterministic" ? 0.1 : 0;

        for (const record of enrichResult.enriched) {
          record.sourceAuthority = sourceAuthority;
          record.extractionMethod = extractionMethod;
          record.confidenceScore = Math.min(
            0.95,
            baseScore + extractionBonus + record.fieldsFromBio.length * 0.05,
          );
        }

        // Accumulate bio stats
        bioStats.bioPagesFetched += enrichResult.stats.bioPagesFetched;
        bioStats.bioPagesSucceeded += enrichResult.stats.bioPagesSucceeded;
        bioStats.bioPagesFailed += enrichResult.stats.bioPagesFailed;
        for (const [field, count] of Object.entries(
          enrichResult.stats.fieldsEnriched,
        )) {
          bioStats.fieldsEnriched[field] =
            (bioStats.fieldsEnriched[field] ?? 0) + count;
        }

        const expandedRecords = expandEnrichedRecords(
          enrichResult.enriched,
          entry,
          stateAbbr,
        );
        allRecords.push(...expandedRecords);

        // Checkpoint save after each URL
        updateCheckpoint(
          checkpoint,
          entry.url,
          result.judges.length,
          [],
          stateOutputDir,
          slug,
        );
      } catch (err) {
        failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`  ERROR: ${errMsg}`);

        const failureType = classifyFailure(errMsg);
        await recordFailure(
          entry.url,
          stateAbbr,
          stateAbbr,
          failureType,
          undefined,
          errMsg,
        );
        updateCheckpoint(
          checkpoint,
          entry.url,
          0,
          [errMsg],
          stateOutputDir,
          slug,
        );

        urlYieldMap.set(entry.url, { id: dbUrl.id, judgesFound: 0 });
      }

      // Update job progress every PROGRESS_INTERVAL URLs
      if (
        processed % PROGRESS_INTERVAL === 0 ||
        processed === courtUrls.length - skipped
      ) {
        await updateJobProgress(
          jobId,
          processed,
          allRecords.length,
          0,
          0,
          failed,
        );
      }
    }

    console.log(
      `\nPipeline complete: ${processed} processed, ${skipped} skipped (resumed), ${failed} failed`,
    );

    if (allRecords.length === 0) {
      console.log("No judge records extracted.");
      await prisma.harvestJob.update({
        where: { id: jobId },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          judgesFound: 0,
          judgesNew: 0,
          judgesUpdated: 0,
        },
      });
      return;
    }

    // Deduplicate
    const rawCount = allRecords.length;
    const dedupResult = deduplicateEnrichedJudges(allRecords, {
      useIdentity: true,
    });
    console.log(
      `Deduplication: ${rawCount} raw → ${dedupResult.duplicates.length} dupes removed → ${dedupResult.unique.length} unique`,
    );

    // Optional Ballotpedia enrichment
    let finalRecords = dedupResult.unique;
    let ballotpediaStats: {
      totalEnriched: number;
      fieldCounts: Record<string, number>;
    } | null = null;
    if (flags.ballotpedia) {
      console.log("\n===== Ballotpedia Enrichment =====");
      const ballotResult = await enrichAllWithBallotpedia(finalRecords, {
        delayMs: 1500,
        maxJudges: flags.ballotpediaMax || undefined,
      });
      finalRecords = ballotResult.judges;
      ballotpediaStats = {
        totalEnriched: ballotResult.totalEnriched,
        fieldCounts: ballotResult.fieldCounts,
      };
    }

    // Optional Exa enrichment
    let exaStats: {
      totalEnriched: number;
      totalSearched: number;
      totalSkipped: number;
      fieldCounts: Record<string, number>;
    } | null = null;
    if (flags.exa) {
      console.log("\n===== Exa Web Search Enrichment =====");
      const exaResult = await enrichAllWithExa(finalRecords, {
        delayMs: 1000,
        maxJudges: flags.exaMax || undefined,
      });
      finalRecords = exaResult.judges;
      exaStats = {
        totalEnriched: exaResult.totalEnriched,
        totalSearched: exaResult.totalSearched,
        totalSkipped: exaResult.totalSkipped,
        fieldCounts: exaResult.fieldCounts,
      };
    }

    // Write judges to database
    console.log(`\nWriting ${finalRecords.length} judges to database...`);
    const writeResult = await writeJudgesToDb(finalRecords, jobId);
    console.log(
      `DB write: ${writeResult.new} new, ${writeResult.updated} updated, ${writeResult.failed} failed`,
    );

    if (writeResult.errors.length > 0) {
      for (const err of writeResult.errors.slice(0, 10)) {
        console.warn(`  Write error: ${err}`);
      }
    }

    // Generate report (writes to filesystem + returns markdown string)
    const timestamp = new Date().toISOString();
    const {
      filePath: reportPath,
      qualityVerdict,
      markdown: reportMarkdown,
    } = generateEnrichedReport(
      {
        courtUrls,
        checkpoint,
        rawCount,
        dedupResult,
        finalRecords,
        timestamp,
        bioStats,
        ballotpediaStats,
        exaStats,
        stateSlug: slug,
      },
      stateOutputDir,
    );
    console.log(`Report written: ${reportPath}`);

    // Update yield tracking on UrlCandidates
    for (const [url, data] of Array.from(urlYieldMap)) {
      await prisma.urlCandidate.updateMany({
        where: { url },
        data: {
          lastYieldCount: data.judgesFound,
          harvestAttempts: { increment: 1 },
        },
      });
    }

    // Zero-yield auto-downgrade (T033, FR-005):
    // After yield tracking is updated, find URLs where scrapeWorthy=true
    // AND lastYieldCount=0 AND harvestAttempts>=2, mark scrapeWorthy=false.
    const zeroYieldDowngrade = await prisma.urlCandidate.updateMany({
      where: {
        stateAbbr,
        scrapeWorthy: true,
        lastYieldCount: 0,
        harvestAttempts: { gte: 2 },
      },
      data: {
        scrapeWorthy: false,
        rejectionReason: "zero-yield",
      },
    });
    if (zeroYieldDowngrade.count > 0) {
      console.log(
        `Zero-yield auto-downgrade: ${zeroYieldDowngrade.count} URL(s) marked scrapeWorthy=false`,
      );
    }

    // Transition: RUNNING → COMPLETED
    await prisma.harvestJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        urlsProcessed: processed,
        urlsFailed: failed,
        judgesFound: finalRecords.length,
        judgesNew: writeResult.new,
        judgesUpdated: writeResult.updated,
        reportMarkdown,
      },
    });

    console.log(
      `\nHarvest completed: ${finalRecords.length} judges (${writeResult.new} new, ${writeResult.updated} updated)`,
    );
    console.log(`Quality verdict: ${qualityVerdict}`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`\nFATAL: ${errMsg}`);

    // Transition: RUNNING → FAILED
    await prisma.harvestJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: errMsg,
      },
    });

    throw err;
  } finally {
    closeLogging();
    await disconnectWriter();
    await prisma.$disconnect();
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  return `${(bytes / 1024).toFixed(1)}KB`;
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

run().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
