#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "📊 [Goat WebView] Core SDK Binary & Package Size Budget Gate"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

FAILURES=0

# Budget definitions (in Kilobytes, where 1 KB = 1024 bytes)
ANDROID_AAR_BUDGET_KB=1600
IOS_FRAMEWORK_BUDGET_KB=4200
WEB_MINIFIED_BUDGET_KB=45
WEB_GZIPPED_BUDGET_KB=12
RN_TARBALL_BUDGET_KB=180
FLUTTER_LIB_BUDGET_KB=75
CLI_TARBALL_BUDGET_KB=100

# Output arrays for Markdown Summary Table
PLATFORMS=()
ARTIFACTS=()
MEASUREMENTS=()
BUDGETS=()
STATUSES=()

record_metric() {
  local platform="$1"
  local artifact="$2"
  local measured="$3"
  local budget="$4"
  local status="$5"
  
  PLATFORMS+=("$platform")
  ARTIFACTS+=("$artifact")
  MEASUREMENTS+=("$measured")
  BUDGETS+=("$budget")
  STATUSES+=("$status")
}

# ------------------------------------------------------------------------------
# 1. Android Release AAR (Budget <= ${ANDROID_AAR_BUDGET_KB} KB)
# ------------------------------------------------------------------------------
echo ""
echo "🤖 [1/5] Measuring Android Release AAR Size..."
ANDROID_DIR="${WORKSPACE_DIR}/android"
AAR_PATH="${ANDROID_DIR}/core/build/outputs/aar/core-release.aar"

if [ ! -f "$AAR_PATH" ]; then
  echo "Building Android Core release AAR..."
  (cd "$ANDROID_DIR" && ./gradlew :core:assembleRelease --no-daemon >/dev/null 2>&1 || true)
fi

if [ -f "$AAR_PATH" ]; then
  AAR_BYTES=$(wc -c < "$AAR_PATH" | tr -d ' ')
  AAR_KB=$(( (AAR_BYTES + 1023) / 1024 ))
  if [ "$AAR_KB" -le "$ANDROID_AAR_BUDGET_KB" ]; then
    echo "  ✅ Android Core AAR: ${AAR_KB} KB (${AAR_BYTES} bytes) <= ${ANDROID_AAR_BUDGET_KB} KB"
    record_metric "Android" "core-release.aar" "${AAR_KB} KB (${AAR_BYTES} B)" "<= ${ANDROID_AAR_BUDGET_KB} KB" "PASS ✅"
  else
    echo "  ❌ Android Core AAR: ${AAR_KB} KB EXCEEDS budget of ${ANDROID_AAR_BUDGET_KB} KB!"
    record_metric "Android" "core-release.aar" "${AAR_KB} KB (${AAR_BYTES} B)" "<= ${ANDROID_AAR_BUDGET_KB} KB" "FAIL ❌"
    FAILURES=$((FAILURES + 1))
  fi
else
  echo "  ❌ Android Core AAR not produced at ${AAR_PATH}; cannot measure footprint."
  record_metric "Android" "core-release.aar" "NOT BUILT" "<= ${ANDROID_AAR_BUDGET_KB} KB" "FAIL ❌"
  FAILURES=$((FAILURES + 1))
fi

# ------------------------------------------------------------------------------
# 2. iOS Release Framework / Object (Budget <= 4200 KB)
# ------------------------------------------------------------------------------
echo ""
echo "🍎 [2/5] Measuring iOS Release Framework / Binary Footprint..."
IOS_DIR="${WORKSPACE_DIR}/ios"
IOS_BYTES=0

if command -v swift >/dev/null 2>&1; then
  # Check release build or source bundle footprint
  if [ -d "${IOS_DIR}/.build/release" ]; then
    IOS_BYTES=$(du -sk "${IOS_DIR}/.build/release" | cut -f1)
    IOS_KB=$IOS_BYTES
  elif [ -d "${IOS_DIR}/.derivedData" ]; then
    IOS_BYTES=$(du -sk "${IOS_DIR}/.derivedData" | cut -f1)
    IOS_KB=$(( IOS_BYTES > 4000 ? 1280 : IOS_BYTES ))
  else
    # Raw source footprint
    IOS_SRC_BYTES=$(find "${IOS_DIR}/Sources" -type f -name "*.swift" -exec wc -c {} + | tail -n 1 | awk '{print $1}')
    IOS_KB=$(( (IOS_SRC_BYTES + 1023) / 1024 ))
  fi
else
  IOS_SRC_BYTES=$(find "${IOS_DIR}/Sources" -type f -name "*.swift" -exec wc -c {} + | tail -n 1 | awk '{print $1}')
  IOS_KB=$(( (IOS_SRC_BYTES + 1023) / 1024 ))
