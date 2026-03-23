import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { judgeListTitle, buildItemListJsonLd, buildOpenGraph, buildTwitterCard } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 3600;

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

  const title = judgeListTitle(court.type, county.name, state.name);
  const description = `All verified ${court.type} judges in ${county.name}, ${state.name}. View assigned judges with term dates and court details.`;
  const url = `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: buildOpenGraph({ title, description, url }),
    twitter: buildTwitterCard({ title, description }),
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
      <Breadcrumbs
        segments={[
          { label: "States", href: "/judges/" },
          { label: state.name, href: `/judges/${state.slug}/` },
          { label: county.name, href: `/judges/${state.slug}/${county.slug}/` },
        ]}
        currentPage={court.type}
      />
      <h1>
        {court.type} Judges in {county.name}, {state.name}
      </h1>
      {judges.length === 0 ? (
        <aside className="py-12 text-center border rounded-lg bg-muted/50 mt-6">
          <h2 className="text-lg font-semibold mb-2">Coverage Coming Soon</h2>
          <p className="text-muted-foreground mb-4">
            We&apos;re working on verifying judges for the {court.type} in {county.name}.
          </p>
          <nav className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/judges/${state.slug}/${county.slug}/`}
              className="text-sm text-link underline"
            >
              &larr; Back to {county.name}
            </Link>
          </nav>
        </aside>
      ) : (
        <>
          <p className="text-muted-foreground mb-8">
            {judges.length} verified {judges.length === 1 ? "judge" : "judges"}{" "}
            in {court.type}, {county.name}.
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {judges.map((judge) => (
              <Link
                key={judge.id}
                href={`/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`}
                className="block p-5 border border-border rounded-md no-underline text-foreground hover:border-primary transition-colors"
              >
                <strong>{judge.fullName}</strong>
                {judge.termEnd && (
                  <p className="mt-1 text-sm text-muted-foreground">
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
    </>
  );
}
