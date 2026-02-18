import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { judgeListTitle, buildItemListJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Disclaimer from "@/components/Disclaimer";

interface PageProps {
  params: Promise<{ state: string; county: string; courtType: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    state: stateSlug,
    county: countySlug,
    courtType: courtSlug,
  } = await params;

  const state = await prisma.state.findUnique({ where: { slug: stateSlug } });
  if (!state) return {};

  const county = await prisma.county.findUnique({
    where: { stateId_slug: { stateId: state.id, slug: countySlug } },
  });
  if (!county) return {};

  const court = await prisma.court.findUnique({
    where: { countyId_slug: { countyId: county.id, slug: courtSlug } },
  });
  if (!court) return {};

  return {
    title: judgeListTitle(court.type, county.name, state.name),
    alternates: {
      canonical: `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/`,
    },
  };
}

export default async function JudgeListPage({ params }: PageProps) {
  const {
    state: stateSlug,
    county: countySlug,
    courtType: courtSlug,
  } = await params;

  const state = await prisma.state.findUnique({ where: { slug: stateSlug } });
  if (!state) notFound();

  const county = await prisma.county.findUnique({
    where: { stateId_slug: { stateId: state.id, slug: countySlug } },
  });
  if (!county) notFound();

  const court = await prisma.court.findUnique({
    where: { countyId_slug: { countyId: county.id, slug: courtSlug } },
  });
  if (!court) notFound();

  const judges = await prisma.judge.findMany({
    where: { courtId: court.id, status: "VERIFIED" },
    orderBy: { fullName: "asc" },
  });

  const jsonLd = buildItemListJsonLd(
    judges.map((judge, index) => ({
      name: judge.fullName,
      url: `/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`,
      position: index + 1,
    })),
    `${court.type} Judges in ${county.name}, ${state.name}`,
    `/judges/${state.slug}/${county.slug}/${court.slug}/`,
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
        <Link
          href={`/judges/${state.slug}/`}
          style={{ color: "var(--color-link)" }}
        >
          {state.name}
        </Link>
        {" › "}
        <Link
          href={`/judges/${state.slug}/${county.slug}/`}
          style={{ color: "var(--color-link)" }}
        >
          {county.name}
        </Link>
        {" › "}
        <span>{court.type}</span>
      </nav>
      <h1>
        {court.type} Judges in {county.name}, {state.name}
      </h1>
      {judges.length === 0 ? (
        <p style={{ color: "var(--color-text-muted)", marginTop: "1rem" }}>
          No verified judge records available for {court.type} in {county.name}{" "}
          yet. Judge data will be added as part of our ongoing data collection
          effort.
        </p>
      ) : (
        <>
          <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
            {judges.length} verified {judges.length === 1 ? "judge" : "judges"}{" "}
            in {court.type}, {county.name}.
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {judges.map((judge) => (
              <Link
                key={judge.id}
                href={`/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`}
                style={{
                  display: "block",
                  padding: "1.25rem",
                  border: "1px solid var(--color-border)",
                  borderRadius: "0.375rem",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <strong>{judge.fullName}</strong>
                {judge.termEnd && (
                  <p
                    style={{
                      marginTop: "0.25rem",
                      fontSize: "0.875rem",
                      color: "var(--color-text-muted)",
                    }}
                  >
                    Term ends:{" "}
                    {new Date(judge.termEnd).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </>
      )}
      <Disclaimer />
    </>
  );
}
