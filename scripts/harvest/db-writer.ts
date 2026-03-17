/**
 * Database writer — upserts enriched judge records directly to PostgreSQL.
 *
 * Absorbs court resolution logic from scripts/import/court-resolver.ts.
 * Uses courtId + slug composite key for upsert.
 *
 * @module scripts/harvest/db-writer
 */

import { PrismaClient, Court, County, State } from "@prisma/client";
import type { EnrichedJudgeRecord } from "./config";

const prisma = new PrismaClient();

// Caches for court resolution (same pattern as court-resolver.ts)
const stateCache = new Map<string, State | null>();
const countyCache = new Map<string, County | null>();
const courtCache = new Map<string, Court>();

export interface WriteResult {
  new: number;
  updated: number;
  failed: number;
  errors: string[];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

function normalizeCountyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

async function getState(abbreviation: string): Promise<State | null> {
  const key = abbreviation.toUpperCase();
  if (stateCache.has(key)) return stateCache.get(key) || null;
  const state = await prisma.state.findUnique({ where: { abbreviation: key } });
  stateCache.set(key, state);
  return state;
}

async function getOrCreateStatewideCounty(state: State): Promise<County> {
  const cacheKey = `statewide-${state.id}`;
  if (countyCache.has(cacheKey)) return countyCache.get(cacheKey) as County;

  let county = await prisma.county.findFirst({
    where: { stateId: state.id, slug: "statewide" },
  });

  if (!county) {
    county = await prisma.county.create({
      data: { stateId: state.id, name: "Statewide", slug: "statewide" },
    });
    console.log(`  Created Statewide placeholder county for ${state.name}`);
  }

  countyCache.set(cacheKey, county);
  return county;
}

async function getCounty(
  countyName: string,
  stateId: string,
): Promise<County | null> {
  const normalizedName = normalizeCountyName(countyName);
  const cacheKey = `${stateId}-${normalizedName}`;
  if (countyCache.has(cacheKey)) return countyCache.get(cacheKey) || null;

  let county = await prisma.county.findFirst({
    where: { stateId, slug: slugify(countyName) },
  });

  if (!county) {
    const allCounties = await prisma.county.findMany({ where: { stateId } });
    county =
      allCounties.find((c) => normalizeCountyName(c.name) === normalizedName) ||
      null;
  }

  countyCache.set(cacheKey, county);
  return county;
}

async function getOrCreateCourt(
  countyId: string,
  courtType: string,
): Promise<Court> {
  const slug = slugify(courtType);
  const cacheKey = `${countyId}-${slug}`;
  if (courtCache.has(cacheKey)) return courtCache.get(cacheKey) as Court;

  let court = await prisma.court.findFirst({ where: { countyId, slug } });

  if (!court) {
    court = await prisma.court.create({
      data: { countyId, type: courtType, slug },
    });
  }

  courtCache.set(cacheKey, court);
  return court;
}

function isAppellateCourt(courtType: string): boolean {
  const appellateTypes = [
    "supreme court",
    "district court of appeal",
    "court of appeals",
    "appellate court",
  ];
  return appellateTypes.some((t) => courtType.toLowerCase().includes(t));
}

/**
 * Resolve a court from state abbreviation, county name, and court type.
 */
async function resolveCourt(
  stateAbbr: string,
  countyName: string | null,
  courtType: string,
): Promise<{ courtId: string } | { error: string }> {
  const state = await getState(stateAbbr);
  if (!state) return { error: `State not found: ${stateAbbr}` };

  let county: County;
  if (isAppellateCourt(courtType) || !countyName) {
    county = await getOrCreateStatewideCounty(state);
  } else {
    const found = await getCounty(countyName, state.id);
    if (!found)
      return { error: `County not found: ${countyName} in ${state.name}` };
    county = found;
  }

  const court = await getOrCreateCourt(county.id, courtType);
  return { courtId: court.id };
}

/**
 * Write enriched judge records to the database.
 * Uses courtId + slug composite key for upsert.
 * Preserves status/autoVerified/verifiedAt on update.
 */
export async function writeJudgesToDb(
  judges: EnrichedJudgeRecord[],
  jobId: string,
): Promise<WriteResult> {
  const result: WriteResult = { new: 0, updated: 0, failed: 0, errors: [] };

  for (const judge of judges) {
    try {
      const stateAbbr =
        judge.state.length === 2
          ? judge.state
          : judge.state.slice(0, 2).toUpperCase();

      const courtResult = await resolveCourt(
        stateAbbr,
        judge.county,
        judge.courtType,
      );

      if ("error" in courtResult) {
        result.failed++;
        result.errors.push(`${judge.fullName}: ${courtResult.error}`);
        continue;
      }

      const slug = slugify(judge.fullName);

      // Check if judge exists before upsert to track new vs updated count
      const existing = await prisma.judge.findUnique({
        where: { courtId_slug: { courtId: courtResult.courtId, slug } },
        select: { id: true },
      });

      await prisma.judge.upsert({
        where: {
          courtId_slug: { courtId: courtResult.courtId, slug },
        },
        create: {
          courtId: courtResult.courtId,
          slug,
          fullName: judge.fullName,
          harvestJobId: jobId,
          status: "UNVERIFIED",
          photoUrl: judge.photoUrl,
          termStart: judge.termStart ? new Date(judge.termStart) : null,
          termEnd: judge.termEnd ? new Date(judge.termEnd) : null,
          selectionMethod: judge.selectionMethod,
          appointingAuthority: judge.appointingAuthority,
          appointmentDate: judge.appointmentDate
            ? new Date(judge.appointmentDate)
            : null,
          birthDate: judge.birthDate ? new Date(judge.birthDate) : null,
          education: judge.education,
          priorExperience: judge.priorExperience,
          politicalAffiliation: judge.politicalAffiliation,
          barAdmissionDate: judge.barAdmissionDate
            ? new Date(judge.barAdmissionDate)
            : null,
          barAdmissionState: judge.barAdmissionState,
          isChiefJudge: judge.isChiefJudge,
          division: judge.division,
          courthouseAddress: judge.courthouseAddress,
          courthousePhone: judge.courthousePhone,
          sourceUrl: judge.bioPageUrl ?? judge.rosterUrl,
          rosterUrl: judge.rosterUrl,
          sourceAuthority: judge.sourceAuthority as
            | "OFFICIAL_GOV"
            | "COURT_WEBSITE"
            | "ELECTION_RECORDS"
            | "SECONDARY"
            | undefined,
          extractionMethod: judge.extractionMethod,
          confidenceScore: judge.confidenceScore,
          lastHarvestAt: new Date(),
        },
        update: {
          fullName: judge.fullName,
          harvestJobId: jobId,
          photoUrl: judge.photoUrl,
          termStart: judge.termStart ? new Date(judge.termStart) : undefined,
          termEnd: judge.termEnd ? new Date(judge.termEnd) : undefined,
          selectionMethod: judge.selectionMethod ?? undefined,
          appointingAuthority: judge.appointingAuthority ?? undefined,
          appointmentDate: judge.appointmentDate
            ? new Date(judge.appointmentDate)
            : undefined,
          birthDate: judge.birthDate ? new Date(judge.birthDate) : undefined,
          education: judge.education ?? undefined,
          priorExperience: judge.priorExperience ?? undefined,
          politicalAffiliation: judge.politicalAffiliation ?? undefined,
          barAdmissionDate: judge.barAdmissionDate
            ? new Date(judge.barAdmissionDate)
            : undefined,
          barAdmissionState: judge.barAdmissionState ?? undefined,
          isChiefJudge: judge.isChiefJudge,
          division: judge.division ?? undefined,
          courthouseAddress: judge.courthouseAddress ?? undefined,
          courthousePhone: judge.courthousePhone ?? undefined,
          sourceUrl: judge.bioPageUrl ?? judge.rosterUrl,
          rosterUrl: judge.rosterUrl,
          sourceAuthority: judge.sourceAuthority as
            | "OFFICIAL_GOV"
            | "COURT_WEBSITE"
            | "ELECTION_RECORDS"
            | "SECONDARY"
            | undefined,
          extractionMethod: judge.extractionMethod,
          confidenceScore: judge.confidenceScore,
          lastHarvestAt: new Date(),
          // PRESERVE: status, autoVerified, verifiedAt — not included in update
        },
      });

      if (existing) {
        result.updated++;
      } else {
        result.new++;
      }
    } catch (err) {
      result.failed++;
      result.errors.push(
        `${judge.fullName}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}

export function clearCaches(): void {
  stateCache.clear();
  countyCache.clear();
  courtCache.clear();
}

export async function disconnect(): Promise<void> {
  await prisma.$disconnect();
}
