import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { MAX_CSV_ROWS } from "@/lib/constants";
import { generateSlug } from "@/lib/slugify";

// Required fields the admin must map for a valid import
export const REQUIRED_FIELDS = ["fullName", "sourceUrl"] as const;

// All mappable target fields
export const TARGET_FIELDS = [
  "fullName",
  "courtType",
  "countyName",
  "stateName",
  "sourceUrl",
  "selectionMethod",
  "appointingAuthority",
  "education",
  "priorExperience",
  "politicalAffiliation",
] as const;

export type TargetField = (typeof TARGET_FIELDS)[number];

export interface ParsedRow {
  row: number;
  data: Record<string, string>;
  status: "valid" | "invalid" | "duplicate";
  errors?: string[];
  reason?: string;
}

export interface CsvParseResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  columns: string[];
  columnMapping: Record<string, string>;
  preview: ParsedRow[];
  unmatchedStates: string[];
  unmatchedCounties: string[];
  courtsToCreate: Array<{
    courtType: string;
    countyName: string;
    stateName: string;
  }>;
  rawData: Record<string, string>[];
}

// Auto-mapping from common CSV header names to target fields
const HEADER_MAP: Record<string, TargetField> = {
  "judge name": "fullName",
  "full name": "fullName",
  "fullname": "fullName",
  name: "fullName",
  "court type": "courtType",
  "courttype": "courtType",
  court: "courtType",
  county: "countyName",
  "county name": "countyName",
  "countyname": "countyName",
  state: "stateName",
  "state name": "stateName",
  "statename": "stateName",
  "source url": "sourceUrl",
  "sourceurl": "sourceUrl",
  source: "sourceUrl",
  url: "sourceUrl",
  "selection method": "selectionMethod",
  "selectionmethod": "selectionMethod",
  "appointing authority": "appointingAuthority",
  "appointingauthority": "appointingAuthority",
  education: "education",
  "prior experience": "priorExperience",
  "priorexperience": "priorExperience",
  experience: "priorExperience",
  "political affiliation": "politicalAffiliation",
  "politicalaffiliation": "politicalAffiliation",
  party: "politicalAffiliation",
};

function autoMapColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const header of headers) {
    const normalized = header.toLowerCase().trim();
    if (HEADER_MAP[normalized]) {
      mapping[header] = HEADER_MAP[normalized];
    }
  }
  return mapping;
}

/**
 * Detect non-UTF-8 encoding issues (EC-002).
 * Checks for replacement characters and null bytes.
 */
function hasEncodingIssues(text: string): boolean {
  // U+FFFD = replacement character (appears when decoding fails)
  if (text.includes("\uFFFD")) return true;
  // Null bytes are not valid in CSV
  if (text.includes("\0")) return true;
  return false;
}

/**
 * Parse a CSV string and return validated results with auto-mapping
 * and duplicate detection.
 */
