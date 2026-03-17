#!/usr/bin/env ts-node
/**
 * Judge Import CLI
 * 
 * Imports harvested CSV data into the PostgreSQL database.
 * Automatically creates ImportBatch records to track imports.
 * 
 * Usage:
 *   npx tsx scripts/import/index.ts [flags]
 * 
 * Flags:
 *   --file <path>    Specify CSV file (default: latest in harvest/output)
 *   --dry-run        Preview import without committing to database
 *   --reset          Clear existing judges before import
 * 
 * @module scripts/import/index
 */

// Load environment variables
// eslint-disable-next-line @typescript-eslint/no-require-imports
require('dotenv').config({
  path: require('node:path').resolve(__dirname, '../../.env'),
});

import { PrismaClient, SourceAuthority } from '@prisma/client';
import {
  findLatestCsv,
  parseCsvFile,
  getDefaultOutputDir,
  type ParsedJudge,
} from './csv-importer';
import { resolveCourt, clearCaches, disconnect } from './court-resolver';
import { evaluateQuality, getQualityStats, type QualityResult } from './quality-gate';

const prisma = new PrismaClient();

interface CliFlags {
  file: string | null;
  dryRun: boolean;
  reset: boolean;
}

function parseFlags(): CliFlags {
  const args = process.argv.slice(2);
  const flags: CliFlags = {
    file: null,
    dryRun: false,
    reset: false,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--file':
        flags.file = args[++i];
        break;
      case '--dry-run':
        flags.dryRun = true;
        break;
      case '--reset':
        flags.reset = true;
        break;
    }
  }

  return flags;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

interface ImportStats {
  totalRows: number;
  imported: number;
  skipped: number;
  errors: number;
  newCourts: number;
  qualityStats: ReturnType<typeof getQualityStats>;
}

async function importJudges(
  judges: ParsedJudge[],
  batchId: string,
  flags: CliFlags
): Promise<ImportStats> {
  const stats: ImportStats = {
    totalRows: judges.length,
    imported: 0,
    skipped: 0,
    errors: 0,
    newCourts: 0,
    qualityStats: {
      verified: 0,
      unverified: 0,
      needsReview: 0,
      rejected: 0,
      skipped: 0,
      autoVerified: 0,
      anomalyCounts: {},
    },
  };

  const qualityResults: QualityResult[] = [];

  for (let i = 0; i < judges.length; i++) {
    const judge = judges[i];
    const progress = `[${i + 1}/${judges.length}]`;

    // Evaluate quality
    const quality = evaluateQuality(judge);
    qualityResults.push(quality);

    // Skip rejected items (navigation text, etc.)
    if (quality.shouldSkip) {
      if (!flags.dryRun) {
        console.log(`${progress} SKIP: ${judge.fullName} (${quality.anomalyFlags.join(', ')})`);
      }
      stats.skipped++;
      continue;
    }

    // Resolve court
    const courtResult = await resolveCourt(
      judge.courtType,
      judge.county,
      judge.state
    );

    if (!courtResult.success || !courtResult.court) {
      console.error(`${progress} ERROR: ${judge.fullName} — ${courtResult.error}`);
      stats.errors++;
      continue;
    }

    if (courtResult.court.isNew) {
      stats.newCourts++;
    }

    // Prepare judge data for upsert
    const slug = slugify(judge.fullName);
    const courtId = courtResult.court.court.id;

    const judgeData = {
      fullName: judge.fullName,
      slug,
      courtId,
      division: judge.division,
      isChiefJudge: judge.isChiefJudge,
      photoUrl: judge.photoUrl,
      termStart: judge.termStart,
      termEnd: judge.termEnd,
      selectionMethod: judge.selectionMethod,
      appointingAuthority: judge.appointingAuthority,
      appointmentDate: judge.appointmentDate,
      birthDate: judge.birthDate,
      education: judge.education,
      priorExperience: judge.priorExperience,
      politicalAffiliation: judge.politicalAffiliation,
      barAdmissionDate: judge.barAdmissionDate,
      barAdmissionState: judge.barAdmissionState,
      courthouseAddress: judge.courthouseAddress,
      courthousePhone: judge.courthousePhone,
      sourceUrl: judge.sourceUrl,
      rosterUrl: judge.rosterUrl,
      sourceAuthority: judge.sourceAuthority as SourceAuthority,
      extractionMethod: judge.extractionMethod,
      status: quality.status,
      autoVerified: quality.autoVerified,
      anomalyFlags: quality.anomalyFlags,
      reviewReason: quality.reviewReason,
      confidenceScore: judge.confidenceScore,
      importBatchId: batchId,
      lastHarvestAt: new Date(),
      verifiedAt: quality.verifiedAt,
    };

    if (flags.dryRun) {
      const statusEmoji = 
        quality.status === 'VERIFIED' ? '✓' :
        quality.status === 'UNVERIFIED' ? '○' :
        quality.status === 'NEEDS_REVIEW' ? '?' : '✗';
      console.log(`${progress} ${statusEmoji} ${judge.fullName} → ${courtResult.court.county.name} ${judge.courtType}`);
    } else {
      try {
        // Upsert judge (update if exists, create if not)
        await prisma.judge.upsert({
          where: {
            courtId_slug: { courtId, slug },
          },
          create: judgeData,
          update: {
            // Only update auto-generated fields, preserve manual edits
            ...judgeData,
            // Don't overwrite manually verified status
            status: undefined,
            autoVerified: undefined,
            verifiedAt: undefined,
          },
        });
        stats.imported++;
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error(`${progress} ERROR: ${judge.fullName} — ${errMsg}`);
        stats.errors++;
      }
    }
  }

  stats.qualityStats = getQualityStats(qualityResults);
  return stats;
}

