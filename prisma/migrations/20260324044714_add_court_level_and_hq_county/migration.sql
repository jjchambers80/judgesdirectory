-- CreateEnum
CREATE TYPE "CourtLevel" AS ENUM ('SUPREME', 'APPELLATE', 'TRIAL', 'SPECIALIZED');

-- AlterTable
ALTER TABLE "courts" ADD COLUMN     "level" "CourtLevel";
