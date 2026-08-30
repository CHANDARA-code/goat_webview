#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Goat WebView Production Release Artifacts Packaging Pipeline
# Builds: .vsix, standalone goat-server binary, npm .tgz tarballs, Android .aar,
#         iOS CocoaPods/SPM zip bundle, Flutter plugin archive, & SHA-256 manifest
# ==============================================================================

echo "================================================================================"
echo "🚀 [Goat WebView] Building Production Release Packages & Binary Artifacts"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
DIST_DIR="${WORKSPACE_DIR}/dist"

# Ensure clean distribution output directory
rm -rf "${DIST_DIR}"
mkdir -p "${DIST_DIR}"

# Ensure Java environment for Android builds
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

# Disable macOS AppleDouble ._* metadata file creation in tar and zip archives
export COPYFILE_DISABLE=1
export TAR_OPTIONS="--no-mac-metadata"

# Ensure bin tools on PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:${HOME}/.bun/bin:${PATH}"

# ------------------------------------------------------------------------------
# 1. Mini-App Web Production Bundle & Tarball
# ------------------------------------------------------------------------------
echo ""
echo "🌐 [1/7] Compiling Web Mini-App & Generating npm Release Tarball..."
cd "${WORKSPACE_DIR}/miniapp-web"
npm run build
mkdir -p "${WORKSPACE_DIR}/android/app/src/main/assets"
(cd dist && zip -q -r "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" .)
cp "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" "${DIST_DIR}/miniapp.zip"

npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ Web Mini-App: miniapp.zip & miniapp-web-1.0.0.tgz built."

# ------------------------------------------------------------------------------
# 2. Tooling NPM Packages (@goat/cli, @goat/bridge-mock, @goat/playground, etc.)
# ------------------------------------------------------------------------------
echo ""
echo "📦 [2/7] Packaging Developer Tooling NPM Release Tarballs..."

# @goat/cli
cd "${WORKSPACE_DIR}/packages/cli"
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/cli packaged."

# @goat/appservice
cd "${WORKSPACE_DIR}/packages/appservice"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/appservice packaged."

# @goat/bridge-mock
cd "${WORKSPACE_DIR}/packages/bridge-mock"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/bridge-mock packaged."

# @goat/devtools
cd "${WORKSPACE_DIR}/packages/devtools"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/devtools packaged."

# @goat/playground
cd "${WORKSPACE_DIR}/packages/playground"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/playground packaged."

# @goat/server
cd "${WORKSPACE_DIR}/packages/server"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/server packaged."

# @goat/core
cd "${WORKSPACE_DIR}/packages/core"
bun run build 2>/dev/null || npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/core packaged."

# @goat/compiler-taro
cd "${WORKSPACE_DIR}/packages/compiler-taro"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/compiler-taro packaged."

# @goat/compiler-uniapp
cd "${WORKSPACE_DIR}/packages/compiler-uniapp"
npm run build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ @goat/compiler-uniapp packaged."

# React Native Plugin
cd "${WORKSPACE_DIR}/react-native-goat-webview"
rm -rf android/.gradle android/build ios/build ios/.build
npm pack --pack-destination "${DIST_DIR}" --silent >/dev/null
echo "  ✅ react-native-goat-webview packaged."

# ------------------------------------------------------------------------------
# 3. VSCode Extension VSIX Package
# ------------------------------------------------------------------------------
echo ""
echo "🧩 [3/7] Bundling VSCode Extension (.vsix)..."
cd "${WORKSPACE_DIR}/packages/vscode-extension"
npm run build
npx --yes @vscode/vsce package --no-dependencies --allow-missing-repository --skip-license -o "${DIST_DIR}/vscode-goat-1.0.0.vsix"
echo "  ✅ VSCode Extension: vscode-goat-1.0.0.vsix packaged successfully."

# ------------------------------------------------------------------------------
# 4. Standalone Native Binary (@goat/server)
# ------------------------------------------------------------------------------
echo ""
echo "⚡ [4/7] Compiling @goat/server Standalone Native Executable Binary..."
cd "${WORKSPACE_DIR}/packages/server"
if command -v bun >/dev/null 2>&1; then
  bun build --compile src/main.ts --outfile "${DIST_DIR}/goat-server"
  chmod +x "${DIST_DIR}/goat-server"
  echo "  ✅ Standalone Native Binary: ${DIST_DIR}/goat-server compiled."
else
  echo "  ⚠️ Bun not found on PATH; compiling with npx bun..."
  npx --yes bun build --compile src/main.ts --outfile "${DIST_DIR}/goat-server"
  chmod +x "${DIST_DIR}/goat-server"
  echo "  ✅ Standalone Native Binary: ${DIST_DIR}/goat-server compiled via npx."
fi

