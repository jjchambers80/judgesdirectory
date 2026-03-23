/**
 * Scrapling-based fetcher for judgesDirectory
 *
 * Uses Scrapling CLI for sites that require:
 * - Anti-bot protection bypass (Cloudflare Turnstile)
 * - Full JavaScript rendering
 *
 * Scrapling CLI writes output to FILES (not stdout). Format is determined
 * by the output file extension (.md for markdown, .html for HTML).
 *
 * CLI syntax:
 *   scrapling extract stealthy-fetch <URL> <OUTPUT_FILE> [--solve-cloudflare] [--timeout <ms>]
 *
 * @module scripts/harvest/scrapling-fetcher
 */

import { spawn } from "child_process";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { cleanHtml } from "./fetcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScraplingResult {
  markdown: string;
  rawHtml: string;
  url: string;
  success: boolean;
  method: "stealthy" | "browser";
  error?: string;
  durationMs?: number;
}

// ---------------------------------------------------------------------------
// Domain allowlist (FR-015)
// ---------------------------------------------------------------------------

/** Approved domains for stealth fetching. New domains require a code change.
 *  NOTE: ballotpedia.org removed — their anti-bot consistently times out (>60s).
 */
const STEALTH_DOMAIN_ALLOWLIST = new Set<string>([
  "nycourts.gov",
  "iapps.courts.state.ny.us",
  "en.wikipedia.org",
  "www.governor.ny.gov",
  "afj.org",
  "www.fedbar.org",
  "www.nycla.org",
  "www.scrutinize.org",
  "ndnyfcba.org",
]);

/**
 * Check if a URL's domain is in the stealth fetch allowlist.
 * Matches the exact domain or any subdomain of an allowlisted domain.
 */
