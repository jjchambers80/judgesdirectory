import { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SITE_URL } from "@/lib/constants";
import {
  judgeProfileTitle,
  buildPersonJsonLd,
  buildOpenGraph,
  buildTwitterCard,
} from "@/lib/seo";
import JsonLd from "@/components/seo/JsonLd";
import { Badge } from "@/components/ui/badge";
import Breadcrumbs from "@/components/Breadcrumbs";
import JudgeAvatar from "@/components/JudgeAvatar";

export const revalidate = 86400;

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

  const title = judgeProfileTitle(
    judge.fullName,
    court.type,
    county.name,
    state.name,
  );
  const description = `Judge ${judge.fullName} serves on the ${court.type} in ${county.name}, ${state.name}. View term dates, court information, and official records.`;
  const url = `${SITE_URL}/judges/${state.slug}/${county.slug}/${court.slug}/${judge.slug}/`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: buildOpenGraph({
      title,
      description,
      url,
      type: "profile",
      imageUrl: judge.photoUrl || undefined,
    }),
    twitter: buildTwitterCard({
      title,
      description,
      imageUrl: judge.photoUrl || undefined,
    }),
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

  const formatYear = (d: Date | null) =>
    d ? new Date(d).getFullYear().toString() : null;

  return (
    <>
      <JsonLd data={jsonLd} />

      <Breadcrumbs
        segments={[
          { label: "States", href: "/judges/" },
          { label: state.name, href: `/judges/${state.slug}/` },
          { label: county.name, href: `/judges/${state.slug}/${county.slug}/` },
          {
            label: court.type,
            href: `/judges/${state.slug}/${county.slug}/${court.slug}/`,
          },
        ]}
        currentPage={judge.fullName}
      />

      {/* Header with Photo */}
      <div className="flex flex-col gap-6 mb-8 sm:flex-row sm:items-start">
        <JudgeAvatar
          photoUrl={judge.photoUrl}
          fullName={judge.fullName}
          size="lg"
        />

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
