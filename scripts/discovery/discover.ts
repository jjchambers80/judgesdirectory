#!/usr/bin/env ts-node
/**
 * URL Discovery CLI — discover court roster URLs for a state using Google CSE.
 *
 * Usage:
 *   npx tsx scripts/discovery/discover.ts --state FL
 *   npx tsx scripts/discovery/discover.ts --state FL --dry-run
 *   npx tsx scripts/discovery/discover.ts --all
 *
 * @module scripts/discovery/discover
 */

// Load .env from project root
// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import { PrismaClient } from "@prisma/client";
import { validateSearchEnv, buildQueries, search } from "./search-client";
import { classifyResults } from "./classifier";
import { upsertCandidate } from "./candidate-store";

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// US states lookup
// ---------------------------------------------------------------------------

const US_STATES: { abbr: string; name: string }[] = [
  { abbr: "AL", name: "Alabama" },
  { abbr: "AK", name: "Alaska" },
  { abbr: "AZ", name: "Arizona" },
  { abbr: "AR", name: "Arkansas" },
  { abbr: "CA", name: "California" },
  { abbr: "CO", name: "Colorado" },
  { abbr: "CT", name: "Connecticut" },
  { abbr: "DE", name: "Delaware" },
  { abbr: "FL", name: "Florida" },
  { abbr: "GA", name: "Georgia" },
  { abbr: "HI", name: "Hawaii" },
  { abbr: "ID", name: "Idaho" },
  { abbr: "IL", name: "Illinois" },
  { abbr: "IN", name: "Indiana" },
  { abbr: "IA", name: "Iowa" },
  { abbr: "KS", name: "Kansas" },
  { abbr: "KY", name: "Kentucky" },
  { abbr: "LA", name: "Louisiana" },
  { abbr: "ME", name: "Maine" },
  { abbr: "MD", name: "Maryland" },
  { abbr: "MA", name: "Massachusetts" },
  { abbr: "MI", name: "Michigan" },
  { abbr: "MN", name: "Minnesota" },
  { abbr: "MS", name: "Mississippi" },
  { abbr: "MO", name: "Missouri" },
  { abbr: "MT", name: "Montana" },
  { abbr: "NE", name: "Nebraska" },
  { abbr: "NV", name: "Nevada" },
  { abbr: "NH", name: "New Hampshire" },
  { abbr: "NJ", name: "New Jersey" },
  { abbr: "NM", name: "New Mexico" },
  { abbr: "NY", name: "New York" },
  { abbr: "NC", name: "North Carolina" },
  { abbr: "ND", name: "North Dakota" },
  { abbr: "OH", name: "Ohio" },
  { abbr: "OK", name: "Oklahoma" },
  { abbr: "OR", name: "Oregon" },
  { abbr: "PA", name: "Pennsylvania" },
  { abbr: "RI", name: "Rhode Island" },
  { abbr: "SC", name: "South Carolina" },
  { abbr: "SD", name: "South Dakota" },
  { abbr: "TN", name: "Tennessee" },
  { abbr: "TX", name: "Texas" },
  { abbr: "UT", name: "Utah" },
  { abbr: "VT", name: "Vermont" },
  { abbr: "VA", name: "Virginia" },
  { abbr: "WA", name: "Washington" },
  { abbr: "WV", name: "West Virginia" },
  { abbr: "WI", name: "Wisconsin" },
  { abbr: "WY", name: "Wyoming" },
];

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------

interface DiscoverFlags {
  state: string | null;
  dryRun: boolean;
  all: boolean;
}

function parseArgs(): DiscoverFlags {
  const args = process.argv.slice(2);
  const flags: DiscoverFlags = {
    state: null,
    dryRun: false,
    all: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--state":
        flags.state = args[++i]?.toUpperCase() ?? null;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--all":
        flags.all = true;
        break;
    }
  }

  return flags;
}

