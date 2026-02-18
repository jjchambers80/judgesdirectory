import { Metadata } from "next";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { statesGridTitle, buildItemListJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Disclaimer from "@/components/Disclaimer";
import StateGrid from "@/components/StateGrid";

export const metadata: Metadata = {
  title: statesGridTitle(),
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
      <JsonLd data={jsonLd} />
      <h1>U.S. Judges Directory — Browse by State</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        Select a state to browse judges by county and court type.
      </p>
      <StateGrid states={states} />
      <Disclaimer />
    </>
  );
}
