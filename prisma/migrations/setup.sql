-- =============================================================================
-- JUDGES DIRECTORY - FULL DATABASE SETUP
-- =============================================================================
-- Generated: 2026-03-05
-- Feature: 008-state-expansion
-- 
-- This script creates the complete database schema and seeds reference data.
-- Run against a fresh PostgreSQL database.
--
-- Prerequisites:
--   - PostgreSQL 14+
--   - Empty database named 'judgesdirectory' (or update connection string)
--
-- Usage:
--   psql -h localhost -U postgres -d judgesdirectory -f setup.sql
--
-- After running this script, seed courts using:
--   npx tsx scripts/harvest/index.ts --all --seed-courts-only
-- =============================================================================

-- =============================================================================
-- MIGRATION 1: Initial Schema (20260218045736_init)
-- =============================================================================

-- States table
CREATE TABLE IF NOT EXISTS "states" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "abbreviation" VARCHAR(2) NOT NULL,
    "fipsCode" VARCHAR(2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "states_pkey" PRIMARY KEY ("id")
);

-- Counties table
CREATE TABLE IF NOT EXISTS "counties" (
    "id" TEXT NOT NULL,
    "stateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "fipsCode" VARCHAR(5),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "counties_pkey" PRIMARY KEY ("id")
);

-- Courts table
CREATE TABLE IF NOT EXISTS "courts" (
    "id" TEXT NOT NULL,
    "countyId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- Judges table (initial columns)
CREATE TABLE IF NOT EXISTS "judges" (
    "id" TEXT NOT NULL,
    "courtId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "termStart" TIMESTAMP(3),
    "termEnd" TIMESTAMP(3),
    "selectionMethod" TEXT,
    "appointingAuthority" TEXT,
    "education" TEXT,
    "priorExperience" TEXT,
    "politicalAffiliation" TEXT,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "judges_pkey" PRIMARY KEY ("id")
);

-- States indexes
CREATE UNIQUE INDEX IF NOT EXISTS "states_name_key" ON "states"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "states_slug_key" ON "states"("slug");
CREATE UNIQUE INDEX IF NOT EXISTS "states_abbreviation_key" ON "states"("abbreviation");
CREATE UNIQUE INDEX IF NOT EXISTS "states_fipsCode_key" ON "states"("fipsCode");

-- Counties indexes
CREATE UNIQUE INDEX IF NOT EXISTS "counties_fipsCode_key" ON "counties"("fipsCode");
CREATE INDEX IF NOT EXISTS "counties_stateId_idx" ON "counties"("stateId");
CREATE UNIQUE INDEX IF NOT EXISTS "counties_stateId_slug_key" ON "counties"("stateId", "slug");

-- Courts indexes
CREATE INDEX IF NOT EXISTS "courts_countyId_idx" ON "courts"("countyId");
CREATE UNIQUE INDEX IF NOT EXISTS "courts_countyId_slug_key" ON "courts"("countyId", "slug");

-- Judges indexes
CREATE INDEX IF NOT EXISTS "judges_courtId_idx" ON "judges"("courtId");
CREATE INDEX IF NOT EXISTS "judges_fullName_idx" ON "judges"("fullName");
CREATE UNIQUE INDEX IF NOT EXISTS "judges_courtId_slug_key" ON "judges"("courtId", "slug");

-- Foreign keys
ALTER TABLE "counties" ADD CONSTRAINT "counties_stateId_fkey" 
    FOREIGN KEY ("stateId") REFERENCES "states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "courts" ADD CONSTRAINT "courts_countyId_fkey" 
    FOREIGN KEY ("countyId") REFERENCES "counties"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "judges" ADD CONSTRAINT "judges_courtId_fkey" 
    FOREIGN KEY ("courtId") REFERENCES "courts"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- =============================================================================
-- MIGRATION 2: Import Batch & Judge Status (20260218155833)
-- =============================================================================

-- Enums
DO $$ BEGIN
    CREATE TYPE "ImportBatchStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETE', 'ROLLED_BACK');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "JudgeStatus" AS ENUM ('UNVERIFIED', 'VERIFIED', 'REJECTED', 'NEEDS_REVIEW');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Import batches table
CREATE TABLE IF NOT EXISTS "import_batches" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "skipCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "status" "ImportBatchStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- Import batch indexes
CREATE INDEX IF NOT EXISTS "import_batches_status_idx" ON "import_batches"("status");
CREATE INDEX IF NOT EXISTS "import_batches_createdAt_idx" ON "import_batches"("createdAt");

-- Add columns to judges (if not exists)
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "importBatchId" TEXT;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "status" "JudgeStatus" NOT NULL DEFAULT 'UNVERIFIED';

CREATE INDEX IF NOT EXISTS "judges_importBatchId_idx" ON "judges"("importBatchId");
CREATE INDEX IF NOT EXISTS "judges_status_idx" ON "judges"("status");

ALTER TABLE "judges" ADD CONSTRAINT "judges_importBatchId_fkey" 
    FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- MIGRATION 3: Expanded Judge Fields (20260228191047)
-- =============================================================================

ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "appointmentDate" TIMESTAMP(3);
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "barAdmissionDate" TIMESTAMP(3);
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "barAdmissionState" TEXT;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "birthDate" TIMESTAMP(3);
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "courthouseAddress" TEXT;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "courthousePhone" TEXT;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "division" TEXT;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "isChiefJudge" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "photoUrl" TEXT;


-- =============================================================================
-- MIGRATION 4: Automated Verification Fields (20260228192303)
-- =============================================================================

DO $$ BEGIN
    CREATE TYPE "SourceAuthority" AS ENUM ('OFFICIAL_GOV', 'COURT_WEBSITE', 'ELECTION_RECORDS', 'SECONDARY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "anomalyFlags" TEXT[];
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "autoVerified" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "confidenceScore" DOUBLE PRECISION;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "lastHarvestAt" TIMESTAMP(3);
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "reviewReason" TEXT;
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "sourceAuthority" "SourceAuthority";
ALTER TABLE "judges" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);


-- =============================================================================
-- PRISMA MIGRATIONS TABLE (for Prisma compatibility)
-- =============================================================================

CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
    "id" VARCHAR(36) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "finished_at" TIMESTAMPTZ,
    "migration_name" VARCHAR(255) NOT NULL,
    "logs" TEXT,
    "rolled_back_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "applied_steps_count" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "_prisma_migrations_pkey" PRIMARY KEY ("id")
);

