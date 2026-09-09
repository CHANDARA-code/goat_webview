#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🐐 [Goat WebView] Master Full-Stack Monorepo Quality & Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo ""
echo "🔀 [1/9] Bridge Action Parity (Android vs iOS)..."
node "${WORKSPACE_DIR}/scripts/verify-action-parity.mjs"

echo ""
echo "🚦 Every test suite is run by some gate..."
node "${WORKSPACE_DIR}/scripts/verify-suites-are-gated.mjs"

echo ""
echo "🧩 Companion action backing (Flutter + RN)..."
node "${WORKSPACE_DIR}/scripts/verify-companion-actions.mjs"

echo ""
echo "🪙 Injected Web3 runtime is in sync with miniapp-web/src/injected/ and wired on both platforms..."
# The sync check bundles miniapp-web/src/injected via miniapp-web's esbuild, so its deps
# must be present before this step (it runs before the miniapp-web test step below).
( cd "${WORKSPACE_DIR}/miniapp-web" && npm install --no-audit --no-fund --silent )
node "${WORKSPACE_DIR}/scripts/verify-web3-runtime-sync.mjs"

echo ""
echo "🌐 Web SDK (miniapp-web) tests..."
# No gate ran these before 2026-09-06, which is how two stale-duplicate syntax errors sat in
# useGoatLifecycle.ts and goat-hooks.test.ts long enough to block all 82 tests from ever building.
( cd "${WORKSPACE_DIR}/miniapp-web" && npm test )

echo ""
echo "🔎 Unwired-symbol review (advisory, never fails the run)..."
python3 "${WORKSPACE_DIR}/scripts/find-unwired-symbols.py" || true

echo ""
echo "🧪 [2/9] Android Core Engine & Host Tests..."
bash "${WORKSPACE_DIR}/scripts/verify-android.sh"

echo ""
echo "📱 [3/9] iOS Core Engine & Bridge Tests..."
bash "${WORKSPACE_DIR}/scripts/verify-ios.sh"

echo ""
echo "⚛️  [4/9] React Native TurboModule & Fabric Tests..."
bash "${WORKSPACE_DIR}/scripts/verify-rn.sh"

echo ""
echo "🎯 [5/9] Flutter PlatformView & MethodChannel Tests..."
bash "${WORKSPACE_DIR}/scripts/verify-flutter.sh"

echo ""
echo "🌐 [6/9] Web Mini-App & JS Bridge Tests..."
bash "${WORKSPACE_DIR}/scripts/verify-web.sh"

echo ""
echo "📦 [7/9] Monorepo Tooling Packages Verification (11 Packages)..."

PACKAGES_OK=0
PACKAGES_FAIL=0

# --- 1. @goat/appservice ---
echo "🔵 [1/10] @goat/appservice..."
if (cd "${WORKSPACE_DIR}/packages/appservice" && npm test); then
  echo "  ✅ @goat/appservice tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/appservice tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 2. @goat/server ---
echo "🔵 [2/10] @goat/server..."
if (cd "${WORKSPACE_DIR}/packages/server" && npm test); then
  echo "  ✅ @goat/server tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/server tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 3. @goat/bridge-mock ---
echo "🔵 [3/10] @goat/bridge-mock..."
if (cd "${WORKSPACE_DIR}/packages/bridge-mock" && npm test); then
  echo "  ✅ @goat/bridge-mock tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/bridge-mock tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 4. @goat/cli ---
echo "🔵 [4/10] @goat/cli..."
if (cd "${WORKSPACE_DIR}/packages/cli" && node --experimental-strip-types --test test/cli.test.ts); then
  echo "  ✅ @goat/cli tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/cli tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 5. @goat/playground ---
echo "🔵 [5/10] @goat/playground..."
if (cd "${WORKSPACE_DIR}/packages/playground" && npm test); then
  echo "  ✅ @goat/playground tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/playground tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 6. vscode-goat ---
echo "🔵 [6/10] vscode-goat (@goat/vscode-extension)..."
if (cd "${WORKSPACE_DIR}/packages/vscode-extension" && npm test); then
  echo "  ✅ vscode-goat tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ vscode-goat tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 7. @goat/devtools ---
echo "🔵 [7/10] @goat/devtools..."
if (cd "${WORKSPACE_DIR}/packages/devtools" && npm test && npm run test:e2e); then
  echo "  ✅ @goat/devtools tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/devtools tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 8. @goat/core ---
echo "🔵 [8/10] @goat/core..."
if (cd "${WORKSPACE_DIR}/packages/core" && bun test); then
  echo "  ✅ @goat/core tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/core tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 9. @goat/compiler-taro ---
echo "🔵 [9/10] @goat/compiler-taro..."
if (cd "${WORKSPACE_DIR}/packages/compiler-taro" && npm test); then
  echo "  ✅ @goat/compiler-taro tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/compiler-taro tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

# --- 10. @goat/compiler-uniapp ---
echo "🔵 [10/10] @goat/compiler-uniapp..."
if (cd "${WORKSPACE_DIR}/packages/compiler-uniapp" && npm test); then
  echo "  ✅ @goat/compiler-uniapp tests passed."
  PACKAGES_OK=$((PACKAGES_OK + 1))
else
  echo "  ❌ @goat/compiler-uniapp tests FAILED."
  PACKAGES_FAIL=$((PACKAGES_FAIL + 1))
fi

if [ "$PACKAGES_FAIL" -gt 0 ]; then
  echo "❌ [Packages] ${PACKAGES_FAIL} package(s) failed. ${PACKAGES_OK} passed."
  exit 1
else
  echo "✅ [Packages] All 10 monorepo tooling packages passed (10/10)."
fi

echo ""
echo "🛡️  [8/9] Enterprise Zero-Trust & Adversarial Fuzzing..."
if (cd "${WORKSPACE_DIR}" && GOAT_SKIP_NATIVE_RERUN=1 bash "${WORKSPACE_DIR}/scripts/run-security-fuzz.sh"); then
  echo "  ✅ Enterprise Zero-Trust Security & Fuzzing suite passed."
else
  echo "  ❌ Enterprise Zero-Trust Security suite FAILED."
  exit 1
fi

echo ""
echo "🔗 [9/9] Master 4-Tier & Cross-MiniApp E2E Suites..."
if (cd "${WORKSPACE_DIR}" && bash "${WORKSPACE_DIR}/scripts/verify-e2e.sh"); then
  echo "  ✅ Master 4-Tier E2E suite passed."
else
  echo "  ❌ Master 4-Tier E2E suite FAILED."
  exit 1
fi
if (cd "${WORKSPACE_DIR}" && node --experimental-strip-types "${WORKSPACE_DIR}/tests/e2e/cross-miniapp/run-cross-miniapp.ts"); then
  echo "  ✅ Task 10201 Cross-MiniApp E2E suite passed."
else
  echo "  ❌ Task 10201 Cross-MiniApp E2E suite FAILED."
  exit 1
fi

echo ""
echo "================================================================================"
echo "🎉 [Goat WebView] 100% Master Test Infrastructure & Quality Gates Verified!"
echo "================================================================================"
