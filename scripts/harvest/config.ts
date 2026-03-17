/**
 * Harvest CLI configuration — flag parsing, env validation, shared types.
 *
 * State configuration loading uses Zod-validated JSON files.
 * Re-exports StateConfig and CourtEntry from state-config-schema.ts.
 *
 * @module scripts/harvest/config
 */

import fs from "node:fs";
import path from "node:path";
import {
  StateConfigSchema,
  checkDuplicateUrls,
  stateSlug,
} from "./state-config-schema";
import type { StateConfig, CourtEntry } from "./state-config-schema";

// Re-export state config types for consumers
export type { StateConfig, CourtEntry } from "./state-config-schema";
export { stateSlug } from "./state-config-schema";
export type { RateLimitConfig } from "./state-config-schema";

// ---------------------------------------------------------------------------
// Shared interfaces
// ---------------------------------------------------------------------------

export interface CliFlags {
  resume: boolean;
  reset: boolean;
  seedCourtsOnly: boolean;
  dryRun: boolean;
  skipBio: boolean;
  ballotpedia: boolean;
  ballotpediaMax: number | null;
  exa: boolean;
  exaMax: number | null;
  outputDir: string;
  // State selection flags (new)
  state: string | null;
  all: boolean;
  list: boolean;
  // Health & delta flags (Feature 012)
  delta: boolean;
  skipBroken: boolean;
  skipBrokenThreshold: number;
}

/** A single extracted court URL entry with metadata for the pipeline */
export interface CourtUrlEntry {
  url: string;
  courtType: string;
  level: string;
  counties: string[];
  label: string;
  // Pipeline hints from CourtEntry
  fetchMethod?: "http" | "browser" | "manual";
  deterministic?: boolean;
  selectorHint?: string | null;
  district?: number | null;
  circuit?: number | null;
}

/** Checkpoint stored between runs for resume support */
export interface Checkpoint {
  startedAt: string;
  lastUpdated: string;
  completedUrls: string[];
  results: Record<
    string,
    { url: string; judgesFound: number; errors: string[] }
  >;
  totalJudges: number;
}

/** A single judge record ready for CSV output (basic roster data) */
export interface CsvJudgeRecord {
  "Judge Name": string;
  "Court Type": string;
  County: string;
  State: string;
  "Source URL": string;
  "Selection Method": string;
}

/** Enriched judge record with full profile data */
export interface EnrichedJudgeRecord {
  // Identity
  fullName: string;
  photoUrl: string | null;

  // Court Assignment
  courtType: string;
  county: string | null;
  state: string;
  division: string | null;
  isChiefJudge: boolean;

  // Term & Selection
  termStart: string | null;
  termEnd: string | null;
  selectionMethod: string | null;
  appointingAuthority: string | null;
  appointmentDate: string | null;

  // Biographical
  birthDate: string | null;
  education: string | null;
  priorExperience: string | null;
  politicalAffiliation: string | null;
  barAdmissionDate: string | null;
  barAdmissionState: string | null;

  // Contact
  courthouseAddress: string | null;
  courthousePhone: string | null;

  // Source Attribution
  rosterUrl: string;
  bioPageUrl: string | null;
  sourceAuthority: string | null;
  extractionMethod: string | null;

  // Data Quality
  confidenceScore: number;
  fieldsFromRoster: string[];
  fieldsFromBio: string[];
  fieldsFromExternal: string[];
}

// ---------------------------------------------------------------------------
// Health & Delta types (Feature 012)
// ---------------------------------------------------------------------------

/** Health score computation weights — tunable without schema changes */
export const HEALTH_WEIGHTS = {
  successRate: 0.40,
  yieldConsistency: 0.30,
  freshness: 0.20,
  volumeScore: 0.10,
} as const;

/** Number of recent scrape logs to consider for health score */
export const HEALTH_WINDOW_SIZE = 10;

/** Days after which a URL is considered stale for delta runs */
export const DELTA_STALE_DAYS = 7;

/** Freshness decay window in days (aligns with DATA_FRESHNESS_THRESHOLD_DAYS) */
export const FRESHNESS_DECAY_DAYS = 90;

/** Default expected yield for first-time URLs with no history */
export const DEFAULT_EXPECTED_YIELD = 5;

/** Anomaly detection threshold — yield drop percentage */
export const ANOMALY_DROP_THRESHOLD = 0.5;

export type DeltaBucket =
  | "stale-healthy"
  | "never-scraped"
  | "stale-moderate"
  | "stale-unhealthy"
  | "fresh";

