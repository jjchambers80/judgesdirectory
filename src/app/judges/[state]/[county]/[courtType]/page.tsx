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
        aria-label="Breadcrumb"
        className="mb-4 text-sm text-muted-foreground"
      >
        <ol className="flex flex-wrap items-center gap-1.5 list-none m-0 p-0">
          <li>
            <Link href="/judges/" className="text-link hover:underline">
              States
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </li>
          <li>
            <Link
              href={`/judges/${state.slug}/`}
              className="text-link hover:underline"
            >
              {state.name}
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </li>
          <li>
            <Link
              href={`/judges/${state.slug}/${county.slug}/`}
              className="text-link hover:underline"
            >
              {county.name}
            </Link>
          </li>
          <li aria-hidden="true">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-4 h-4"
            >
              <path
                fillRule="evenodd"
                d="M8.22 5.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.75.75 0 0 1-1.06-1.06L11.94 10 8.22 6.28a.75.75 0 0 1 0-1.06Z"
                clipRule="evenodd"
              />
            </svg>
          </li>
          <li aria-current="page">{court.type}</li>
        </ol>
      </nav>
      <h1>
        {court.type} Judges in {county.name}, {state.name}
      </h1>
      {judges.length === 0 ? (
        <p className="text-muted-foreground mt-4 py-8 text-center">
          No verified judge records available for {court.type} in {county.name}{" "}
          yet. Judge data will be added as part of our ongoing data collection
          effort.
        </p>
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
      <Disclaimer />
    </>
  );
}
