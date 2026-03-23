import { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import {
  countyListTitle,
  buildItemListJsonLd,
  buildOpenGraph,
  buildTwitterCard,
} from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import JudgeGrid from "@/components/JudgeGrid";
import Breadcrumbs from "@/components/Breadcrumbs";

export const revalidate = 3600;

interface PageProps {
  params: Promise<{ state: string }>;
}

// Cached so generateMetadata and the page component share one DB round-trip
const getState = cache((slug: string) =>
  prisma.state.findUnique({ where: { slug } }),
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { state: stateSlug } = await params;
  const state = await getState(stateSlug);

  if (!state) return {};

  const title = countyListTitle(state.name);
  const description = `Browse all verified judges in ${state.name} by county. Find circuit court, county court, and district court judges.`;
  const url = `${SITE_URL}/judges/${state.slug}/`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: buildOpenGraph({ title, description, url }),
    twitter: buildTwitterCard({ title, description }),
  };
}

export default async function StateJudgesPage({ params }: PageProps) {
  const { state: stateSlug } = await params;

  const state = await getState(stateSlug);

  if (!state) notFound();

  const judges = await prisma.judge.findMany({
    where: {
      status: "VERIFIED",
      court: { county: { stateId: state.id } },
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
    `Judges in ${state.name}`,
    `/judges/${state.slug}/`,
  );

  return (
    <>
      <JsonLd data={jsonLd} />
      <Breadcrumbs
        segments={[{ label: "States", href: "/judges/" }]}
        currentPage={state.name}
      />
      <h1>Judges in {state.name}</h1>
      <p className="text-sm text-muted-foreground mb-4">
        {judges.length} verified {judges.length === 1 ? "judge" : "judges"} in{" "}
        {state.name}
      </p>
      <JudgeGrid judges={judges} />
    </>
  );
}
