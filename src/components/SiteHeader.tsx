"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { SITE_NAME } from "@/lib/constants";
import { SearchInput } from "@/components/search";
import ThemeToggle from "@/components/ThemeToggle";

export default function SiteHeader() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState(searchParams.get("q") || "");
  const [isVisible, setIsVisible] = React.useState(true);
  const [hasScrolled, setHasScrolled] = React.useState(false);
  const lastScrollY = React.useRef(0);

  // Sync search input with URL query param
  const urlQuery = searchParams.get("q") || "";
  React.useEffect(() => {
    setQuery(urlQuery);
  }, [urlQuery]);

  // Scroll-direction detection: hide on down, show on up
  React.useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setHasScrolled(y > 0);
      if (Math.abs(y - lastScrollY.current) < 10) return;
      setIsVisible(y < 50 || y < lastScrollY.current);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleSubmit = () => {
    const trimmed = query.trim();
    router.push(
      trimmed ? `/judges/?q=${encodeURIComponent(trimmed)}` : "/judges/",
    );
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full bg-background/95 backdrop-blur-md",
        "border-b transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]",
        isVisible ? "translate-y-0" : "-translate-y-full",
        hasScrolled
          ? "border-border/80 shadow-[0_1px_3px_0_rgba(0,0,0,.25)]"
          : "border-border",
      )}
    >
      {/* Desktop: logo | centered search | toggle */}
      <div className="hidden sm:flex items-center gap-6 px-8 py-3 mx-auto max-w-[1200px]">
        <a
          href="/judges/"
          className="no-underline text-foreground hover:no-underline shrink-0"
        >
          <strong className="text-lg tracking-tight">{SITE_NAME}</strong>
        </a>

        <div className="flex-1 max-w-xl mx-auto">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            placeholder="Search judges by name..."
          />
        </div>

        <div className="shrink-0">
          <ThemeToggle />
        </div>
      </div>

      {/* Mobile row 1: centered logo, toggle flush-right */}
      {/* Mobile row 2: full-width search */}
      <div className="sm:hidden">
        <div className="flex items-center justify-center px-4 py-3 relative">
          <a
            href="/judges/"
            className="no-underline text-foreground hover:no-underline"
          >
            <strong className="text-lg tracking-tight">{SITE_NAME}</strong>
          </a>
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <ThemeToggle />
          </div>
        </div>
        <div className="px-4 pb-3">
          <SearchInput
            value={query}
            onChange={setQuery}
            onSubmit={handleSubmit}
            placeholder="Search judges by name..."
          />
        </div>
      </div>
    </header>
  );
}
