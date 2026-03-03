# Quickstart: State Expansion — Multi-State Harvesting

**Feature**: 007-state-expansion  
**Date**: 2026-03-01

## Prerequisites

- Node.js 20+
- PostgreSQL with seeded State/County data (50 states, 3,143 counties)
- `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` environment variable
- `DATABASE_URL` environment variable (for `--seed-courts-only`)

## Run a Single State

```bash
# Harvest Florida (default, backward-compatible)
npx ts-node scripts/harvest/index.ts

# Harvest Florida (explicit)
npx ts-node scripts/harvest/index.ts --state florida

# Harvest Texas
npx ts-node scripts/harvest/index.ts --state texas

# Dry run California (fetch HTML, skip LLM)
npx ts-node scripts/harvest/index.ts --state california --dry-run

# Seed New York court structure only
npx ts-node scripts/harvest/index.ts --state new-york --seed-courts-only
```

## Run All States

```bash
# Process all configured states sequentially
npx ts-node scripts/harvest/index.ts --all

# Resume an interrupted multi-state run
npx ts-node scripts/harvest/index.ts --all --resume
```

## List Available States

```bash
npx ts-node scripts/harvest/index.ts --list
# Output:
#   Available states:
#     florida
#     texas
#     california
#     new-york
```

## Add a New State

1. Create `scripts/harvest/{state-slug}-courts.json` following the schema in [contracts/cli-contract.md](contracts/cli-contract.md)
2. (Optional) Create `scripts/harvest/prompts/{state-slug}-extraction-prompt.txt`
3. Run `--state {state-slug} --seed-courts-only` to seed courts in the database
4. Run `--state {state-slug} --dry-run` to test fetching without LLM cost
5. Run `--state {state-slug}` for full extraction

No code changes required.

## Output

Per-state output goes to `scripts/harvest/output/{state-slug}/`:

- `checkpoints/harvest-checkpoint.json` — resume checkpoint
- `{state}-judges-enriched-{timestamp}.csv` — extracted judge records
- `{state}-quality-report-{timestamp}.txt` — extraction quality report
- `{state}-harvest-{timestamp}.log` — full log

When using `--all`, a combined summary is generated at `scripts/harvest/output/combined-summary-{timestamp}.txt`.

## Config Template

Minimal state config (copy and edit):

```json
{
  "state": "StateName",
  "abbreviation": "XX",
  "courts": [
    {
      "url": "https://example.com/court-roster",
      "courtType": "Supreme Court",
      "level": "supreme",
      "label": "Supreme Court of StateName",
      "counties": []
    }
  ]
}
```

## Key Flags Reference

| Flag                 | Description                      |
| -------------------- | -------------------------------- |
| `--state <name>`     | Process single state             |
| `--all`              | Process all states               |
| `--list`             | Show available states            |
| `--dry-run`          | Fetch only, skip LLM             |
| `--seed-courts-only` | Create court records in DB       |
| `--resume`           | Resume from checkpoint (default) |
| `--reset`            | Clear checkpoint, start fresh    |
| `--skip-bio`         | Skip bio page enrichment         |
