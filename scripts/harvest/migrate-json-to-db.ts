#!/usr/bin/env ts-node
/**
 * One-time migration: JSON court configs → UrlCandidate DB records.
 *
 * Reads each *-courts.json from scripts/harvest/legacy/, upserts
 * UrlCandidate records with status=APPROVED, scrapeWorthy=true,
 * confidenceScore=1.0, and creates a stub DiscoveryRun for provenance.
 *
 * Usage: npx tsx scripts/harvest/migrate-json-to-db.ts [--dry-run]
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import fs from "node:fs";
import path from "node:path";
import { PrismaClient, Prisma } from "@prisma/client";
import { StateConfigSchema } from "./state-config-schema";
import type { CourtEntry } from "./state-config-schema";

const prisma = new PrismaClient();

const LEGACY_DIR = path.resolve(__dirname, "legacy");

async function main(): Promise<void> {
  const dryRun = process.argv.includes("--dry-run");

  if (!fs.existsSync(LEGACY_DIR)) {
    console.error(`Legacy directory not found: ${LEGACY_DIR}`);
    process.exit(1);
  }

  const files = fs
    .readdirSync(LEGACY_DIR)
    .filter((f) => f.endsWith("-courts.json"));
  if (files.length === 0) {
    console.log("No legacy JSON files found.");
    return;
  }

  console.log(
    `Found ${files.length} legacy config file(s): ${files.join(", ")}`,
  );
  if (dryRun) console.log("(DRY RUN — no changes will be written)\n");

  let totalUpserted = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(LEGACY_DIR, file);
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    const result = StateConfigSchema.safeParse(raw);

    if (!result.success) {
      console.error(
        `Skipping ${file}: invalid schema — ${result.error.issues.map((i) => i.message).join("; ")}`,
      );
      continue;
    }

    const config = result.data;
    const stateAbbr = config.abbreviation;
    console.log(
      `\nMigrating ${config.state} (${stateAbbr}): ${config.courts.length} URL(s)`,
    );

    // Create a stub DiscoveryRun for provenance tracking
    let discoveryRunId: string | undefined = undefined;
    if (!dryRun) {
      // Look up state name for the DiscoveryRun state field
      const stateRecord = await prisma.state.findUnique({
        where: { abbreviation: stateAbbr },
        select: { name: true },
      });
      const stateName = stateRecord?.name ?? stateAbbr;
      const run = await prisma.discoveryRun.create({
        data: {
          stateAbbr,
          state: stateName,
          candidatesFound: config.courts.length,
          candidatesNew: config.courts.length,
          status: "COMPLETED",
          completedAt: new Date(),
        },
      });
      discoveryRunId = run.id;
      console.log(`  Created DiscoveryRun: ${discoveryRunId}`);
    }

    for (const court of config.courts) {
      const domain = extractDomain(court.url);
      const extractionHints = buildExtractionHints(court);

      if (dryRun) {
        console.log(`  [dry-run] Would upsert: ${court.url}`);
        totalUpserted++;
        continue;
      }

      try {
        if (!discoveryRunId) {
          console.warn(`  Skipped ${court.url}: no DiscoveryRun created`);
          totalSkipped++;
          continue;
        }
        await prisma.urlCandidate.upsert({
          where: { url: court.url },
          create: {
            url: court.url,
            domain,
            state: config.state,
            stateAbbr,
            searchQuery: "[migration]",
            status: "APPROVED",
            confidenceScore: 1.0,
            scrapeWorthy: true,
            autoClassifiedAt: new Date(),
            fetchMethod: court.fetchMethod ?? "http",
            extractionHints:
              extractionHints != null
                ? (extractionHints as Prisma.InputJsonValue)
                : undefined,
            suggestedType: court.courtType,
            suggestedLevel: court.level,
            discoveryRunId,
          },
          update: {
            status: "APPROVED",
            confidenceScore: 1.0,
            scrapeWorthy: true,
            fetchMethod: court.fetchMethod ?? "http",
            extractionHints:
              extractionHints != null
                ? (extractionHints as Prisma.InputJsonValue)
                : undefined,
            suggestedType: court.courtType,
            suggestedLevel: court.level,
          },
        });
        totalUpserted++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`  Skipped ${court.url}: ${msg}`);
        totalSkipped++;
      }
    }
  }

  console.log(
    `\nMigration complete: ${totalUpserted} upserted, ${totalSkipped} skipped`,
  );
  await prisma.$disconnect();
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function buildExtractionHints(
  court: CourtEntry,
): Record<string, unknown> | null {
  const hints: Record<string, unknown> = {};
  if (court.deterministic) hints.deterministic = true;
  if (court.selectorHint) hints.selector = court.selectorHint;
  if (court.counties.length > 0) hints.counties = court.counties;
  if (court.district) hints.district = court.district;
  if (court.circuit) hints.circuit = court.circuit;
  return Object.keys(hints).length > 0 ? hints : null;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
