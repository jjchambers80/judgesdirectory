/**
 * LLM-based extractor — sends cleaned Markdown to configured LLM and
 * receives structured judge data back via Zod-validated schemas.
 *
 * Supports OpenAI (default, cheapest) and Anthropic via LLM_PROVIDER env var.
 * Uses deterministic extraction first when possible to minimize LLM costs.
 *
 * @module scripts/harvest/extractor
 */

import { z } from "zod";
import { chatCompletion, describeLLMConfig } from "./llm-provider";
import { tryDeterministicExtraction } from "./deterministic-extractor";

// ---------------------------------------------------------------------------
// Zod schemas (per contracts/cli-contract.md)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Roster extraction schemas (Phase 1: basic data from listing pages)
// ---------------------------------------------------------------------------

export const JudgeRecordSchema = z.object({
  name: z.string().describe("Full name in 'First Last' format"),
  courtType: z.enum([
    "Supreme Court",
    "District Court of Appeal",
    "Circuit Court",
    "County Court",
  ]),
  county: z
    .string()
    .nullable()
    .describe("County name or null if statewide/multi-county"),
  division: z.string().nullable().describe("Division or section if listed"),
  selectionMethod: z.enum(["Elected", "Appointed"]).nullable(),
  bioPageUrl: z
    .string()
    .nullable()
    .describe("URL to individual bio/profile page if linked"),
  isChiefJudge: z
    .boolean()
    .describe("True if designated as Chief Judge/Justice"),
});

export const ExtractionResultSchema = z.object({
  judges: z.array(JudgeRecordSchema),
  pageTitle: z.string().nullable(),
  courtLevel: z.string().nullable(),
});

export type JudgeRecord = z.infer<typeof JudgeRecordSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ---------------------------------------------------------------------------
// Bio page extraction schemas (Phase 2: detailed profile data)
// ---------------------------------------------------------------------------

export const BioPageDataSchema = z.object({
  // Photo
  photoUrl: z.string().nullable().describe("URL to judge's official photo"),

  // Term & Selection
  termStart: z
    .string()
    .nullable()
    .describe("Term start date in YYYY-MM-DD or YYYY format"),
  termEnd: z
    .string()
    .nullable()
    .describe("Term end date in YYYY-MM-DD or YYYY format"),
  appointingAuthority: z
    .string()
    .nullable()
    .describe("Governor or authority who appointed (if appointed)"),
  appointmentDate: z
    .string()
    .nullable()
    .describe("Appointment date in YYYY-MM-DD or YYYY format"),

  // Biographical
  birthDate: z
    .string()
    .nullable()
    .describe("Birth date in YYYY-MM-DD or YYYY format"),
  education: z
    .string()
    .nullable()
    .describe("Educational background - degrees, schools, years"),
  priorExperience: z
    .string()
    .nullable()
    .describe("Legal career before becoming a judge"),
  barAdmissionYear: z
    .string()
    .nullable()
    .describe("Year admitted to the bar (YYYY format)"),

  // Contact
  courthouseAddress: z
    .string()
    .nullable()
    .describe("Office/courthouse address"),
  courthousePhone: z.string().nullable().describe("Office phone number"),

  // Additional context
  divisions: z
    .array(z.string())
    .nullable()
    .describe("Court divisions/sections the judge serves"),
  biography: z.string().nullable().describe("Full biographical text if present"),
});

export type BioPageData = z.infer<typeof BioPageDataSchema>;

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

const ROSTER_SYSTEM_PROMPT = `You are a data extraction assistant for a US judicial directory. Extract all judge/justice names from the provided court webpage content. Return structured JSON only.

Rules:
- Extract every judge or justice listed on the page
- Normalize names to "First Last" format (strip "Hon.", "Judge", "Justice", "Chief" prefixes)
- Preserve name suffixes (Jr., Sr., III, etc.) as part of the name
- If "Last, First" format is detected, reverse to "First Last"
- For each judge, determine the court type: "Supreme Court", "District Court of Appeal", "Circuit Court", or "County Court"
- Determine the county assignment if listed (some judges serve multiple counties in a circuit)
- If selection method is mentioned (elected, appointed), include it
- IMPORTANT: Extract any link to the judge's individual bio/profile page (look for "Read more", "Biography", or name links)
- Mark isChiefJudge as true if the judge is designated "Chief Judge" or "Chief Justice"
- If you cannot determine a field with confidence, leave it as null
- Do NOT fabricate or hallucinate data — only extract what is explicitly on the page`;

