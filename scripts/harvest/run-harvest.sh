#!/bin/bash
# 
# Judges Directory — Multi-State Automated Harvest Script
#
# Run harvesting for one state, all states, or list available states.
#
# Usage:
#   ./scripts/harvest/run-harvest.sh                     # Default: harvest Florida
#   ./scripts/harvest/run-harvest.sh --state florida      # Explicit single state
#   ./scripts/harvest/run-harvest.sh --state texas         # Harvest Texas
#   ./scripts/harvest/run-harvest.sh --state california    # Harvest California
#   ./scripts/harvest/run-harvest.sh --state new-york      # Harvest New York
#   ./scripts/harvest/run-harvest.sh --all                 # Process all states
#   ./scripts/harvest/run-harvest.sh --all --resume        # Resume interrupted multi-state run
#   ./scripts/harvest/run-harvest.sh --list                # List available states
#   ./scripts/harvest/run-harvest.sh --state texas --dry-run  # Dry run (fetch only, skip LLM)
#   ./scripts/harvest/run-harvest.sh --state new-york --seed-courts-only  # Seed courts in DB
#
# Flags:
#   --state <name>     Process a single state (slug format, e.g. "florida", "new-york")
#   --all              Process all configured states sequentially
#   --list             Show available states and exit
#   --dry-run          Fetch HTML but skip LLM extraction
#   --seed-courts-only Create court records in database only
#   --resume           Resume from last checkpoint (default behavior)
#   --reset            Clear checkpoint and start fresh
#   --skip-bio         Skip bio page enrichment (faster, less data)
#
# Output:
#   Per-state: scripts/harvest/output/{state-slug}/
#   Combined:  scripts/harvest/output/combined-summary-{timestamp}.txt (with --all)

set -e  # Exit on first error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  Judges Directory — Multi-State Harvest"
echo "========================================"
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Output dir: $SCRIPT_DIR/output"
echo ""

# Pass all arguments through to the harvest script
exec npx tsx scripts/harvest/index.ts "$@"
