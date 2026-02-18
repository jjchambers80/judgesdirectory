import Link from "next/link";

export default function NotFound() {
  return (
    <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
      <h1>404 — Page Not Found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link
        href="/judges/"
        style={{
          display: "inline-block",
          marginTop: "1rem",
          color: "#2563eb",
          textDecoration: "underline",
        }}
      >
        Browse the Judges Directory
      </Link>
    </div>
  );
}
