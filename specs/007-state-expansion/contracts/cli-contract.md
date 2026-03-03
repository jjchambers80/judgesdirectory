# CLI Contract: State Expansion — Multi-State Harvesting

**Feature**: 007-state-expansion  
**Date**: 2026-03-01  
**Module**: `scripts/harvest/index.ts`

## CLI Interface

### Usage

```
npx ts-node scripts/harvest/index.ts [state-flags] [pipeline-flags]
```

### State Flags (new)

| Flag             | Type    | Required | Description                                                                                           |
| ---------------- | ------- | -------- | ----------------------------------------------------------------------------------------------------- |
| `--state <name>` | string  | No       | Process a single state by name (e.g., `--state texas`). Name matches JSON filename without extension. |
| `--all`          | boolean | No       | Process all available state configurations sequentially.                                              |
| `--list`         | boolean | No       | Print available state names and exit.                                                                 |

**Default behavior**: When none of `--state`, `--all`, or `--list` is provided, defaults to Florida (backward compatibility).

### Pipeline Flags (existing, unchanged)

| Flag                    | Type    | Default                  | Description                              |
| ----------------------- | ------- | ------------------------ | ---------------------------------------- |
| `--resume`              | boolean | true                     | Resume from last checkpoint              |
| `--reset`               | boolean | false                    | Clear checkpoint and start fresh         |
| `--seed-courts-only`    | boolean | false                    | Seed court structure only, no extraction |
| `--dry-run`             | boolean | false                    | Fetch HTML but skip LLM API calls        |
| `--skip-bio`            | boolean | false                    | Skip bio page enrichment                 |
| `--ballotpedia`         | boolean | false                    | Enrich with Ballotpedia data             |
| `--ballotpedia-max <n>` | number  | null                     | Limit Ballotpedia enrichment count       |
| `--no-identity`         | boolean | false                    | Disable identity-based deduplication     |
| `--output-dir <path>`   | string  | `scripts/harvest/output` | Override base output directory           |

### Flag Combinations

All existing pipeline flags work with `--state`:

```
npx ts-node scripts/harvest/index.ts --state texas --dry-run
npx ts-node scripts/harvest/index.ts --state california --seed-courts-only
npx ts-node scripts/harvest/index.ts --all --resume --skip-bio
```

### Validation Rules

- `--state` and `--all` are mutually exclusive. Providing both exits with error.
- `--state <name>` must match an existing `{name}-courts.json` file in `scripts/harvest/`. Error with available list if not found.
- `--list` exits immediately after printing. Ignores all other flags.

## State Configuration File Contract

### Location

`scripts/harvest/{state-slug}-courts.json`

State slug: lowercase, hyphenated (e.g., `florida`, `texas`, `california`, `new-york`).

### Schema

```typescript
interface StateConfig {
  state: string; // Required. Official state name.
  abbreviation: string; // Required. 2-letter USPS code.
  rateLimit?: {
    fetchDelayMs?: number; // Default: 1500. Min: 500.
    maxConcurrent?: number; // Default: 1. Min: 1.
    requestTimeoutMs?: number; // Default: 15000. Min: 5000.
    maxRetries?: number; // Default: 3. Min: 0.
  };
  extractionPromptFile?: string; // Relative path from scripts/harvest/.
  courts: CourtEntry[]; // Non-empty array.
}

interface CourtEntry {
  url: string; // Required. Court roster page URL.
  courtType: string; // Required. Free-form court type name.
  level: "supreme" | "appellate" | "trial" | "specialized"; // Required.
  label: string; // Required. Human-readable label.
  counties: string[]; // Required. Empty array = statewide.
  district?: number | null;
  circuit?: number | null;
  department?: number | null;
  division?: string | null;
  judicialDistrict?: number | null;
  parentCourt?: string | null;
  fetchMethod?: "http" | "browser" | "manual"; // Default: "http"
  deterministic?: boolean; // Default: false
  selectorHint?: string | null;
  notes?: string | null;
}
```

### Validation (at startup)

- Schema validated by Zod before pipeline starts
- Invalid configs: exit with specific error message and field path
- Duplicate URLs: warning logged, pipeline continues
- Missing state in database: error if `--seed-courts-only`, otherwise log warning

## Extraction Prompt File Contract

### Location

`scripts/harvest/prompts/{name}.txt`

### Convention

- `generic-extraction.txt` — default prompt (extracted from current inline `ROSTER_SYSTEM_PROMPT`)
- `{state-slug}-extraction-prompt.txt` — state-specific override
- Referenced from state config via `extractionPromptFile` field

### Content Format

Plain text. Injected as the system prompt for LLM extraction calls. May include:

- Court type names specific to the state
- HTML structure hints for that state's websites
- County mapping guidance
- Examples of expected output

## Output Directory Contract

### Structure

```
output/
├── florida/
│   ├── checkpoints/
│   │   └── harvest-checkpoint.json
│   ├── florida-judges-enriched-{timestamp}.csv
│   ├── florida-harvest-{timestamp}.log
│   └── florida-quality-report-{timestamp}.txt
├── texas/
│   ├── checkpoints/
│   │   └── harvest-checkpoint.json
│   ├── texas-judges-enriched-{timestamp}.csv
│   ├── texas-harvest-{timestamp}.log
│   └── texas-quality-report-{timestamp}.txt
├── california/
│   └── ...
├── new-york/
│   └── ...
└── combined-summary-{timestamp}.txt  (only when --all is used)
```

### Per-State Output Files

| File                                      | Description                        |
| ----------------------------------------- | ---------------------------------- |
| `checkpoints/harvest-checkpoint.json`     | Per-state checkpoint for resume    |
| `{state}-judges-enriched-{timestamp}.csv` | Enriched judge records             |
| `{state}-harvest-{timestamp}.log`         | Full log of the harvest run        |
| `{state}-quality-report-{timestamp}.txt`  | Quality report with coverage stats |

### Combined Summary (--all only)

When `--all` is used, a combined summary file is produced at `output/combined-summary-{timestamp}.txt` containing:

- Per-state extraction counts
- Per-state success/failure status
- Aggregate totals
- List of failed states (if any) with error summaries

## Error Responses

| Scenario                     | Exit Code     | Message                                                                                             |
| ---------------------------- | ------------- | --------------------------------------------------------------------------------------------------- |
| Unknown flag                 | 1             | `Unknown flag: {flag}`                                                                              |
| `--state` + `--all` combined | 1             | `Error: --state and --all are mutually exclusive`                                                   |
| State config not found       | 1             | `Error: No configuration found for state "{name}". Available: florida, texas, california, new-york` |
| Config validation failure    | 1             | `Error: Invalid configuration for {state}: {zod error details}`                                     |
| LLM API key missing          | 1             | `Error: {KEY} is required. Set it via: export {KEY}="..."`                                          |
| State fails during --all     | 0 (continues) | `ERROR: {state} failed: {error}. Checkpoint saved. Continuing to next state.`                       |
| All states fail during --all | 1             | `Error: All states failed. See combined summary for details.`                                       |
