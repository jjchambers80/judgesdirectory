import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildOpenGraph, buildTwitterCard } from "@/lib/seo";

const title = "Terms of Service";
const description = `Terms of service for ${SITE_NAME} — usage terms, disclaimers, and acceptable use policies.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/terms/` },
  openGraph: buildOpenGraph({ title, description, url: `${SITE_URL}/terms/` }),
  twitter: buildTwitterCard({ title, description }),
};

export default function TermsPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Terms of Service</h1>
      <p className="text-muted-foreground text-sm">
        Last updated: March 2026
      </p>

      <h2>Acceptance of Terms</h2>
      <p>
        By accessing and using {SITE_NAME}, you agree to these terms. If you do
        not agree, please do not use this site.
      </p>

      <h2>Informational Purposes Only</h2>
      <p>
        All information on this site is provided for general informational
        purposes only and does not constitute legal advice. While we strive to
        keep the information accurate and up to date, we make no representations
        or warranties of any kind, express or implied, about the completeness,
        accuracy, reliability, or suitability of the information.
      </p>

      <h2>No Legal Advice</h2>
      <p>
        Nothing on this site should be construed as legal advice. For legal
        matters, consult a qualified attorney. For official court and judge
        information, refer to the relevant government websites and court clerk
        offices.
      </p>

      <h2>Acceptable Use</h2>
      <p>You agree not to:</p>
      <ul>
        <li>Use automated tools to scrape or bulk-download data from this site</li>
        <li>Reproduce, distribute, or commercially exploit the compiled directory data</li>
        <li>Use the site for any unlawful purpose</li>
        <li>Attempt to interfere with the site&apos;s operation or security</li>
      </ul>

      <h2>Intellectual Property</h2>
      <p>
        Individual judge biographical facts are public information. However, the
        compilation, organization, and presentation of this directory — including
        the site design, code, and curated data structure — are protected by
        copyright. You may link to any page on this site without restriction.
      </p>

      <h2>Limitation of Liability</h2>
      <p>
        {SITE_NAME} and its operators shall not be liable for any direct,
        indirect, incidental, consequential, or punitive damages arising from
        your use of or inability to use this site, or from any errors or
        omissions in the information provided.
      </p>

      <h2>Data Accuracy</h2>
      <p>
        Judicial information is sourced from public records and verified through
        multiple sources. However, judicial appointments, retirements, and
        reassignments occur regularly. We update our records as frequently as
        possible but cannot guarantee real-time accuracy. Always verify critical
        information with official sources.
      </p>

      <h2>Changes to Terms</h2>
      <p>
        We reserve the right to update these terms at any time. Continued use of
        the site after changes constitutes acceptance of the revised terms.
      </p>

      <h2>Contact</h2>
      <p>
        For questions about these terms, contact us at{" "}
        <a href="mailto:legal@judgesdirectory.org">legal@judgesdirectory.org</a>.
      </p>
    </article>
  );
}
