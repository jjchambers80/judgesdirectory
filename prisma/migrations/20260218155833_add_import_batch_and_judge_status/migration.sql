/*
  Warnings:

  - You are about to drop the column `verified` on the `judges` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'ROLLED_BACK');

-- CreateEnum
CREATE TYPE "JudgeStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "judges" DROP COLUMN "verified",
ADD COLUMN     "importBatchId" TEXT,
ADD COLUMN     "status" "JudgeStatus" NOT NULL DEFAULT 'UNVERIFIED';

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "import_batches_status_idx" ON "import_batches"("status");

-- CreateIndex
CREATE INDEX "import_batches_createdAt_idx" ON "import_batches"("createdAt");

-- CreateIndex
CREATE INDEX "judges_importBatchId_idx" ON "judges"("importBatchId");

-- CreateIndex
CREATE INDEX "judges_status_idx" ON "judges"("status");

-- AddForeignKey
ALTER TABLE "judges" ADD CONSTRAINT "judges_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
