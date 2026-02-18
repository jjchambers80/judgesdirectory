import Link from "next/link";

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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: "1rem",
      }}
    >
      {states.map((state) => (
        <Link
          key={state.id}
          href={`/judges/${state.slug}/`}
          style={{
            display: "block",
            padding: "1.5rem",
            border: "1px solid #e5e7eb",
            borderRadius: "0.5rem",
            textDecoration: "none",
            color: "inherit",
            transition: "border-color 0.15s",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <strong style={{ fontSize: "1.125rem" }}>{state.name}</strong>
            <span
              style={{
                fontSize: "0.875rem",
                color: "#6b7280",
                fontWeight: 600,
              }}
            >
              {state.abbreviation}
            </span>
          </div>
          <p
            style={{
              marginTop: "0.5rem",
              fontSize: "0.875rem",
              color: "#6b7280",
            }}
          >
            {state._count.counties}{" "}
            {state._count.counties === 1 ? "county" : "counties"}
          </p>
        </Link>
      ))}
    </div>
  );
}
