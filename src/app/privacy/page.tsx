import { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/constants";
import { buildOpenGraph, buildTwitterCard } from "@/lib/seo";

const title = "Privacy Policy";
const description = `Privacy policy for ${SITE_NAME} — how we handle visitor data and protect your privacy.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${SITE_URL}/privacy/` },
  openGraph: buildOpenGraph({
    title,
    description,
    url: `${SITE_URL}/privacy/`,
  }),
  twitter: buildTwitterCard({ title, description }),
};

export default function PrivacyPage() {
  return (
    <article className="prose prose-neutral dark:prose-invert max-w-3xl mx-auto py-8">
      <h1>Privacy Policy</h1>
      <p className="text-muted-foreground text-sm">Last updated: March 2026</p>

      <h2>Overview</h2>
      <p>
        {SITE_NAME} is committed to protecting your privacy. This policy
        explains what information we collect, how we use it, and your rights
        regarding that information.
      </p>

      <h2>Information We Collect</h2>
      <p>
        We do not use cookies or collect personal information from visitors. Our
        analytics are provided by Vercel Analytics, which is a privacy-friendly,
        cookie-free analytics service that does not track individual users or
        collect personally identifiable information.
      </p>

      <h2>Data Sources</h2>
      <p>
        The judicial information displayed on this site is sourced from publicly
        available government records, including official court websites, state
        bar association records, and public judicial appointment notices. We do
        not collect private information about judges or any individuals.
      </p>

      <h2>Third-Party Services</h2>
      <ul>
        <li>
          <strong>Vercel Analytics:</strong> Cookie-free page view analytics. No
          personal data is collected or shared. See{" "}
          <a
            href="https://vercel.com/docs/analytics/privacy-policy"
            target="_blank"
            rel="noopener noreferrer"
          >
            Vercel&apos;s privacy policy
          </a>
          .
        </li>
        <li>
          <strong>Vercel Speed Insights:</strong> Anonymous Core Web Vitals
          performance monitoring. No personal data collected.
        </li>
        <li>
          <strong>Google Search Console:</strong> Used to monitor search
          performance. Interacts only with search engine crawlers, not with
          visitor browsers.
        </li>
      </ul>

      <h2>Data Retention</h2>
      <p>
        Since we do not collect personal data from visitors, there is no
        personal data to retain or delete. Judicial data is retained and updated
        as public records change.
      </p>

      <h2>Your Rights</h2>
      <p>
        If you believe any information displayed on this site is inaccurate or
        should be corrected, please contact us. As all information is sourced
        from public records, we encourage you to also contact the relevant court
        or government agency directly.
      </p>

      <h2>Changes to This Policy</h2>
      <p>
        We may update this policy from time to time. Changes will be posted on
        this page with an updated revision date.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy-related questions, contact us at{" "}
        <a href="mailto:privacy@judgesdirectory.org">
          privacy@judgesdirectory.org
        </a>
        .
      </p>
    </article>
  );
}