function resolveState(abbr: string): { abbr: string; name: string } | null {
  return US_STATES.find((s) => s.abbr === abbr.toUpperCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Advisory lock
// ---------------------------------------------------------------------------

/** Check for running discovery and clean up stale locks. */
async function acquireLock(): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Clean stale locks (RUNNING for over 1 hour)
  await prisma.discoveryRun.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: oneHourAgo },
    },
    data: {
      status: "FAILED",
      errorMessage: "Stale lock — marked FAILED by new run",
      completedAt: new Date(),
    },
  });

  // Check if any RUNNING lock still exists
  const running = await prisma.discoveryRun.findFirst({
    where: { status: "RUNNING" },
  });

  return running === null;
}

// ---------------------------------------------------------------------------
// Core discovery pipeline for one state
// ---------------------------------------------------------------------------

interface DiscoveryResult {
  state: string;
  stateAbbr: string;
  queriesRun: number;
  candidatesFound: number;
  candidatesNew: number;
  rateLimited: boolean;
}

async function discoverState(
  stateName: string,
  stateAbbr: string,
  dryRun: boolean,
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    state: stateName,
    stateAbbr,
    queriesRun: 0,
    candidatesFound: 0,
    candidatesNew: 0,
    rateLimited: false,
  };

  // Create a DiscoveryRun record (skip in dry-run)
  let runId: string | null = null;
  if (!dryRun) {
    const run = await prisma.discoveryRun.create({
      data: {
        state: stateName,
        stateAbbr,
        status: "RUNNING",
      },
    });
    runId = run.id;
  }

  const queries = buildQueries(stateName);

  try {
    for (const { level, query } of queries) {
      console.log(
        `[Discovery] Query ${result.queriesRun + 1}/${queries.length}: ${query}`,
      );

      let searchResults;
      try {
        searchResults = await search(query);
        result.queriesRun++;
      } catch (err) {
        if (err instanceof Error && err.message.includes("RATE_LIMIT")) {
          console.warn("[Discovery] Rate limit hit — stopping gracefully");
          result.rateLimited = true;
          break;
        }
        throw err;
      }

      console.log(`  → ${searchResults.length} results`);

      if (searchResults.length === 0) continue;

      // Classify results with LLM
      const classifications = await classifyResults(searchResults);
      const relevant = classifications.filter((c) => c.isJudicialRoster);
      console.log(`  → ${relevant.length} classified as judicial roster`);

      if (dryRun) {
        // Display results without DB writes
        for (const c of relevant) {
          const conf = c.confidence !== null ? c.confidence.toFixed(2) : "N/A";
          console.log(`  [DRY-RUN] ${conf}  ${c.url}`);
          console.log(
            `            ${c.courtType || "?"} (${c.courtLevel || level})`,
          );
        }
        result.candidatesFound += relevant.length;
        continue;
      }

      // Upsert candidates into DB
      for (const classification of relevant) {
        const matchedSearch = searchResults.find(
          (sr) => sr.link === classification.url,
        );

        // Auto-promote or auto-reject based on classifier confidence + isJudicialRoster.
        // High confidence (>=0.7) & confirmed roster → APPROVED (no human review needed).
        // Low confidence (<0.3) or not judicial → REJECTED automatically.
        // Middle band (0.3–0.7) → stays DISCOVERED for optional human triage.
        let autoStatus: "APPROVED" | "REJECTED" | "DISCOVERED" = "DISCOVERED";
        if (classification.scrapeWorthy === true) {
          autoStatus = "APPROVED";
        } else if (classification.scrapeWorthy === false) {
          autoStatus = "REJECTED";
        }

        const { created } = await upsertCandidate({
          url: classification.url,
          domain:
            matchedSearch?.displayLink ?? new URL(classification.url).hostname,
          state: stateName,
          stateAbbr,
          suggestedType: classification.courtType,
          suggestedLevel: classification.courtLevel ?? level,
          confidenceScore: classification.confidence,
          searchQuery: query,
          snippetText: matchedSearch?.snippet ?? null,
          pageTitle: matchedSearch?.title ?? null,
          discoveryRunId: runId!,
          scrapeWorthy: classification.scrapeWorthy,
          autoClassifiedAt: classification.autoClassifiedAt,
          status: autoStatus,
        });

        result.candidatesFound++;
        if (created) result.candidatesNew++;
      }
    }

    // Update DiscoveryRun on success
    if (runId) {
      await prisma.discoveryRun.update({
        where: { id: runId },
        data: {
          status: result.rateLimited ? "FAILED" : "COMPLETED",
          queriesRun: result.queriesRun,
          candidatesFound: result.candidatesFound,
          candidatesNew: result.candidatesNew,
          completedAt: new Date(),
          errorMessage: result.rateLimited
            ? "Stopped early — Google CSE rate limit reached"
            : null,
        },
      });
    }
  } catch (err) {
    // Update DiscoveryRun on failure
    if (runId) {
      await prisma.discoveryRun.update({
        where: { id: runId },
        data: {
          status: "FAILED",
          queriesRun: result.queriesRun,
          candidatesFound: result.candidatesFound,
          candidatesNew: result.candidatesNew,
          completedAt: new Date(),
          errorMessage: err instanceof Error ? err.message : String(err),
        },
      });
    }
    throw err;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const flags = parseArgs();

  if (!flags.state && !flags.all) {
    console.error(
      "Usage: npx tsx scripts/discovery/discover.ts --state FL [--dry-run]",
    );
    console.error("       npx tsx scripts/discovery/discover.ts --all");
    process.exit(1);
  }

  // Validate env vars (skip in dry-run since we still need them for search)
  validateSearchEnv();

  if (!flags.dryRun) {
    // Acquire advisory lock
    const lockAcquired = await acquireLock();
    if (!lockAcquired) {
      console.error(
        "[Discovery] Another discovery run is in progress. Aborting.",
      );
      process.exit(1);
    }
    console.log("[Discovery] Lock acquired");
  }

  if (flags.all) {
    // Discover all states
    console.log(`[Discovery] Running for all ${US_STATES.length} states\n`);

    let totalQueriesRun = 0;
    let totalCandidatesFound = 0;
    let totalCandidatesNew = 0;

    for (const { abbr, name } of US_STATES) {
      console.log(`\n[Discovery] Starting discovery for ${name} (${abbr})`);

      try {
        const result = await discoverState(name, abbr, flags.dryRun);
        totalQueriesRun += result.queriesRun;
        totalCandidatesFound += result.candidatesFound;
        totalCandidatesNew += result.candidatesNew;

        console.log(
          `[Discovery] ${name}: ${result.queriesRun} queries, ${result.candidatesFound} found, ${result.candidatesNew} new`,
        );

        if (result.rateLimited) {
          console.warn(
            "\n[Discovery] Rate limit hit — stopping all-state discovery",
          );
          break;
        }
      } catch (err) {
        console.error(
          `[Discovery] ${name} failed: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    console.log("\n[Discovery] === All-State Summary ===");
    console.log(`  Queries run: ${totalQueriesRun}`);
    console.log(`  Candidates found: ${totalCandidatesFound}`);
    console.log(`  New candidates: ${totalCandidatesNew}`);
  } else {
    // Single state
    const stateInfo = resolveState(flags.state!);
    if (!stateInfo) {
      console.error(`Unknown state abbreviation: ${flags.state}`);
      process.exit(1);
    }

    console.log(
      `[Discovery] Starting discovery for ${stateInfo.name} (${stateInfo.abbr})${flags.dryRun ? " [DRY-RUN]" : ""}`,
    );

    const result = await discoverState(
      stateInfo.name,
      stateInfo.abbr,
      flags.dryRun,
    );

    console.log("\n[Discovery] === Summary ===");
    console.log(`  State: ${result.state} (${result.stateAbbr})`);
    console.log(`  Queries run: ${result.queriesRun}`);
    console.log(`  Candidates found: ${result.candidatesFound}`);
    console.log(`  New candidates: ${result.candidatesNew}`);
    if (result.rateLimited) {
      console.warn("  ⚠ Rate limited — partial results");
    }
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Discovery] Fatal error:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
