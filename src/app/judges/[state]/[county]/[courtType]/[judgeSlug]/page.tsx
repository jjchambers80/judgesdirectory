import { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
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
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#e5e7eb",
        borderRadius: "8px",
      }}
    >
      {/* Background circle for head */}
      <circle cx="60" cy="40" r="22" fill="#9ca3af" />
      {/* Shoulders/robe */}
      <path
        d="M20 120 C20 85 40 70 60 70 C80 70 100 85 100 120"
        fill="#4b5563"
      />
      {/* Judicial collar/robe detail */}
      <path
        d="M45 75 L60 90 L75 75"
        stroke="#1f2937"
        strokeWidth="3"
        fill="none"
      />
      {/* Gavel icon hint */}
      <rect x="85" y="95" width="20" height="6" rx="2" fill="#6b7280" transform="rotate(-30 85 95)" />
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
        style={{
          marginBottom: "1.5rem",
          fontSize: "0.875rem",
          color: "var(--color-text-muted)",
        }}
      >
        <Link href="/judges/" style={{ color: "var(--color-link)" }}>
          States
        </Link>
        {" › "}
        <Link
          href={`/judges/${state.slug}/`}
          style={{ color: "var(--color-link)" }}
        >
          {state.name}
        </Link>
        {" › "}
        <Link
          href={`/judges/${state.slug}/${county.slug}/`}
          style={{ color: "var(--color-link)" }}
        >
          {county.name}
        </Link>
        {" › "}
        <Link
          href={`/judges/${state.slug}/${county.slug}/${court.slug}/`}
          style={{ color: "var(--color-link)" }}
        >
          {court.type}
        </Link>
        {" › "}
        <span>{judge.fullName}</span>
      </nav>

      {/* Header with Photo */}
      <div
        style={{
          display: "flex",
          gap: "2rem",
          marginBottom: "2rem",
          alignItems: "flex-start",
        }}
      >
        {/* Photo or Silhouette */}
        <div
          style={{
            width: "150px",
            height: "180px",
            flexShrink: 0,
            borderRadius: "8px",
            overflow: "hidden",
            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
          }}
        >
          {judge.photoUrl ? (
            <Image
              src={judge.photoUrl}
              alt={`Photo of ${judge.fullName}`}
              width={150}
              height={180}
              style={{ objectFit: "cover", width: "100%", height: "100%" }}
              unoptimized
            />
          ) : (
            <JudgeSilhouette />
          )}
        </div>

        {/* Name and Title */}
        <div style={{ flex: 1 }}>
          <h1 style={{ marginTop: 0, marginBottom: "0.5rem" }}>
            {judge.isChiefJudge && (
              <span
                style={{
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  color: "#b45309",
                  backgroundColor: "#fef3c7",
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  marginRight: "0.75rem",
                  verticalAlign: "middle",
                }}
              >
                Chief Judge
              </span>
            )}
            {judge.fullName}
          </h1>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "1.1rem",
              margin: 0,
            }}
          >
            {court.type}
          </p>
          <p
            style={{
              color: "var(--color-text-muted)",
              fontSize: "0.95rem",
              margin: "0.25rem 0 0 0",
            }}
          >
            {county.name}, {state.name}
          </p>
          {judge.division && (
            <p
              style={{
                color: "var(--color-text-muted)",
                fontSize: "0.875rem",
                margin: "0.5rem 0 0 0",
              }}
            >
              Division: {judge.division}
            </p>
          )}
        </div>
      </div>

      {/* Main Info Sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
        
        {/* Term & Appointment Section */}
        {(judge.termStart || judge.termEnd || judge.appointingAuthority || judge.appointmentDate || judge.selectionMethod) && (
          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Term & Appointment
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: "0.75rem 1.5rem",
                margin: 0,
              }}
            >
              {judge.termStart && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Term Start</dt>
                  <dd style={{ margin: 0 }}>{formatDate(judge.termStart)}</dd>
                </>
              )}
              {judge.termEnd && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Term End</dt>
                  <dd style={{ margin: 0 }}>{formatDate(judge.termEnd)}</dd>
                </>
              )}
              {judge.appointingAuthority && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Appointed By</dt>
                  <dd style={{ margin: 0 }}>{judge.appointingAuthority}</dd>
                </>
              )}
              {judge.appointmentDate && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Appointment Date</dt>
                  <dd style={{ margin: 0 }}>{formatDate(judge.appointmentDate)}</dd>
                </>
              )}
              {judge.selectionMethod && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Selection Method</dt>
                  <dd style={{ margin: 0 }}>{judge.selectionMethod}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Education & Career Section */}
        {(judge.education || judge.priorExperience || judge.barAdmissionDate) && (
          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Education & Career
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: "0.75rem 1.5rem",
                margin: 0,
              }}
            >
              {judge.education && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Education</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-line" }}>{judge.education}</dd>
                </>
              )}
              {judge.barAdmissionDate && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Bar Admission</dt>
                  <dd style={{ margin: 0 }}>
                    {formatYear(judge.barAdmissionDate)}
                    {judge.barAdmissionState && ` (${judge.barAdmissionState})`}
                  </dd>
                </>
              )}
              {judge.priorExperience && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Prior Experience</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-line" }}>{judge.priorExperience}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Political Information Section */}
        {(judge.politicalAffiliation || judge.birthDate) && (
          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Additional Information
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: "0.75rem 1.5rem",
                margin: 0,
              }}
            >
              {judge.politicalAffiliation && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Political Affiliation</dt>
                  <dd style={{ margin: 0 }}>{judge.politicalAffiliation}</dd>
                </>
              )}
              {judge.birthDate && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Birth Date</dt>
                  <dd style={{ margin: 0 }}>{formatDate(judge.birthDate)}</dd>
                </>
              )}
            </dl>
          </section>
        )}

        {/* Contact Information Section */}
        {(judge.courthouseAddress || judge.courthousePhone) && (
          <section>
            <h2 style={{ fontSize: "1.25rem", marginBottom: "1rem", borderBottom: "2px solid #e5e7eb", paddingBottom: "0.5rem" }}>
              Contact Information
            </h2>
            <dl
              style={{
                display: "grid",
                gridTemplateColumns: "180px 1fr",
                gap: "0.75rem 1.5rem",
                margin: 0,
              }}
            >
              {judge.courthouseAddress && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Courthouse Address</dt>
                  <dd style={{ margin: 0, whiteSpace: "pre-line" }}>{judge.courthouseAddress}</dd>
                </>
              )}
              {judge.courthousePhone && (
                <>
                  <dt style={{ fontWeight: 600, color: "var(--color-text-primary)" }}>Phone</dt>
                  <dd style={{ margin: 0 }}>
                    <a href={`tel:${judge.courthousePhone}`} style={{ color: "var(--color-link)" }}>
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
        <p
          style={{
            fontSize: "0.875rem",
            color: "var(--color-text-muted)",
            marginTop: "2rem",
            marginBottom: "2rem",
          }}
        >
          Source:{" "}
          <a
            href={judge.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--color-link)", textDecoration: "underline" }}
          >
            Official Court Website
          </a>
        </p>
      )}

      <Disclaimer />
    </>
  );
}
