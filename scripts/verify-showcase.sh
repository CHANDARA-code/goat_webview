#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Goat WebView — SuperApp Multi-Ecosystem Showcase Master Verification Pipeline
# (8-Stage Automated Verification Suite for iOS, Android, Flutter, RN, & Web)
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

START_TIME=$(date +%s)

echo "================================================================================"
echo "🐐 [Goat WebView] SuperApp Showcase Master 8-Stage Automated Verification Pipeline"
echo "   Multi-Ecosystem Parity: Web Mini-Apps | iOS SwiftUI | Android Compose | Flutter | React Native"
echo "================================================================================"
echo "Workspace: ${WORKSPACE_DIR}"
echo "Started:   $(date -u +"%Y-%m-%dT%H:%M:%SZ")"
echo "================================================================================"

# Helper for stage headers
stage_banner() {
  local num="$1"
  local title="$2"
  echo ""
  echo "--------------------------------------------------------------------------------"
  echo "🚀 [Stage ${num}/8] ${title}"
  echo "--------------------------------------------------------------------------------"
}

# ------------------------------------------------------------------------------
# STAGE 1: Web Mini-Apps Build, Tests, & Cryptographic Asset Packaging
# ------------------------------------------------------------------------------
stage_banner 1 "Web Mini-Apps Build, Tests & Asset Packaging Pipeline"
cd "${WORKSPACE_DIR}/miniapp-web"

echo "🧪 Running Web Mini-Apps Unit & Bridge Tests (75+ tests across 4 domain apps)..."
npm test

echo "📦 Compiling Web Mini-Apps Production Bundle with Vite & esbuild..."
npm run build

DIST_DIR="${WORKSPACE_DIR}/dist"
mkdir -p "${DIST_DIR}"
MANIFEST_FILE="${DIST_DIR}/release-manifest.json"

echo "🗜️ Packaging miniapp.zip archive from miniapp-web/dist/..."
cd "${WORKSPACE_DIR}/miniapp-web/dist"
zip -q -r "${WORKSPACE_DIR}/miniapp-web/dist/miniapp.zip" .

CANONICAL_ZIP="${WORKSPACE_DIR}/miniapp-web/dist/miniapp.zip"
CANONICAL_SHA256=$(shasum -a 256 "${CANONICAL_ZIP}" | awk '{print $1}')
FILE_SIZE=$(wc -c < "${CANONICAL_ZIP}" | tr -d ' ')

echo "✨ Canonical Asset Package Generated: ${FILE_SIZE} bytes (SHA-256: ${CANONICAL_SHA256})"

echo "🔄 Synchronizing miniapp.zip across all 4 Host Showcase Asset Directories..."
mkdir -p "${WORKSPACE_DIR}/android/app/src/main/assets"
mkdir -p "${WORKSPACE_DIR}/ios/Example/Resources"
mkdir -p "${WORKSPACE_DIR}/goat_webview/example/assets"
mkdir -p "${WORKSPACE_DIR}/react-native-goat-webview/example/assets"

cp -f "${CANONICAL_ZIP}" "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip"
cp -f "${CANONICAL_ZIP}" "${WORKSPACE_DIR}/ios/Example/Resources/miniapp.zip"
cp -f "${CANONICAL_ZIP}" "${WORKSPACE_DIR}/goat_webview/example/assets/miniapp.zip"
cp -f "${CANONICAL_ZIP}" "${WORKSPACE_DIR}/react-native-goat-webview/example/assets/miniapp.zip"
cp -f "${CANONICAL_ZIP}" "${DIST_DIR}/miniapp.zip"

echo "📝 Generating Release Manifest & Cryptographic Checksum Metadata..."
cat <<EOF > "${MANIFEST_FILE}"
{
  "version": "1.0.0",
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "artifacts": {
    "miniappZip": {
      "filename": "miniapp.zip",
      "sha256": "${CANONICAL_SHA256}",
      "byteSize": ${FILE_SIZE}
    },
    "hostAssetTargets": [
      "android/app/src/main/assets/miniapp.zip",
      "ios/Example/Resources/miniapp.zip",
      "goat_webview/example/assets/miniapp.zip",
      "react-native-goat-webview/example/assets/miniapp.zip"
    ]
  }
}
EOF

