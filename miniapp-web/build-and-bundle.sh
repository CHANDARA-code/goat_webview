#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo "=== 1. Building Vite React SPA & MiniApp Bridge SDK ==="
cd "${SCRIPT_DIR}"
npm run build

echo "=== 2. Creating miniapp.zip bundle ==="
cd "${SCRIPT_DIR}/dist"
rm -f "${SCRIPT_DIR}/miniapp.zip"
zip -r -q "${SCRIPT_DIR}/miniapp.zip" ./*
cd "${SCRIPT_DIR}"

SHA256_HASH=$(shasum -a 256 "${SCRIPT_DIR}/miniapp.zip" | awk '{print $1}')
FILE_SIZE=$(wc -c < "${SCRIPT_DIR}/miniapp.zip" | tr -d ' ')
echo "📦 Packaged miniapp.zip ($FILE_SIZE bytes)"
echo "🔑 SHA-256: $SHA256_HASH"

echo "=== 3. Distributing miniapp.zip to Multi-Ecosystem Host Showcase Apps ==="

# Android Jetpack Compose Host
ANDROID_ASSETS="${ROOT_DIR}/android/app/src/main/assets"
mkdir -p "$ANDROID_ASSETS"
cp -f "${SCRIPT_DIR}/miniapp.zip" "$ANDROID_ASSETS/miniapp.zip"
echo "  ✅ Android: $ANDROID_ASSETS/miniapp.zip"

# iOS SwiftUI Host
IOS_ASSETS="${ROOT_DIR}/ios/Example/Resources"
mkdir -p "$IOS_ASSETS"
cp -f "${SCRIPT_DIR}/miniapp.zip" "$IOS_ASSETS/miniapp.zip"
echo "  ✅ iOS: $IOS_ASSETS/miniapp.zip"

# Flutter Host
FLUTTER_ASSETS="${ROOT_DIR}/goat_webview/example/assets"
mkdir -p "$FLUTTER_ASSETS"
cp -f "${SCRIPT_DIR}/miniapp.zip" "$FLUTTER_ASSETS/miniapp.zip"
echo "  ✅ Flutter: $FLUTTER_ASSETS/miniapp.zip"

# React Native Host
RN_ASSETS="${ROOT_DIR}/react-native-goat-webview/example/assets"
mkdir -p "$RN_ASSETS"
cp -f "${SCRIPT_DIR}/miniapp.zip" "$RN_ASSETS/miniapp.zip"
echo "  ✅ React Native: $RN_ASSETS/miniapp.zip"

# Project root dist copy
mkdir -p "${ROOT_DIR}/dist"
cp -f "${SCRIPT_DIR}/miniapp.zip" "${ROOT_DIR}/dist/miniapp.zip"

echo "=== Asset Distribution Complete ==="