const BIO_SYSTEM_PROMPT = `You are a data extraction assistant for a US judicial directory. Extract detailed biographical information from an individual judge's profile page. Return structured JSON only.

Rules:
- Extract all available biographical data: education, career history, appointment info, contact details
- For dates, use YYYY-MM-DD format when full date available, or just YYYY if only year is known
- For education, include degrees, schools, and graduation years in a single string
- For prior experience, summarize legal career before becoming a judge
- Extract photo URL if an official portrait/headshot image is present (look for img tags with judge name or "portrait", "headshot", "photo" in src/alt)
- Extract courthouse address and phone if present
- Extract term start/end dates if mentioned
- Extract appointing authority (usually a governor's name) if mentioned
- If you cannot determine a field with confidence, leave it as null
- Do NOT fabricate or hallucinate data — only extract what is explicitly on the page`;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface ExtractContext {
  /** Human-readable court label for the prompt (e.g. "1st Judicial Circuit") */
  label: string;
  /** Court type expected on this page */
  courtType: string;
  /** Counties this court covers (used as hint) */
  counties: string[];
  /** Raw HTML for deterministic extraction */
  rawHtml?: string;
  /** Source URL */
  url?: string;
}

export interface ExtractionStats {
  method: "deterministic" | "llm";
  llmModel?: string;
  inputTokens?: number;
  outputTokens?: number;
}

let lastExtractionStats: ExtractionStats | null = null;

/**
 * Get stats from the last extraction call.
 */
export function getLastExtractionStats(): ExtractionStats | null {
  return lastExtractionStats;
}

/**
 * Extract judges from page content.
 * Tries deterministic extraction first, falls back to LLM if needed.
 */
export async function extractJudges(
  markdown: string,
  context: ExtractContext,
): Promise<ExtractionResult> {
  // Try deterministic extraction first (free!)
  if (context.rawHtml && context.url) {
    const deterministic = tryDeterministicExtraction(
      context.rawHtml,
      context.url,
      context.courtType,
    );

    if (deterministic.success && deterministic.result) {
      console.log(
        `    [deterministic:${deterministic.method}] Extracted ${deterministic.result.judges.length} judges`,
      );
      lastExtractionStats = { method: "deterministic" };
      return deterministic.result;
    }
  }

  // Fall back to LLM extraction
  const userPrompt = buildRosterPrompt(markdown, context);

  const response = await chatCompletion(
    ROSTER_SYSTEM_PROMPT,
    userPrompt,
    16384,
  );

  console.log(`    [${describeLLMConfig()}] LLM extraction`);
  lastExtractionStats = {
    method: "llm",
    llmModel: response.model,
    inputTokens: response.inputTokens,
    outputTokens: response.outputTokens,
  };

  // Parse JSON from the response text (with repair for truncated responses)
  const jsonStr = extractJson(response.content);
  const parsed = safeJsonParse(jsonStr);

  // Normalize LLM output before validation (fixes courtType variations)
  const normalized = normalizeExtractionResult(parsed);

  // Validate with Zod
  const result = ExtractionResultSchema.parse(normalized);
  return result;
}

/**
 * Extract detailed biographical data from an individual judge's profile page.
 */
export async function extractBioPage(
  markdown: string,
  judgeName: string,
  bioUrl: string,
): Promise<BioPageData> {
  const userPrompt = buildBioPrompt(markdown, judgeName, bioUrl);

  const response = await chatCompletion(BIO_SYSTEM_PROMPT, userPrompt, 8192);

  const jsonStr = extractJson(response.content);
  const parsed = safeJsonParse(jsonStr);

  const result = BioPageDataSchema.parse(parsed);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Prompt builders
// ---------------------------------------------------------------------------

function buildRosterPrompt(markdown: string, context: ExtractContext): string {
  const countyHint =
    context.counties.length > 0
      ? `\nCounties in this ${context.courtType}: ${context.counties.join(", ")}`
      : "";

  return `Extract judge/justice data from the following ${context.label} webpage content.

Court type expected: ${context.courtType}${countyHint}

---

${markdown}

---

Return your response as a JSON object with this exact structure:
{
  "judges": [
    {
      "name": "First Last",
      "courtType": "Circuit Court",
      "county": "County Name or null",
      "division": "Division or null",
      "selectionMethod": "Elected" or "Appointed" or null,
      "bioPageUrl": "https://... or null",
      "isChiefJudge": true or false
    }
  ],
  "pageTitle": "Page title or null",
  "courtLevel": "Supreme Court" or "District Court of Appeal" or "Circuit Court" or "County Court" or null
}`;
}

function buildBioPrompt(
  markdown: string,
  judgeName: string,
  bioUrl: string,
): string {
  return `Extract biographical data for Judge ${judgeName} from this profile page.

Source URL: ${bioUrl}

---

${markdown}

---

Return your response as a JSON object with this exact structure:
{
  "photoUrl": "https://... or null",
  "termStart": "YYYY-MM-DD or YYYY or null",
  "termEnd": "YYYY-MM-DD or YYYY or null",
  "appointingAuthority": "Governor Name or null",
  "appointmentDate": "YYYY-MM-DD or YYYY or null",
  "birthDate": "YYYY-MM-DD or YYYY or null",
  "education": "Degree, School, Year; ... or null",
  "priorExperience": "Career summary or null",
  "barAdmissionYear": "YYYY or null",
  "courthouseAddress": "Full address or null",
  "courthousePhone": "Phone number or null",
  "divisions": ["Division 1", "Division 2"],
  "biography": "Full bio text or null"
}`;
}

/**
 * Extract JSON from Claude's response text.
 * Handles cases where Claude wraps JSON in markdown code fences.
 */
function extractJson(text: string): string {
  // Try to find JSON in code fence
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }

  // Try to find raw JSON object
  const objectMatch = text.match(/\{[\s\S]*\}/);
  if (objectMatch) {
    return objectMatch[0];
  }

  throw new Error("No JSON found in Claude response");
}

