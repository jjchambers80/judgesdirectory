/**
 * Zod validation schemas for state court configuration files.
 *
 * Defines StateConfig, CourtEntry, and RateLimitConfig schemas with
 * defaults and constraints per data-model.md.
 *
 * @module scripts/harvest/state-config-schema
 */

import { z } from "zod";

// ---------------------------------------------------------------------------
// RateLimitConfig
// ---------------------------------------------------------------------------

const RateLimitObjectSchema = z.object({
  fetchDelayMs: z.number().min(500).default(2000),
  maxConcurrent: z.number().int().min(1).default(1),
  requestTimeoutMs: z.number().min(5000).default(15000),
  maxRetries: z.number().int().min(0).default(3),
});

export const RateLimitConfigSchema = RateLimitObjectSchema.default({
  fetchDelayMs: 2000,
  maxConcurrent: 1,
  requestTimeoutMs: 15000,
  maxRetries: 3,
});

export type RateLimitConfig = z.infer<typeof RateLimitConfigSchema>;

// ---------------------------------------------------------------------------
// CourtEntry
// ---------------------------------------------------------------------------

export const CourtEntrySchema = z.object({
  url: z.string().url(),
  courtType: z.string().min(1),
  level: z.enum(["supreme", "appellate", "trial", "specialized"]),
  label: z.string().min(1),
  counties: z.array(z.string()),
  district: z.number().int().nullable().optional().default(null),
  circuit: z.number().int().nullable().optional().default(null),
  department: z.number().int().nullable().optional().default(null),
  division: z.string().nullable().optional().default(null),
  judicialDistrict: z.number().int().nullable().optional().default(null),
  parentCourt: z.string().nullable().optional().default(null),
  fetchMethod: z.enum(["http", "browser", "manual", "scrapling", "auto"]).default("http"),
  deterministic: z.boolean().default(false),
  selectorHint: z.string().nullable().optional().default(null),
  notes: z.string().nullable().optional().default(null),
});

export type CourtEntry = z.infer<typeof CourtEntrySchema>;

// ---------------------------------------------------------------------------
// StateConfig
// ---------------------------------------------------------------------------

export const StateConfigSchema = z
  .object({
    state: z.string().min(1),
    abbreviation: z
      .string()
      .length(2)
      .regex(/^[A-Z]{2}$/, "Must be 2 uppercase letters"),
    rateLimit: RateLimitConfigSchema,
    extractionPromptFile: z.string().optional(),
    countyAliases: z
      .record(z.string().min(1), z.string().min(1))
      .optional()
      .default({}),
    courts: z.array(CourtEntrySchema).min(1, "At least one court is required"),
  })
  .refine((config) => config.courts.some((c) => c.level === "supreme"), {
    message: "Config should have at least one court with level 'supreme'",
    path: ["courts"],
  });

export type StateConfig = z.infer<typeof StateConfigSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// HarvestManifest (written after each successful harvest run)
// ---------------------------------------------------------------------------

/**
 * Zod schema for the harvest manifest file.
 * Written to output/{state-slug}/harvest-manifest.json after each successful run.
 */
export const HarvestManifestSchema = z.object({
  /** ISO 8601 timestamp of last successful run completion */
  lastCompletedAt: z.string().datetime(),
  /** Total judges in the final output CSV */
  judgeCount: z.number().int().min(0),
  /** Filename of the quality report generated */
  reportFile: z.string().min(1),
  /** Total roster pages targeted */
  pagesTargeted: z.number().int().min(1),
  /** Pages that failed to fetch or extract */
  pagesFailed: z.number().int().min(0),
  /** Quality gate verdict from the run */
  qualityVerdict: z.enum(["PASS", "WARNING", "CRITICAL"]),
});

export type HarvestManifest = z.infer<typeof HarvestManifestSchema>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Derive a URL-safe state slug from a state name.
 * e.g. "New York" → "new-york", "Florida" → "florida"
 */
export function stateSlug(stateName: string): string {
  return stateName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Check for duplicate URLs within a config and log warnings.
 * Returns the list of duplicate URLs found.
 */
export function checkDuplicateUrls(config: StateConfig): string[] {
  const seen = new Set<string>();
  const duplicates: string[] = [];

  for (const court of config.courts) {
    if (seen.has(court.url)) {
      duplicates.push(court.url);
    }
    seen.add(court.url);
  }

  return duplicates;
}
