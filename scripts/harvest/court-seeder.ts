/**
 * Generic state court structure seeder — creates courts in the database
 * based on any state's configuration file.
 *
 * Replaces the former Florida-specific seedFloridaCourts().
 *
 * @module scripts/harvest/court-seeder
 */

import { PrismaClient, CourtLevel } from "@prisma/client";
import slugify from "slugify";
import type { StateConfig, CourtEntry } from "./state-config-schema";
import { resolveCountyAlias } from "./normalizer";
import type { UnresolvedCountyWarning } from "./normalizer";

const prisma = new PrismaClient();

function makeSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true }).slice(
    0,
    100,
  );
}

function toCourtLevel(level: string): CourtLevel {
  const map: Record<string, CourtLevel> = {
    supreme: CourtLevel.SUPREME,
    appellate: CourtLevel.APPELLATE,
    trial: CourtLevel.TRIAL,
    specialized: CourtLevel.SPECIALIZED,
  };
  return map[level] ?? CourtLevel.TRIAL;
}

/**
 * Seed court records for any state from its StateConfig.
 * Creates courts under the appropriate county in the database.
 *
 * For statewide courts (empty counties[]), the first county in the state is used
 * as the administrative "home" county.
 *
 * For multi-county courts, the first county in the list is used as the home county
 * (appellate/statewide courts serve the region, not individual counties).
 *
 * For trial-level courts, one court record is created per county served.
 */
export async function seedStateCourts(config: StateConfig): Promise<void> {
  // Find state in database
  const state = await prisma.state.findFirst({
    where: { abbreviation: config.abbreviation },
    include: { counties: true },
  });

  if (!state) {
    throw new Error(
      `State "${config.state}" (${config.abbreviation}) not found in database. Run the state/county seed first.`,
    );
  }

  // Build county lookup: normalized name → county record
  const countyMap = new Map<string, (typeof state.counties)[0]>();
  for (const county of state.counties) {
    countyMap.set(county.name.toLowerCase().trim(), county);
  }

  // County alias map from config (default: empty)
  const aliases = config.countyAliases ?? {};
  const unresolvedWarnings: UnresolvedCountyWarning[] = [];

  // Warn about missing counties (after alias resolution)
  const missingCounties = new Set<string>();
  for (const court of config.courts) {
    for (const countyName of court.counties) {
      const resolution = resolveCountyAlias(countyName, aliases);
      if (resolution.aliasApplied) {
        console.log(`  ALIAS: "${countyName}" → "${resolution.canonical}"`);
      }
      if (!countyMap.has(resolution.canonical.toLowerCase().trim())) {
        missingCounties.add(resolution.canonical);
      }
    }
  }
  if (missingCounties.size > 0) {
    console.warn(
      `  WARN: ${missingCounties.size} county(ies) not found in DB for ${config.state}: ${Array.from(missingCounties).join(", ")}`,
    );
    for (const countyName of Array.from(missingCounties)) {
      unresolvedWarnings.push({
        countyName,
        stateAbbreviation: config.abbreviation,
        affectedRecordCount: config.courts.filter((c) =>
          c.counties.some(
            (cn) =>
              resolveCountyAlias(cn, aliases).canonical.toLowerCase().trim() ===
              countyName.toLowerCase().trim(),
          ),
        ).length,
        stage: "court-seeding",
      });
    }
  }

  let created = 0;
  let skipped = 0;

  for (const court of config.courts) {
    const isTrialLevel =
      court.level === "trial" || court.level === "specialized";

    const courtLevel = toCourtLevel(court.level);

    if (isTrialLevel && court.counties.length > 0) {
      // Trial/specialized courts: one court record per county
      for (const countyName of court.counties) {
        const resolution = resolveCountyAlias(countyName, aliases);
        const county = countyMap.get(resolution.canonical.toLowerCase().trim());
        if (!county) {
          continue; // Already warned above
        }

        const exists = await prisma.court.findFirst({
          where: { countyId: county.id, type: court.courtType },
        });

        if (!exists) {
          const slug = makeSlug(`${court.courtType} ${countyName}`);
          await prisma.court.create({
            data: {
              countyId: county.id,
              type: court.courtType,
              slug,
              level: courtLevel,
            },
          });
          created++;
        } else if (!exists.level) {
          // Backfill level on existing courts
          await prisma.court.update({
            where: { id: exists.id },
            data: { level: courtLevel },
          });
          skipped++;
        } else {
          skipped++;
        }
      }
    } else {
      // Supreme/appellate/statewide courts: single record linked to HQ county
      let homeCounty: (typeof state.counties)[0] | undefined;

      if (court.headquartersCounty) {
        // Use explicit headquartersCounty from config
        const resolution = resolveCountyAlias(court.headquartersCounty, aliases);
        homeCounty = countyMap.get(resolution.canonical.toLowerCase().trim());
      } else if (court.counties.length > 0) {
        // Fallback: use first county in list as home county
        const resolution = resolveCountyAlias(court.counties[0], aliases);
        homeCounty = countyMap.get(resolution.canonical.toLowerCase().trim());
      } else {
        // Statewide court with no HQ or counties — use first county in state
        homeCounty = state.counties[0];
      }

      if (!homeCounty) {
        console.warn(
          `  WARN: No home county found for ${court.label} — skipping`,
        );
        continue;
      }

      const slug = makeSlug(court.label);
      const exists = await prisma.court.findFirst({
        where: {
          countyId: homeCounty.id,
          type: court.courtType,
          slug,
        },
      });

      if (!exists) {
        await prisma.court.create({
          data: {
            countyId: homeCounty.id,
            type: court.courtType,
            slug,
            level: courtLevel,
          },
        });
        created++;
        console.log(`  Created: ${court.label} (${homeCounty.name})`);
      } else {
        if (!exists.level) {
          await prisma.court.update({
            where: { id: exists.id },
            data: { level: courtLevel },
          });
        }
        skipped++;
      }
    }
  }

  console.log(
    `\n  ${config.state}: ${created} courts created, ${skipped} already existed.`,
  );

  await prisma.$disconnect();
}

/**
 * Legacy wrapper for backward compatibility.
 * Loads Florida config and seeds courts.
 */
export async function seedFloridaCourts(): Promise<void> {
  const { loadStateConfig } = await import("./config");
  const config = loadStateConfig("florida");
  await seedStateCourts(config);
}
