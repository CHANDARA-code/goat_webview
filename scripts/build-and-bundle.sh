#!/usr/bin/env bash
set -e

# ==============================================================================
# Goat WebView Universal Library & Mini-App CI/CD Packaging Pipeline (Task 10112)
# ==============================================================================

echo "================================================================================"
echo "🚀 [Goat WebView] Packaging Universal Multi-Platform Libraries & Mini-App Bundles"
echo "================================================================================"

WORKSPACE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIST_DIR="${WORKSPACE_DIR}/dist"
MANIFEST_FILE="${DIST_DIR}/release-manifest.json"

mkdir -p "${DIST_DIR}"

echo "📦 [1/4] Compiling Web Mini-App & Bundling miniapp.zip..."
cd "${WORKSPACE_DIR}/miniapp-web"
npm run build
cd "${WORKSPACE_DIR}/miniapp-web/dist"
zip -q -r "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" .
mkdir -p "${WORKSPACE_DIR}/ios/Example/Resources"
mkdir -p "${WORKSPACE_DIR}/goat_webview/example/assets"
mkdir -p "${WORKSPACE_DIR}/react-native-goat-webview/example/assets"
cp -f "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" "${WORKSPACE_DIR}/ios/Example/Resources/miniapp.zip"
cp -f "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" "${WORKSPACE_DIR}/goat_webview/example/assets/miniapp.zip"
cp -f "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" "${WORKSPACE_DIR}/react-native-goat-webview/example/assets/miniapp.zip"
cp -f "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" "${DIST_DIR}/miniapp.zip"

# Compute SHA-256 Checksum
SHA256_HASH=$(shasum -a 256 "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" | awk '{print $1}')
FILE_SIZE=$(wc -c < "${WORKSPACE_DIR}/android/app/src/main/assets/miniapp.zip" | tr -d ' ')

echo "✨ Bundle Generated: ${FILE_SIZE} bytes (SHA-256: ${SHA256_HASH})"

echo "📱 [2/4] Validating Flutter Plugin Specification..."
cd "${WORKSPACE_DIR}/goat_webview"
flutter analyze --no-fatal-infos

echo "⚛️ [3/4] Validating React Native Package Manifest..."
cd "${WORKSPACE_DIR}/react-native-goat-webview"
npm run test -- --silent

echo "📝 [4/4] Generating Release Metadata & Integrity Manifest..."
cat <<EOF > "${MANIFEST_FILE}"
{
  "version": "1.0.0",
  "generatedAt": "$(date -u +"%Y-%m-%dT%H:%M:%SZ")",
  "artifacts": {
    "miniappZip": {
      "filename": "miniapp.zip",
      "sha256": "${SHA256_HASH}",
      "byteSize": ${FILE_SIZE}
    },
    "androidAar": {
      "module": ":android:app",
      "targetPackage": "com.goat.webview"
    },
    "reactNativePackage": {
      "name": "react-native-goat-webview",
      "version": "1.0.0"
    },
    "flutterPlugin": {
      "name": "goat_webview",
      "version": "1.0.0"
    }
  }
}
EOF

echo "================================================================================"
echo "✅ [Goat WebView] Universal Packaging Pipeline Completed Successfully!"
echo "📄 Manifest generated at: ${MANIFEST_FILE}"
echo "================================================================================"
