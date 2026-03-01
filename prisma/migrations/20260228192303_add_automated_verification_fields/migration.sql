-- CreateEnum
CREATE TYPE "SourceAuthority" AS ENUM ('OFFICIAL_GOV', 'COURT_WEBSITE', 'ELECTION_RECORDS', 'SECONDARY');

-- AlterEnum
ALTER TYPE "JudgeStatus" ADD VALUE 'NEEDS_REVIEW';

-- AlterTable
ALTER TABLE "judges" ADD COLUMN     "anomalyFlags" TEXT[],
ADD COLUMN     "autoVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "confidenceScore" DOUBLE PRECISION,
ADD COLUMN     "lastHarvestAt" TIMESTAMP(3),
ADD COLUMN     "reviewReason" TEXT,
ADD COLUMN     "sourceAuthority" "SourceAuthority",
ADD COLUMN     "verifiedAt" TIMESTAMP(3);
