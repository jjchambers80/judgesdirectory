import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { courtTypesTitle, buildItemListJsonLd, buildOpenGraph, buildTwitterCard } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import JudgeGrid from "@/components/JudgeGrid";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 3600;

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

  const title = courtTypesTitle(county.name, state.name);
  const description = `Explore court types and judges in ${county.name}, ${state.name}. Find circuit, county, and district court judges.`;
  const url = `${SITE_URL}/judges/${state.slug}/${county.slug}/`;

  const verifiedCount = await prisma.judge.count({
    where: {
      status: "VERIFIED",
      court: { countyId: county.id },
    },
  });

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: buildOpenGraph({ title, description, url }),
    twitter: buildTwitterCard({ title, description }),
    ...(verifiedCount < 3 ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function CountyJudgesPage({ params }: PageProps) {
  const { state: stateSlug, county: countySlug } = await params;

  const state = await prisma.state.findUnique({ where: { slug: stateSlug } });
  if (!state) notFound();

  const county = await prisma.county.findUnique({
    where: { stateId_slug: { stateId: state.id, slug: countySlug } },
  });
  if (!county) notFound();

  const judges = await prisma.judge.findMany({
    where: {
      status: "VERIFIED",
      court: { countyId: county.id },
    },
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      slug: true,
      termEnd: true,
      photoUrl: true,
      court: {
        select: {
          type: true,
          slug: true,
          county: {
            select: {
              name: true,
              slug: true,
              state: { select: { name: true, slug: true } },
            },
          },
        },
      },
    },
  });

  if (judges.length === 0) {
    const neighbors = await prisma.county.findMany({
      where: {
        stateId: state.id,
        id: { not: county.id },
        courts: { some: { judges: { some: { status: "VERIFIED" } } } },
      },
      take: 5,
      orderBy: { name: "asc" },
      select: { name: true, slug: true },
    });

    return (
      <>
        <Breadcrumbs
          segments={[
            { label: "States", href: "/judges/" },
            { label: state.name, href: `/judges/${state.slug}/` },
          ]}
          currentPage={county.name}
        />
        <h1>
          Judges in {county.name}, {state.name}
        </h1>
        <aside className="py-12 text-center border rounded-lg bg-muted/50 mt-6">
          <h2 className="text-lg font-semibold mb-2">Coverage Coming Soon</h2>
          <p className="text-muted-foreground mb-4">
            We&apos;re working on adding verified judge information for {county.name}.
          </p>
          <nav className="flex flex-wrap justify-center gap-3">
            <Link
              href={`/judges/${state.slug}/`}
              className="text-sm text-link underline"
            >
              &larr; Back to {state.name}
            </Link>
            {neighbors.map((n) => (
              <Link
                key={n.slug}
                href={`/judges/${state.slug}/${n.slug}/`}
                className="text-sm px-3 py-1 rounded-md bg-muted hover:bg-muted/80"
              >
                {n.name}
              </Link>
            ))}
          </nav>
        </aside>
      </>
    );
  }

  const jsonLd = buildItemListJsonLd(
    judges.map((judge, index) => ({
      name: judge.fullName,
      url: `/judges/${judge.court.county.state.slug}/${judge.court.county.slug}/${judge.court.slug}/${judge.slug}/`,
      position: index + 1,
    })),
    `Judges in ${county.name}, ${state.name}`,
    `/judges/${state.slug}/${county.slug}/`,
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        segments={[
          { label: "States", href: "/judges/" },
          { label: state.name, href: `/judges/${state.slug}/` },
        ]}
        currentPage={county.name}
      />
      <h1>
        Judges in {county.name}, {state.name}
      </h1>
      <p className="text-sm text-muted-foreground mb-4">
        {judges.length} verified {judges.length === 1 ? "judge" : "judges"} in{" "}
        {county.name}
      </p>
      <JudgeGrid judges={judges} />
    </>
  );
}
