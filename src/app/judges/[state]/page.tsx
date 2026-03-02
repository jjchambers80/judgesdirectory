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
          <li aria-current="page">{state.name}</li>
        </ol>
      </nav>
      <h1>Judges in {state.name} — County Directory</h1>
      <p className="text-muted-foreground mb-8">
        {counties.length} {counties.length === 1 ? "county" : "counties"} in{" "}
        {state.name}. Select a county to view court types.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {counties.map((county) => (
          <Link
            key={county.id}
            href={`/judges/${state.slug}/${county.slug}/`}
            className="block px-5 py-4 border border-border rounded-md no-underline text-foreground hover:border-primary transition-colors"
          >
            <strong>{county.name}</strong>
            {county._count.courts > 0 && (
              <span className="ml-2 text-sm text-muted-foreground">
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
