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
      className="block p-6 border border-border rounded-lg no-underline text-foreground hover:border-primary transition-colors"
    >
      <strong>{title}</strong>
      <p className="text-muted-foreground mt-2 text-sm">{description}</p>
    </Link>
  );
}

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p className="text-muted-foreground mb-8">
        Manage judge records for judgesdirectory.org
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        <AdminCard
          href="/admin/discovery/"
          title="URL Discovery"
          description="Discover and review court roster URLs for new states"
        />
        <AdminCard
          href="/admin/health/"
          title="URL Health"
          description="Monitor URL health scores, yield trends, and anomalies"
        />
      </div>
    </div>
  );
}
