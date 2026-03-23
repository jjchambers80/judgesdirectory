import { revalidateTag, revalidatePath } from "next/cache";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function POST(request: NextRequest) {
  const token = request.headers.get("x-revalidation-token");
  const secret = process.env.REVALIDATION_SECRET;

  if (!secret || !token || !secureCompare(token, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { tag?: string; path?: string };
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  if (body.tag) {
    revalidateTag(body.tag);
    return NextResponse.json({ revalidated: true, tag: body.tag });
  }

  if (body.path) {
    revalidatePath(body.path);
    return NextResponse.json({ revalidated: true, path: body.path });
  }

  // Default: revalidate all judge-related caches
  revalidateTag("judges");
  return NextResponse.json({ revalidated: true, scope: "all-judges" });
}
