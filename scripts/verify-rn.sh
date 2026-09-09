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

echo "📥 [React Native] Installing react-native-goat-webview dependencies..."
npm install --no-audit --no-fund --silent
echo "🔨 [React Native] Typechecking react-native-goat-webview (npm run build)..."
npm run build
echo "✅ [React Native] react-native-goat-webview TypeScript build and types passed."

echo ""
echo "🧪 [React Native] Running TurboModule & Fabric Jest tests..."
npm test -- --silent
echo "✅ [React Native] TurboModule & Fabric Jest tests passed."

# The jest run covers tests. TypeScript typechecks, zero-retention lint tests, and size budgets
# must be machine-checked so regressions cannot enter main.
# react-native-goat-webview-compat is the drop-in react-native-webview replacement.
COMPAT_DIR="${WORKSPACE_DIR}/react-native-goat-webview-compat"
if [ -f "${COMPAT_DIR}/package.json" ]; then
  echo ""
  echo "📥 [React Native] Installing react-native-goat-webview-compat dependencies..."
  ( cd "${COMPAT_DIR}" && npm install --no-audit --no-fund --silent )
  echo "🔨 [React Native] Typechecking react-native-goat-webview-compat (npm run build)..."
  ( cd "${COMPAT_DIR}" && npm run build )
  echo "✅ [React Native] compat adapter TypeScript typecheck passed."

  echo ""
  # Critical suites that must always be executed:
  #   src/__tests__/mountUnmountLeak.test.tsx — 100-cycle mount/unmount leak & zero-retention verification
  #   src/__tests__/WebView.test.tsx           — component lifecycle & creation-prop mapping
  #   src/__tests__/cookies.test.ts            — multi-tenant CookieManager isolation
  #   src/__tests__/toCreationProps.test.ts    — prop-to-primitive purity (G1 enforcement)
  echo "🔁 [React Native] Running react-native-goat-webview-compat tests (including 100-cycle leak suite: src/__tests__/mountUnmountLeak.test.tsx)..."
  ( cd "${COMPAT_DIR}" && npm test -- --silent )
  # Verify the leak test file is present so this gate cannot silently be skipped if the file is removed.
  if [ ! -f "${COMPAT_DIR}/src/__tests__/mountUnmountLeak.test.tsx" ]; then
    echo "❌ Error: src/__tests__/mountUnmountLeak.test.tsx is missing — the 100-cycle leak suite must always be present."
    exit 1
  fi
  echo "✅ [React Native] compat adapter tests passed (mountUnmountLeak.test.tsx confirmed present)."

  echo ""
  echo "🛡️  [React Native] Running ESLint zero-retention rule test (npm run test:lint-rule)..."
  ( cd "${COMPAT_DIR}" && npm run test:lint-rule )
  echo "✅ [React Native] zero-retention lint rule test passed."

  echo ""
  echo "📦 [React Native] Verifying bundle size budget & tree-shaking (npm run check:size)..."
  ( cd "${COMPAT_DIR}" && npm run check:size )
  echo "✅ [React Native] bundle size budget and tree-shaking verified."
fi

echo ""
echo "🤖 [React Native] Compiling the Android native module..."
GRADLEW="${WORKSPACE_DIR}/android/gradlew"
if [ -x "$GRADLEW" ]; then
  # Run with --project-dir so the module is its own root project; react-android resolves from
  # Maven, so this needs no react-native install.
  ( cd "${WORKSPACE_DIR}/react-native-goat-webview/android" && "$GRADLEW" --project-dir . compileDebugKotlin --console=plain -q )
  echo "✅ [React Native] Android native module compiles."
else
  echo "❌ Error: ${GRADLEW} not found; cannot compile the RN Android module."
  exit 1
fi

echo ""
echo "🍎 [React Native] Parsing the iOS native sources..."
if command -v xcrun >/dev/null 2>&1 && xcrun --find swiftc >/dev/null 2>&1; then
  for SWIFT_FILE in "${WORKSPACE_DIR}"/react-native-goat-webview/ios/*.swift; do
    xcrun swiftc -parse "$SWIFT_FILE" >/dev/null
  done
  # Syntax only: a full typecheck needs the React headers, which come from a pod install in a host
  # app. This still catches the syntax breakage that previously reached main unchallenged.
  echo "✅ [React Native] iOS sources parse (syntax only, not typechecked)."
else
  echo "⏭️  swiftc unavailable (non-macOS runner); skipping the iOS parse."
fi