async function main(): Promise<void> {
  const flags = parseFlags();

  console.log('=================================');
  console.log('  Judge Import Pipeline');
  console.log('=================================\n');

  if (flags.dryRun) {
    console.log('🔍 DRY RUN MODE — No changes will be made\n');
  }

  // Find CSV file
  const csvPath = flags.file || findLatestCsv(getDefaultOutputDir());
  if (!csvPath) {
    console.error('ERROR: No CSV file found. Run harvest first or specify --file');
    process.exit(1);
  }

  console.log(`📄 CSV file: ${csvPath}\n`);

  // Parse CSV
  console.log('Parsing CSV...');
  const { judges, fileName, totalRows } = await parseCsvFile(csvPath);
  console.log(`  Found ${totalRows} rows\n`);

  // Handle --reset
  if (flags.reset && !flags.dryRun) {
    console.log('🗑️  Clearing existing judges...');
    const deleted = await prisma.judge.deleteMany();
    console.log(`  Deleted ${deleted.count} judges\n`);
    clearCaches();
  }

  // Create import batch
  let batchId: string;
  if (flags.dryRun) {
    batchId = 'dry-run';
  } else {
    const batch = await prisma.importBatch.create({
      data: {
        fileName,
        totalRows,
        status: 'PROCESSING',
      },
    });
    batchId = batch.id;
    console.log(`📦 Import batch: ${batchId}\n`);
  }

  // Import judges
  console.log('Importing judges...\n');
  const stats = await importJudges(judges, batchId, flags);

  // Update batch status
  if (!flags.dryRun) {
    await prisma.importBatch.update({
      where: { id: batchId },
      data: {
        status: 'COMPLETE',
        successCount: stats.imported,
        skipCount: stats.skipped,
        errorCount: stats.errors,
      },
    });
  }

  // Print summary
  console.log('\n=================================');
  console.log('  Import Summary');
  console.log('=================================\n');
  console.log(`Total rows:     ${stats.totalRows}`);
  console.log(`Imported:       ${stats.imported}`);
  console.log(`Skipped:        ${stats.skipped}`);
  console.log(`Errors:         ${stats.errors}`);
  console.log(`New courts:     ${stats.newCourts}`);
  console.log('');
  console.log('Quality breakdown:');
  console.log(`  ✓ Verified:     ${stats.qualityStats.verified} (${stats.qualityStats.autoVerified} auto)`);
  console.log(`  ○ Unverified:   ${stats.qualityStats.unverified}`);
  console.log(`  ? Needs review: ${stats.qualityStats.needsReview}`);
  console.log(`  ✗ Rejected:     ${stats.qualityStats.rejected}`);

  if (Object.keys(stats.qualityStats.anomalyCounts).length > 0) {
    console.log('\nAnomaly flags:');
    for (const [flag, count] of Object.entries(stats.qualityStats.anomalyCounts)) {
      console.log(`  ${flag}: ${count}`);
    }
  }

  if (flags.dryRun) {
    console.log('\n🔍 DRY RUN — No changes were made');
    console.log('   Run without --dry-run to import');
  }
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await disconnect();
    await prisma.$disconnect();
  });
