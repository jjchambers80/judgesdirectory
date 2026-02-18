/**
 * Florida court structure seeder — creates courts in the database
 * based on florida-courts.json configuration.
 *
 * @module scripts/harvest/court-seeder
 */

import { PrismaClient } from "@prisma/client";
import { loadCourtConfig } from "./config";
import slugify from "slugify";

const prisma = new PrismaClient();

function makeSlug(input: string): string {
  return slugify(input, { lower: true, strict: true, trim: true }).slice(
    0,
    100,
  );
}

export async function seedFloridaCourts(): Promise<void> {
  const config = loadCourtConfig();

  // Find Florida state
  const florida = await prisma.state.findFirst({
    where: { abbreviation: "FL" },
    include: { counties: true },
  });

  if (!florida) {
    throw new Error(
      "Florida not found in database. Run the state/county seed first.",
    );
  }

  // Build county lookup: normalized name → county record
  const countyMap = new Map<string, (typeof florida.counties)[0]>();
  for (const county of florida.counties) {
    countyMap.set(county.name.toLowerCase().trim(), county);
  }

  let created = 0;
  let skipped = 0;

  // -------------------------------------------------------------------------
  // 1. Supreme Court — one court in Leon County (statewide)
  // -------------------------------------------------------------------------
  const leonCounty = countyMap.get("leon");
  if (leonCounty) {
    const slug = makeSlug("Supreme Court");
    const exists = await prisma.court.findFirst({
      where: { countyId: leonCounty.id, type: "Supreme Court" },
    });
    if (!exists) {
      await prisma.court.create({
        data: {
          countyId: leonCounty.id,
          type: "Supreme Court",
          slug,
        },
      });
      created++;
      console.log("  Created: Supreme Court (Leon County)");
    } else {
      skipped++;
    }
  } else {
    console.warn("  WARN: Leon County not found — skipping Supreme Court");
  }

  // -------------------------------------------------------------------------
  // 2. District Courts of Appeal — one per DCA, linked to first county
  //    in the district for DB purposes (DCAs are multi-county/statewide)
  // -------------------------------------------------------------------------
  for (const dca of config.districtCourts) {
    // Use the first county in the district as the "home" county
    const homeCountyName = dca.counties[0];
    const homeCounty = countyMap.get(homeCountyName.toLowerCase().trim());

    if (!homeCounty) {
      console.warn(
        `  WARN: County "${homeCountyName}" not found — skipping ${dca.name}`,
      );
      continue;
    }

    const slug = makeSlug(dca.name);
    const exists = await prisma.court.findFirst({
      where: {
        countyId: homeCounty.id,
        type: "District Court of Appeal",
        slug,
      },
    });

    if (!exists) {
      await prisma.court.create({
        data: {
          countyId: homeCounty.id,
          type: "District Court of Appeal",
          slug,
        },
      });
      created++;
      console.log(`  Created: ${dca.name} (${homeCountyName} County)`);
    } else {
      skipped++;
    }
  }

  // -------------------------------------------------------------------------
  // 3. Circuit Courts — one per county in each circuit
  // -------------------------------------------------------------------------
  for (const circuit of config.circuitCourts) {
    for (const countyName of circuit.counties) {
      const county = countyMap.get(countyName.toLowerCase().trim());
      if (!county) {
        console.warn(
          `  WARN: County "${countyName}" not found — skipping Circuit Court`,
        );
        continue;
      }

      const exists = await prisma.court.findFirst({
        where: { countyId: county.id, type: "Circuit Court" },
      });

      if (!exists) {
        const slug = makeSlug(`Circuit Court ${countyName}`);
        await prisma.court.create({
          data: {
            countyId: county.id,
            type: "Circuit Court",
            slug,
          },
        });
        created++;
      } else {
        skipped++;
      }
    }
  }

  console.log(
    `  Circuit Courts: processed ${config.circuitCourts.reduce((sum, c) => sum + c.counties.length, 0)} county entries`,
  );

  // -------------------------------------------------------------------------
  // 4. County Courts — one per county (67 total)
  // -------------------------------------------------------------------------
  const allCounties = new Set<string>();
  for (const circuit of config.circuitCourts) {
    for (const countyName of circuit.counties) {
      allCounties.add(countyName);
    }
  }

  for (const countyName of Array.from(allCounties)) {
    const county = countyMap.get(countyName.toLowerCase().trim());
    if (!county) {
      console.warn(
        `  WARN: County "${countyName}" not found — skipping County Court`,
      );
      continue;
    }

    const exists = await prisma.court.findFirst({
      where: { countyId: county.id, type: "County Court" },
    });

    if (!exists) {
      const slug = makeSlug(`County Court ${countyName}`);
      await prisma.court.create({
        data: {
          countyId: county.id,
          type: "County Court",
          slug,
        },
      });
      created++;
    } else {
      skipped++;
    }
  }

  console.log(`  County Courts: processed ${allCounties.size} counties`);

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------
  console.log(`\nDone. ${created} courts created, ${skipped} already existed.`);

  await prisma.$disconnect();
}
