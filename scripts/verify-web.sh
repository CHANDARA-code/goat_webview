#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🌐 [Goat WebView] Web JS SDK Tests & Production Build Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}/miniapp-web"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Error: npm CLI not found on PATH."
  exit 1
fi

echo "🧪 Running Web Bridge Unit, Hooks & E2E Tests..."
npm test

echo "📦 Running Web Mini-App Production Compilation..."
npm run build

echo "✅ [Web] 100% Web SDK Tests & Production Build Passed."
