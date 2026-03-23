import Link from "next/link";
import { cn } from "@/lib/utils";
import JudgeAvatar from "@/components/JudgeAvatar";

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
            <JudgeAvatar photoUrl={judge.photoUrl} fullName={judge.fullName} size="sm" />

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
