/**
 * Generic state court structure seeder — creates courts in the database
 * based on any state's configuration file.
 *
 * Replaces the former Florida-specific seedFloridaCourts().
 *
 * @module scripts/harvest/court-seeder
 */

import { PrismaClient } from "@prisma/client";
import slugify from "slugify";
import type { StateConfig, CourtEntry } from "./state-config-schema";

const prisma = new PrismaClient();

function makeSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true }).slice(
    0,
    100,
  );
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

  // Warn about missing counties
  const missingCounties = new Set<string>();
  for (const court of config.courts) {
    for (const countyName of court.counties) {
      if (!countyMap.has(countyName.toLowerCase().trim())) {
        missingCounties.add(countyName);
      }
    }
  }
  if (missingCounties.size > 0) {
    console.warn(
      `  WARN: ${missingCounties.size} county(ies) not found in DB for ${config.state}: ${Array.from(missingCounties).join(", ")}`,
    );
  }

  let created = 0;
  let skipped = 0;

  for (const court of config.courts) {
    const isTrialLevel =
      court.level === "trial" || court.level === "specialized";

    if (isTrialLevel && court.counties.length > 0) {
      // Trial/specialized courts: one court record per county
      for (const countyName of court.counties) {
        const county = countyMap.get(countyName.toLowerCase().trim());
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
            },
          });
          created++;
        } else {
          skipped++;
        }
      }
    } else {
      // Supreme/appellate/statewide courts: single record linked to home county
      let homeCounty: (typeof state.counties)[0] | undefined;

      if (court.counties.length > 0) {
        // Use first county in list as home county
        homeCounty = countyMap.get(court.counties[0].toLowerCase().trim());
      } else {
        // Statewide court — use first county in state as admin home
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
          },
        });
        created++;
        console.log(`  Created: ${court.label} (${homeCounty.name})`);
      } else {
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
