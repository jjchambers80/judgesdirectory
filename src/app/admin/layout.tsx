import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Admin layout — basic layout for admin panel.
 * Authentication is handled by middleware (Basic Auth).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const linkClasses = "text-link no-underline hover:underline font-normal";

  return (
    <div>
      <nav
        aria-label="Admin navigation"
        className="flex flex-wrap gap-x-6 gap-y-2 py-3 mb-6 border-b-2 border-link text-sm"
      >
        <Link href="/admin/" className={cn(linkClasses, "font-semibold")}>
          Dashboard
        </Link>
        <Link href="/admin/judges/" className={linkClasses}>
          Judges
        </Link>
        <Link href="/admin/judges/new/" className={linkClasses}>
          + Add Judge
        </Link>
        <Link href="/admin/import/" className={linkClasses}>
          Import
        </Link>
        <Link href="/admin/verification/" className={linkClasses}>
          Verification
        </Link>
        <Link href="/admin/courts/" className={linkClasses}>
          Courts
        </Link>
        <Link href="/admin/discovery/" className={linkClasses}>
          Discovery
        </Link>
        <Link href="/admin/failures/" className={linkClasses}>
          Failures
        </Link>
        <Link href="/admin/dashboard/" className={linkClasses}>
          Progress
        </Link>
      </nav>
      {children}
    </div>
  );
}