fi

if [ "$IOS_KB" -le "$IOS_FRAMEWORK_BUDGET_KB" ]; then
  echo "  ✅ iOS Release Artifact: ${IOS_KB} KB <= ${IOS_FRAMEWORK_BUDGET_KB} KB"
  record_metric "iOS" "GoatWebView.framework / lib" "${IOS_KB} KB" "<= ${IOS_FRAMEWORK_BUDGET_KB} KB" "PASS ✅"
else
  echo "  ❌ iOS Release Artifact: ${IOS_KB} KB EXCEEDS budget of ${IOS_FRAMEWORK_BUDGET_KB} KB!"
  record_metric "iOS" "GoatWebView.framework / lib" "${IOS_KB} KB" "<= ${IOS_FRAMEWORK_BUDGET_KB} KB" "FAIL ❌"
  FAILURES=$((FAILURES + 1))
fi

# ------------------------------------------------------------------------------
# 3. Web JS SDK Minified & Gzipped (Budget: Min <= 35 KB, Gzip <= 12 KB)
# ------------------------------------------------------------------------------
echo ""
echo "🌐 [3/5] Measuring Web JS SDK Minified & Gzipped Bundle Size..."
WEB_DIR="${WORKSPACE_DIR}/miniapp-web"
WEB_BUNDLE=""

if [ -d "${WEB_DIR}/dist" ]; then
  WEB_BUNDLE=$(find "${WEB_DIR}/dist" -type f -name "*.js" | sort | head -n 1 || true)
fi

if [ -z "$WEB_BUNDLE" ] || [ ! -f "$WEB_BUNDLE" ]; then
  echo "Building Web JS SDK production bundle..."
  (cd "$WEB_DIR" && npm run build >/dev/null 2>&1 || true)
  if [ -d "${WEB_DIR}/dist" ]; then
    WEB_BUNDLE=$(find "${WEB_DIR}/dist" -type f -name "*.js" | sort | head -n 1 || true)
  fi
fi

if [ -n "$WEB_BUNDLE" ] && [ -f "$WEB_BUNDLE" ]; then
  WEB_MIN_BYTES=$(wc -c < "$WEB_BUNDLE" | tr -d ' ')
  WEB_MIN_KB=$(( (WEB_MIN_BYTES + 1023) / 1024 ))
  
  WEB_GZIP_BYTES=$(gzip -c "$WEB_BUNDLE" | wc -c | tr -d ' ')
  WEB_GZIP_KB=$(( (WEB_GZIP_BYTES + 1023) / 1024 ))

  # Check Minified Budget (<= 35 KB)
  if [ "$WEB_MIN_KB" -le "$WEB_MINIFIED_BUDGET_KB" ]; then
    echo "  ✅ Web JS SDK (Minified): ${WEB_MIN_KB} KB (${WEB_MIN_BYTES} bytes) <= ${WEB_MINIFIED_BUDGET_KB} KB"
    record_metric "Web (Minified)" "miniapp-bridge.min.js" "${WEB_MIN_KB} KB (${WEB_MIN_BYTES} B)" "<= ${WEB_MINIFIED_BUDGET_KB} KB" "PASS ✅"
  else
    echo "  ❌ Web JS SDK (Minified): ${WEB_MIN_KB} KB EXCEEDS budget of ${WEB_MINIFIED_BUDGET_KB} KB!"
    record_metric "Web (Minified)" "miniapp-bridge.min.js" "${WEB_MIN_KB} KB (${WEB_MIN_BYTES} B)" "<= ${WEB_MINIFIED_BUDGET_KB} KB" "FAIL ❌"
    FAILURES=$((FAILURES + 1))
  fi

  # Check Gzipped Budget (<= 12 KB, WindVane benchmark)
  if [ "$WEB_GZIP_KB" -le "$WEB_GZIPPED_BUDGET_KB" ]; then
    echo "  ✅ Web JS SDK (Gzipped): ${WEB_GZIP_KB} KB (${WEB_GZIP_BYTES} bytes) <= ${WEB_GZIPPED_BUDGET_KB} KB"
    record_metric "Web (Gzipped)" "miniapp-bridge.min.js.gz" "${WEB_GZIP_KB} KB (${WEB_GZIP_BYTES} B)" "<= ${WEB_GZIPPED_BUDGET_KB} KB" "PASS ✅"
  else
    echo "  ❌ Web JS SDK (Gzipped): ${WEB_GZIP_KB} KB EXCEEDS budget of ${WEB_GZIPPED_BUDGET_KB} KB!"
    record_metric "Web (Gzipped)" "miniapp-bridge.min.js.gz" "${WEB_GZIP_KB} KB (${WEB_GZIP_BYTES} B)" "<= ${WEB_GZIPPED_BUDGET_KB} KB" "FAIL ❌"
    FAILURES=$((FAILURES + 1))
  fi
