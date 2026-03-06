import { Metadata } from "next";
import { Suspense } from "react";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { statesGridTitle, buildItemListJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Disclaimer from "@/components/Disclaimer";
import StateGrid from "@/components/StateGrid";
import { JudgeSearch } from "@/components/search";

export const metadata: Metadata = {
  title: statesGridTitle(),
  description: "Search and browse judges across all U.S. states. Find judges by name, state, county, or court type.",
  alternates: {
    canonical: `${SITE_URL}/judges/`,
  },
};

export default async function StatesGridPage() {
  const states = await prisma.state.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: { select: { counties: true } },
    },
  });

  const jsonLd = buildItemListJsonLd(
    states.map((state, index) => ({
      name: state.name,
      url: `/judges/${state.slug}/`,
      position: index + 1,
    })),
    "U.S. States",
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
        <h1>U.S. Judges Directory — Browse by State</h1>
        <p className="text-muted-foreground mb-6">
          Search for judges or select a state to browse by county and court type.
        </p>
        
        {/* Search Component (Feature: 009-search-discovery) */}
        <Suspense fallback={<div className="h-10 w-full max-w-md bg-muted rounded-md animate-pulse mb-8" />}>
          <JudgeSearch className="mb-8 max-w-2xl" />
        </Suspense>
        
        <h2 className="text-xl font-semibold mb-4">Browse by State</h2>
        <StateGrid states={states} />
        <Disclaimer />
      </main>
    </>
  );
}
