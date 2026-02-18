/**
 * Name normalization, court type canonicalization, and county name utilities.
 *
 * @module scripts/harvest/normalizer
 */

// We need a dynamic import approach since the main app uses the @/ alias.
// Instead, we duplicate the lightweight normalizeCountyName logic here to
// avoid complex TS path resolution outside the Next.js build.

const COUNTY_SUFFIXES = [
  " county",
  " parish",
  " borough",
  " municipality",
  " census area",
  " city and borough",
  " city",
];

/**
 * Normalize a county name for flexible matching.
 * Mirrors the logic in src/lib/csv.ts normalizeCountyName().
 */
export function normalizeCountyName(name: string): string {
  const normalized = name.toLowerCase().trim();
  for (const suffix of COUNTY_SUFFIXES) {
    if (normalized.endsWith(suffix)) {
      return normalized.slice(0, -suffix.length);
    }
  }
  return normalized;
}

// ---------------------------------------------------------------------------
// Honorific / title prefixes to strip from judge names
// ---------------------------------------------------------------------------

const TITLE_PREFIXES = [
  "chief justice",
  "chief judge",
  "senior judge",
  "associate justice",
  "justice",
  "judge",
  "hon.",
  "honorable",
  "the honorable",
];

/**
 * Normalize a judge name to "First Last" format.
 *
 * - Strip honorific / title prefixes (Hon., Judge, Justice, Chief, etc.)
 * - Handle "Last, First" → "First Last"
 * - Preserve suffixes (Jr., Sr., III, IV, etc.)
 * - Trim extra whitespace
 */
export function normalizeJudgeName(raw: string): string {
  let name = raw.trim();

  // Strip title prefixes (case-insensitive, greedy from longest)
  const lowerName = name.toLowerCase();
  for (const prefix of TITLE_PREFIXES) {
    if (lowerName.startsWith(prefix)) {
      name = name.slice(prefix.length).trim();
      // Remove leading punctuation after prefix (e.g., "Hon. " → "")
      name = name.replace(/^[.,:\s]+/, "");
      break; // Only strip the first matching prefix
    }
  }

  // Handle "Last, First [Middle] [Suffix]" format
  // Only convert if there's exactly one comma and first part looks like a last name
  if (name.includes(",")) {
    const parts = name.split(",").map((p) => p.trim());
    if (parts.length === 2 && parts[0] && parts[1]) {
      // Check that the first part doesn't contain a suffix indicator
      // e.g., "Smith Jr., John" shouldn't be reversed
      const suffixes = /^(jr|sr|ii|iii|iv|v|esq)\.?$/i;
      const firstPartWords = parts[0].split(/\s+/);
      const lastWord = firstPartWords[firstPartWords.length - 1];

      if (!suffixes.test(lastWord)) {
        // "Last, First Middle" → "First Middle Last"
        name = `${parts[1]} ${parts[0]}`;
      }
    }
  }

  // Collapse multiple spaces
  name = name.replace(/\s+/g, " ").trim();

  return name;
}

// ---------------------------------------------------------------------------
// Court type canonicalization
// ---------------------------------------------------------------------------

const COURT_TYPE_MAP: Record<string, string> = {
  "supreme court": "Supreme Court",
  "district court of appeal": "District Court of Appeal",
  "district court of appeals": "District Court of Appeal",
  dca: "District Court of Appeal",
  "circuit court": "Circuit Court",
  "circuit ct": "Circuit Court",
  "circuit ct.": "Circuit Court",
  "county court": "County Court",
  "county ct": "County Court",
  "county ct.": "County Court",
};

const CANONICAL_COURT_TYPES = [
  "Supreme Court",
  "District Court of Appeal",
  "Circuit Court",
  "County Court",
];

/**
 * Map a court type string to its canonical form.
 * Returns the canonical name, or the original string if no mapping found.
 */
export function canonicalizeCourtType(raw: string): string {
  const lower = raw.toLowerCase().trim();

  // Direct map lookup
  if (COURT_TYPE_MAP[lower]) {
    return COURT_TYPE_MAP[lower];
  }

  // Check if it's already canonical
  if (CANONICAL_COURT_TYPES.includes(raw.trim())) {
    return raw.trim();
  }

  // Partial match fallback
  for (const canonical of CANONICAL_COURT_TYPES) {
    if (lower.includes(canonical.toLowerCase())) {
      return canonical;
    }
  }

  return raw.trim();
}
