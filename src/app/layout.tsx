import type { Metadata } from "next";
import { SITE_NAME, SITE_DESCRIPTION, TITLE_TEMPLATE } from "@/lib/constants";

export const metadata: Metadata = {
  title: {
    template: TITLE_TEMPLATE,
    default: SITE_NAME,
  },
  description: SITE_DESCRIPTION,
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL || "https://judgesdirectory.org",
  ),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <header
          style={{
            padding: "1rem 2rem",
            borderBottom: "1px solid #e5e7eb",
          }}
        >
          <a
            href="/judges/"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <strong>{SITE_NAME}</strong>
          </a>
        </header>
        <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
