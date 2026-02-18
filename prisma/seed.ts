import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 50 US States + DC with FIPS codes and abbreviations
const states: Array<{
  name: string;
  abbreviation: string;
  fipsCode: string;
}> = [
  { name: "Alabama", abbreviation: "AL", fipsCode: "01" },
  { name: "Alaska", abbreviation: "AK", fipsCode: "02" },
  { name: "Arizona", abbreviation: "AZ", fipsCode: "04" },
  { name: "Arkansas", abbreviation: "AR", fipsCode: "05" },
  { name: "California", abbreviation: "CA", fipsCode: "06" },
  { name: "Colorado", abbreviation: "CO", fipsCode: "08" },
  { name: "Connecticut", abbreviation: "CT", fipsCode: "09" },
  { name: "Delaware", abbreviation: "DE", fipsCode: "10" },
  { name: "Florida", abbreviation: "FL", fipsCode: "12" },
  { name: "Georgia", abbreviation: "GA", fipsCode: "13" },
  { name: "Hawaii", abbreviation: "HI", fipsCode: "15" },
  { name: "Idaho", abbreviation: "ID", fipsCode: "16" },
  { name: "Illinois", abbreviation: "IL", fipsCode: "17" },
  { name: "Indiana", abbreviation: "IN", fipsCode: "18" },
  { name: "Iowa", abbreviation: "IA", fipsCode: "19" },
  { name: "Kansas", abbreviation: "KS", fipsCode: "20" },
  { name: "Kentucky", abbreviation: "KY", fipsCode: "21" },
  { name: "Louisiana", abbreviation: "LA", fipsCode: "22" },
  { name: "Maine", abbreviation: "ME", fipsCode: "23" },
  { name: "Maryland", abbreviation: "MD", fipsCode: "24" },
  { name: "Massachusetts", abbreviation: "MA", fipsCode: "25" },
  { name: "Michigan", abbreviation: "MI", fipsCode: "26" },
  { name: "Minnesota", abbreviation: "MN", fipsCode: "27" },
  { name: "Mississippi", abbreviation: "MS", fipsCode: "28" },
  { name: "Missouri", abbreviation: "MO", fipsCode: "29" },
  { name: "Montana", abbreviation: "MT", fipsCode: "30" },
  { name: "Nebraska", abbreviation: "NE", fipsCode: "31" },
  { name: "Nevada", abbreviation: "NV", fipsCode: "32" },
  { name: "New Hampshire", abbreviation: "NH", fipsCode: "33" },
  { name: "New Jersey", abbreviation: "NJ", fipsCode: "34" },
  { name: "New Mexico", abbreviation: "NM", fipsCode: "35" },
  { name: "New York", abbreviation: "NY", fipsCode: "36" },
  { name: "North Carolina", abbreviation: "NC", fipsCode: "37" },
  { name: "North Dakota", abbreviation: "ND", fipsCode: "38" },
  { name: "Ohio", abbreviation: "OH", fipsCode: "39" },
  { name: "Oklahoma", abbreviation: "OK", fipsCode: "40" },
  { name: "Oregon", abbreviation: "OR", fipsCode: "41" },
  { name: "Pennsylvania", abbreviation: "PA", fipsCode: "42" },
  { name: "Rhode Island", abbreviation: "RI", fipsCode: "44" },
  { name: "South Carolina", abbreviation: "SC", fipsCode: "45" },
  { name: "South Dakota", abbreviation: "SD", fipsCode: "46" },
  { name: "Tennessee", abbreviation: "TN", fipsCode: "47" },
  { name: "Texas", abbreviation: "TX", fipsCode: "48" },
  { name: "Utah", abbreviation: "UT", fipsCode: "49" },
  { name: "Vermont", abbreviation: "VT", fipsCode: "50" },
  { name: "Virginia", abbreviation: "VA", fipsCode: "51" },
  { name: "Washington", abbreviation: "WA", fipsCode: "53" },
  { name: "West Virginia", abbreviation: "WV", fipsCode: "54" },
  { name: "Wisconsin", abbreviation: "WI", fipsCode: "55" },
  { name: "Wyoming", abbreviation: "WY", fipsCode: "56" },
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 100);
}

