import type { Metadata } from "next";
import { SITE_NAME, SITE_DESCRIPTION, TITLE_TEMPLATE } from "@/lib/constants";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("theme");var t;if(s==="dark"||s==="light"){t=s}else{t=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "1rem 2rem",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <a
            href="/judges/"
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <strong>{SITE_NAME}</strong>
          </a>
          <ThemeToggle />
        </header>
        <main style={{ padding: "2rem", maxWidth: "1200px", margin: "0 auto" }}>
          {children}
        </main>
      </body>
    </html>
  );
}
