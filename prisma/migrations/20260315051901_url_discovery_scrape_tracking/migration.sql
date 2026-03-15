-- CreateEnum
CREATE TYPE "CandidateStatus" AS ENUM ('DISCOVERED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FailureType" AS ENUM ('HTTP_403', 'HTTP_429', 'TIMEOUT', 'CAPTCHA_DETECTED', 'SSL_ERROR', 'DNS_FAILURE', 'EMPTY_PAGE', 'PARSE_ERROR', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "DiscoveryRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "url_candidates" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "domain" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateAbbr" VARCHAR(2) NOT NULL,
    "suggestedType" TEXT,
    "suggestedLevel" TEXT,
    "confidenceScore" DOUBLE PRECISION,
    "searchQuery" TEXT NOT NULL,
    "snippetText" TEXT,
    "pageTitle" TEXT,
    "status" "CandidateStatus" NOT NULL DEFAULT 'DISCOVERED',
    "rejectionReason" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "promotedAt" TIMESTAMP(3),
    "discoveryRunId" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "url_candidates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scrape_failures" (
    "id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateAbbr" VARCHAR(2) NOT NULL,
    "failureType" "FailureType" NOT NULL,
    "httpStatusCode" INTEGER,
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "attemptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "resolutionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scrape_failures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "discovery_runs" (
    "id" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "stateAbbr" VARCHAR(2) NOT NULL,
    "status" "DiscoveryRunStatus" NOT NULL DEFAULT 'RUNNING',
    "queriesRun" INTEGER NOT NULL DEFAULT 0,
    "candidatesFound" INTEGER NOT NULL DEFAULT 0,
    "candidatesNew" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discovery_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "url_candidates_url_key" ON "url_candidates"("url");

-- CreateIndex
CREATE INDEX "url_candidates_state_idx" ON "url_candidates"("state");

-- CreateIndex
CREATE INDEX "url_candidates_status_idx" ON "url_candidates"("status");

-- CreateIndex
CREATE INDEX "url_candidates_discoveredAt_idx" ON "url_candidates"("discoveredAt");

-- CreateIndex
CREATE INDEX "url_candidates_stateAbbr_status_idx" ON "url_candidates"("stateAbbr", "status");

-- CreateIndex
CREATE INDEX "scrape_failures_url_idx" ON "scrape_failures"("url");

-- CreateIndex
CREATE INDEX "scrape_failures_state_idx" ON "scrape_failures"("state");

-- CreateIndex
CREATE INDEX "scrape_failures_failureType_idx" ON "scrape_failures"("failureType");

-- CreateIndex
CREATE INDEX "scrape_failures_resolvedAt_idx" ON "scrape_failures"("resolvedAt");

-- CreateIndex
CREATE INDEX "scrape_failures_stateAbbr_failureType_idx" ON "scrape_failures"("stateAbbr", "failureType");

-- CreateIndex
CREATE INDEX "scrape_failures_attemptedAt_idx" ON "scrape_failures"("attemptedAt");

-- CreateIndex
CREATE INDEX "discovery_runs_status_idx" ON "discovery_runs"("status");

-- CreateIndex
CREATE INDEX "discovery_runs_state_idx" ON "discovery_runs"("state");

-- CreateIndex
CREATE INDEX "discovery_runs_startedAt_idx" ON "discovery_runs"("startedAt");

-- AddForeignKey
ALTER TABLE "url_candidates" ADD CONSTRAINT "url_candidates_discoveryRunId_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "discovery_runs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
