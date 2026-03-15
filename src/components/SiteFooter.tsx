import { SITE_NAME } from "@/lib/constants";

export default function SiteFooter() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="px-4 py-6 mx-auto max-w-[1200px] sm:px-8">
        <p className="text-sm text-muted-foreground">
          &copy; {new Date().getFullYear()} {SITE_NAME}. All rights reserved.
        </p>
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
