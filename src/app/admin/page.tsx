import Link from "next/link";

function AdminCard({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      style={{
        display: "block",
        padding: "1.5rem",
        border: "1px solid var(--color-border)",
        borderRadius: "0.5rem",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <strong>{title}</strong>
      <p
        style={{
          color: "var(--color-text-muted)",
          marginTop: "0.5rem",
          fontSize: "0.875rem",
        }}
      >
        {description}
      </p>
    </Link>
  );
}

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p style={{ color: "var(--color-text-muted)", marginBottom: "2rem" }}>
        Manage judge records for judgesdirectory.org
      </p>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          gap: "1rem",
        }}
      >
        <AdminCard
          href="/admin/import/"
          title="CSV Import"
          description="Upload CSV files to bulk import judge records"
        />
        <AdminCard
          href="/admin/verification/"
          title="Verification"
          description="Review and verify imported judge records"
        />
        <AdminCard
          href="/admin/courts/"
          title="Courts"
          description="Bulk create court types across counties"
        />
        <AdminCard
          href="/admin/dashboard/"
          title="Dashboard"
          description="Track import progress toward the pilot target"
        />
        <AdminCard
          href="/admin/judges/"
          title="Judge Records"
          description="View, create, edit, and manage judge records"
        />
      </div>
    </div>
  );
}