// Strip geographic suffixes so county names are just the proper name
// e.g. "Harris County" → "Harris", "Orleans Parish" → "Orleans"
const COUNTY_SUFFIXES = [
  " City and Borough",
  " Census Area",
  " Municipality",
  " Borough",
  " Parish",
  " County",
  " city",
  " City",
];

function stripCountySuffix(name: string): string {
  for (const suffix of COUNTY_SUFFIXES) {
    if (name.endsWith(suffix)) {
      return name.slice(0, -suffix.length);
    }
  }
  return name;
}

// County data by state FIPS code
// Source: US Census Bureau FIPS county codes
// Format: { stateFips: [{ name, fipsCode }] }
const countiesByState: Record<
  string,
  Array<{ name: string; fipsCode: string }>
> = {
  "01": [
    // Alabama
    { name: "Autauga County", fipsCode: "01001" },
    { name: "Baldwin County", fipsCode: "01003" },
    { name: "Barbour County", fipsCode: "01005" },
    { name: "Bibb County", fipsCode: "01007" },
    { name: "Blount County", fipsCode: "01009" },
    { name: "Bullock County", fipsCode: "01011" },
    { name: "Butler County", fipsCode: "01013" },
    { name: "Calhoun County", fipsCode: "01015" },
    { name: "Chambers County", fipsCode: "01017" },
    { name: "Cherokee County", fipsCode: "01019" },
    { name: "Chilton County", fipsCode: "01021" },
    { name: "Choctaw County", fipsCode: "01023" },
    { name: "Clarke County", fipsCode: "01025" },
    { name: "Clay County", fipsCode: "01027" },
    { name: "Cleburne County", fipsCode: "01029" },
    { name: "Coffee County", fipsCode: "01031" },
    { name: "Colbert County", fipsCode: "01033" },
    { name: "Conecuh County", fipsCode: "01035" },
    { name: "Coosa County", fipsCode: "01037" },
    { name: "Covington County", fipsCode: "01039" },
    { name: "Crenshaw County", fipsCode: "01041" },
    { name: "Cullman County", fipsCode: "01043" },
    { name: "Dale County", fipsCode: "01045" },
    { name: "Dallas County", fipsCode: "01047" },
    { name: "DeKalb County", fipsCode: "01049" },
    { name: "Elmore County", fipsCode: "01051" },
    { name: "Escambia County", fipsCode: "01053" },
    { name: "Etowah County", fipsCode: "01055" },
    { name: "Fayette County", fipsCode: "01057" },
    { name: "Franklin County", fipsCode: "01059" },
    { name: "Geneva County", fipsCode: "01061" },
    { name: "Greene County", fipsCode: "01063" },
    { name: "Hale County", fipsCode: "01065" },
    { name: "Henry County", fipsCode: "01067" },
    { name: "Houston County", fipsCode: "01069" },
    { name: "Jackson County", fipsCode: "01071" },
    { name: "Jefferson County", fipsCode: "01073" },
    { name: "Lamar County", fipsCode: "01075" },
    { name: "Lauderdale County", fipsCode: "01077" },
    { name: "Lawrence County", fipsCode: "01079" },
    { name: "Lee County", fipsCode: "01081" },
    { name: "Limestone County", fipsCode: "01083" },
    { name: "Lowndes County", fipsCode: "01085" },
    { name: "Macon County", fipsCode: "01087" },
    { name: "Madison County", fipsCode: "01089" },
    { name: "Marengo County", fipsCode: "01091" },
    { name: "Marion County", fipsCode: "01093" },
    { name: "Marshall County", fipsCode: "01095" },
    { name: "Mobile County", fipsCode: "01097" },
    { name: "Monroe County", fipsCode: "01099" },
    { name: "Montgomery County", fipsCode: "01101" },
    { name: "Morgan County", fipsCode: "01103" },
    { name: "Perry County", fipsCode: "01105" },
    { name: "Pickens County", fipsCode: "01107" },
    { name: "Pike County", fipsCode: "01109" },
    { name: "Randolph County", fipsCode: "01111" },
    { name: "Russell County", fipsCode: "01113" },
    { name: "St. Clair County", fipsCode: "01115" },
    { name: "Shelby County", fipsCode: "01117" },
    { name: "Sumter County", fipsCode: "01119" },
    { name: "Talladega County", fipsCode: "01121" },
    { name: "Tallapoosa County", fipsCode: "01123" },
    { name: "Tuscaloosa County", fipsCode: "01125" },
    { name: "Walker County", fipsCode: "01127" },
    { name: "Washington County", fipsCode: "01129" },
    { name: "Wilcox County", fipsCode: "01131" },
    { name: "Winston County", fipsCode: "01133" },
  ],
  "02": [
    // Alaska
    { name: "Aleutians East Borough", fipsCode: "02013" },
    { name: "Aleutians West Census Area", fipsCode: "02016" },
    { name: "Anchorage Municipality", fipsCode: "02020" },
    { name: "Bethel Census Area", fipsCode: "02050" },
    { name: "Bristol Bay Borough", fipsCode: "02060" },
    { name: "Chugach Census Area", fipsCode: "02063" },
    { name: "Copper River Census Area", fipsCode: "02066" },
    { name: "Denali Borough", fipsCode: "02068" },
    { name: "Dillingham Census Area", fipsCode: "02070" },
    { name: "Fairbanks North Star Borough", fipsCode: "02090" },
    { name: "Haines Borough", fipsCode: "02100" },
    { name: "Hoonah-Angoon Census Area", fipsCode: "02105" },
    { name: "Juneau City and Borough", fipsCode: "02110" },
    { name: "Kenai Peninsula Borough", fipsCode: "02122" },
    { name: "Ketchikan Gateway Borough", fipsCode: "02130" },
    { name: "Kodiak Island Borough", fipsCode: "02150" },
    { name: "Kusilvak Census Area", fipsCode: "02158" },
    { name: "Lake and Peninsula Borough", fipsCode: "02164" },
    { name: "Matanuska-Susitna Borough", fipsCode: "02170" },
    { name: "Nome Census Area", fipsCode: "02180" },
    { name: "North Slope Borough", fipsCode: "02185" },
    { name: "Northwest Arctic Borough", fipsCode: "02188" },
    { name: "Petersburg Borough", fipsCode: "02195" },
    { name: "Prince of Wales-Hyder Census Area", fipsCode: "02198" },
    { name: "Sitka City and Borough", fipsCode: "02220" },
    { name: "Skagway Municipality", fipsCode: "02230" },
    { name: "Southeast Fairbanks Census Area", fipsCode: "02240" },
    { name: "Wrangell City and Borough", fipsCode: "02275" },
    { name: "Yakutat City and Borough", fipsCode: "02282" },
    { name: "Yukon-Koyukuk Census Area", fipsCode: "02290" },
  ],
  "04": [
    // Arizona
    { name: "Apache County", fipsCode: "04001" },
    { name: "Cochise County", fipsCode: "04003" },
    { name: "Coconino County", fipsCode: "04005" },
    { name: "Gila County", fipsCode: "04007" },
    { name: "Graham County", fipsCode: "04009" },
    { name: "Greenlee County", fipsCode: "04011" },
    { name: "La Paz County", fipsCode: "04012" },
    { name: "Maricopa County", fipsCode: "04013" },
    { name: "Mohave County", fipsCode: "04015" },
    { name: "Navajo County", fipsCode: "04017" },
    { name: "Pima County", fipsCode: "04019" },
    { name: "Pinal County", fipsCode: "04021" },
    { name: "Santa Cruz County", fipsCode: "04023" },
    { name: "Yavapai County", fipsCode: "04025" },
    { name: "Yuma County", fipsCode: "04027" },
  ],
  "05": [
    // Arkansas
    { name: "Arkansas County", fipsCode: "05001" },
    { name: "Ashley County", fipsCode: "05003" },
    { name: "Baxter County", fipsCode: "05005" },
    { name: "Benton County", fipsCode: "05007" },
    { name: "Boone County", fipsCode: "05009" },
    { name: "Bradley County", fipsCode: "05011" },
    { name: "Calhoun County", fipsCode: "05013" },
    { name: "Carroll County", fipsCode: "05015" },
    { name: "Chicot County", fipsCode: "05017" },
    { name: "Clark County", fipsCode: "05019" },
    { name: "Clay County", fipsCode: "05021" },
    { name: "Cleburne County", fipsCode: "05023" },
    { name: "Cleveland County", fipsCode: "05025" },
    { name: "Columbia County", fipsCode: "05027" },
    { name: "Conway County", fipsCode: "05029" },
    { name: "Craighead County", fipsCode: "05031" },
    { name: "Crawford County", fipsCode: "05033" },
    { name: "Crittenden County", fipsCode: "05035" },
    { name: "Cross County", fipsCode: "05037" },
    { name: "Dallas County", fipsCode: "05039" },
    { name: "Desha County", fipsCode: "05041" },
    { name: "Drew County", fipsCode: "05043" },
    { name: "Faulkner County", fipsCode: "05045" },
    { name: "Franklin County", fipsCode: "05047" },
    { name: "Fulton County", fipsCode: "05049" },
    { name: "Garland County", fipsCode: "05051" },
    { name: "Grant County", fipsCode: "05053" },
    { name: "Greene County", fipsCode: "05055" },
    { name: "Hempstead County", fipsCode: "05057" },
    { name: "Hot Spring County", fipsCode: "05059" },
    { name: "Howard County", fipsCode: "05061" },
    { name: "Independence County", fipsCode: "05063" },
    { name: "Izard County", fipsCode: "05065" },
    { name: "Jackson County", fipsCode: "05067" },
    { name: "Jefferson County", fipsCode: "05069" },
    { name: "Johnson County", fipsCode: "05071" },
    { name: "Lafayette County", fipsCode: "05073" },
    { name: "Lawrence County", fipsCode: "05075" },
    { name: "Lee County", fipsCode: "05077" },
    { name: "Lincoln County", fipsCode: "05079" },
    { name: "Little River County", fipsCode: "05081" },
    { name: "Logan County", fipsCode: "05083" },
    { name: "Lonoke County", fipsCode: "05085" },
    { name: "Madison County", fipsCode: "05087" },
    { name: "Marion County", fipsCode: "05089" },
    { name: "Miller County", fipsCode: "05091" },
    { name: "Mississippi County", fipsCode: "05093" },
    { name: "Monroe County", fipsCode: "05095" },
    { name: "Montgomery County", fipsCode: "05097" },
    { name: "Nevada County", fipsCode: "05099" },
    { name: "Newton County", fipsCode: "05101" },
    { name: "Ouachita County", fipsCode: "05103" },
    { name: "Perry County", fipsCode: "05105" },
    { name: "Phillips County", fipsCode: "05107" },
    { name: "Pike County", fipsCode: "05109" },
    { name: "Poinsett County", fipsCode: "05111" },
    { name: "Polk County", fipsCode: "05113" },
    { name: "Pope County", fipsCode: "05115" },
    { name: "Prairie County", fipsCode: "05117" },
    { name: "Pulaski County", fipsCode: "05119" },
    { name: "Randolph County", fipsCode: "05121" },
    { name: "St. Francis County", fipsCode: "05123" },
    { name: "Saline County", fipsCode: "05125" },
    { name: "Scott County", fipsCode: "05127" },
    { name: "Searcy County", fipsCode: "05129" },
    { name: "Sebastian County", fipsCode: "05131" },
    { name: "Sevier County", fipsCode: "05133" },
    { name: "Sharp County", fipsCode: "05135" },
    { name: "Stone County", fipsCode: "05137" },
    { name: "Union County", fipsCode: "05139" },
    { name: "Van Buren County", fipsCode: "05141" },
    { name: "Washington County", fipsCode: "05143" },
    { name: "White County", fipsCode: "05145" },
    { name: "Woodruff County", fipsCode: "05147" },
    { name: "Yell County", fipsCode: "05149" },
  ],
};

