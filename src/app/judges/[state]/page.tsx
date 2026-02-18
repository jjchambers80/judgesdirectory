import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { countyListTitle, buildItemListJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Disclaimer from "@/components/Disclaimer";

interface PageProps {
  params: Promise<{ state: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const state = await prisma.state.findUnique({
    where: { slug: stateSlug },
  });

  if (!state) return {};

  return {
    title: countyListTitle(state.name),
    alternates: {
      canonical: `${SITE_URL}/judges/${state.slug}/`,
    },
  };
}

export default async function CountyListPage({ params }: PageProps) {
  const { state: stateSlug } = await params;

  const state = await prisma.state.findUnique({
    where: { slug: stateSlug },
  });

  if (!state) notFound();

  const counties = await prisma.county.findMany({
    where: { stateId: state.id },
    orderBy: { name: "asc" },
    include: {
      _count: { select: { courts: true } },
    },
  });

  const jsonLd = buildItemListJsonLd(
    counties.map((county, index) => ({
      name: county.name,
      url: `/judges/${state.slug}/${county.slug}/`,
      position: index + 1,
    })),
    `Counties in ${state.name}`,
    `/judges/${state.slug}/`,
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <nav
        style={{
          marginBottom: "1rem",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
        }}
      >
        <Link href="/judges/" style={{ color: "var(--color-link)" }}>
          States
        </Link>
        {" › "}
        <span>{state.name}</span>
      </nav>
      <h1>Judges in {state.name} — County Directory</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        {counties.length} {counties.length === 1 ? "county" : "counties"} in{" "}
        {state.name}. Select a county to view court types.
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
          gap: "0.75rem",
        }}
      >
        {counties.map((county) => (
          <Link
            key={county.id}
            href={`/judges/${state.slug}/${county.slug}/`}
            style={{
              display: "block",
              padding: "1rem 1.25rem",
              border: "1px solid var(--color-border)",
              borderRadius: "0.375rem",
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <strong>{county.name}</strong>
            {county._count.courts > 0 && (
              <span
                style={{
                  marginLeft: "0.5rem",
                  fontSize: "0.875rem",
                  color: "var(--color-text-muted)",
                }}
              >
                ({county._count.courts}{" "}
                {county._count.courts === 1 ? "court" : "courts"})
              </span>
            )}
          </Link>
        ))}
      </div>
      <Disclaimer />
    </>
  );
}
