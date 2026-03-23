import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface JudgeItem {
  id: string;
  fullName: string;
  slug: string;
  termEnd: Date | null;
  photoUrl: string | null;
  court: {
    type: string;
    slug: string;
    county: {
      name: string;
      slug: string;
      state: {
        name: string;
        slug: string;
      };
    };
  };
}

interface JudgeGridProps {
  judges: JudgeItem[];
}

export default function JudgeGrid({ judges }: JudgeGridProps) {
  if (judges.length === 0) {
    return (
      <p className="text-muted-foreground py-8 text-center">
        No verified judge records available yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {judges.map((judge) => {
        const { court } = judge;
        const href = `/judges/${court.county.state.slug}/${court.county.slug}/${court.slug}/${judge.slug}/`;

        return (
          <Link
            key={judge.id}
            href={href}
            className={cn(
              "group flex items-start gap-4 p-4 rounded-lg border border-border",
              "no-underline text-foreground bg-card",
              "transition-all duration-200",
              "hover:border-primary hover:shadow-md hover:no-underline",
              "hover:-translate-y-0.5",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            {/* Avatar */}
            <div className="relative w-11 h-11 shrink-0 rounded-full overflow-hidden bg-muted ring-1 ring-border">
              {judge.photoUrl ? (
                <Image
                  src={judge.photoUrl}
                  alt=""
                  width={44}
                  height={44}
                  className="object-cover w-full h-full"
                />
              ) : (
                <svg
                  viewBox="0 0 44 44"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-full"
                  aria-hidden="true"
                >
                  <circle
                    cx="22"
                    cy="16"
                    r="7"
                    className="fill-muted-foreground/50"
                  />
                  <path
                    d="M8 44 C8 33 14 27 22 27 C30 27 36 33 36 44"
                    className="fill-muted-foreground/30"
                  />
                  <path
                    d="M18 29 L22 33 L26 29"
                    className="stroke-muted-foreground/40"
                    strokeWidth="1.2"
                    fill="none"
                  />
                </svg>
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <strong className="text-base group-hover:text-primary transition-colors duration-200">
                {judge.fullName}
              </strong>
              <p className="mt-0.5 text-sm text-muted-foreground leading-snug truncate">
                {court.type} · {court.county.name}, {court.county.state.name}
              </p>
              {judge.termEnd && (
                <p className="mt-0.5 text-xs text-muted-foreground/70">
                  Term ends{" "}
                  {new Date(judge.termEnd).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                  })}
                </p>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
