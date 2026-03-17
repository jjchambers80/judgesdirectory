/**
 * CSV Parser for Judge Import
 * 
 * Parses enriched harvest CSV files and maps columns to Judge model fields.
 * 
 * @module scripts/import/csv-importer
 */

import fs from 'node:fs';
import path from 'node:path';
import Papa from 'papaparse';

// CSV column names from harvest output
export interface CsvRow {
  'Judge Name': string;
  'Court Type': string;
  'County': string;
  'State': string;
  'Division': string;
  'Is Chief Judge': string;
  'Photo URL': string;
  'Term Start': string;
  'Term End': string;
  'Selection Method': string;
  'Appointing Authority': string;
  'Appointment Date': string;
  'Birth Date': string;
  'Education': string;
  'Prior Experience': string;
  'Political Affiliation': string;
  'Bar Admission Date': string;
  'Bar Admission State': string;
  'Courthouse Address': string;
  'Courthouse Phone': string;
  'Roster URL': string;
  'Bio Page URL': string;
  'Confidence Score': string;
  'Source Authority'?: string;
  'Extraction Method'?: string;
}

// Parsed judge record ready for database import
export interface ParsedJudge {
  fullName: string;
  slug: string;
  courtType: string;
  county: string | null;
  state: string;
  division: string | null;
  isChiefJudge: boolean;
  photoUrl: string | null;
  termStart: Date | null;
  termEnd: Date | null;
  selectionMethod: string | null;
  appointingAuthority: string | null;
  appointmentDate: Date | null;
  birthDate: Date | null;
  education: string | null;
  priorExperience: string | null;
  politicalAffiliation: string | null;
  barAdmissionDate: Date | null;
  barAdmissionState: string | null;
  courthouseAddress: string | null;
  courthousePhone: string | null;
  sourceUrl: string | null;
  rosterUrl: string | null;
  sourceAuthority: string;
  extractionMethod: string | null;
  confidenceScore: number;
}

/**
 * Find the most recent enriched CSV file in the output directory
 */
export function findLatestCsv(outputDir: string): string | null {
  if (!fs.existsSync(outputDir)) {
    return null;
  }

  const files = fs.readdirSync(outputDir)
    .filter(f => f.startsWith('florida-judges-enriched-') && f.endsWith('.csv'))
    .sort()
    .reverse();

  if (files.length === 0) {
    return null;
  }

  return path.join(outputDir, files[0]);
}

/**
 * Parse a date string in various formats
 */
function parseDate(dateStr: string | undefined | null): Date | null {
  if (!dateStr || dateStr.trim() === '') {
    return null;
  }

  const trimmed = dateStr.trim();

  // Handle year-only (e.g., "2015" or "2015-01-01")
  if (/^\d{4}$/.test(trimmed)) {
    return new Date(`${trimmed}-01-01`);
  }

  // Handle ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
  }

  // Handle "January 1, 2020" format
  const parsed = Date.parse(trimmed);
  if (!isNaN(parsed)) {
    return new Date(parsed);
  }

  return null;
}

/**
 * Create a URL-friendly slug from a judge name
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Parse a single CSV row into a ParsedJudge record
 */
export function parseRow(row: CsvRow): ParsedJudge {
  const name = row['Judge Name']?.trim() || '';
  
  // Backward compatibility: default Source Authority to COURT_WEBSITE
  // and Extraction Method to null when columns are absent (FR-012)
  const VALID_SOURCE_AUTHORITIES = ['OFFICIAL_GOV', 'COURT_WEBSITE', 'ELECTION_RECORDS', 'SECONDARY'];
  const rawSourceAuthority = row['Source Authority']?.trim() || '';
  const sourceAuthority = VALID_SOURCE_AUTHORITIES.includes(rawSourceAuthority)
    ? rawSourceAuthority
    : 'COURT_WEBSITE';

  const rawExtractionMethod = row['Extraction Method']?.trim() || '';
  const extractionMethod = rawExtractionMethod === 'deterministic' || rawExtractionMethod === 'llm'
    ? rawExtractionMethod
    : null;

  return {
    fullName: name,
    slug: slugify(name),
    courtType: row['Court Type']?.trim() || '',
    county: row['County']?.trim() || null,
    state: row['State']?.trim() || 'FL',
    division: row['Division']?.trim() || null,
    isChiefJudge: row['Is Chief Judge']?.toLowerCase() === 'yes',
    photoUrl: row['Photo URL']?.trim() || null,
    termStart: parseDate(row['Term Start']),
    termEnd: parseDate(row['Term End']),
    selectionMethod: row['Selection Method']?.trim() || null,
    appointingAuthority: row['Appointing Authority']?.trim() || null,
    appointmentDate: parseDate(row['Appointment Date']),
    birthDate: parseDate(row['Birth Date']),
    education: row['Education']?.trim() || null,
    priorExperience: row['Prior Experience']?.trim() || null,
    politicalAffiliation: row['Political Affiliation']?.trim() || null,
    barAdmissionDate: parseDate(row['Bar Admission Date']),
    barAdmissionState: row['Bar Admission State']?.trim() || null,
    courthouseAddress: row['Courthouse Address']?.trim() || null,
    courthousePhone: row['Courthouse Phone']?.trim() || null,
    // Prefer bio page URL over roster URL as source
    sourceUrl: row['Bio Page URL']?.trim() || row['Roster URL']?.trim() || null,
    rosterUrl: row['Roster URL']?.trim() || null,
    sourceAuthority,
    extractionMethod,
    confidenceScore: parseFloat(row['Confidence Score']) || 0,
  };
}

/**
 * Parse a CSV file and return all judge records
 */
export async function parseCsvFile(filePath: string): Promise<{
  judges: ParsedJudge[];
  fileName: string;
  totalRows: number;
}> {
  const content = fs.readFileSync(filePath, 'utf-8');
  const fileName = path.basename(filePath);

  return new Promise((resolve, reject) => {
    Papa.parse<CsvRow>(content, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const judges = results.data.map(parseRow);
        resolve({
          judges,
          fileName,
          totalRows: results.data.length,
        });
      },
      error: (error: Error) => {
        reject(new Error(`CSV parse error: ${error.message}`));
      },
    });
  });
}

/**
 * Get the default output directory for harvest CSVs
 */
export function getDefaultOutputDir(): string {
  return path.resolve(__dirname, '../harvest/output');
}
