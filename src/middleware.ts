import { NextRequest, NextResponse } from "next/server";
import { ADMIN_PATHS } from "@/lib/constants";

/**
 * Middleware handles:
 * 1. URL normalization: lowercase + trailing slash via 308 redirect
 * 2. Admin Basic Auth: protect /admin and /api/admin routes
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // --- URL Normalization ---
  // Skip normalization for API routes, _next, and static files
  const skipNormalization =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".");

  if (!skipNormalization) {
    const lowercased = pathname.toLowerCase();
    const withTrailingSlash = lowercased.endsWith("/")
      ? lowercased
      : `${lowercased}/`;

    if (pathname !== withTrailingSlash) {
      const url = request.nextUrl.clone();
      url.pathname = withTrailingSlash;
      return NextResponse.redirect(url, 308);
    }
  }

  // --- Admin Basic Auth ---
  const isAdminRoute = ADMIN_PATHS.some((path) => pathname.startsWith(path));

  if (isAdminRoute) {
    const authHeader = request.headers.get("authorization");

    if (!authHeader || !isValidAuth(authHeader)) {
      return new NextResponse("Unauthorized", {
        status: 401,
        headers: {
          "WWW-Authenticate": 'Basic realm="Admin Panel"',
        },
      });
    }
  }

  return NextResponse.next();
}

function isValidAuth(authHeader: string): boolean {
  const [scheme, encoded] = authHeader.split(" ");
  if (scheme !== "Basic" || !encoded) return false;

  try {
    const decoded = atob(encoded);
    const [username, password] = decoded.split(":");
    return (
      username === process.env.ADMIN_USERNAME &&
      password === process.env.ADMIN_PASSWORD
    );
  } catch {
    return false;
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
