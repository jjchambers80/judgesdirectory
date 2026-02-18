/**
 * Anthropic Claude extractor — sends cleaned Markdown to Claude and
 * receives structured judge data back via Zod-validated schemas.
 *
 * Uses `messages.parse()` for type-safe structured output with the
 * claude-sonnet-4-5-20250929 model.
 *
 * @module scripts/harvest/extractor
 */

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Zod schemas (per contracts/cli-contract.md)
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
});

export const ExtractionResultSchema = z.object({
  judges: z.array(JudgeRecordSchema),
  pageTitle: z.string().nullable(),
  courtLevel: z.string().nullable(),
});

export type JudgeRecord = z.infer<typeof JudgeRecordSchema>;
export type ExtractionResult = z.infer<typeof ExtractionResultSchema>;

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are a data extraction assistant for a US judicial directory. Extract all judge/justice names from the provided court webpage content. Return structured JSON only.

Rules:
- Extract every judge or justice listed on the page
- Normalize names to "First Last" format (strip "Hon.", "Judge", "Justice", "Chief" prefixes)
- Preserve name suffixes (Jr., Sr., III, etc.) as part of the name
- If "Last, First" format is detected, reverse to "First Last"
- For each judge, determine the court type: "Supreme Court", "District Court of Appeal", "Circuit Court", or "County Court"
- Determine the county assignment if listed (some judges serve multiple counties in a circuit)
- If selection method is mentioned (elected, appointed), include it
- If you cannot determine a field with confidence, leave it as null
- Do NOT fabricate or hallucinate data — only extract what is explicitly on the page`;

// ---------------------------------------------------------------------------
// Module state
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic(); // reads ANTHROPIC_API_KEY from env
  }
  return client;
}

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
}

/**
 * Send cleaned Markdown to Claude and get structured judge records back.
 */
export async function extractJudges(
  markdown: string,
  context: ExtractContext,
): Promise<ExtractionResult> {
  const anthropic = getClient();

  const userPrompt = buildUserPrompt(markdown, context);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 16384,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  // Extract text content from the response
  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("No text content in Claude response");
  }

  // Parse JSON from the response text (with repair for truncated responses)
  const jsonStr = extractJson(textBlock.text);
  const parsed = safeJsonParse(jsonStr);

  // Validate with Zod
  const result = ExtractionResultSchema.parse(parsed);
  return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildUserPrompt(markdown: string, context: ExtractContext): string {
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
      "selectionMethod": "Elected" or "Appointed" or null
    }
  ],
  "pageTitle": "Page title or null",
  "courtLevel": "Supreme Court" or "District Court of Appeal" or "Circuit Court" or "County Court" or null
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