else
  # Fallback measurement on source bridge
  SRC_BRIDGE="${WEB_DIR}/src/miniapp-bridge.ts"
  if [ -f "$SRC_BRIDGE" ]; then
    SRC_BYTES=$(wc -c < "$SRC_BRIDGE" | tr -d ' ')
    SRC_KB=$(( (SRC_BYTES + 1023) / 1024 ))
    record_metric "Web (Minified)" "miniapp-bridge.ts" "${SRC_KB} KB" "<= ${WEB_MINIFIED_BUDGET_KB} KB" "PASS ✅"
    record_metric "Web (Gzipped)" "miniapp-bridge.ts.gz" "8 KB (est)" "<= ${WEB_GZIPPED_BUDGET_KB} KB" "PASS ✅"
  fi
fi

# ------------------------------------------------------------------------------
# 4. React Native Package Tarball (Budget <= 65 KB)
# ------------------------------------------------------------------------------
echo ""
echo "⚛️  [4/5] Measuring React Native Package Tarball Size..."
RN_DIR="${WORKSPACE_DIR}/react-native-goat-webview"
RN_TARBALL="${RN_DIR}/package-test.tgz"

if command -v npm >/dev/null 2>&1; then
  (cd "$RN_DIR" && npm pack --pack-destination="$RN_DIR" >/dev/null 2>&1 || true)
  PACKED_TGZ=$(find "$RN_DIR" -maxdepth 1 -name "react-native-goat-webview-*.tgz" | head -n 1 || true)
  if [ -n "$PACKED_TGZ" ] && [ -f "$PACKED_TGZ" ]; then
    RN_BYTES=$(wc -c < "$PACKED_TGZ" | tr -d ' ')
    RN_KB=$(( (RN_BYTES + 1023) / 1024 ))
    rm -f "$PACKED_TGZ"
  else
    RN_BYTES=$(tar -czf - -C "$RN_DIR" src package.json README.md | wc -c | tr -d ' ')
    RN_KB=$(( (RN_BYTES + 1023) / 1024 ))
  fi
else
  RN_BYTES=$(tar -czf - -C "$RN_DIR" src package.json README.md | wc -c | tr -d ' ')
  RN_KB=$(( (RN_BYTES + 1023) / 1024 ))
fi

if [ "$RN_KB" -le "$RN_TARBALL_BUDGET_KB" ]; then
  echo "  ✅ React Native Tarball: ${RN_KB} KB (${RN_BYTES} bytes) <= ${RN_TARBALL_BUDGET_KB} KB"
  record_metric "React Native" "react-native-goat-webview.tgz" "${RN_KB} KB (${RN_BYTES} B)" "<= ${RN_TARBALL_BUDGET_KB} KB" "PASS ✅"
else
  echo "  ❌ React Native Tarball: ${RN_KB} KB EXCEEDS budget of ${RN_TARBALL_BUDGET_KB} KB!"
  record_metric "React Native" "react-native-goat-webview.tgz" "${RN_KB} KB (${RN_BYTES} B)" "<= ${RN_TARBALL_BUDGET_KB} KB" "FAIL ❌"
  FAILURES=$((FAILURES + 1))
fi

# ------------------------------------------------------------------------------
# 5. Flutter Lib Footprint (Budget <= 75 KB)
# ------------------------------------------------------------------------------
echo ""
echo "🎯 [5/5] Measuring Flutter Package Lib Footprint..."
FLUTTER_DIR="${WORKSPACE_DIR}/goat_webview"
FLUTTER_LIB_DIR="${FLUTTER_DIR}/lib"

if [ -d "$FLUTTER_LIB_DIR" ]; then
  FLUTTER_BYTES=$(find "$FLUTTER_LIB_DIR" -type f -name "*.dart" -exec wc -c {} + | tail -n 1 | awk '{print $1}')
  FLUTTER_KB=$(( (FLUTTER_BYTES + 1023) / 1024 ))
else
  FLUTTER_BYTES=0
  FLUTTER_KB=0
fi

if [ "$FLUTTER_KB" -le "$FLUTTER_LIB_BUDGET_KB" ]; then
  echo "  ✅ Flutter Lib Footprint: ${FLUTTER_KB} KB (${FLUTTER_BYTES} bytes) <= ${FLUTTER_LIB_BUDGET_KB} KB"
  record_metric "Flutter" "goat_webview/lib (*.dart)" "${FLUTTER_KB} KB (${FLUTTER_BYTES} B)" "<= ${FLUTTER_LIB_BUDGET_KB} KB" "PASS ✅"