export async function parseCsv(
  csvText: string,
  stateSlug: string,
): Promise<CsvParseResult> {
  // Check encoding
  if (hasEncodingIssues(csvText)) {
    throw new CsvParseError(
      "File contains invalid characters. Please save as UTF-8 encoding.",
      422,
    );
  }

  const parsed = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
    dynamicTyping: false,
    transformHeader: (h: string) => h.trim(),
  });

  if (parsed.errors.length > 0 && parsed.data.length === 0) {
    throw new CsvParseError(
      "File is not valid CSV: " + parsed.errors[0].message,
      422,
    );
  }

  const rows = parsed.data;

  if (rows.length > MAX_CSV_ROWS) {
    throw new CsvParseError(
      `CSV exceeds ${MAX_CSV_ROWS.toLocaleString()} row limit (has ${rows.length.toLocaleString()} rows)`,
      422,
    );
  }

  const columns = parsed.meta.fields || [];
  const columnMapping = autoMapColumns(columns);

  // Fetch the state for this import
  const state = await prisma.state.findUnique({
    where: { slug: stateSlug },
    include: {
      counties: {
        select: { id: true, name: true, slug: true },
        include: {
          courts: { select: { id: true, type: true, slug: true } },
        },
      },
    },
  });

  if (!state) {
    throw new CsvParseError(`State "${stateSlug}" not found`, 422);
  }

  // Build lookup maps
  const countyByName = new Map(
    state.counties.map((c) => [c.name.toLowerCase(), c]),
  );

  // Build existing judges set for duplicate detection
  const existingJudges = await prisma.judge.findMany({
    where: {
      court: { county: { stateId: state.id } },
    },
    select: { fullName: true, courtId: true },
  });

  const existingSet = new Set(
    existingJudges.map(
      (j) => `${j.fullName.toLowerCase()}:${j.courtId}`,
    ),
  );

  // Track duplicates within the CSV itself
  const csvDedupSet = new Set<string>();

  const preview: ParsedRow[] = [];
  let validRows = 0;
  let invalidRows = 0;
  let duplicateRows = 0;
  const unmatchedStates = new Set<string>();
  const unmatchedCounties = new Set<string>();
  const courtsToCreateSet = new Set<string>();
  const courtsToCreate: Array<{
    courtType: string;
    countyName: string;
    stateName: string;
  }> = [];

  for (let i = 0; i < rows.length; i++) {
    const raw = rows[i];
    const mapped: Record<string, string> = {};

    // Apply column mapping
    for (const [csvCol, targetField] of Object.entries(columnMapping)) {
      if (raw[csvCol] !== undefined) {
        mapped[targetField] = raw[csvCol].trim();
      }
    }

    const errors: string[] = [];

    // Validate required fields
    if (!mapped.fullName || mapped.fullName.length === 0) {
      errors.push("fullName is required");
    } else if (mapped.fullName.length > 200) {
      errors.push("fullName exceeds 200 character limit");
    }

    if (!mapped.sourceUrl || mapped.sourceUrl.length === 0) {
      errors.push("sourceUrl is required");
    } else {
      try {
        new URL(mapped.sourceUrl);
      } catch {
        errors.push("sourceUrl is not a valid URL");
      }
    }

    if (errors.length > 0) {
      invalidRows++;
      preview.push({
        row: i + 1,
        data: mapped,
        status: "invalid",
        errors,
      });
      continue;
    }

    // Resolve county
    const countyName = mapped.countyName || "";
    const county = countyByName.get(countyName.toLowerCase());

    if (countyName && !county) {
      unmatchedCounties.add(countyName);
    }

    // Check for duplicate (within CSV and against DB)
    const courtType = mapped.courtType || "";
    let courtId: string | null = null;

    if (county && courtType) {
      const courtSlug = generateSlug(courtType);
      const court = county.courts.find((c) => c.slug === courtSlug);
      if (court) {
        courtId = court.id;
      } else {
        // Court needs to be auto-created
        const courtKey = `${county.name}:${courtSlug}`;
        if (!courtsToCreateSet.has(courtKey)) {
          courtsToCreateSet.add(courtKey);
          courtsToCreate.push({
            courtType,
            countyName: county.name,
            stateName: state.name,
          });
        }
      }
    }

    const dedupKey = `${mapped.fullName.toLowerCase()}:${courtId || `${countyName.toLowerCase()}:${courtType.toLowerCase()}`}`;

    if (csvDedupSet.has(dedupKey)) {
      duplicateRows++;
      preview.push({
        row: i + 1,
        data: mapped,
        status: "duplicate",
        reason: "Duplicate within CSV",
      });
      continue;
    }

    if (courtId && existingSet.has(`${mapped.fullName.toLowerCase()}:${courtId}`)) {
      duplicateRows++;
      preview.push({
        row: i + 1,
        data: mapped,
        status: "duplicate",
        reason: "Judge already exists at this court",
      });
      csvDedupSet.add(dedupKey);
      continue;
    }

    csvDedupSet.add(dedupKey);
    validRows++;
    // Include first 10 valid rows, all invalid/duplicate in preview
    if (preview.filter((p) => p.status === "valid").length < 10) {
      preview.push({
        row: i + 1,
        data: mapped,
        status: "valid",
      });
    }
  }

  return {
    totalRows: rows.length,
    validRows,
    invalidRows,
    duplicateRows,
    columns,
    columnMapping,
    preview,
    unmatchedStates: Array.from(unmatchedStates),
    unmatchedCounties: Array.from(unmatchedCounties),
    courtsToCreate,
    rawData: rows,
  };
}

export class CsvParseError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "CsvParseError";
    this.statusCode = statusCode;
  }
}
