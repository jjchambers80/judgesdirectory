import Link from "next/link";

export default function NotFound() {
  return (
    <div className="text-center py-16 px-4 sm:px-8">
      <h1>404 — Page Not Found</h1>
      <p className="text-muted-foreground">
        The page you are looking for does not exist.
      </p>
      <Link href="/judges/" className="inline-block mt-4 text-link underline">
        Browse the Judges Directory
      </Link>
    </div>
  );
}
