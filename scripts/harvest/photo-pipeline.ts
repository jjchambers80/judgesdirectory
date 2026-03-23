/**
 * Photo Pipeline — Extracts judge photos from court bio pages,
 * optimizes via sharp, and stores in Vercel Blob.
 *
 * Usage: npx tsx scripts/harvest/photo-pipeline.ts [--dry-run] [--limit=N]
 *
 * Requirements: BLOB_READ_WRITE_TOKEN env var for Vercel Blob uploads
 */

import { PrismaClient } from "@prisma/client";
import sharp from "sharp";
import { put } from "@vercel/blob";
import * as cheerio from "cheerio";

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT_ARG = process.argv.find((a) => a.startsWith("--limit="));
const LIMIT = LIMIT_ARG ? parseInt(LIMIT_ARG.split("=")[1], 10) : 50;

interface PhotoResult {
  judgeId: string;
  judgeName: string;
  status: "extracted" | "no-photo" | "failed";
  blobUrl?: string;
  error?: string;
}

/**
 * Extract a photo URL from an HTML page using common court bio patterns.
 */
function extractPhotoUrl(html: string, baseUrl: string): string | null {
  const $ = cheerio.load(html);

  const selectors = [
    ".judge-photo img",
    ".bio-photo img",
    ".judge-image img",
    ".profile-photo img",
    ".judge-profile img",
    ".judicial-officer img",
    'article img[alt*="judge" i]',
    'article img[alt*="Judge" i]',
    ".content-area img:first-of-type",
    "main img:first-of-type",
  ];

  for (const selector of selectors) {
    const img = $(selector).first();
    if (img.length) {
      const src = img.attr("src");
      if (src && !isIconOrLogo(src, img)) {
        try {
          return new URL(src, baseUrl).href;
        } catch {
          continue;
        }
      }
    }
  }

  return null;
}

/**
 * Heuristic to filter out logos, icons, and non-portrait images.
 */
function isIconOrLogo(
  src: string,
  img: ReturnType<ReturnType<typeof cheerio.load>>,
): boolean {
  const srcLower = src.toLowerCase();
  if (
    srcLower.includes("logo") ||
    srcLower.includes("icon") ||
    srcLower.includes("seal")
  ) {
    return true;
  }
  const alt = (img.attr("alt") || "").toLowerCase();
  if (alt.includes("logo") || alt.includes("seal") || alt.includes("icon")) {
    return true;
  }
  if (srcLower.endsWith(".svg") || srcLower.includes("1x1")) {
    return true;
  }
  return false;
}

/**
 * Fetch, optimize, and upload a photo to Vercel Blob.
 */
async function processPhoto(
  sourceUrl: string,
  judgeSlug: string,
): Promise<string> {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; JudgesDirectory/1.0; +https://judgesdirectory.org)",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch photo: ${response.status} ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  const metadata = await sharp(buffer).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Not a valid image");
  }

  if (metadata.width < 80 || metadata.height < 80) {
    throw new Error(`Image too small: ${metadata.width}x${metadata.height}`);
  }

  const optimized = await sharp(buffer)
    .resize(300, 360, { fit: "cover", position: "top" })
    .webp({ quality: 80 })
    .toBuffer();

  if (DRY_RUN) {
    console.log(
      `  [DRY RUN] Would upload ${judgeSlug}.webp (${optimized.length} bytes)`,
    );
    return `https://dry-run.example.com/judges/${judgeSlug}.webp`;
  }

  const { url } = await put(`judges/${judgeSlug}.webp`, optimized, {
    access: "public",
    contentType: "image/webp",
  });

  return url;
}

async function main() {
  console.log(
    `Photo Pipeline — ${DRY_RUN ? "DRY RUN" : "LIVE"} mode, limit: ${LIMIT}`,
  );

  const judges = await prisma.judge.findMany({
    where: {
      photoUrl: null,
      sourceUrl: { not: null },
      status: "VERIFIED",
    },
    take: LIMIT,
    select: {
      id: true,
      fullName: true,
      slug: true,
      sourceUrl: true,
    },
  });

  console.log(`Found ${judges.length} judges without photos\n`);

  const results: PhotoResult[] = [];

  for (const judge of judges) {
    console.log(`Processing: ${judge.fullName}`);
    try {
      const response = await fetch(judge.sourceUrl!, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; JudgesDirectory/1.0; +https://judgesdirectory.org)",
        },
      });

      if (!response.ok) {
        results.push({
          judgeId: judge.id,
          judgeName: judge.fullName,
          status: "failed",
          error: `Bio page fetch failed: ${response.status}`,
        });
        continue;
      }

      const html = await response.text();
      const photoUrl = extractPhotoUrl(html, judge.sourceUrl!);

      if (!photoUrl) {
        results.push({
          judgeId: judge.id,
          judgeName: judge.fullName,
          status: "no-photo",
        });
        console.log("  No photo found on bio page");
        continue;
      }

      console.log(`  Found photo: ${photoUrl}`);

      const blobUrl = await processPhoto(photoUrl, judge.slug);

      if (!DRY_RUN) {
        await prisma.judge.update({
          where: { id: judge.id },
          data: { photoUrl: blobUrl },
        });
      }

      results.push({
        judgeId: judge.id,
        judgeName: judge.fullName,
        status: "extracted",
        blobUrl,
      });
      console.log(`  Stored: ${blobUrl}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({
        judgeId: judge.id,
        judgeName: judge.fullName,
        status: "failed",
        error: message,
      });
      console.log(`  Error: ${message}`);
    }
  }

  const extracted = results.filter((r) => r.status === "extracted").length;
  const noPhoto = results.filter((r) => r.status === "no-photo").length;
  const failed = results.filter((r) => r.status === "failed").length;

  console.log(`\n--- Summary ---`);
  console.log(`Extracted: ${extracted}`);
  console.log(`No photo:  ${noPhoto}`);
  console.log(`Failed:    ${failed}`);
  console.log(`Total:     ${results.length}`);

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Photo pipeline failed:", err);
  process.exit(1);
});
