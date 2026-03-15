import { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { buildItemListJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { JudgeSearch } from "@/components/search";

export const metadata: Metadata = {
  title: "U.S. Judges Directory — All Judges",
  description:
    "Browse all verified U.S. judges alphabetically. Find judges by name, state, county, or court type.",
  alternates: {
    canonical: `${SITE_URL}/judges/`,
  },
};

export default async function JudgesPage() {
  const judges = await prisma.judge.findMany({
    where: { status: "VERIFIED" },
    orderBy: { fullName: "asc" },
    select: {
      fullName: true,
      slug: true,
      court: {
        select: {
          slug: true,
          county: {
            select: {
              slug: true,
              state: {
                select: {
                  slug: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const jsonLd = buildItemListJsonLd(
    judges.map((judge, index) => ({
      name: judge.fullName,
      url: `/judges/${judge.court.county.state.slug}/${judge.court.county.slug}/${judge.court.slug}/${judge.slug}/`,
      position: index + 1,
    })),
    "U.S. Judges Directory",
    "/judges/",
  );

  return (
    <>
      {/* T048a: Skip navigation link per Constitution Principle VI */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>

      <JsonLd data={jsonLd} />
      <main id="main-content">
        {/* Search Component (Feature: 009-search-discovery) */}
        <Suspense
          fallback={
            <div className="h-10 w-full max-w-md bg-muted rounded-md animate-pulse mb-8" />
          }
        >
          <JudgeSearch hideSearchInput className="mb-8" />
        </Suspense>
      </main>
    </>
  );
}
