import baseSlugify from "slugify";
import { prisma } from "@/lib/db";

/**
 * Generate a URL-safe slug from a string.
 * Lowercase ASCII, hyphen-separated, max 100 chars.
 */
export function generateSlug(input: string): string {
  const slug = baseSlugify(input, {
    lower: true,
    strict: true, // strip special characters
    trim: true,
  });
  return slug.slice(0, 100);
}

/**
 * Generate a unique slug within a given scope.
 * If collision exists, appends -2, -3, etc.
 */
export async function generateUniqueJudgeSlug(
  fullName: string,
  courtId: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = generateSlug(fullName);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.judge.findFirst({
      where: {
        courtId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (!existing) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
}

/**
 * Generate a unique slug for a court within a county.
 */
export async function generateUniqueCourtSlug(
  type: string,
  countyId: string,
  excludeId?: string,
): Promise<string> {
  const baseSlug = generateSlug(type);
  let candidate = baseSlug;
  let suffix = 2;

  while (true) {
    const existing = await prisma.court.findFirst({
      where: {
        countyId,
        slug: candidate,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
    });

    if (!existing) return candidate;
    candidate = `${baseSlug}-${suffix}`;
    suffix++;
  }
}
