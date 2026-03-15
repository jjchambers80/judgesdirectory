import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import { judgeProfileTitle, buildPersonJsonLd } from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/badge";

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
  if (!judge || judge.status !== "VERIFIED") return null;

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

// Judge silhouette SVG for when no photo is available
function JudgeSilhouette() {
  return (
    <svg
      viewBox="0 0 120 120"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full bg-muted rounded-lg"
      aria-hidden="true"
    >
      {/* Background circle for head */}
      <circle cx="60" cy="40" r="22" className="fill-muted-foreground" />
      {/* Shoulders/robe */}
      <path
        d="M20 120 C20 85 40 70 60 70 C80 70 100 85 100 120"
        className="fill-foreground/60"
      />
      {/* Judicial collar/robe detail */}
      <path
        d="M45 75 L60 90 L75 75"
        className="stroke-foreground"
        strokeWidth="3"
        fill="none"
      />
      {/* Gavel icon hint */}
      <rect
        x="85"
        y="95"
        width="20"
        height="6"
        rx="2"
        className="fill-muted-foreground"
        transform="rotate(-30 85 95)"
      />
    </svg>
  );
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

  const formatYear = (d: Date | null) =>
    d ? new Date(d).getFullYear().toString() : null;

  return (
    <>
      <JsonLd data={jsonLd} />

      {/* Breadcrumb Navigation */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 text-sm text-muted-foreground"
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
          <li>
            <Link
              href={`/judges/${state.slug}/${county.slug}/${court.slug}/`}
              className="text-link hover:underline"
            >
              {court.type}
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
          <li aria-current="page">{judge.fullName}</li>
        </ol>
      </nav>

      {/* Header with Photo */}
      <div className="flex flex-col gap-6 mb-8 sm:flex-row sm:items-start">
        {/* Photo or Silhouette */}
        <div className="w-[150px] h-[180px] shrink-0 rounded-lg overflow-hidden shadow-md">
          {judge.photoUrl ? (
            <Image
              src={judge.photoUrl}
              alt={`Photo of ${judge.fullName}`}
              width={150}
              height={180}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <JudgeSilhouette />
          )}
        </div>

        {/* Name and Title */}
        <div className="flex-1">
          <h1 className="mt-0 mb-2">
            {judge.isChiefJudge && (
              <Badge
                variant="outline"
                className="mr-3 align-middle bg-badge-warning-bg text-badge-warning-text border-transparent text-xs"
              >
                Chief Judge
              </Badge>
            )}
            {judge.fullName}
          </h1>
          <p className="text-muted-foreground text-lg m-0">{court.type}</p>
          <p className="text-muted-foreground text-[0.95rem] mt-1 mb-0">
            {county.name}, {state.name}
          </p>
          {judge.division && (
            <p className="text-muted-foreground text-sm mt-2 mb-0">
              Division: {judge.division}
            </p>
          )}
        </div>
      </div>

      {/* Main Info Sections */}
      <div className="flex flex-col gap-8">
        {/* Term & Appointment Section */}
        {(judge.termStart ||
          judge.termEnd ||
          judge.appointingAuthority ||
          judge.appointmentDate ||
          judge.selectionMethod) && (
          <section>
            <h2 className="text-xl mb-4 border-b-2 border-border pb-2">
              Term & Appointment
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr] sm:gap-x-6 sm:gap-y-3 m-0">
              {judge.termStart && (
                <>
                  <dt className="font-semibold text-foreground">Term Start</dt>
                  <dd className="m-0">{formatDate(judge.termStart)}</dd>
                </>
              )}
              {judge.termEnd && (
                <>
                  <dt className="font-semibold text-foreground">Term End</dt>
                  <dd className="m-0">{formatDate(judge.termEnd)}</dd>
                </>
              )}
              {judge.appointingAuthority && (
                <>
                  <dt className="font-semibold text-foreground">
                    Appointed By
                  </dt>
                  <dd className="m-0">{judge.appointingAuthority}</dd>
                </>
              )}
              {judge.appointmentDate && (
                <>
                  <dt className="font-semibold text-foreground">
                    Appointment Date
                  </dt>
                  <dd className="m-0">{formatDate(judge.appointmentDate)}</dd>
                </>
              )}
              {judge.selectionMethod && (
                <>
                  <dt className="font-semibold text-foreground">
                    Selection Method
                  </dt>
                  <dd className="m-0">{judge.selectionMethod}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Education & Career Section */}
        {(judge.education ||
          judge.priorExperience ||
          judge.barAdmissionDate) && (
          <section>
            <h2 className="text-xl mb-4 border-b-2 border-border pb-2">
              Education & Career
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr] sm:gap-x-6 sm:gap-y-3 m-0">
              {judge.education && (
                <>
                  <dt className="font-semibold text-foreground">Education</dt>
                  <dd className="m-0 whitespace-pre-line">{judge.education}</dd>
                </>
              )}
              {judge.barAdmissionDate && (
                <>
                  <dt className="font-semibold text-foreground">
                    Bar Admission
                  </dt>
                  <dd className="m-0">
                    {formatYear(judge.barAdmissionDate)}
                    {judge.barAdmissionState && ` (${judge.barAdmissionState})`}
                  </dd>
                </>
              )}
              {judge.priorExperience && (
                <>
                  <dt className="font-semibold text-foreground">
                    Prior Experience
                  </dt>
                  <dd className="m-0 whitespace-pre-line">
                    {judge.priorExperience}
                  </dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Political Information Section */}
        {(judge.politicalAffiliation || judge.birthDate) && (
          <section>
            <h2 className="text-xl mb-4 border-b-2 border-border pb-2">
              Additional Information
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr] sm:gap-x-6 sm:gap-y-3 m-0">
              {judge.politicalAffiliation && (
                <>
                  <dt className="font-semibold text-foreground">
                    Political Affiliation
                  </dt>
                  <dd className="m-0">{judge.politicalAffiliation}</dd>
                </>
              )}
              {judge.birthDate && (
                <>
                  <dt className="font-semibold text-foreground">Birth Date</dt>
                  <dd className="m-0">{formatDate(judge.birthDate)}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Contact Information Section */}
        {(judge.courthouseAddress || judge.courthousePhone) && (
          <section>
            <h2 className="text-xl mb-4 border-b-2 border-border pb-2">
              Contact Information
            </h2>
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_1fr] sm:gap-x-6 sm:gap-y-3 m-0">
              {judge.courthouseAddress && (
                <>
                  <dt className="font-semibold text-foreground">
                    Courthouse Address
                  </dt>
                  <dd className="m-0 whitespace-pre-line">
                    {judge.courthouseAddress}
                  </dd>
                </>
              )}
              {judge.courthousePhone && (
                <>
                  <dt className="font-semibold text-foreground">Phone</dt>
                  <dd className="m-0">
                    <a
                      href={`tel:${judge.courthousePhone}`}
                      className="text-link hover:underline"
                    >
                      {judge.courthousePhone}
                    </a>
                  </dd>
                </>
              )}
            </dl>
          </section>
        )}
      </div>

      {/* Source Link */}
      {judge.sourceUrl && (
        <p className="text-sm text-muted-foreground mt-8 mb-8">
          Source:{" "}
          <a
            href={judge.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-link underline"
          >
            Official Court Website
          </a>
        </p>
      )}

    </>
  );
}
