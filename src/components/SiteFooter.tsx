import { SITE_NAME } from "@/lib/constants";
import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="px-4 py-6 mx-auto max-w-[1400px] sm:px-8">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
        <nav aria-label="Footer navigation" className="flex gap-4 mt-2">
          <Link href="/about/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            About
          </Link>
          <Link href="/privacy/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Privacy Policy
          </Link>
          <Link href="/terms/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Terms of Service
          </Link>
        </nav>
        <aside
          role="note"
          aria-label="Legal disclaimer"
          className="mt-4 text-sm text-disclaimer-text"
        >
          <p>
            <strong>Disclaimer:</strong> The information provided on this
            website is for general informational purposes only and does not
            constitute legal advice. While we strive to keep the information
            accurate and up to date, we make no representations or warranties of
            any kind, express or implied, about the completeness, accuracy,
            reliability, or suitability of the information. Any reliance you
            place on such information is strictly at your own risk. For official
            court and judge information, please refer to the relevant government
            websites.
          </p>
        </aside>
      </div>
    </footer>
  );
}
