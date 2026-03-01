/**
 * Harvest CLI configuration — flag parsing, env validation, shared types.
 *
 * @module scripts/harvest/config
 */

import path from "node:path";

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
  outputDir: string;
}

/** Shape of a single entry in florida-courts.json → supremeCourt */
export interface SupremeCourtConfig {
  url: string;
  courtType: "Supreme Court";
}

/** Shape of a single entry in florida-courts.json → districtCourts[] */
export interface DistrictCourtConfig {
  district: number;
  name: string;
  url: string;
  courtType: "District Court of Appeal";
  circuits: number[];
  counties: string[];
}

/** Shape of a single entry in florida-courts.json → circuitCourts[] */
export interface CircuitCourtConfig {
  circuit: number;
  url: string;
  courtType: "Circuit Court";
  counties: string[];
}

/** Top-level shape of florida-courts.json */
export interface FloridaCourtsConfig {
  state: string;
  abbreviation: string;
  supremeCourt: SupremeCourtConfig;
  districtCourts: DistrictCourtConfig[];
  circuitCourts: CircuitCourtConfig[];
}

/** A single extracted court URL entry with metadata for the pipeline */
export interface CourtUrlEntry {
  url: string;
  courtType: string;
  counties: string[];
  label: string; // human-readable label for logging
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

  // Data Quality
  confidenceScore: number;
  fieldsFromRoster: string[];
  fieldsFromBio: string[];
  fieldsFromExternal: string[];
}

// ---------------------------------------------------------------------------
// Flag parsing
// ---------------------------------------------------------------------------

export interface CliFlags {
  resume: boolean;
  reset: boolean;
  seedCourtsOnly: boolean;
  dryRun: boolean;
  skipBio: boolean;
  ballotpedia: boolean;
  ballotpediaMax: number | null;
  useIdentity: boolean;
  outputDir: string;
}

export function parseFlags(argv: string[] = process.argv.slice(2)): CliFlags {
  const flags: CliFlags = {
    resume: true,
    reset: false,
    seedCourtsOnly: false,
    dryRun: false,
    skipBio: false,
    ballotpedia: false,
    ballotpediaMax: null,
    useIdentity: true, // Default to identity-based dedup
    outputDir: path.resolve(process.cwd(), "scripts/harvest/output"),
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
        flags.useIdentity = false;
        break;
      case "--use-identity":
        flags.useIdentity = true;
        break;
      case "--output-dir":
        if (argv[i + 1] && !argv[i + 1].startsWith("--")) {
          flags.outputDir = path.resolve(argv[++i]);
        } else {
          console.error("Error: --output-dir requires a path argument");
          process.exit(1);
        }
        break;
      default:
        console.error(`Unknown flag: ${argv[i]}`);
        process.exit(1);
    }
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
}

// ---------------------------------------------------------------------------
// Load florida-courts.json
// ---------------------------------------------------------------------------

export function loadCourtConfig(): FloridaCourtsConfig {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config: FloridaCourtsConfig = require("./florida-courts.json");
  return config;
}

/**
 * Flatten the config into a sequential list of court URL entries for the
 * extraction pipeline.
 */
export function flattenCourtUrls(config: FloridaCourtsConfig): CourtUrlEntry[] {
  const entries: CourtUrlEntry[] = [];

  // Supreme Court
  entries.push({
    url: config.supremeCourt.url,
    courtType: config.supremeCourt.courtType,
    counties: ["Leon"], // Statewide but administratively based in Leon County
    label: "Florida Supreme Court",
  });

  // District Courts of Appeal
  for (const dca of config.districtCourts) {
    entries.push({
      url: dca.url,
      courtType: dca.courtType,
      counties: dca.counties,
      label: dca.name,
    });
  }

  // Circuit Courts (includes county court judges on the same page)
  for (const circuit of config.circuitCourts) {
    entries.push({
      url: circuit.url,
      courtType: circuit.courtType,
      counties: circuit.counties,
      label: `${ordinal(circuit.circuit)} Judicial Circuit`,
    });
  }

  return entries;
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
