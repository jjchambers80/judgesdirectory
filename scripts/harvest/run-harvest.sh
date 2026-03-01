#!/bin/bash
# 
# Florida Judges Directory — Automated Harvest Script
#
# Run a complete harvest with no manual intervention.
# Usage: ./scripts/harvest/run-harvest.sh [--reset] [--ballotpedia]
#
# This script:
#   1. Runs the full harvest pipeline
#   2. Enriches with bio page data automatically
#   3. Uses identity-based deduplication
#   4. Writes CSV output and quality report
#   5. Exits with 0 on success, non-zero on failure
#
# Output files:
#   scripts/harvest/output/florida-judges-enriched-*.csv
#   scripts/harvest/output/florida-enriched-report-*.md
#   scripts/harvest/output/florida-harvest-*.log

set -e  # Exit on first error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

cd "$PROJECT_ROOT"

echo "========================================"
echo "  Florida Judges Directory — Harvest"
echo "========================================"
echo ""
echo "Project root: $PROJECT_ROOT"
echo "Output dir: $SCRIPT_DIR/output"
echo ""

# Pass all arguments through to the harvest script
exec npx tsx scripts/harvest/index.ts "$@"
