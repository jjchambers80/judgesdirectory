import { Metadata } from "next";
import { notFound } from "next/navigation";
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

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: buildOpenGraph({ title, description, url }),
    twitter: buildTwitterCard({ title, description }),
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