export function isAllowlistedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    const domains = Array.from(STEALTH_DOMAIN_ALLOWLIST);
    for (const allowed of domains) {
      if (hostname === allowed || hostname.endsWith(`.${allowed}`)) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Per-domain rate limiting (FR-013)
// ---------------------------------------------------------------------------

const DEFAULT_DOMAIN_DELAY_MS = 3000;
const lastFetchByDomain = new Map<string, number>();

async function waitForDomainDelay(
  domain: string,
  delayMs = DEFAULT_DOMAIN_DELAY_MS,
): Promise<void> {
  const last = lastFetchByDomain.get(domain);
  if (last !== undefined) {
    const elapsed = Date.now() - last;
    if (elapsed < delayMs) {
      await new Promise((resolve) => setTimeout(resolve, delayMs - elapsed));
    }
  }
}

function recordDomainFetch(domain: string): void {
  lastFetchByDomain.set(domain, Date.now());
}

// ---------------------------------------------------------------------------
// Availability guard (FR-005)
// ---------------------------------------------------------------------------

let scraplingAvailableCache: boolean | null = null;

/**
 * Check if the Scrapling CLI is available on the system.
 * Result is cached for the lifetime of the process.
 */
export async function isScraplingAvailable(): Promise<boolean> {
  if (scraplingAvailableCache !== null) {
    return scraplingAvailableCache;
  }

  try {
    const result = await runCommand("scrapling", ["--help"], 10_000);
    scraplingAvailableCache = result.exitCode === 0;
  } catch {
    scraplingAvailableCache = false;
  }

  return scraplingAvailableCache;
}

// ---------------------------------------------------------------------------
// Core fetch function (FR-001, FR-014, FR-015)
// ---------------------------------------------------------------------------

const RETRY_BACKOFF_MS = 15_000;
const DEFAULT_TIMEOUT_MS = 60_000;

/**
 * Fetch a URL using Scrapling CLI with stealth mode.
 * Validates URL against domain allowlist before proceeding.
 * Writes output to a temp file and reads it back.
 *
 * Implements retry-once with 15s backoff on failure (FR-014).
 */
export async function fetchWithScrapling(
  url: string,
  options: {
    mode?: "stealthy" | "browser";
    timeout?: number;
    solveCloudflare?: boolean;
  } = {},
): Promise<ScraplingResult> {
  const {
    mode = "stealthy",
    timeout = DEFAULT_TIMEOUT_MS,
    solveCloudflare = true,
  } = options;

  // Allowlist enforcement
  if (!isAllowlistedDomain(url)) {
    const msg = `Domain not on stealth allowlist: ${new URL(url).hostname}`;
    console.error(`  [Scrapling] ${msg}`);
    return { markdown: "", rawHtml: "", url, success: false, method: mode, error: msg };
  }

  // Per-domain rate limiting
  const domain = new URL(url).hostname.toLowerCase();
  await waitForDomainDelay(domain);

  // Attempt 1
  let result = await attemptScraplingFetch(url, mode, timeout, solveCloudflare, 1);
  if (result.success) {
    recordDomainFetch(domain);
    return result;
  }

  // Retry once with backoff (FR-014)
  console.log(
    `  [Scrapling] url=${url} attempt=1 result=failure error="${result.error}" — retrying in ${RETRY_BACKOFF_MS / 1000}s`,
  );
  await new Promise((resolve) => setTimeout(resolve, RETRY_BACKOFF_MS));

  result = await attemptScraplingFetch(url, mode, timeout, solveCloudflare, 2);
  recordDomainFetch(domain);

  if (!result.success) {
    console.error(
      `  [Scrapling] url=${url} attempt=2 result=failure error="${result.error}" — giving up`,
    );
  }

  return result;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function attemptScraplingFetch(
  url: string,
  mode: "stealthy" | "browser",
  timeout: number,
  solveCloudflare: boolean,
  attempt: number,
): Promise<ScraplingResult> {
  const startMs = Date.now();

  // Use .html extension so Scrapling returns raw HTML — we convert to
  // markdown ourselves (via cleanHtml) to keep rawHtml available for
  // deterministic photo extraction.
  const tmpFile = path.join(
    os.tmpdir(),
    `scrapling_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.html`,
  );

  try {
    const subcommand = mode === "stealthy" ? "stealthy-fetch" : "fetch";
    const args = ["extract", subcommand, url, tmpFile];
    if (solveCloudflare && mode === "stealthy") {
      args.push("--solve-cloudflare");
    }
    args.push("--timeout", String(timeout));

    console.log(`  [Scrapling] url=${url} attempt=${attempt} mode=${mode}`);

    const cmdResult = await runCommand("scrapling", args, timeout + 30_000);
    const durationMs = Date.now() - startMs;

    // Check exit code
    if (cmdResult.exitCode !== 0) {
      return {
        markdown: "",
        rawHtml: "",
        url,
        success: false,
        method: mode,
        error: cmdResult.stderr.trim() || `Exit code ${cmdResult.exitCode}`,
        durationMs,
      };
    }

    // Read output file
    if (!fs.existsSync(tmpFile)) {
      return {
        markdown: "",
        rawHtml: "",
        url,
        success: false,
        method: mode,
        error: "Output file not created",
        durationMs,
      };
    }

    const rawHtml = fs.readFileSync(tmpFile, "utf-8");
    if (rawHtml.length === 0) {
      return {
        markdown: "",
        rawHtml: "",
        url,
        success: false,
        method: mode,
        error: "Output file is empty",
        durationMs,
      };
    }

    // Convert HTML → noise-stripped Markdown (same pipeline as HTTP fetcher)
    const markdown = cleanHtml(rawHtml);

    console.log(
      `  [Scrapling] url=${url} attempt=${attempt} duration=${durationMs}ms result=success htmlSize=${rawHtml.length} mdSize=${markdown.length}`,
    );

    return {
      markdown,
      rawHtml,
      url,
      success: true,
      method: mode,
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startMs;
    return {
      markdown: "",
      rawHtml: "",
      url,
      success: false,
      method: mode,
      error: error instanceof Error ? error.message : String(error),
      durationMs,
    };
  } finally {
    // Clean up temp file
    try {
      if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
    } catch {
      // Ignore cleanup errors
    }
  }
}

function runCommand(
  cmd: string,
  args: string[],
  timeoutMs: number,
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const stdout: string[] = [];
    const stderr: string[] = [];

    const proc = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });

    proc.stdout.on("data", (data: Buffer) => stdout.push(data.toString()));
    proc.stderr.on("data", (data: Buffer) => stderr.push(data.toString()));

    const timer = setTimeout(() => {
      proc.kill("SIGTERM");
      resolve({
        exitCode: 1,
        stdout: stdout.join(""),
        stderr: "Timeout exceeded",
      });
    }, timeoutMs);

    proc.on("close", (code) => {
      clearTimeout(timer);
      resolve({
        exitCode: code ?? 1,
        stdout: stdout.join(""),
        stderr: stderr.join(""),
      });
    });

    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}