/**
 * Parse JSON with repair for truncated responses.
 * If the response was cut off mid-array, try to close the JSON structure.
 */
function safeJsonParse(jsonStr: string): unknown {
  try {
    return JSON.parse(jsonStr);
  } catch {
    // Attempt to repair truncated JSON: close unclosed arrays/objects
    let repaired = jsonStr.trimEnd();

    // Remove trailing comma
    repaired = repaired.replace(/,\s*$/, "");

    // Remove any incomplete object at the end (e.g., {"name": "John...)
    const lastCompleteObj = repaired.lastIndexOf("}");
    const lastOpenObj = repaired.lastIndexOf("{", repaired.length - 1);
    if (lastOpenObj > lastCompleteObj) {
      // There's an unclosed object — truncate before it and remove trailing comma
      repaired = repaired.substring(0, lastOpenObj).replace(/,\s*$/, "");
    }

    // Count unclosed brackets and close them
    let openBrackets = 0;
    let openBraces = 0;
    for (const ch of repaired) {
      if (ch === "[") openBrackets++;
      else if (ch === "]") openBrackets--;
      else if (ch === "{") openBraces++;
      else if (ch === "}") openBraces--;
    }

    for (let i = 0; i < openBrackets; i++) repaired += "]";
    for (let i = 0; i < openBraces; i++) repaired += "}";

    try {
      const parsed = JSON.parse(repaired);
      console.warn("  [repaired truncated JSON — some entries may be missing]");
      return parsed;
    } catch (e) {
      throw new Error(
        `JSON parse failed even after repair: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
}

/**
 * Normalize courtType values to match the Zod enum.
 * LLMs sometimes return variations like "Circuit Court - Civil Division".
 */
function normalizeCourtType(
  value: string,
): "Supreme Court" | "District Court of Appeal" | "Circuit Court" | "County Court" {
  const lower = value.toLowerCase();

  if (lower.includes("supreme")) {
    return "Supreme Court";
  }
  if (lower.includes("district") && lower.includes("appeal")) {
    return "District Court of Appeal";
  }
  if (lower.includes("dca")) {
    return "District Court of Appeal";
  }
  if (lower.includes("circuit")) {
    return "Circuit Court";
  }
  if (lower.includes("county")) {
    return "County Court";
  }

  // Default to Circuit Court for Florida trial courts
  return "Circuit Court";
}

/**
 * Normalize extraction result before Zod validation.
 * Fixes common LLM output variations.
 */
function normalizeExtractionResult(data: unknown): unknown {
  if (!data || typeof data !== "object") return data;

  const obj = data as Record<string, unknown>;

  if (Array.isArray(obj.judges)) {
    obj.judges = obj.judges.map((judge: unknown) => {
      if (!judge || typeof judge !== "object") return judge;
      const j = judge as Record<string, unknown>;

      // Normalize courtType
      if (typeof j.courtType === "string") {
        j.courtType = normalizeCourtType(j.courtType);
      }

      // Normalize selectionMethod (LLM sometimes returns variations)
      if (typeof j.selectionMethod === "string") {
        j.selectionMethod = normalizeSelectionMethod(j.selectionMethod);
      }

      return j;
    });
  }

  return obj;
}

/**
 * Normalize selectionMethod values to match the Zod enum.
 * LLMs sometimes return variations like "Election" or "Merit Selection".
 */
function normalizeSelectionMethod(value: string): "Elected" | "Appointed" | null {
  const lower = value.toLowerCase().trim();

  if (
    lower === "elected" ||
    lower === "election" ||
    lower.includes("elect")
  ) {
    return "Elected";
  }

  if (
    lower === "appointed" ||
    lower === "appointment" ||
    lower.includes("appoint") ||
    lower.includes("merit")
  ) {
    return "Appointed";
  }

  // Return null if we can't determine
  return null;
}
