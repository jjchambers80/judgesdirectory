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
// Court type canonicalization — per-state registry
// ---------------------------------------------------------------------------

/**
 * Per-state court type mapping registry.
 * Key: state abbreviation (uppercase). Value: mapping of lowercase aliases → canonical name.
 */
const STATE_COURT_TYPE_REGISTRY = new Map<string, Record<string, string>>();

/**
 * Register court type mappings for a state.
 * Entries are lowercase alias → canonical display name.
 */
export function registerStateCourtTypes(
  abbreviation: string,
  mapping: Record<string, string>,
): void {
  STATE_COURT_TYPE_REGISTRY.set(abbreviation.toUpperCase(), mapping);
}

/**
 * Get the court type mapping for a specific state.
 */
export function getCourtTypeMapping(
  abbreviation: string,
): Record<string, string> | undefined {
  return STATE_COURT_TYPE_REGISTRY.get(abbreviation.toUpperCase());
}

// Register Florida mappings as default
registerStateCourtTypes("FL", {
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
});

// Register Texas mappings
registerStateCourtTypes("TX", {
  "supreme court": "Supreme Court",
  "supreme court of texas": "Supreme Court",
  "court of criminal appeals": "Court of Criminal Appeals",
  cca: "Court of Criminal Appeals",
  "court of appeals": "Court of Appeals",
  "courts of appeals": "Court of Appeals",
  coa: "Court of Appeals",
  "district court": "District Court",
  "district ct": "District Court",
  "district ct.": "District Court",
});

// Register California mappings
registerStateCourtTypes("CA", {
  "supreme court": "Supreme Court",
  "supreme court of california": "Supreme Court",
  "court of appeal": "Court of Appeal",
  "courts of appeal": "Court of Appeal",
  "district court of appeal": "Court of Appeal",
  "appellate court": "Court of Appeal",
  "superior court": "Superior Court",
  "superior ct": "Superior Court",
  "superior ct.": "Superior Court",
});

// Register New York mappings
registerStateCourtTypes("NY", {
  "court of appeals": "Court of Appeals",
  "appellate division": "Appellate Division",
  "appellate div": "Appellate Division",
  "appellate div.": "Appellate Division",
  "supreme court": "Supreme Court",
  "supreme ct": "Supreme Court",
  "supreme ct.": "Supreme Court",
  "county court": "County Court",
  "county ct": "County Court",
  "county ct.": "County Court",
  "family court": "Family Court",
  "family ct": "Family Court",
  "family ct.": "Family Court",
  "surrogate's court": "Surrogate's Court",
  "surrogates court": "Surrogate's Court",
  "surrogate court": "Surrogate's Court",
  "civil court": "Civil Court",
  "criminal court": "Criminal Court",
});

// Legacy global map (union of all registered state mappings, used as fallback)
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
 * Checks state-specific registry first, then falls back to global map.
 *
 * @param raw The raw court type string
 * @param stateAbbreviation Optional 2-letter state code for state-specific mapping
 */
export function canonicalizeCourtType(
  raw: string,
  stateAbbreviation?: string,
): string {
  const lower = raw.toLowerCase().trim();

  // Try state-specific mapping first
  if (stateAbbreviation) {
    const stateMap = STATE_COURT_TYPE_REGISTRY.get(
      stateAbbreviation.toUpperCase(),
    );
    if (stateMap && stateMap[lower]) {
      return stateMap[lower];
    }
  }

  // Fall back to global map
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
