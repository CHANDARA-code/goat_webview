#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "⚛️  [Goat WebView] React Native TurboModule & Fabric Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}/react-native-goat-webview"

if ! command -v npm >/dev/null 2>&1; then
  echo "❌ Error: npm CLI not found on PATH."
  exit 1
fi

npm test -- --silent
echo "✅ [React Native] 100% TurboModule & Fabric Jest Tests Passed."
