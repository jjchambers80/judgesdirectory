import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { judgeProfileTitle, buildPersonJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import Disclaimer from "@/components/Disclaimer";

interface PageProps {
  params: Promise<{
    state: string;
    county: string;
    courtType: string;
    judgeSlug: string;
  }>;
}

async function getJudge(
  stateSlug: string,
  countySlug: string,
  courtSlug: string,
  judgeSlug: string,
) {
  const state = await prisma.state.findUnique({ where: { slug: stateSlug } });
  if (!state) return null;

  const county = await prisma.county.findUnique({
    where: { stateId_slug: { stateId: state.id, slug: countySlug } },
  });
  if (!county) return null;

  const court = await prisma.court.findUnique({
    where: { countyId_slug: { countyId: county.id, slug: courtSlug } },
  });
  if (!court) return null;

  const judge = await prisma.judge.findUnique({
    where: { courtId_slug: { courtId: court.id, slug: judgeSlug } },
  });
  // Only show verified judges on public pages
  if (!judge || !judge.verified) return null;

  return { state, county, court, judge };
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const {
    state: stateSlug,
    county: countySlug,
    courtType: courtSlug,
    judgeSlug,
  } = await params;
  const data = await getJudge(stateSlug, countySlug, courtSlug, judgeSlug);
  if (!data) return {};

  const { state, county, court, judge } = data;

  return {
    title: judgeProfileTitle(
      judge.fullName,
      court.type,
      county.name,
      state.name,
    ),
    alternates: {
      canonical: `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`,
    },
  };
}

export default async function JudgeProfilePage({ params }: PageProps) {
  const {
    state: stateSlug,
    county: countySlug,
    courtType: courtSlug,
    judgeSlug,
  } = await params;
  const data = await getJudge(stateSlug, countySlug, courtSlug, judgeSlug);
  if (!data) notFound();

  const { state, county, court, judge } = data;
  const profileUrl = `/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`;

  const jsonLd = buildPersonJsonLd({
    fullName: judge.fullName,
    court: {
      type: court.type,
      county: {
        name: county.name,
        state: { name: state.name },
      },
    },
    url: profileUrl,
    description: `${judge.fullName}, ${court.type}, ${county.name}, ${state.name}`,
  });

  const formatDate = (d: Date | null) =>
    d
      ? new Date(d).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : null;

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
        <Link
          href={`/judges/${state.slug}/${county.slug}/`}
          style={{ color: "#2563eb" }}
        >
          {county.name}
        </Link>
        {" › "}
        <Link
          href={`/judges/${state.slug}/${county.slug}/${court.slug}/`}
          style={{ color: "#2563eb" }}
        >
          {court.type}
        </Link>
        {" › "}
        <span>{judge.fullName}</span>
      </nav>

      <h1>{judge.fullName}</h1>
      <p
        style={{ color: "#6b7280", fontSize: "0.875rem", marginBottom: "2rem" }}
      >
        {court.type} — {county.name}, {state.name}
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "max-content 1fr",
          gap: "0.5rem 1.5rem",
          marginBottom: "2rem",
        }}
      >
        <dt style={{ fontWeight: 600, color: "#374151" }}>Court</dt>
        <dd style={{ margin: 0 }}>{court.type}</dd>

        <dt style={{ fontWeight: 600, color: "#374151" }}>Location</dt>
        <dd style={{ margin: 0 }}>
          {county.name}, {state.name}
        </dd>

        {judge.termStart && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>Term Start</dt>
            <dd style={{ margin: 0 }}>{formatDate(judge.termStart)}</dd>
          </>
        )}

        {judge.termEnd && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>Term End</dt>
            <dd style={{ margin: 0 }}>{formatDate(judge.termEnd)}</dd>
          </>
        )}

        {judge.selectionMethod && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>
              Selection Method
            </dt>
            <dd style={{ margin: 0 }}>{judge.selectionMethod}</dd>
          </>
        )}

        {judge.appointingAuthority && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>
              Appointing Authority
            </dt>
            <dd style={{ margin: 0 }}>{judge.appointingAuthority}</dd>
          </>
        )}

        {judge.politicalAffiliation && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>
              Political Affiliation
            </dt>
            <dd style={{ margin: 0 }}>{judge.politicalAffiliation}</dd>
          </>
        )}

        {judge.education && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>Education</dt>
            <dd style={{ margin: 0, whiteSpace: "pre-line" }}>
              {judge.education}
            </dd>
          </>
        )}

        {judge.priorExperience && (
          <>
            <dt style={{ fontWeight: 600, color: "#374151" }}>
              Prior Experience
            </dt>
            <dd style={{ margin: 0, whiteSpace: "pre-line" }}>
              {judge.priorExperience}
            </dd>
          </>
        )}
      </div>

      {judge.sourceUrl && (
        <p
          style={{
            fontSize: "0.875rem",
            color: "#6b7280",
            marginBottom: "2rem",
          }}
        >
          Source:{" "}
          <a
            href={judge.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "#2563eb", textDecoration: "underline" }}
          >
            {judge.sourceUrl}
          </a>
        </p>
      )}

      <Disclaimer />
    </>
  );
}
