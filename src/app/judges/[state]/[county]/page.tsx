import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { courtTypesTitle, buildItemListJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Disclaimer from "@/components/Disclaimer";

interface PageProps {
  params: Promise<{ state: string; county: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { state: stateSlug, county: countySlug } = await params;

  const state = await prisma.state.findUnique({ where: { slug: stateSlug } });
  if (!state) return {};

  const county = await prisma.county.findUnique({
    where: { stateId_slug: { stateId: state.id, slug: countySlug } },
  });
  if (!county) return {};

  return {
    title: courtTypesTitle(county.name, state.name),
    alternates: {
      canonical: `${SITE_URL}/judges/${state.slug}/${county.slug}/`,
    },
  };
}

export default async function CourtTypesPage({ params }: PageProps) {
  const { state: stateSlug, county: countySlug } = await params;

  const state = await prisma.state.findUnique({ where: { slug: stateSlug } });
  if (!state) notFound();

  const county = await prisma.county.findUnique({
    where: { stateId_slug: { stateId: state.id, slug: countySlug } },
  });
  if (!county) notFound();

  const courts = await prisma.court.findMany({
    where: { countyId: county.id },
    orderBy: { type: "asc" },
    include: {
      _count: { select: { judges: true } },
    },
  });

  const jsonLd = buildItemListJsonLd(
    courts.map((court, index) => ({
      name: court.type,
      url: `/judges/${state.slug}/${county.slug}/${court.slug}/`,
      position: index + 1,
    })),
    `Courts in ${county.name}, ${state.name}`,
    `/judges/${state.slug}/${county.slug}/`,
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav
        style={{ marginBottom: "1rem", fontSize: "0.875rem", color: "#6b7280" }}
      >
        <Link href="/judges/" style={{ color: "#2563eb" }}>
          States
        </Link>
        {" › "}
        <Link href={`/judges/${state.slug}/`} style={{ color: "#2563eb" }}>
          {state.name}
        </Link>
        {" › "}
        <span>{county.name}</span>
      </nav>
      <h1>
        Courts in {county.name}, {state.name}
      </h1>
      {courts.length === 0 ? (
        <p style={{ color: "#6b7280", marginTop: "1rem" }}>
          No court records available for {county.name} yet. Court and judge data
          will be added as part of our ongoing data collection effort.
        </p>
      ) : (
        <>
          <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
            {courts.length} {courts.length === 1 ? "court type" : "court types"}{" "}
            in {county.name}. Select a court to view judges.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {courts.map((court) => (
              <Link
                key={court.id}
                href={`/judges/${state.slug}/${county.slug}/${court.slug}/`}
                style={{
                  display: "block",
                  padding: "1.25rem",
                  border: "1px solid #e5e7eb",
                  borderRadius: "0.375rem",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong>{court.type}</strong>
                <p
                  style={{
                    marginTop: "0.25rem",
                    fontSize: "0.875rem",
                    color: "#6b7280",
                  }}
                >
                  {court._count.judges}{" "}
                  {court._count.judges === 1 ? "judge" : "judges"}
                </p>
              </Link>
            ))}
          </div>
        </>
      )}
      <Disclaimer />
    </>
  );
}
