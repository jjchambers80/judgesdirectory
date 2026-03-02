import Link from "next/link";
import { cn } from "@/lib/utils";

interface StateItem {
  id: string;
  name: string;
  slug: string;
  abbreviation: string;
  _count: { counties: number };
}

interface StateGridProps {
  states: StateItem[];
}

/**
 * Grid of US state tiles, each linking to its county listing page.
 * Server Component — no 'use client'.
 */
export default function StateGrid({ states }: StateGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {states.map((state) => (
        <Link
          key={state.id}
          href={`/judges/${state.slug}/`}
          className={cn(
            "block p-6 rounded-lg border border-border",
            "no-underline text-foreground",
            "transition-colors hover:border-primary hover:no-underline",
            "bg-card",
          )}
        >
          <div className="flex items-center justify-between">
            <strong className="text-lg">{state.name}</strong>
            <span className="text-sm font-semibold text-muted-foreground">
              {state.abbreviation}
            </span>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {state._count.counties}{" "}
            {state._count.counties === 1 ? "county" : "counties"}
          </p>
        </Link>
      ))}
    </div>
  );
}
