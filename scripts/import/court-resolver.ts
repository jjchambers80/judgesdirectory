/**
 * Court Resolver for Judge Import
 * 
 * Resolves court references from CSV data to database Court records.
 * Creates Courts and "Statewide" placeholder counties as needed.
 * 
 * @module scripts/import/court-resolver
 */

import { PrismaClient, Court, County, State } from '@prisma/client';

const prisma = new PrismaClient();

// Cache for resolved courts to avoid repeated DB lookups
const courtCache = new Map<string, Court>();
const countyCache = new Map<string, County | null>();
const stateCache = new Map<string, State | null>();

/**
 * Create a URL-friendly slug
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}

/**
 * Normalize county name for matching
 * Handles variations like "Miami-Dade" vs "Miami Dade"
 */
function normalizeCountyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Get state by abbreviation (cached)
 */
async function getState(abbreviation: string): Promise<State | null> {
  const key = abbreviation.toUpperCase();
  
  if (stateCache.has(key)) {
    return stateCache.get(key) || null;
  }

  const state = await prisma.state.findUnique({
    where: { abbreviation: key },
  });

  stateCache.set(key, state);
  return state;
}

/**
 * Get or create "Statewide" placeholder county for appellate courts
 */
async function getOrCreateStatewideCounty(state: State): Promise<County> {
  const cacheKey = `statewide-${state.id}`;
  
  if (countyCache.has(cacheKey)) {
    return countyCache.get(cacheKey) as County;
  }

  // Check if Statewide county already exists
  let county = await prisma.county.findFirst({
    where: {
      stateId: state.id,
      slug: 'statewide',
    },
  });

  if (!county) {
    // Create the Statewide placeholder
    county = await prisma.county.create({
      data: {
        stateId: state.id,
        name: 'Statewide',
        slug: 'statewide',
        fipsCode: null,
      },
    });
    console.log(`  Created Statewide placeholder county for ${state.name}`);
  }

  countyCache.set(cacheKey, county);
  return county;
}

/**
 * Get county by name and state (cached)
 */
async function getCounty(countyName: string, stateId: string): Promise<County | null> {
  const normalizedName = normalizeCountyName(countyName);
  const cacheKey = `${stateId}-${normalizedName}`;

  if (countyCache.has(cacheKey)) {
    return countyCache.get(cacheKey) || null;
  }

  // Try exact slug match first
  let county = await prisma.county.findFirst({
    where: {
      stateId,
      slug: slugify(countyName),
    },
  });

  // If not found, try fuzzy match by normalized name
  if (!county) {
    const allCounties = await prisma.county.findMany({
      where: { stateId },
    });
    
    county = allCounties.find(c => 
      normalizeCountyName(c.name) === normalizedName
    ) || null;
  }

  countyCache.set(cacheKey, county);
  return county;
}

/**
 * Get or create a Court record
 */
async function getOrCreateCourt(
  countyId: string,
  courtType: string
): Promise<Court> {
  const slug = slugify(courtType);
  const cacheKey = `${countyId}-${slug}`;

  if (courtCache.has(cacheKey)) {
    return courtCache.get(cacheKey) as Court;
  }

  // Try to find existing court
  let court = await prisma.court.findFirst({
    where: {
      countyId,
      slug,
    },
  });

  if (!court) {
    // Create new court
    court = await prisma.court.create({
      data: {
        countyId,
        type: courtType,
        slug,
      },
    });
  }

  courtCache.set(cacheKey, court);
  return court;
}

/**
 * Check if a court type is appellate (no specific county)
 */
function isAppellateCourt(courtType: string): boolean {
  const appellateTypes = [
    'supreme court',
    'district court of appeal',
    'court of appeals',
    'appellate court',
  ];
  
  return appellateTypes.some(t => 
    courtType.toLowerCase().includes(t)
  );
}

export interface ResolvedCourt {
  court: Court;
  county: County;
  state: State;
  isNew: boolean;
}

export interface ResolveResult {
  success: boolean;
  court?: ResolvedCourt;
  error?: string;
}

/**
 * Resolve a court reference from CSV data to database records
 * 
 * @param courtType - Court type from CSV (e.g., "Circuit Court")
 * @param countyName - County name from CSV (may be null for appellate)
 * @param stateAbbr - State abbreviation (e.g., "FL")
 */
export async function resolveCourt(
  courtType: string,
  countyName: string | null,
  stateAbbr: string
): Promise<ResolveResult> {
  // Get state
  const state = await getState(stateAbbr);
  if (!state) {
    return {
      success: false,
      error: `State not found: ${stateAbbr}`,
    };
  }

  let county: County;

  // Handle appellate courts (no county)
  if (isAppellateCourt(courtType) || !countyName) {
    county = await getOrCreateStatewideCounty(state);
  } else {
    // Look up the county
    const foundCounty = await getCounty(countyName, state.id);
    if (!foundCounty) {
      return {
        success: false,
        error: `County not found: ${countyName} in ${state.name}`,
      };
    }
    county = foundCounty;
  }

  // Get or create the court
  const courtBefore = courtCache.size;
  const court = await getOrCreateCourt(county.id, courtType);
  const isNew = courtCache.size > courtBefore;

  return {
    success: true,
    court: {
      court,
      county,
      state,
      isNew,
    },
  };
}

/**
 * Clear all caches (useful for testing)
 */
export function clearCaches(): void {
  courtCache.clear();
  countyCache.clear();
  stateCache.clear();
}

/**
 * Disconnect Prisma client
 */
export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