-- Record migrations as applied
INSERT INTO "_prisma_migrations" ("id", "checksum", "migration_name", "finished_at", "applied_steps_count")
VALUES 
    (gen_random_uuid()::text, 'manual', '20260218045736_init', NOW(), 1),
    (gen_random_uuid()::text, 'manual', '20260218155833_add_import_batch_and_judge_status', NOW(), 1),
    (gen_random_uuid()::text, 'manual', '20260228191047_add_expanded_judge_fields', NOW(), 1),
    (gen_random_uuid()::text, 'manual', '20260228192303_add_automated_verification_fields', NOW(), 1)
ON CONFLICT DO NOTHING;


-- =============================================================================
-- SEED DATA: US States (51 including DC)
-- =============================================================================

INSERT INTO "states" ("id", "name", "slug", "abbreviation", "fipsCode", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'Alabama', 'alabama', 'AL', '01', NOW()),
    (gen_random_uuid()::text, 'Alaska', 'alaska', 'AK', '02', NOW()),
    (gen_random_uuid()::text, 'Arizona', 'arizona', 'AZ', '04', NOW()),
    (gen_random_uuid()::text, 'Arkansas', 'arkansas', 'AR', '05', NOW()),
    (gen_random_uuid()::text, 'California', 'california', 'CA', '06', NOW()),
    (gen_random_uuid()::text, 'Colorado', 'colorado', 'CO', '08', NOW()),
    (gen_random_uuid()::text, 'Connecticut', 'connecticut', 'CT', '09', NOW()),
    (gen_random_uuid()::text, 'Delaware', 'delaware', 'DE', '10', NOW()),
    (gen_random_uuid()::text, 'District of Columbia', 'district-of-columbia', 'DC', '11', NOW()),
    (gen_random_uuid()::text, 'Florida', 'florida', 'FL', '12', NOW()),
    (gen_random_uuid()::text, 'Georgia', 'georgia', 'GA', '13', NOW()),
    (gen_random_uuid()::text, 'Hawaii', 'hawaii', 'HI', '15', NOW()),
    (gen_random_uuid()::text, 'Idaho', 'idaho', 'ID', '16', NOW()),
    (gen_random_uuid()::text, 'Illinois', 'illinois', 'IL', '17', NOW()),
    (gen_random_uuid()::text, 'Indiana', 'indiana', 'IN', '18', NOW()),
    (gen_random_uuid()::text, 'Iowa', 'iowa', 'IA', '19', NOW()),
    (gen_random_uuid()::text, 'Kansas', 'kansas', 'KS', '20', NOW()),
    (gen_random_uuid()::text, 'Kentucky', 'kentucky', 'KY', '21', NOW()),
    (gen_random_uuid()::text, 'Louisiana', 'louisiana', 'LA', '22', NOW()),
    (gen_random_uuid()::text, 'Maine', 'maine', 'ME', '23', NOW()),
    (gen_random_uuid()::text, 'Maryland', 'maryland', 'MD', '24', NOW()),
    (gen_random_uuid()::text, 'Massachusetts', 'massachusetts', 'MA', '25', NOW()),
    (gen_random_uuid()::text, 'Michigan', 'michigan', 'MI', '26', NOW()),
    (gen_random_uuid()::text, 'Minnesota', 'minnesota', 'MN', '27', NOW()),
    (gen_random_uuid()::text, 'Mississippi', 'mississippi', 'MS', '28', NOW()),
    (gen_random_uuid()::text, 'Missouri', 'missouri', 'MO', '29', NOW()),
    (gen_random_uuid()::text, 'Montana', 'montana', 'MT', '30', NOW()),
    (gen_random_uuid()::text, 'Nebraska', 'nebraska', 'NE', '31', NOW()),
    (gen_random_uuid()::text, 'Nevada', 'nevada', 'NV', '32', NOW()),
    (gen_random_uuid()::text, 'New Hampshire', 'new-hampshire', 'NH', '33', NOW()),
    (gen_random_uuid()::text, 'New Jersey', 'new-jersey', 'NJ', '34', NOW()),
    (gen_random_uuid()::text, 'New Mexico', 'new-mexico', 'NM', '35', NOW()),
    (gen_random_uuid()::text, 'New York', 'new-york', 'NY', '36', NOW()),
    (gen_random_uuid()::text, 'North Carolina', 'north-carolina', 'NC', '37', NOW()),
    (gen_random_uuid()::text, 'North Dakota', 'north-dakota', 'ND', '38', NOW()),
    (gen_random_uuid()::text, 'Ohio', 'ohio', 'OH', '39', NOW()),
    (gen_random_uuid()::text, 'Oklahoma', 'oklahoma', 'OK', '40', NOW()),
    (gen_random_uuid()::text, 'Oregon', 'oregon', 'OR', '41', NOW()),
    (gen_random_uuid()::text, 'Pennsylvania', 'pennsylvania', 'PA', '42', NOW()),
    (gen_random_uuid()::text, 'Rhode Island', 'rhode-island', 'RI', '44', NOW()),
    (gen_random_uuid()::text, 'South Carolina', 'south-carolina', 'SC', '45', NOW()),
    (gen_random_uuid()::text, 'South Dakota', 'south-dakota', 'SD', '46', NOW()),
    (gen_random_uuid()::text, 'Tennessee', 'tennessee', 'TN', '47', NOW()),
    (gen_random_uuid()::text, 'Texas', 'texas', 'TX', '48', NOW()),
    (gen_random_uuid()::text, 'Utah', 'utah', 'UT', '49', NOW()),
    (gen_random_uuid()::text, 'Vermont', 'vermont', 'VT', '50', NOW()),
    (gen_random_uuid()::text, 'Virginia', 'virginia', 'VA', '51', NOW()),
    (gen_random_uuid()::text, 'Washington', 'washington', 'WA', '53', NOW()),
    (gen_random_uuid()::text, 'West Virginia', 'west-virginia', 'WV', '54', NOW()),
    (gen_random_uuid()::text, 'Wisconsin', 'wisconsin', 'WI', '55', NOW()),
    (gen_random_uuid()::text, 'Wyoming', 'wyoming', 'WY', '56', NOW())
ON CONFLICT ("abbreviation") DO NOTHING;


-- =============================================================================
-- NOTE: Counties are seeded via Prisma seed script (3,143 counties)
-- Run: npx prisma db seed
--
-- Courts are seeded via harvest tool:
-- Run: npx tsx scripts/harvest/index.ts --all --seed-courts-only
-- =============================================================================

-- =============================================================================
-- VERIFICATION QUERY
-- =============================================================================
-- After setup, verify with:
--
-- SELECT 'States' as entity, COUNT(*) as count FROM states
-- UNION ALL
-- SELECT 'Counties', COUNT(*) FROM counties  
-- UNION ALL
-- SELECT 'Courts', COUNT(*) FROM courts
-- UNION ALL
-- SELECT 'Judges', COUNT(*) FROM judges;
--
-- Expected (after full seed):
--   States:   51
--   Counties: 3,143
--   Courts:   188 (FL 27 + TX 16 + CA 126 + NY 19)
--   Judges:   2,818+ (after harvest import)
-- =============================================================================
