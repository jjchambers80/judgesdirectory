import { sanitizeJsonLd } from "@/lib/seo";

interface JsonLdProps {
  data: object;
}

/**
 * Server Component that injects JSON-LD structured data into the page.
 * Uses dangerouslySetInnerHTML with XSS sanitization.
 */
export default function JsonLd({ data }: JsonLdProps) {
  const jsonString = sanitizeJsonLd(JSON.stringify(data));

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: jsonString }}
    />
  );
}
