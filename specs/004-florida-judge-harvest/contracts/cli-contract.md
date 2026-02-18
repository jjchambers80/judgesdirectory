# CLI Contract: Florida Judge Harvest Script

**Date**: 2026-02-18 | **Feature**: 004-florida-judge-harvest

This feature is a CLI tool, not an API. This contract defines the command-line interface, input/output formats, and environment requirements.

## Command Interface

### Primary Command: `harvest`

```bash
# Full extraction — all Florida courts
npx ts-node scripts/harvest/index.ts

# Resume interrupted extraction
npx ts-node scripts/harvest/index.ts --resume

# Reset checkpoint and start fresh
npx ts-node scripts/harvest/index.ts --reset

# Seed courts only (no judge extraction)
npx ts-node scripts/harvest/index.ts --seed-courts-only

# Dry run — fetch and clean HTML but don't call Claude
npx ts-node scripts/harvest/index.ts --dry-run
```

### CLI Flags

| Flag                 | Type    | Default                  | Description                                        |
| -------------------- | ------- | ------------------------ | -------------------------------------------------- |
| `--resume`           | boolean | `true`                   | Resume from last checkpoint (default behavior)     |
| `--reset`            | boolean | `false`                  | Delete checkpoint and start fresh                  |
| `--seed-courts-only` | boolean | `false`                  | Only seed Florida court structure, skip extraction |
| `--dry-run`          | boolean | `false`                  | Fetch HTML and clean it but skip Claude API calls  |
| `--output-dir`       | string  | `scripts/harvest/output` | Directory for CSV, logs, and checkpoints           |

## Environment Variables

| Variable            | Required                                         | Description                                         |
| ------------------- | ------------------------------------------------ | --------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Yes (unless `--seed-courts-only` or `--dry-run`) | Anthropic API key for Claude                        |
| `DATABASE_URL`      | Yes (for `--seed-courts-only`)                   | PostgreSQL connection string (shared with main app) |

## Input: Curated URL Configuration

File: `scripts/harvest/florida-courts.json`

```json
{
  "state": "Florida",
  "abbreviation": "FL",
  "supremeCourt": {
    "url": "https://supremecourt.flcourts.gov/Justices",
    "courtType": "Supreme Court"
  },
  "districtCourts": [
    {
      "district": 1,
      "name": "1st District Court of Appeal",
      "url": "https://1dca.flcourts.gov/Judges",
      "courtType": "District Court of Appeal",
      "circuits": [1, 2, 3, 8, 14]
    }
  ],
  "circuitCourts": [
    {
      "circuit": 1,
      "url": "https://www.firstjudicialcircuit.org/judges",
      "courtType": "Circuit Court",
      "counties": ["Escambia", "Okaloosa", "Santa Rosa", "Walton"]
    }
  ]
}
```

## Output: CSV File

**Location**: `scripts/harvest/output/florida-judges-{YYYY-MM-DDTHH-MM-SS}.csv`

**Format**: RFC 4180 CSV with header row. Compatible with the existing `/admin/import/` pipeline.

| Column             | Type   | Required | Description                                                                  |
| ------------------ | ------ | -------- | ---------------------------------------------------------------------------- |
| `Judge Name`       | string | Yes      | Normalized "First Last" format                                               |
| `Court Type`       | string | Yes      | One of: Supreme Court, District Court of Appeal, Circuit Court, County Court |
| `County`           | string | Yes      | County name matching DB (e.g., "Miami-Dade")                                 |
| `State`            | string | Yes      | Always "FL"                                                                  |
| `Source URL`       | string | Yes      | URL of the page where judge was found                                        |
| `Selection Method` | string | No       | "Elected", "Appointed", or empty                                             |

**Example rows**:

```csv
Judge Name,Court Type,County,State,Source URL,Selection Method
"Carlos Muñiz","Supreme Court","Leon","FL","https://supremecourt.flcourts.gov/Justices","Appointed"
"Jane Smith","Circuit Court","Miami-Dade","FL","https://www.jud11.flcourts.org/judicial-directory","Elected"
```

## Output: Quality Report

**Location**: `scripts/harvest/output/florida-report-{YYYY-MM-DDTHH-MM-SS}.md`

**Format**: Markdown summary printed to stdout and saved to file.

```markdown
# Florida Judge Harvest Report — 2026-02-18T14:30:00

## Summary

- Pages fetched: 28
- Pages successful: 26
- Pages failed: 2
- Judges extracted: 1,042
- Duplicates removed: 15
- Final judge count: 1,027

## Court Type Breakdown

| Court Type               | Count |
| ------------------------ | ----- |
| Supreme Court            | 7     |
| District Court of Appeal | 71    |
| Circuit Court            | 612   |
| County Court             | 337   |

## Counties with Zero Judges

- Lafayette (3rd Circuit)
- Liberty (2nd Circuit)

## Failed Pages

| URL         | Error                         |
| ----------- | ----------------------------- |
| https://... | HTTP 503 after 3 retries      |
| https://... | No parseable judge data found |
```

## Output: Log File

**Location**: `scripts/harvest/output/florida-harvest-{YYYY-MM-DDTHH-MM-SS}.log`

**Format**: Plain text, one line per event.

```
[2026-02-18T14:30:00.000Z] INFO  Starting Florida judge harvest
[2026-02-18T14:30:01.500Z] INFO  Fetching: https://supremecourt.flcourts.gov/Justices
[2026-02-18T14:30:02.100Z] INFO  Fetched: 200 OK (42KB HTML → 8KB Markdown)
[2026-02-18T14:30:03.500Z] INFO  Extracted: 7 judges from Supreme Court
[2026-02-18T14:30:05.000Z] WARN  robots.txt disallows /Judges at 1dca.flcourts.gov — proceeding (public records)
[2026-02-18T14:31:00.000Z] ERROR Failed: https://... — HTTP 503 after 3 retries
[2026-02-18T14:45:00.000Z] INFO  Complete: 1,027 judges → florida-judges-2026-02-18T14-30-00.csv
```

## Anthropic Claude Prompt Contract

### System Prompt

```
You are a data extraction assistant for a US judicial directory. Extract all judge/justice names from the provided court webpage content. Return structured JSON only.

Rules:
- Extract every judge or justice listed on the page
- Normalize names to "First Last" format (strip "Hon.", "Judge", "Justice", "Chief" prefixes)
- Preserve name suffixes (Jr., Sr., III, etc.) as part of the name
- If "Last, First" format is detected, reverse to "First Last"
- For each judge, determine the court type: "Supreme Court", "District Court of Appeal", "Circuit Court", or "County Court"
- Determine the county assignment if listed (some judges serve multiple counties in a circuit)
- If selection method is mentioned (elected, appointed), include it
- If you cannot determine a field with confidence, leave it as null
- Do NOT fabricate or hallucinate data — only extract what is explicitly on the page
```

### Zod Schema

```typescript
const JudgeRecord = z.object({
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

const ExtractionResult = z.object({
  judges: z.array(JudgeRecord),
  pageTitle: z.string().nullable(),
  courtLevel: z.string().nullable(),
});
```
