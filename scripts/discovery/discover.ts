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
  runId: string | null;
}

function parseArgs(): DiscoverFlags {
  const args = process.argv.slice(2);
  const flags: DiscoverFlags = {
    state: null,
    dryRun: false,
    all: false,
    runId: null,
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
      case "--run-id":
        flags.runId = args[++i] ?? null;
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

/** Check for running discovery and clean up stale locks.
 *  @param ownRunId — If provided, exclude this run from the conflict check
 *    (the API pre-creates the RUNNING record before spawning the process).
 */
async function acquireLock(ownRunId?: string): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Clean stale locks (RUNNING for over 1 hour)
  await prisma.discoveryRun.updateMany({
    where: {
      status: "RUNNING",
      startedAt: { lt: oneHourAgo },
      ...(ownRunId ? { id: { not: ownRunId } } : {}),
    },
    data: {
      status: "FAILED",
      errorMessage: "Stale lock — marked FAILED by new run",
      completedAt: new Date(),
    },
  });

  // Check if any OTHER RUNNING lock still exists
  const running = await prisma.discoveryRun.findFirst({
    where: {
      status: "RUNNING",
      ...(ownRunId ? { id: { not: ownRunId } } : {}),
    },
  });

  return running === null;
}

// ---------------------------------------------------------------------------
// Cross-state domain guard
// ---------------------------------------------------------------------------

/**
 * Maps US state abbreviations to the hostname fragments that unambiguously
 * identify that state's official court websites. Used to filter out results
 * returned by Brave Search that belong to a different state — e.g. nccourts.gov
 * appearing in a South Carolina discovery run.
 *
 * Only include fragments that are unambiguous identifiers of a specific state
 * (state abbr prefix in domain, state name in domain, etc.).
 */
const STATE_DOMAIN_FRAGMENTS: Record<string, string[]> = {
  AL: ["alabamacourts", "al.gov", "alacourt"],
  AK: ["akcourts", "ak.gov"],
  AZ: ["azcourts", "az.gov"],
  AR: ["courts.arkansas", "ar.gov"],
  CA: ["courts.ca.gov", "ca.gov"],
  CO: ["coloradocourts", "co.gov"],
  CT: ["jud.ct.gov", "ct.gov"],
  DE: ["courts.delaware", "de.gov"],
  FL: ["flcourts", "fl.gov"],
  GA: ["georgiacourts", "ga.gov"],
  HI: ["courts.hawaii", "hi.gov"],
  ID: ["isc.idaho", "id.gov"],
  IL: ["illinoiscourts", "il.gov"],
  IN: ["courts.in.gov", "in.gov"],
  IA: ["iowacourts", "ia.gov"],
  KS: ["kscourts", "ks.gov"],
  KY: ["courts.ky.gov", "ky.gov"],
  LA: ["louisianasupremecourt", "la.gov"],
  ME: ["courts.maine", "me.gov"],
  MD: ["mdcourts", "md.gov"],
  MA: ["mass.gov"],
  MI: ["michigan.gov/courts", "courts.mi.gov"],
  MN: ["mncourts", "mn.gov"],
  MS: ["courts.ms.gov", "ms.gov"],
  MO: ["courts.mo.gov", "mo.gov"],
  MT: ["courts.mt.gov", "mt.gov"],
  NE: ["supremecourt.nebraska", "ne.gov"],
  NV: ["nvcourts", "nv.gov"],
  NH: ["courts.nh.gov", "nh.gov"],
  NJ: ["njcourts", "nj.gov"],
  NM: ["nmcourts", "nm.gov"],
  NY: ["nycourts", "ny.gov"],
  NC: ["nccourts", "nc.gov"],
  ND: ["ndcourts", "nd.gov"],
  OH: ["supremecourt.ohio", "ohiocourts", "oh.gov"],
  OK: ["oscn.net", "ok.gov"],
  OR: ["courts.oregon", "orcourts", "or.gov"],
  PA: ["pacourts", "pa.gov"],
  RI: ["courts.ri.gov", "ri.gov"],
  SC: ["sccourts", "sc.gov"],
  SD: ["ujs.sd.gov", "sd.gov"],
  TN: ["tncourts", "tn.gov"],
  TX: ["txcourts", "tx.gov"],
  UT: ["utcourts", "utah.gov"],
  VT: ["vermontjudiciary", "vt.gov"],
  VA: ["vacourts", "va.gov"],
  WA: ["courts.wa.gov", "wa.gov"],
  WV: ["courtswv", "wv.gov"],
  WI: ["wicourts", "wi.gov"],
  WY: ["courts.wyo", "wy.gov"],
};

/**
 * Returns true if the given domain clearly identifies a state OTHER than the
 * target state. Used as a fast pre-classification filter.
 *
 * Only rejects when we have positive evidence the domain belongs to a different
 * state — avoids false positives on generic .gov domains.
 */
function isDomainForDifferentState(
  domain: string,
  targetStateAbbr: string,
): boolean {
  for (const [abbr, fragments] of Object.entries(STATE_DOMAIN_FRAGMENTS)) {
    if (abbr === targetStateAbbr) continue;
    if (fragments.some((frag) => domain.includes(frag))) {
      return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Cooperative cancellation check
// ---------------------------------------------------------------------------

async function isCancelled(runId: string): Promise<boolean> {
  const run = await prisma.discoveryRun.findUnique({
    where: { id: runId },
    select: { status: true },
  });
  return run?.status === "CANCELLED";
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
  existingRunId?: string,
): Promise<DiscoveryResult> {
  const result: DiscoveryResult = {
    state: stateName,
    stateAbbr,
    queriesRun: 0,
    candidatesFound: 0,
    candidatesNew: 0,
    rateLimited: false,
  };

  // Create or reuse a DiscoveryRun record (skip in dry-run)
  let runId: string | null = null;
  if (!dryRun) {
    if (existingRunId) {
      // Reuse pre-created run from API
      runId = existingRunId;
    } else {
      const run = await prisma.discoveryRun.create({
        data: {
          state: stateName,
          stateAbbr,
          status: "RUNNING",
        },
      });
      runId = run.id;
    }
  }

  const queries = buildQueries(stateName);

  // Write queriesTotal so SSE progress stream can calculate %
  if (runId) {
    await prisma.discoveryRun.update({
      where: { id: runId },
      data: { queriesTotal: queries.length },
    });
  }

  try {
    for (const { level, query } of queries) {
      // Cooperative cancellation check before each query
      if (runId && (await isCancelled(runId))) {
        console.log("[Discovery] Cancellation detected — stopping gracefully");
        await prisma.discoveryRun.update({
          where: { id: runId },
          data: {
            status: "FAILED",
            errorMessage: "Cancelled by user",
            queriesRun: result.queriesRun,
            candidatesFound: result.candidatesFound,
            candidatesNew: result.candidatesNew,
            completedAt: new Date(),
          },
        });
        return result;
      }

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

      // Pre-classification filter: drop results whose domain clearly belongs
      // to a different state. Catches obvious mismatches like nccourts.gov
      // appearing in South Carolina searches before they reach the LLM.
      const filtered = searchResults.filter((r) => {
        const domain = r.displayLink.toLowerCase();
        const dominated = isDomainForDifferentState(domain, stateAbbr);
        if (dominated) {
          console.warn(
            `  [Filter] Dropped cross-state URL (expected ${stateAbbr}): ${r.link}`,
          );
        }
        return !dominated;
      });

      if (filtered.length < searchResults.length) {
        console.log(
          `  → ${searchResults.length - filtered.length} filtered as wrong-state domain`,
        );
      }

      if (filtered.length === 0) continue;

      // Classify results with LLM (state-scoped — classifier rejects wrong-state URLs)
      const classifications = await classifyResults(
        filtered,
        stateName,
        stateAbbr,
      );
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

      // Flush metrics after each query so SSE stream picks up progress
      if (runId) {
        await prisma.discoveryRun.update({
          where: { id: runId },
          data: {
            queriesRun: result.queriesRun,
            candidatesFound: result.candidatesFound,
            candidatesNew: result.candidatesNew,
          },
        });
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
    // Acquire advisory lock (pass own run-id so we don't conflict with
    // the RUNNING record the API pre-created for this process)
    const lockAcquired = await acquireLock(flags.runId ?? undefined);
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
      flags.runId ?? undefined,
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
