#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Goat WebView Monorepo Version Alignment & Synchronization Tool
# Usage:
#   ./scripts/bump-version.sh --check
#   ./scripts/bump-version.sh 1.0.1
# ==============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

CHECK_MODE=0
TARGET_VERSION=""

if [ "$#" -eq 0 ] || [ "$1" = "--check" ]; then
  CHECK_MODE=1
else
  TARGET_VERSION="$1"
fi

echo "================================================================================"
if [ "${CHECK_MODE}" -eq 1 ]; then
  echo "🔍 [Goat WebView] Monorepo Version Synchronization Verification"
else
  echo "🚀 [Goat WebView] Bumping Monorepo Version to: ${TARGET_VERSION}"
fi
echo "================================================================================"

# Collect versions from all ecosystems
ROOT_PUB_VER=$(grep "^version:" "${WORKSPACE_DIR}/goat_webview/pubspec.yaml" | awk '{print $2}' | tr -d '"' | tr -d "'")
RN_VER=$(node -p "require('${WORKSPACE_DIR}/react-native-goat-webview/package.json').version")
CLI_VER=$(node -p "require('${WORKSPACE_DIR}/packages/cli/package.json').version")
APPSERVICE_VER=$(node -p "require('${WORKSPACE_DIR}/packages/appservice/package.json').version")
SERVER_VER=$(node -p "require('${WORKSPACE_DIR}/packages/server/package.json').version")
IOS_POD_VER=$(grep "s.version[[:space:]]*=" "${WORKSPACE_DIR}/ios/GoatWebView.podspec" | head -1 | sed 's/.*=[[:space:]]*//' | tr -d "'" | tr -d '"')
ANDROID_VER=$(grep 'version = "' "${WORKSPACE_DIR}/android/core/build.gradle.kts" | head -1 | sed 's/.*version = "//' | sed 's/".*//')

if [ "${CHECK_MODE}" -eq 1 ]; then
  echo "Flutter Engine (goat_webview):   ${ROOT_PUB_VER}"
  echo "React Native SDK:               ${RN_VER}"
  echo "Developer CLI (@goat/cli):       ${CLI_VER}"
  echo "AppService (@goat/appservice):   ${APPSERVICE_VER}"
  echo "iOS Podspec (GoatWebView):       ${IOS_POD_VER}"
  echo "Android Core (com.goat.webview): ${ANDROID_VER}"
  echo ""

  MISMATCH=0
  BASE_VER="${ROOT_PUB_VER}"

  for pkg_pub in "${WORKSPACE_DIR}"/packages/flutter/*/pubspec.yaml; do
    P_NAME=$(basename "$(dirname "$pkg_pub")")
    P_VER=$(grep "^version:" "$pkg_pub" | awk '{print $2}' | tr -d '"' | tr -d "'")
    if [ "$P_VER" != "$BASE_VER" ]; then
      echo "  ❌ Flutter Companion Package Mismatch: ${P_NAME} (${P_VER}) != ${BASE_VER}"
      MISMATCH=1
    fi
  done

  if [ "$RN_VER" != "$BASE_VER" ] || [ "$IOS_POD_VER" != "$BASE_VER" ] || [ "$ANDROID_VER" != "$BASE_VER" ]; then
    echo "  ❌ Monorepo version mismatch detected across core platforms!"
    MISMATCH=1
  fi

  if [ "$MISMATCH" -eq 0 ]; then
    echo "✅ [SUCCESS] All monorepo packages are strictly synchronized at version ${BASE_VER}!"
    exit 0
  else
    echo "❌ [FAILURE] Version synchronization mismatch found."
    exit 1
  fi
fi

# Apply version update across all files
echo "Updating Flutter packages to ${TARGET_VERSION}..."
sed -i '' "s/^version: .*/version: ${TARGET_VERSION}/" "${WORKSPACE_DIR}/goat_webview/pubspec.yaml"
for pkg_pub in "${WORKSPACE_DIR}"/packages/flutter/*/pubspec.yaml; do
  sed -i '' "s/^version: .*/version: ${TARGET_VERSION}/" "$pkg_pub"
done

echo "Updating React Native & npm packages to ${TARGET_VERSION}..."
NPM_PKGS=(
  "react-native-goat-webview"
  "packages/cli"
  "packages/appservice"
  "packages/bridge-mock"
  "packages/devtools"
  "packages/server"
  "packages/core"
  "packages/compiler-taro"
  "packages/compiler-uniapp"
  "packages/playground"
  "miniapp-web"
)

for pkg in "${NPM_PKGS[@]}"; do
  PKG_JSON="${WORKSPACE_DIR}/${pkg}/package.json"
  if [ -f "${PKG_JSON}" ]; then
    node -e "
      const fs = require('fs');
      const p = '${PKG_JSON}';
      const j = JSON.parse(fs.readFileSync(p, 'utf8'));
      j.version = '${TARGET_VERSION}';
      fs.writeFileSync(p, JSON.stringify(j, null, 2) + '\n');
    "
  fi
done

echo "Updating iOS Podspecs to ${TARGET_VERSION}..."
sed -i '' "s/s.version[[:space:]]*=.*/s.version          = '${TARGET_VERSION}'/" "${WORKSPACE_DIR}/ios/GoatWebView.podspec"

echo "Updating Android Gradle Maven publication to ${TARGET_VERSION}..."
sed -i '' "s/version = \".*\"/version = \"${TARGET_VERSION}\"/" "${WORKSPACE_DIR}/android/core/build.gradle.kts"

echo ""
echo "🎉 [SUCCESS] Monorepo successfully updated to version ${TARGET_VERSION}!"