# ------------------------------------------------------------------------------
# 5. Android Native Publishing & Release AAR
# ------------------------------------------------------------------------------
echo ""
echo "🤖 [5/7] Building Android Core Release AAR & Publishing to Maven Local..."
cd "${WORKSPACE_DIR}/android"
chmod +x ./gradlew
./gradlew :core:publishToMavenLocal :core:bundleReleaseAar --no-daemon

if [ -f "${WORKSPACE_DIR}/android/core/build/outputs/aar/core-release.aar" ]; then
  cp "${WORKSPACE_DIR}/android/core/build/outputs/aar/core-release.aar" "${DIST_DIR}/goat-webview-core-1.0.0.aar"
  cp "${WORKSPACE_DIR}/android/core/build/outputs/aar/core-release.aar" "${DIST_DIR}/core-release.aar"
  echo "  ✅ Android Core Release AAR: goat-webview-core-1.0.0.aar packaged."
fi

# ------------------------------------------------------------------------------
# 6. iOS CocoaPods & Swift Package Distribution Bundle
# ------------------------------------------------------------------------------
echo ""
echo "🍎 [6/7] Bundling iOS Native CocoaPods / Swift Package Release Assets..."
GOAT_VERSION="$(node -e "process.stdout.write(require('${WORKSPACE_DIR}/react-native-goat-webview/package.json').version)")"
cd "${WORKSPACE_DIR}"
# Package.swift is at the repo root (SPM requirement); the podspec and sources are under ios/.
if ! zip -q -r "${DIST_DIR}/GoatWebView-ios-${GOAT_VERSION}.zip" \
  Package.swift \
  ios/GoatWebView.podspec \
  ios/Sources \
  ios/LICENSE; then
  echo "  ❌ Failed to package the iOS release bundle."
  exit 1
fi
echo "  ✅ iOS Library: GoatWebView-ios-${GOAT_VERSION}.zip packaged."

# ------------------------------------------------------------------------------
# 7. Flutter Plugin Distribution Archive
# ------------------------------------------------------------------------------
echo ""
echo "🎯 [7/7] Packaging Flutter Plugin Archive & Checksums..."
cd "${WORKSPACE_DIR}/goat_webview"
tar -czf "${DIST_DIR}/goat_webview-flutter-1.0.0.tar.gz" \
  --exclude=".dart_tool" \
  --exclude="build" \
  --exclude=".git" \
  pubspec.yaml \
  analysis_options.yaml \
  CHANGELOG.md \
  LICENSE \
  README.md \
  lib \
  android \
  ios \
  pigeons

echo "  ✅ Flutter Plugin: goat_webview-flutter-1.0.0.tar.gz packaged."

# ------------------------------------------------------------------------------
# 8. SHA-256 Checksums Manifest & Release Metadata
# ------------------------------------------------------------------------------
echo ""
echo "🔒 Computing SHA-256 Checksums & Generating Release Manifest..."
cd "${DIST_DIR}"
rm -f checksums.sha256 release-manifest.json

# Hash all release artifacts deterministically
find . -maxdepth 1 -type f ! -name "checksums.sha256" ! -name "release-manifest.json" | sed 's|^\./||' | sort | while read -r item; do
  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "${item}"
  else
    sha256sum "${item}"
  fi
done > "${DIST_DIR}/checksums.sha256"

cat "${DIST_DIR}/checksums.sha256"

cat << MANIFEST_EOF > "${DIST_DIR}/release-manifest.json"
{
  "project": "Goat WebView Multi-Platform Engine",
  "version": "1.0.0",
  "buildTimestamp": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "distributionDirectory": "${DIST_DIR}",
  "artifacts": [
$(find . -maxdepth 1 -type f ! -name "release-manifest.json" | sed 's|^\./||' | sort | while read -r item; do
  FILE_BYTES=$(wc -c < "${DIST_DIR}/${item}" | tr -d ' ')
  FILE_SHA=$(shasum -a 256 "${DIST_DIR}/${item}" 2>/dev/null | awk '{print $1}' || sha256sum "${DIST_DIR}/${item}" | awk '{print $1}')
  echo "    { \"file\": \"${item}\", \"bytes\": ${FILE_BYTES}, \"sha256\": \"${FILE_SHA}\" },"
done | sed '$ s/,$//')
  ]
}
MANIFEST_EOF

echo ""
echo "🔍 Validating all SHA-256 Checksums..."
(cd "${DIST_DIR}" && (shasum -c checksums.sha256 2>/dev/null || sha256sum -c checksums.sha256))
echo "  ✅ All checksums verified."

echo ""
echo "================================================================================"
echo "🎉 [Goat WebView] Production Release Artifacts Built & Verified Successfully!"
echo "📂 Output Location: ${DIST_DIR}"
ls -lh "${DIST_DIR}"
echo "================================================================================"
