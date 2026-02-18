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
          borderBottom: "2px solid #2563eb",
          fontSize: "0.875rem",
        }}
      >
        <Link href="/admin/" style={{ color: "#2563eb", fontWeight: 600 }}>
          Dashboard
        </Link>
        <Link href="/admin/judges/" style={{ color: "#2563eb" }}>
          Judges
        </Link>
        <Link href="/admin/judges/new/" style={{ color: "#2563eb" }}>
          + Add Judge
        </Link>
      </nav>
      {children}
    </div>
  );
}
