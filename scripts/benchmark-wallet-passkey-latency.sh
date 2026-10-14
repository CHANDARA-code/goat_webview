#!/usr/bin/env bash
set -uo pipefail

# Latency budgets for the wallet, passkey and vault vertical:
#
#   1. WebAuthn ArrayBuffer serialization  < 1 ms  for a 10 KB payload
#   2. TON BOC parsing                     < 3 ms  for a 1 KB cell slice
#   3. Bridge round-trip (warm path)       < 5 ms
#
# Deliberately separate from scripts/benchmark-bridge-latency.sh, which belongs to the compat
# adapter benchmark, measures a different thing, and needs a
# Flutter APK on a device.
#
# (1) and (2) run off-device against the real implementations. (3) needs a device and SKIPS LOUDLY
# without one — a latency gate that silently reports nothing is worse than no gate.

echo "================================================================================"
echo "⏱  [Goat WebView] Wallet / Passkey / Vault Latency Budgets"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}"

PASSED=0
FAILED=0
SKIPPED=0

# ------------------------------------------------------- 1. WebAuthn serialization (< 1 ms @ 10 KB)
echo ""
echo "▶ [1/3] WebAuthn ArrayBuffer serialization — budget < 1 ms @ 10 KB"
if GOAT_ENFORCE_LATENCY_SLA=1 npm --prefix miniapp-web test > /tmp/goat-bench-webauthn.log 2>&1; then
  grep -E "ms/call" /tmp/goat-bench-webauthn.log | sed 's/^/    /'
  echo "  ✅ within budget"
  PASSED=$((PASSED + 1))
else
  echo "  ❌ over budget or suite failed"
  grep -E "ms/call|over the 1ms budget" /tmp/goat-bench-webauthn.log | tail -5 | sed 's/^/    /'
  FAILED=$((FAILED + 1))
fi

# --------------------------------------------------------------- 2. TON BOC parse (< 3 ms @ 1 KB)
echo ""
echo "▶ [2/3] TON BOC parsing — budget < 3 ms @ 1 KB cell"
if [ -x "./android/gradlew" ]; then
  if ./android/gradlew -p android :feature-web3:testDebugUnitTest \
       --tests '*TonBocParserTest*' > /tmp/goat-bench-boc.log 2>&1; then
    echo "    TonBocParserTest.testParsingIsBoundedInTimeForTheLargestLegalPayload asserts < 3 ms/parse"
    echo "  ✅ within budget"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ over budget or suite failed"
    grep -E "budget|FAILED" /tmp/goat-bench-boc.log | tail -5 | sed 's/^/    /'
    FAILED=$((FAILED + 1))
  fi
else
  echo "  ⏭️  skipped — no ./android/gradlew on this checkout"
  SKIPPED=$((SKIPPED + 1))
fi

# ------------------------------------------------------------ 3. Bridge round-trip (< 5 ms warm)
echo ""
echo "▶ [3/3] Bridge round-trip warm path — budget < 5 ms"
if command -v adb >/dev/null 2>&1 && [ -n "$(adb devices | tail -n +2 | grep -w device || true)" ]; then
  # BRIDGE_PING is the engine's zero-dispatch probe: the first branch of executeAction, returning
  # before any manager access, permission check or abuse-guard evaluation. Note this is the NATIVE
  # handler round trip — it excludes the JS-to-native WebMessageListener hop, so treat it as a
  # floor for the full round trip, not the whole of it.
  adb logcat -c >/dev/null 2>&1 || true
  if ./android/gradlew -p android :core:connectedDebugAndroidTest \
       -Pandroid.testInstrumentationRunnerArguments.class=com.goat.webview.GoatBridgeLatencyInstrumentedTest \
       > /tmp/goat-bench-rt.log 2>&1; then
    adb logcat -d 2>/dev/null | grep -oE "BENCHMARK (bridge_ping_native_dispatch|unknown_action_rejection).*" \
      | tail -2 | sed 's/^/    /'
    echo "  ✅ within budget (native dispatch; excludes the JS->native hop)"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ over budget or the on-device suite failed"
    grep -E "budget|FAILED" /tmp/goat-bench-rt.log | tail -5 | sed 's/^/    /'
    FAILED=$((FAILED + 1))
  fi
else
  echo "  ⏭️  skipped — no device or emulator attached to adb"
  SKIPPED=$((SKIPPED + 1))
fi

echo ""
echo "================================================================================"
echo "  passed: ${PASSED}   failed: ${FAILED}   skipped: ${SKIPPED}"
if [ "${FAILED}" -gt 0 ]; then
  echo "❌ Latency budget(s) breached."
  echo "================================================================================"
  exit 1
fi
echo "✅ Wallet / passkey latency budgets met (${SKIPPED} measurement(s) skipped, see above)."
echo "================================================================================"
