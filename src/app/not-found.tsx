import Link from "next/link";
import { prisma } from "@/lib/db";

export default async function NotFound() {
  const states = await prisma.state.findMany({
    where: {
      counties: {
        some: {
          courts: {
            some: {
              judges: { some: { status: "VERIFIED" } },
            },
          },
        },
      },
    },
    orderBy: { name: "asc" },
    select: { name: true, slug: true },
  });

  return (
    <div className="text-center py-16 px-4 sm:px-8">
      <h1 className="text-3xl font-bold mb-4">404 — Page Not Found</h1>
      <p className="text-muted-foreground mb-8">
        The page you&apos;re looking for doesn&apos;t exist or may have moved.
      </p>

      <div className="max-w-md mx-auto space-y-8">
        <Link
          href="/judges/"
          className="inline-block text-link underline font-medium"
        >
          Search all judges
        </Link>

        {states.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground mb-3">
              Browse by state
            </h2>
            <div className="flex flex-wrap justify-center gap-2">
              {states.map((state) => (
                <Link
                  key={state.slug}
                  href={`/judges/${state.slug}/`}
                  className="px-3 py-1.5 rounded-md bg-muted text-sm hover:bg-muted/80 transition-colors"
                >
                  {state.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
