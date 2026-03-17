-- CreateEnum
CREATE TYPE "HarvestJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "HarvestTrigger" AS ENUM ('ADMIN', 'CRON', 'CLI');

-- DropForeignKey
ALTER TABLE "judges" DROP CONSTRAINT "judges_importBatchId_fkey";

-- DropIndex
DROP INDEX "judges_importBatchId_idx";

-- AlterTable
ALTER TABLE "judges" DROP COLUMN "importBatchId",
ADD COLUMN     "harvestJobId" TEXT;

-- AlterTable
ALTER TABLE "url_candidates" ADD COLUMN     "autoClassifiedAt" TIMESTAMP(3),
ADD COLUMN     "extractionHints" JSONB,
ADD COLUMN     "fetchMethod" TEXT NOT NULL DEFAULT 'http',
ADD COLUMN     "harvestAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastYieldCount" INTEGER,
ADD COLUMN     "scrapeWorthy" BOOLEAN;

-- DropTable
DROP TABLE "import_batches";

-- DropEnum
DROP TYPE "ImportBatchStatus";

-- CreateTable
CREATE TABLE "harvest_jobs" (
    "id" TEXT NOT NULL,
    "stateAbbr" VARCHAR(2) NOT NULL,
    "state" TEXT NOT NULL,
    "status" "HarvestJobStatus" NOT NULL DEFAULT 'QUEUED',
    "triggeredBy" "HarvestTrigger" NOT NULL DEFAULT 'ADMIN',
    "urlsTotal" INTEGER NOT NULL DEFAULT 0,
    "urlsProcessed" INTEGER NOT NULL DEFAULT 0,
    "urlsFailed" INTEGER NOT NULL DEFAULT 0,
    "judgesFound" INTEGER NOT NULL DEFAULT 0,
    "judgesNew" INTEGER NOT NULL DEFAULT 0,
    "judgesUpdated" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "reportMarkdown" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "harvest_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "harvest_jobs_stateAbbr_idx" ON "harvest_jobs"("stateAbbr");

-- CreateIndex
CREATE INDEX "harvest_jobs_status_idx" ON "harvest_jobs"("status");

-- CreateIndex
CREATE INDEX "harvest_jobs_createdAt_idx" ON "harvest_jobs"("createdAt");

-- CreateIndex
CREATE INDEX "harvest_jobs_stateAbbr_status_idx" ON "harvest_jobs"("stateAbbr", "status");

-- CreateIndex
CREATE INDEX "judges_harvestJobId_idx" ON "judges"("harvestJobId");

-- CreateIndex
CREATE INDEX "url_candidates_scrapeWorthy_idx" ON "url_candidates"("scrapeWorthy");

-- AddForeignKey
ALTER TABLE "judges" ADD CONSTRAINT "judges_harvestJobId_fkey" FOREIGN KEY ("harvestJobId") REFERENCES "harvest_jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;