echo "✅ [Stage 1 Passed] Web Mini-Apps built, tested, packaged, and synced successfully."

# ------------------------------------------------------------------------------
# STAGE 2: iOS SwiftUI Host Showcase & Swift Package Verification
# ------------------------------------------------------------------------------
stage_banner 2 "iOS SwiftUI Host Showcase & Swift Package Verification"
bash "${WORKSPACE_DIR}/scripts/verify-ios.sh"
echo "✅ [Stage 2 Passed] iOS Swift Package & Host Showcase verified cleanly."

# ------------------------------------------------------------------------------
# STAGE 3: Android Jetpack Compose Host Showcase Verification
# ------------------------------------------------------------------------------
stage_banner 3 "Android Jetpack Compose Host Showcase Verification"
cd "${WORKSPACE_DIR}/android"

# Detect JAVA_HOME across macOS and Linux environments
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME}/bin/java" ]; then
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null || true)"
  fi
  if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME}/bin/java" ]; then
    if [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
      export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    elif [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then
      export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
    elif [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
      export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    fi
  fi
fi

if [ -n "${JAVA_HOME:-}" ]; then
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

echo "Java Home: ${JAVA_HOME:-system default}"
chmod +x ./gradlew
echo "🧪 Running Android Unit Tests & Assembling Compose Host Debug APK..."
./gradlew testDebugUnitTest :app:assembleDebug --no-daemon
echo "✅ [Stage 3 Passed] Android Compose Host Showcase assembled and tested cleanly."

# ------------------------------------------------------------------------------
# STAGE 4: Flutter Host Showcase & 7 Companion Capability Packages Verification
# ------------------------------------------------------------------------------
stage_banner 4 "Flutter Host Showcase & 7 Companion Capability Packages Verification"

# Auto-detect flutter PATH
if [ -d "${HOME}/fvm/default/bin" ]; then
  export PATH="${HOME}/fvm/default/bin:${PATH}"
elif [ -d "/opt/homebrew/bin" ]; then
  export PATH="/opt/homebrew/bin:${PATH}"
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "❌ Error: Flutter CLI not found on PATH."
  exit 1
fi

echo "🎯 [4.1] Validating Core Goat WebView Flutter Plugin..."
cd "${WORKSPACE_DIR}/goat_webview"
flutter test
flutter analyze

echo "🎯 [4.2] Validating Flutter Example Host Showcase App..."
cd "${WORKSPACE_DIR}/goat_webview/example"
flutter analyze

echo "🎯 [4.3] Validating 7 Companion Capability Packages (Biometrics, BLE, Location, Media, Network, Payments, Scanner)..."
for pkg in "${WORKSPACE_DIR}"/packages/flutter/*; do
  if [ -d "${pkg}" ]; then
    pkg_name="$(basename "${pkg}")"
    echo "  🔵 Validating companion package: ${pkg_name}..."
    (cd "${pkg}" && flutter analyze && if [ -d "test" ]; then flutter test; fi)
  fi
done

echo "✅ [Stage 4 Passed] Flutter Host Showcase & 7 companion capability packages verified cleanly."

# ------------------------------------------------------------------------------
# STAGE 5: React Native Host Showcase Verification
# ------------------------------------------------------------------------------
stage_banner 5 "React Native Host Showcase & TurboModule/Fabric Verification"

echo "⚛️ [5.1] Compiling & Testing react-native-goat-webview Library..."
cd "${WORKSPACE_DIR}/react-native-goat-webview"
npm run build
npm test -- --silent

echo "⚛️ [5.2] Typechecking React Native Host Showcase Example App..."
cd "${WORKSPACE_DIR}/react-native-goat-webview/example"
npm run typecheck

echo "✅ [Stage 5 Passed] React Native package build, tests, and example typecheck verified cleanly."

# ------------------------------------------------------------------------------
# STAGE 6: Master 4-Tier Opaque-Box E2E Integration Suite
# ------------------------------------------------------------------------------
stage_banner 6 "Master 4-Tier Opaque-Box E2E Integration Suite"
cd "${WORKSPACE_DIR}"

echo "🧪 Running Master 4-Tier E2E Integration Test Suite (Tiers 1–4 across all 32 features & showcase)..."
node --experimental-strip-types "${WORKSPACE_DIR}/tests/e2e/run-all.ts"

echo "🧪 Running Dedicated SuperApp Showcase 4-Tier E2E Suite..."
node --experimental-strip-types "${WORKSPACE_DIR}/tests/e2e/showcase/run-showcase.ts"

echo "✅ [Stage 6 Passed] 100% 4-Tier Opaque-Box E2E Integration & Showcase Suites Passed."

# ------------------------------------------------------------------------------
# STAGE 7: Baseline Monorepo Quality Gate
# ------------------------------------------------------------------------------
stage_banner 7 "Baseline Monorepo Quality Gate (Full Monorepo Suite)"
bash "${WORKSPACE_DIR}/scripts/verify-all.sh"
echo "✅ [Stage 7 Passed] Master monorepo quality gate passed 100% with zero regressions."

# ------------------------------------------------------------------------------
# STAGE 8: Multi-Platform Asset Integrity & Cryptographic Checksum Sync Verification
# ------------------------------------------------------------------------------
stage_banner 8 "Multi-Platform Asset Integrity & Cryptographic Checksum Sync Verification"

TARGET_ASSETS=(
  "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip"
  "${WORKSPACE_DIR}/ios/Example/Resources/miniapp.zip"
  "${WORKSPACE_DIR}/goat_webview/example/assets/miniapp.zip"
  "${WORKSPACE_DIR}/react-native-goat-webview/example/assets/miniapp.zip"
  "${WORKSPACE_DIR}/dist/miniapp.zip"
)

echo "🔍 Validating Cryptographic Integrity of Synced miniapp.zip Across All Host Showcase Applications:"
for asset_path in "${TARGET_ASSETS[@]}"; do
  if [ ! -f "${asset_path}" ]; then
    echo "  ❌ Missing asset target: ${asset_path}"
    exit 1
  fi
  TARGET_SHA256=$(shasum -a 256 "${asset_path}" | awk '{print $1}')
  TARGET_SIZE=$(wc -c < "${asset_path}" | tr -d ' ')
  if [ "${TARGET_SHA256}" != "${CANONICAL_SHA256}" ]; then
    echo "  ❌ Checksum mismatch for ${asset_path}!"
    echo "     Expected: ${CANONICAL_SHA256}"
    echo "     Actual:   ${TARGET_SHA256}"
    exit 1
  fi
  echo "  ✅ Verified: $(basename "$(dirname "$(dirname "${asset_path}")")")/.../$(basename "${asset_path}") [${TARGET_SIZE} bytes | SHA-256: ${TARGET_SHA256:0:16}...]"
done

if [ ! -f "${MANIFEST_FILE}" ]; then
  echo "  ❌ Missing release manifest at ${MANIFEST_FILE}"
  exit 1
fi
echo "  ✅ Verified: Release manifest present at ${MANIFEST_FILE}"

END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo ""
echo "================================================================================"
echo "🎉 [Goat WebView] 100% SuperApp Showcase Master Verification Pipeline PASSED!"
echo "================================================================================"
echo "📊 Execution Summary:"
echo "   - Stage 1: Web Mini-Apps & Asset Packaging  [PASSED ✅]"
echo "   - Stage 2: iOS SwiftUI Host & XCTest Suite   [PASSED ✅]"
echo "   - Stage 3: Android Compose Host & Unit Tests [PASSED ✅]"
echo "   - Stage 4: Flutter Host & 7 Companion Pkgs   [PASSED ✅]"
echo "   - Stage 5: React Native Host & TurboModules  [PASSED ✅]"
echo "   - Stage 6: Master 4-Tier Opaque-Box E2E Suite[PASSED ✅]"
echo "   - Stage 7: Baseline Monorepo Quality Gate    [PASSED ✅]"
echo "   - Stage 8: Asset Cryptographic Integrity     [PASSED ✅]"
echo "   - Total Pipeline Duration: ${TOTAL_DURATION}s"
echo "================================================================================"
exit 0
