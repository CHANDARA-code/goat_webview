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

# The package tests above and a Flutter host build compile from DIFFERENT file lists: the tests use
# the SPM target, the host uses the CocoaPods project, which is regenerated only by `pod install`.
# A stale Podfile.lock therefore leaves new Sources/GoatWebView files invisible to every Flutter
# consumer while the package suite stays green -- which is exactly what happened on 2026-09-06, when
# four types added that day broke `flutter build ios` with "cannot find in scope" and nothing caught
# it (see bench/goat_vs_fiw/RESULT_v23_ios_release.md).
#
# Building a Flutter host is the check that catches it. Skipped when no Flutter host is present so
# the script stays usable in a package-only checkout.
HOST_APP="bench/goat_vs_fiw/app_goat"
if command -v flutter >/dev/null 2>&1 && [ -d "${HOST_APP}/ios" ]; then
  echo "Verifying a Flutter host still compiles against the package..."
  ( cd "${HOST_APP}/ios" && pod install >/dev/null 2>&1 || true )
  ( cd "${HOST_APP}" && flutter build ios --release --no-codesign )
  echo "✅ [iOS] Flutter host builds against the package."
else
  echo "⏭  [iOS] No Flutter host found; skipping consumer build check."
fi
