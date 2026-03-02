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
        aria-label="Breadcrumb"
        className="mb-4 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1">
          <li>
            <Link href="/judges/" className="text-link hover:underline">
              States
            </Link>
          </li>
          <li aria-hidden="true"> › </li>
          <li>
            <Link
              href={`/judges/${state.slug}/`}
              className="text-link hover:underline"
            >
              {state.name}
            </Link>
          </li>
          <li aria-hidden="true"> › </li>
          <li aria-current="page">{county.name}</li>
        </ol>
      </nav>
      <h1>
        Courts in {county.name}, {state.name}
      </h1>
      {courts.length === 0 ? (
        <p className="text-muted-foreground mt-4 py-8 text-center">
          No court records available for {county.name} yet. Court and judge data
          will be added as part of our ongoing data collection effort.
        </p>
      ) : (
        <>
          <p className="text-muted-foreground mb-8">
            {courts.length} {courts.length === 1 ? "court type" : "court types"}{" "}
            in {county.name}. Select a court to view judges.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {courts.map((court) => (
              <Link
                key={court.id}
                href={`/judges/${state.slug}/${county.slug}/${court.slug}/`}
                className="block p-5 border border-border rounded-md no-underline text-foreground hover:border-primary transition-colors"
              >
                <strong>{court.type}</strong>
                <p className="mt-1 text-sm text-muted-foreground">
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