// This is a very large dataset. For brevity in the seed file, we'll fetch from Census API.
// However, for a deterministic seed, we'll use a programmatic approach.

async function fetchCountiesFromCensus(): Promise<
  Array<{ stateFips: string; countyFips: string; name: string }>
> {
  // Try to fetch from Census API first
  try {
    const response = await fetch(
      "https://api.census.gov/data/2020/dec/pl?get=NAME&for=county:*",
    );
    if (response.ok) {
      const data = await response.json();
      // data[0] is headers: ["NAME","state","county"]
      // data[1+] is actual data
      return data.slice(1).map((row: string[]) => ({
        name: row[0].split(",")[0].trim(), // "Harris County, Texas" → "Harris County"
        stateFips: row[1],
        countyFips: row[1] + row[2],
      }));
    }
  } catch (e) {
    console.log("Census API unavailable, falling back to local data...");
  }

  // Fallback: use the local data we have
  const allCounties: Array<{
    stateFips: string;
    countyFips: string;
    name: string;
  }> = [];
  for (const [stateFips, counties] of Object.entries(countiesByState)) {
    for (const county of counties) {
      allCounties.push({
        stateFips,
        countyFips: county.fipsCode,
        name: county.name,
      });
    }
  }
  return allCounties;
}

async function main() {
  console.log("🌱 Starting seed...");

  // Clear existing data
  await prisma.judge.deleteMany();
  await prisma.court.deleteMany();
  await prisma.county.deleteMany();
  await prisma.state.deleteMany();

  console.log("📊 Seeding states...");

  // Create all states
  const stateMap = new Map<string, string>(); // fipsCode → stateId
  for (const state of states) {
    const created = await prisma.state.create({
      data: {
        name: state.name,
        slug: slugify(state.name),
        abbreviation: state.abbreviation,
        fipsCode: state.fipsCode,
      },
    });
    stateMap.set(state.fipsCode, created.id);
  }

  console.log(`✅ Seeded ${states.length} states`);

  // Fetch counties
  console.log("📊 Fetching county data...");
  const counties = await fetchCountiesFromCensus();
  console.log(`📊 Seeding ${counties.length} counties...`);

  let countyCount = 0;
  const batchSize = 100;

  for (let i = 0; i < counties.length; i += batchSize) {
    const batch = counties.slice(i, i + batchSize);
    const operations = batch
      .map((county) => {
        const stateId = stateMap.get(county.stateFips);
        if (!stateId) return null;
        const cleanName = stripCountySuffix(county.name);
        return prisma.county.create({
          data: {
            stateId,
            name: cleanName,
            slug: slugify(cleanName),
            fipsCode: county.countyFips,
          },
        });
      })
      .filter(Boolean);

    await Promise.all(operations);
    countyCount += operations.length;

    if (countyCount % 500 === 0 || i + batchSize >= counties.length) {
      console.log(`   Seeded ${countyCount} counties...`);
    }
  }

  console.log(`✅ Seeded ${countyCount} counties`);
  console.log("🎉 Seed complete!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