export interface DeltaBucketResult {
  bucket: DeltaBucket;
  urls: string[];
  skipped: boolean;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

export function parseFlags(argv: string[] = process.argv.slice(2)): CliFlags {
  const flags: CliFlags = {
    resume: true,
    reset: false,
    seedCourtsOnly: false,
    dryRun: false,
    skipBio: false,
    ballotpedia: false,
    ballotpediaMax: null,
    exa: false,
    exaMax: null,
    outputDir: path.resolve(process.cwd(), "scripts/harvest/output"),
    state: null,
    all: false,
    list: false,
    delta: false,
    skipBroken: false,
    skipBrokenThreshold: 0.2,
  };

  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--reset":
        flags.reset = true;
        flags.resume = false;
        break;
      case "--seed-courts-only":
        flags.seedCourtsOnly = true;
        break;
      case "--dry-run":
        flags.dryRun = true;
        break;
      case "--resume":
        flags.resume = true;
        break;
      case "--skip-bio":
        flags.skipBio = true;
        break;
      case "--ballotpedia":
        flags.ballotpedia = true;
        break;
      case "--ballotpedia-max":
        if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          flags.ballotpedia = true;
          flags.ballotpediaMax = parseInt(argv[++i], 10);
        } else {
          console.error("Error: --ballotpedia-max requires a number argument");
          process.exit(1);
        }
        break;
      case "--no-identity":
        flags.outputDir = flags.outputDir; // no-op to keep switch exhaustive
        break;
      case "--use-identity":
        break;
      case "--exa":
        flags.exa = true;
        break;
      case "--exa-max":
        if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          flags.exa = true;
          flags.exaMax = parseInt(argv[++i], 10);
        } else {
          console.error("Error: --exa-max requires a number argument");
          process.exit(1);
        }
        break;
      case "--output-dir":
        if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          flags.outputDir = path.resolve(argv[++i]);
        } else {
          console.error("Error: --output-dir requires a path argument");
          process.exit(1);
        }
        break;
      case "--state":
        if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          flags.state = argv[++i].toLowerCase();
        } else {
          console.error("Error: --state requires a state name argument");
          process.exit(1);
        }
        break;
      case "--all":
        flags.all = true;
        break;
      case "--list":
        flags.list = true;
        break;
      case "--delta":
        flags.delta = true;
        break;
      case "--skip-broken":
        flags.skipBroken = true;
        break;
      case "--skip-broken-threshold":
        if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          flags.skipBroken = true;
          flags.skipBrokenThreshold = parseFloat(argv[++i]);
        } else {
          console.error("Error: --skip-broken-threshold requires a number argument");
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown flag: ${argv[i]}`);
        process.exit(1);
    }
  }

  // Mutual exclusion: --state and --all cannot be combined
  if (flags.state && flags.all) {
    console.error("Error: --state and --all are mutually exclusive");
    process.exit(1);
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------

export function validateEnv(flags: CliFlags): void {
  if (flags.seedCourtsOnly) {
    if (!process.env.DATABASE_URL) {
      console.error("Error: DATABASE_URL is required for --seed-courts-only");
      process.exit(1);
    }
    return;
  }

  if (flags.dryRun) {
    // Dry run doesn't need an API key
    return;
  }

  // Check for appropriate API key based on LLM provider
  const provider = process.env.LLM_PROVIDER?.toLowerCase() || "openai";

  if (provider === "anthropic") {
    if (!process.env.ANTHROPIC_API_KEY) {
      console.error(
        'Error: ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic. Set it via:\n  export ANTHROPIC_API_KEY="sk-ant-..."',
      );
      process.exit(1);
    }
  } else {
    // Default to OpenAI
    if (!process.env.OPENAI_API_KEY) {
      console.error(
        'Error: OPENAI_API_KEY is required. Set it via:\n  export OPENAI_API_KEY="sk-..."',
      );
      process.exit(1);
    }
  }

  // Exa enrichment requires EXA_API_KEY
  if (flags.exa && !process.env.EXA_API_KEY) {
    console.error(
      'Error: EXA_API_KEY is required for --exa. Get one at https://dashboard.exa.ai/api-keys\n  export EXA_API_KEY="..."',
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// State config loading
// ---------------------------------------------------------------------------

/** Directory containing state config JSON files */
const HARVEST_DIR = path.resolve(__dirname);

/**
 * Load and validate a state's court configuration.
 * Reads {stateName}-courts.json from the harvest directory, validates via Zod.
 */
export function loadStateConfig(stateName: string): StateConfig {
  const slug = stateSlug(stateName);
  const configPath = path.join(HARVEST_DIR, `${slug}-courts.json`);

  if (!fs.existsSync(configPath)) {
    const available = discoverStates();
    console.error(
      `Error: No configuration found for state "${stateName}". Available: ${available.join(", ") || "(none)"}`,
    );
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  const result = StateConfigSchema.safeParse(raw);

  if (!result.success) {
    console.error(
      `Error: Invalid configuration for ${stateName}: ${result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
    process.exit(1);
  }

  // Warn on duplicate URLs
  const duplicates = checkDuplicateUrls(result.data);
  if (duplicates.length > 0) {
    console.warn(
      `Warning: Duplicate URLs in ${slug}-courts.json: ${duplicates.join(", ")}`,
    );
  }

  return result.data;
}

/**
 * Discover all available state configurations by scanning for *-courts.json files.
 * Returns an array of state slugs (e.g., ["florida", "texas", "new-york"]).
 */
export function discoverStates(): string[] {
  const files = fs.readdirSync(HARVEST_DIR);
  return files
    .filter((f) => f.endsWith("-courts.json"))
    .map((f) => f.replace("-courts.json", ""))
    .sort();
}

/**
 * Convert a StateConfig's courts array into CourtUrlEntry[] for the pipeline.
 * This replaces the old flattenCourtUrls() — the flat courts[] format makes
 * this a straightforward mapping rather than a structural transformation.
 */
export function buildCourtUrlEntries(config: StateConfig): CourtUrlEntry[] {
  return config.courts.map((court: CourtEntry) => ({
    url: court.url,
    courtType: court.courtType,
    level: court.level,
    counties: court.counties,
    label: court.label,
    fetchMethod: court.fetchMethod ?? "http",
    deterministic: court.deterministic ?? false,
    selectorHint: court.selectorHint ?? null,
    district: court.district ?? null,
    circuit: court.circuit ?? null,
  }));
}
