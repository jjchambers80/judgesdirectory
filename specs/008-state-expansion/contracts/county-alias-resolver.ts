/**
 * Contract: County Alias Resolver
 *
 * Resolves variant county names to canonical database names using
 * per-state alias maps from StateConfig.countyAliases.
 *
 * Used at two pipeline stages:
 *   1. Court seeding — resolve config counties[] before DB lookup
 *   2. Normalization — resolve extracted county names before dedup/CSV
 *
 * @module specs/008-state-expansion/contracts/county-alias-resolver
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A county alias map: variant name (case-insensitive key) → canonical DB name.
 * Stored in StateConfig.countyAliases.
 *
 * Example:
 *   { "Manhattan": "New York", "Brooklyn": "Kings", "Staten Island": "Richmond" }
 */
export type CountyAliasMap = Record<string, string>;

/**
 * Result of resolving a county name against the alias map.
 */
export interface CountyResolution {
  /** The original name as extracted or configured */
  original: string;
  /** The resolved canonical name (may equal original if no alias matched) */
  canonical: string;
  /** Whether an alias was applied */
  aliasApplied: boolean;
}

/**
 * Unresolved county warning — emitted when a name is not found in either
 * the alias map or the database county records.
 */
export interface UnresolvedCountyWarning {
  /** The county name that could not be resolved */
  countyName: string;
  /** The state abbreviation */
  stateAbbreviation: string;
  /** Court entries or judge records affected */
  affectedRecordCount: number;
  /** Context: which pipeline stage detected the issue */
  stage: "court-seeding" | "normalization";
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/**
 * Resolve a county name using the alias map.
 *
 * Lookup is case-insensitive. Returns the canonical name if an alias
 * matches, or the original name if no alias is found.
 *
 * @param countyName - The raw county name from config or extraction
 * @param aliases - The CountyAliasMap from StateConfig.countyAliases
 * @returns CountyResolution with the resolved name
 */
export function resolveCountyAlias(
  countyName: string,
  aliases: CountyAliasMap,
): CountyResolution {
  const normalized = countyName.trim();
  const key = normalized.toLowerCase();

  // Build case-insensitive lookup
  for (const [alias, canonical] of Object.entries(aliases)) {
    if (alias.toLowerCase() === key) {
      return { original: normalized, canonical, aliasApplied: true };
    }
  }

  return { original: normalized, canonical: normalized, aliasApplied: false };
}

/**
 * Resolve all county names in an array using the alias map.
 * Returns resolved names and any warnings for names not found in DB.
 *
 * @param counties - Array of county names to resolve
 * @param aliases - The CountyAliasMap from StateConfig.countyAliases
 * @returns Array of CountyResolution results
 */
export function resolveCountyAliases(
  counties: string[],
  aliases: CountyAliasMap,
): CountyResolution[] {
  return counties.map((name) => resolveCountyAlias(name, aliases));
}
