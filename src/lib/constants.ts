export const SITE_NAME = "judgesdirectory.org";
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://judgesdirectory.org";

export const SITE_DESCRIPTION =
  "National directory of U.S. judges — browse by state, county, and court type.";

export const TITLE_TEMPLATE = `%s — ${SITE_NAME}`;
export const DEFAULT_TITLE = `U.S. Judges Directory — Browse by State`;

export const ADMIN_PATHS = ["/admin", "/api/admin"];

// CSV Import limits
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB (FR-001)
export const MAX_CSV_ROWS = 10_000; // (EC-001)

// Verification queue
export const VERIFICATION_PAGE_SIZE = 50; // Fixed per clarification

// Pilot target
export const PILOT_TARGET = 1_500; // 1,500 verified judges across 3 states (SC-002)
