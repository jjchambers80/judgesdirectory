import Link from "next/link";

/**
 * Admin layout — basic layout for admin panel.
 * Authentication is handled by middleware (Basic Auth).
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <nav
        style={{
          display: "flex",
          gap: "1.5rem",
          padding: "0.75rem 0",
          marginBottom: "2rem",
          borderBottom: "2px solid var(--color-link)",
          fontSize: "0.875rem",
        }}
      >
        <Link
          href="/admin/"
          style={{ color: "var(--color-link)", fontWeight: 600 }}
        >
          Dashboard
        </Link>
        <Link href="/admin/judges/" style={{ color: "var(--color-link)" }}>
          Judges
        </Link>
        <Link href="/admin/judges/new/" style={{ color: "var(--color-link)" }}>
          + Add Judge
        </Link>
        <Link href="/admin/import/" style={{ color: "var(--color-link)" }}>
          Import
        </Link>
        <Link
          href="/admin/verification/"
          style={{ color: "var(--color-link)" }}
        >
          Verification
        </Link>
        <Link href="/admin/courts/" style={{ color: "var(--color-link)" }}>
          Courts
        </Link>
        <Link href="/admin/dashboard/" style={{ color: "var(--color-link)" }}>
          Progress
        </Link>
      </nav>
      {children}
    </div>
  );
}
