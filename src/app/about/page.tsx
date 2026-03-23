import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildOpenGraph, buildTwitterCard } from "@/lib/seo";

const title = "About";
const description = `About ${SITE_NAME} — our mission, data sources, methodology, and verification process for the national judges directory.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/about/` },
  openGraph: buildOpenGraph({
    title: `About — ${SITE_NAME}`,
    description,
    url: `${SITE_URL}/about/`,
  }),
  twitter: buildTwitterCard({ title: `About — ${SITE_NAME}`, description }),
};

export default function AboutPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>About {SITE_NAME}</h1>

      <h2>Our Mission</h2>
      <p>
        {SITE_NAME} makes public judicial information accessible and searchable.
        We believe that knowing who your judges are — their backgrounds, their
        courts, and their terms — is a fundamental part of civic participation.
      </p>
      <p>
        Our goal is to be the most accurate, comprehensive, and user-friendly
        directory of U.S. judges, built on the principle that public information
        about public officials should be easy to find.
      </p>

      <h2>Data Sources</h2>
      <p>
        All judicial information on this site is sourced from publicly available
        records, including:
      </p>
      <ul>
        <li>Official state and county court websites</li>
        <li>State bar association public records</li>
        <li>Judicial appointment and election records</li>
        <li>Public government directories</li>
      </ul>
      <p>
        We do not use private databases, social media profiles, or any
        non-public information sources.
      </p>

      <h2>Methodology</h2>
      <p>
        Our data collection process combines automated harvesting of public
        court websites with structured verification. We use the following
        approach:
      </p>
      <ol>
        <li>
          <strong>Discovery:</strong> We identify official court websites and
          judicial roster pages for each jurisdiction.
        </li>
        <li>
          <strong>Harvesting:</strong> Automated tools extract judge names,
          court assignments, and term information from these official sources.
        </li>
        <li>
          <strong>Verification:</strong> Each extracted record is
          cross-referenced against multiple public sources before being
          published. Only verified judges appear on the public site.
        </li>
        <li>
          <strong>Updates:</strong> We regularly re-harvest and re-verify to
          capture new appointments, retirements, and reassignments.
        </li>
      </ol>

      <h2>Verification Process</h2>
      <p>
        Every judge profile on {SITE_NAME} carries a verification status. Only
        judges marked as <strong>Verified</strong> appear on the public site.
        Verification means the judge&apos;s identity, court assignment, and
        basic information have been confirmed against at least one authoritative
        public source.
      </p>
      <p>
        We maintain source attribution for every record — you can see where each
        piece of information came from via the source links on judge profiles.
      </p>

      <h2>Coverage</h2>
      <p>
        We are currently building coverage across U.S. states, starting with
        Florida. Our goal is to expand to all 50 states. Coverage status is
        indicated on each state page — jurisdictions without verified judges are
        clearly marked as &quot;coming soon.&quot;
      </p>

      <h2>Corrections &amp; Updates</h2>
      <p>
        If you find inaccurate information or have an update to suggest, please
        contact us at{" "}
        <a href="mailto:corrections@judgesdirectory.org">
          corrections@judgesdirectory.org
        </a>
        . We take accuracy seriously and investigate all credible reports.
      </p>

      <h2>Contact</h2>
      <p>
        General inquiries:{" "}
        <a href="mailto:info@judgesdirectory.org">info@judgesdirectory.org</a>
      </p>
    </article>
  );
}