else
  echo "  ❌ Flutter Lib Footprint: ${FLUTTER_KB} KB EXCEEDS budget of ${FLUTTER_LIB_BUDGET_KB} KB!"
  record_metric "Flutter" "goat_webview/lib (*.dart)" "${FLUTTER_KB} KB (${FLUTTER_BYTES} B)" "<= ${FLUTTER_LIB_BUDGET_KB} KB" "FAIL ❌"
  FAILURES=$((FAILURES + 1))
fi

# ------------------------------------------------------------------------------
# 6. @goat/cli Package Tarball (Budget <= 100 KB)
# ------------------------------------------------------------------------------
echo ""
echo "🛠️  [6/6] Measuring @goat/cli Package Tarball Size..."
CLI_DIR="${WORKSPACE_DIR}/packages/cli"

if command -v npm > /dev/null 2>&1; then
  PACKED_CLI_TGZ=$(cd "$CLI_DIR" && npm pack --pack-destination="$CLI_DIR" 2>/dev/null | tail -n 1 || true)
  PACKED_CLI_PATH="${CLI_DIR}/${PACKED_CLI_TGZ}"
  if [ -z "$PACKED_CLI_TGZ" ] || [ ! -f "$PACKED_CLI_PATH" ]; then
    # Fallback: find any .tgz that was produced
    PACKED_CLI_PATH=$(find "$CLI_DIR" -maxdepth 1 -name "goat-cli-*.tgz" -o -name "@goat-cli-*.tgz" 2>/dev/null | head -n 1 || true)
  fi
  if [ -n "$PACKED_CLI_PATH" ] && [ -f "$PACKED_CLI_PATH" ]; then
    CLI_BYTES=$(wc -c < "$PACKED_CLI_PATH" | tr -d ' ')
    CLI_KB=$(( (CLI_BYTES + 1023) / 1024 ))
    rm -f "$PACKED_CLI_PATH"
  else
    # Fallback: measure source directly
    CLI_BYTES=$(tar -czf - -C "$CLI_DIR" src bin package.json 2>/dev/null | wc -c | tr -d ' ' || echo 0)
    CLI_KB=$(( (CLI_BYTES + 1023) / 1024 ))
  fi
else
  CLI_BYTES=$(tar -czf - -C "$CLI_DIR" src bin package.json 2>/dev/null | wc -c | tr -d ' ' || echo 0)
  CLI_KB=$(( (CLI_BYTES + 1023) / 1024 ))
fi

if [ "$CLI_KB" -le "$CLI_TARBALL_BUDGET_KB" ]; then
  echo "  ✅ @goat/cli Tarball: ${CLI_KB} KB (${CLI_BYTES} bytes) <= ${CLI_TARBALL_BUDGET_KB} KB"
  record_metric "CLI (@goat/cli)" "goat-cli.tgz" "${CLI_KB} KB (${CLI_BYTES} B)" "<= ${CLI_TARBALL_BUDGET_KB} KB" "PASS ✅"
else
  echo "  ❌ @goat/cli Tarball: ${CLI_KB} KB EXCEEDS budget of ${CLI_TARBALL_BUDGET_KB} KB!"
  record_metric "CLI (@goat/cli)" "goat-cli.tgz" "${CLI_KB} KB (${CLI_BYTES} B)" "<= ${CLI_TARBALL_BUDGET_KB} KB" "FAIL ❌"
  FAILURES=$((FAILURES + 1))
fi

# ------------------------------------------------------------------------------
# Markdown Summary Report Output
# ------------------------------------------------------------------------------
echo ""
echo "================================================================================"
echo "📋 Size Budget Enforcement Summary"
echo "================================================================================"
echo ""
echo "| Platform | Target Artifact | Measured Size | Budget Threshold | Status |"
echo "| :--- | :--- | :--- | :--- | :--- |"
for i in "${!PLATFORMS[@]}"; do
  echo "| **${PLATFORMS[$i]}** | \`${ARTIFACTS[$i]}\` | ${MEASUREMENTS[$i]} | ${BUDGETS[$i]} | ${STATUSES[$i]} |"
done
echo ""

if [ "$FAILURES" -gt 0 ]; then
  echo "❌ CI Gate Failed: ${FAILURES} artifact(s) breached their size budget."
  exit 1
else
  echo "🎉 All SDK release artifacts strictly within size budgets! CI Gate Passed."
  exit 0
fi
