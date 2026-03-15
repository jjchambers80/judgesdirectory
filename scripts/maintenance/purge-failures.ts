#!/usr/bin/env ts-node
/**
 * Purge resolved scrape failure records older than 90 days.
 *
 * Usage:
 *   npx tsx scripts/maintenance/purge-failures.ts
 *   npx tsx scripts/maintenance/purge-failures.ts --dry-run
 *
 * @module scripts/maintenance/purge-failures
 */

// eslint-disable-next-line @typescript-eslint/no-require-imports
require("dotenv").config({
  path: require("node:path").resolve(__dirname, "../../.env"),
});

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const RETENTION_DAYS = 90;

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  console.log(
    `[Purge] Searching for resolved failures older than ${RETENTION_DAYS} days (before ${cutoff.toISOString()})`,
  );

  const count = await prisma.scrapeFailure.count({
    where: {
      resolvedAt: { not: null, lt: cutoff },
    },
  });

  if (count === 0) {
    console.log("[Purge] No eligible records found.");
    await prisma.$disconnect();
    return;
  }

  if (dryRun) {
    console.log(
      `[Purge] [DRY-RUN] Would purge ${count} resolved failure record(s).`,
    );
    await prisma.$disconnect();
    return;
  }

  const result = await prisma.scrapeFailure.deleteMany({
    where: {
      resolvedAt: { not: null, lt: cutoff },
    },
  });

  console.log(`[Purge] Purged ${result.count} resolved failure record(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("[Purge] Fatal error:", err);
  prisma.$disconnect().finally(() => process.exit(1));
});
