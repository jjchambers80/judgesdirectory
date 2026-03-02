import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { SITE_NAME, SITE_DESCRIPTION, TITLE_TEMPLATE } from "@/lib/constants";
import ThemeToggle from "@/components/ThemeToggle";
import "./globals.css";

const roboto = Roboto({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-roboto",
});

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
    <html
      lang="en"
      className={`${roboto.variable} ${roboto.className}`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var s=localStorage.getItem("theme");var t;if(s==="dark"||s==="light"){t=s}else{t=window.matchMedia("(prefers-color-scheme:dark)").matches?"dark":"light"}document.documentElement.dataset.theme=t}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        {/* Skip navigation link (FR-009) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-background focus:text-foreground focus:rounded-md focus:ring-2 focus:ring-ring"
        >
          Skip to main content
        </a>

        <header className="flex flex-col items-start gap-2 px-4 py-3 border-b border-border sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-4">
          <a
            href="/judges/"
            className="no-underline text-foreground hover:no-underline"
          >
            <strong className="text-lg">{SITE_NAME}</strong>
          </a>
          <ThemeToggle />
        </header>

        <main
          id="main-content"
          className="px-4 py-6 mx-auto max-w-[1200px] sm:px-8 sm:py-8"
        >
          {children}
        </main>
      </body>
    </html>
  );
}
