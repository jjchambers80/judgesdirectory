import Link from "next/link";

export default function AdminDashboard() {
  return (
    <div>
      <h1>Admin Dashboard</h1>
      <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
        Manage judge records for judgesdirectory.org
      </p>
      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/admin/judges/"
          style={{
            display: "block",
            padding: "2rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            textDecoration: "none",
            color: "inherit",
            minWidth: "200px",
          }}
        >
          <strong>Judge Records</strong>
          <p
            style={{
              color: "#6b7280",
              marginTop: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            View, create, edit, and verify judge records
          </p>
        </Link>
      </div>
    </div>
  );
}
