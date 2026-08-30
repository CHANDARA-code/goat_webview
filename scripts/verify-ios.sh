#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🍎 [Goat WebView] iOS Core Engine & Bridge Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
# Package.swift lives at the repo root so SPM can resolve this repo as a package.
cd "${WORKSPACE_DIR}"

if command -v xcodebuild >/dev/null 2>&1; then
  echo "Xcode version: $(xcodebuild -version | tr '\n' ' ')"
  
  # Resolve available simulator device ID
  DEVICE_ID=""
  if command -v xcrun >/dev/null 2>&1; then
    DEVICE_ID="$(xcrun simctl list devices available 2>/dev/null | grep -E "iPhone" | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/' || true)"
  fi
  
  if [ -n "${DEVICE_ID}" ]; then
    DESTINATION="id=${DEVICE_ID}"
  else
    DESTINATION="generic/platform=iOS Simulator"
  fi
  
  echo "Running iOS XCTest suite targeting: ${DESTINATION}..."
  xcodebuild test \
    -scheme "GoatWebView-Package" \
    -destination "${DESTINATION}" \
    -derivedDataPath ".derivedData"
elif command -v swift >/dev/null 2>&1; then
  echo "Swift version: $(swift --version | head -n 1)"
  swift test
else
  echo "❌ Error: Neither xcodebuild nor swift compiler found on PATH."
  exit 1
fi

echo "✅ [iOS] 100% iOS Swift Package XCTests Passed."
