#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🐐 [Goat WebView] Master 4-Tier Opaque-Box E2E Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "❌ Error: Node.js CLI not found on PATH."
  exit 1
fi

echo "Node CLI: $(which node) ($(node -v))"
echo "Running 4-Tier Master E2E Test Suite (Tiers 1–4 across all 32 Features)..."

node --experimental-strip-types "${WORKSPACE_DIR}/tests/e2e/run-all.ts"

echo ""
echo "✅ [E2E] 100% Master 4-Tier E2E Tests Passed Across All 32 Features."
