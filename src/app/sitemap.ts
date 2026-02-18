import { MetadataRoute } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";

const SITEMAP_LIMIT = 50000;

/**
 * Generate sitemap index entries for splitting when > 50k URLs.
 */
export async function generateSitemaps() {
  const stateCount = await prisma.state.count();
  const countyCount = await prisma.county.count();
  const courtCount = await prisma.court.count();
  const judgeCount = await prisma.judge.count({ where: { status: "VERIFIED" } });

  // Total URLs: 1 (index) + states + counties + courts + judges
  const totalUrls = 1 + stateCount + countyCount + courtCount + judgeCount;
  const numSitemaps = Math.ceil(totalUrls / SITEMAP_LIMIT);

  return Array.from({ length: numSitemaps }, (_, i) => ({ id: i }));
}

export default async function sitemap({
  id,
}: {
  id: number;
}): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [];

  // Page 0 starts with the index page
  if (id === 0) {
    entries.push({
      url: `${SITE_URL}/judges/`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    });
  }

  // Fetch all states with their counties, courts, and judges for URL generation
  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    include: {
      counties: {
        orderBy: { name: "asc" },
        include: {
          courts: {
            orderBy: { type: "asc" },
            include: {
              judges: {
                where: { status: "VERIFIED" },
                orderBy: { fullName: "asc" },
                select: { slug: true, updatedAt: true },
              },
            },
          },
        },
      },
    },
  });

  for (const state of states) {
    // State URL
    if (entries.length < SITEMAP_LIMIT) {
      entries.push({
        url: `${SITE_URL}/judges/${state.slug}/`,
        lastModified: state.updatedAt,
        changeFrequency: "weekly",
        priority: 0.9,
      });
    }

    for (const county of state.counties) {
      // County URL
      if (entries.length < SITEMAP_LIMIT) {
        entries.push({
          url: `${SITE_URL}/judges/${state.slug}/${county.slug}/`,
          lastModified: county.updatedAt,
          changeFrequency: "weekly",
          priority: 0.8,
        });
      }

      for (const court of county.courts) {
        // Court URL
        if (entries.length < SITEMAP_LIMIT) {
          entries.push({
            url: `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/`,
            lastModified: court.updatedAt,
            changeFrequency: "weekly",
            priority: 0.7,
          });
        }

        for (const judge of court.judges) {
          // Judge URL
          if (entries.length < SITEMAP_LIMIT) {
            entries.push({
              url: `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`,
              lastModified: judge.updatedAt,
              changeFrequency: "monthly",
              priority: 0.6,
            });
          }
        }
      }
    }
  }

  return entries;
}
