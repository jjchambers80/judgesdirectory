-- Migration: add_search_index
-- Feature: 009-search-discovery
-- Purpose: Enable PostgreSQL trigram extension for fuzzy text search on judge names

-- Enable pg_trgm extension for fuzzy text search
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on judges.fullName for ILIKE queries with trigram support
-- GIN is faster for read-heavy workloads (search), GiST better for frequent updates
-- Note: Not using CONCURRENTLY as Prisma migrations run in transactions
CREATE INDEX IF NOT EXISTS idx_judges_fullname_trgm 
ON judges USING GIN ("fullName" gin_trgm_ops);
