-- CreateEnum
CREATE TYPE "YieldTrend" AS ENUM ('IMPROVING', 'STABLE', 'DECLINING');

-- CreateEnum
CREATE TYPE "HealthSource" AS ENUM ('DISCOVERED', 'MANUAL');

-- CreateTable
CREATE TABLE "url_health" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateAbbr" VARCHAR(2) NOT NULL,
    "healthScore" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "totalScrapes" INTEGER NOT NULL DEFAULT 0,
    "successfulScrapes" INTEGER NOT NULL DEFAULT 0,
    "lastYield" INTEGER,
    "avgYield" DOUBLE PRECISION,
    "yieldTrend" "YieldTrend" NOT NULL DEFAULT 'STABLE',
    "anomalyDetected" BOOLEAN NOT NULL DEFAULT false,
    "anomalyMessage" TEXT,
    "lastScrapedAt" TIMESTAMP(3),
    "lastSuccessAt" TIMESTAMP(3),
    "source" "HealthSource" NOT NULL DEFAULT 'MANUAL',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "url_health_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_logs" (
    "id" TEXT NOT NULL,
    "urlHealthId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateAbbr" VARCHAR(2) NOT NULL,
    "success" BOOLEAN NOT NULL,
    "judgesFound" INTEGER NOT NULL DEFAULT 0,
    "failureType" "FailureType",
    "httpStatusCode" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "scrapeDurationMs" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "scrapedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "url_health_url_key" ON "url_health"("url");

-- CreateIndex
CREATE INDEX "url_health_stateAbbr_healthScore_idx" ON "url_health"("stateAbbr", "healthScore");

-- CreateIndex
CREATE INDEX "url_health_healthScore_idx" ON "url_health"("healthScore");

-- CreateIndex
CREATE INDEX "url_health_lastSuccessAt_idx" ON "url_health"("lastSuccessAt");

-- CreateIndex
CREATE INDEX "url_health_anomalyDetected_idx" ON "url_health"("anomalyDetected");

-- CreateIndex
CREATE INDEX "url_health_active_idx" ON "url_health"("active");

-- CreateIndex
CREATE INDEX "scrape_logs_urlHealthId_idx" ON "scrape_logs"("urlHealthId");

-- CreateIndex
CREATE INDEX "scrape_logs_url_idx" ON "scrape_logs"("url");

-- CreateIndex
CREATE INDEX "scrape_logs_stateAbbr_success_idx" ON "scrape_logs"("stateAbbr", "success");

-- CreateIndex
CREATE INDEX "scrape_logs_failureType_idx" ON "scrape_logs"("failureType");

-- CreateIndex
CREATE INDEX "scrape_logs_scrapedAt_idx" ON "scrape_logs"("scrapedAt");

-- CreateIndex
CREATE INDEX "scrape_logs_resolvedAt_idx" ON "scrape_logs"("resolvedAt");

-- AddForeignKey
ALTER TABLE "scrape_logs" ADD CONSTRAINT "scrape_logs_urlHealthId_fkey" FOREIGN KEY ("urlHealthId") REFERENCES "url_health"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Data Migration: ScrapeFailure → UrlHealth + ScrapeLog
-- ---------------------------------------------------------------------------

-- Step 1: Create a UrlHealth record for each unique URL in scrape_failures
INSERT INTO "url_health" ("id", "url", "domain", "state", "stateAbbr", "healthScore", "totalScrapes", "successfulScrapes", "source", "active", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  sf."url",
  substring(sf."url" from '://([^/]+)'),
  sf."state",
  sf."stateAbbr",
  0.0,
  COUNT(*)::integer,
  0,
  'MANUAL'::"HealthSource",
  true,
  MIN(sf."createdAt"),
  NOW()
FROM "scrape_failures" sf
GROUP BY sf."url", sf."state", sf."stateAbbr";

-- Step 2: Copy each ScrapeFailure record into ScrapeLog (as failures)
INSERT INTO "scrape_logs" ("id", "urlHealthId", "url", "state", "stateAbbr", "success", "judgesFound", "failureType", "httpStatusCode", "errorMessage", "retryCount", "resolvedAt", "resolvedBy", "resolutionNotes", "scrapedAt", "createdAt", "updatedAt")
SELECT
  gen_random_uuid(),
  uh."id",
  sf."url",
  sf."state",
  sf."stateAbbr",
  false,
  0,
  sf."failureType",
  sf."httpStatusCode",
  sf."errorMessage",
  sf."retryCount",
  sf."resolvedAt",
  sf."resolvedBy",
  sf."resolutionNotes",
  sf."attemptedAt",
  sf."createdAt",
  NOW()
FROM "scrape_failures" sf
JOIN "url_health" uh ON uh."url" = sf."url";
