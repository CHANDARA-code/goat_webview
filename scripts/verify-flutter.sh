#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🎯 [Goat WebView] Flutter PlatformView & MethodChannel Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}/goat_webview"

# Auto-detect flutter PATH across user setups
if [ -d "${HOME}/fvm/default/bin" ]; then
  export PATH="${HOME}/fvm/default/bin:${PATH}"
elif [ -d "/opt/homebrew/bin" ]; then
  export PATH="/opt/homebrew/bin:${PATH}"
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "❌ Error: Flutter CLI not found on PATH."
  exit 1
fi

echo "Flutter CLI: $(which flutter) ($(flutter --version | head -n 1))"

echo "🧪 Running Flutter unit & widget tests..."
flutter test

echo "🔍 Running Flutter static analysis..."
flutter analyze

echo "✅ [Flutter] 100% Flutter MethodChannel & PlatformView Tests Passed."
