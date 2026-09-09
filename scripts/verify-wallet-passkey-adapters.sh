#!/usr/bin/env bash
set -uo pipefail

# T16 — the whole wallet / passkey / vault vertical, in one gate.
#
# Deliberately runs the *narrow* suites rather than shelling out to verify-all.sh: this is meant to
# be runnable in a couple of minutes while working on this area, and to name exactly which layer
# broke. verify-all.sh remains the full gate.

echo "================================================================================"
echo "🔐 [Goat WebView] Wallet, Passkey & Vault Adapter Verification"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}"

PASSED=0
FAILED=0
SKIPPED=0

step() {
  local label="$1"; shift
  echo ""
  echo "▶ ${label}"
  if "$@" > /tmp/goat-wallet-step.log 2>&1; then
    echo "  ✅ ${label}"
    PASSED=$((PASSED + 1))
  else
    echo "  ❌ ${label}"
    tail -n 25 /tmp/goat-wallet-step.log | sed 's/^/     /'
    FAILED=$((FAILED + 1))
  fi
}

skip() {
  echo ""
  echo "▶ $1"
  echo "  ⏭️  skipped — $2"
  SKIPPED=$((SKIPPED + 1))
}

# ---------------------------------------------------------------- static gates
step "Bridge action parity (Android vs iOS)" node scripts/verify-action-parity.mjs
step "Injected Web3/passkey runtime is in sync and wired" node scripts/verify-web3-runtime-sync.mjs
step "Every test suite is run by some gate" node scripts/verify-suites-are-gated.mjs

# ---------------------------------------------------------------- android
if [ -x "./android/gradlew" ]; then
  step "Android: wallet SPI, chain decoders & confirmation gate" \
    ./android/gradlew -p android :feature-web3:testDebugUnitTest
  step "Android: Compose confirmation modal compiles (opt-in UI module)" \
    ./android/gradlew -p android :feature-web3-compose:assembleRelease
  step "Android: passkey engine, hardware vault & SOTER" \
    ./android/gradlew -p android :feature-biometrics:testDebugUnitTest
  step "Android: WeChat Pay & Alipay adapters" \
    ./android/gradlew -p android :feature-payments-wechat:testDebugUnitTest :feature-payments-alipay:testDebugUnitTest
  step "Android: core (gesture gate, manifest, payment gateway)" \
    ./android/gradlew -p android :core:testDebugUnitTest
  # The vault's REAL AndroidKeyStore path only exists on a device. Skipped, loudly, when none is
  # attached — never silently, or the hardware path looks covered when it is not.
  if command -v adb >/dev/null 2>&1 && [ -n "$(adb devices | tail -n +2 | grep -w device || true)" ]; then
    step "Android (on device): real KeyStore vault" \
      ./android/gradlew -p android :feature-biometrics:connectedDebugAndroidTest
  else
    skip "Android (on device): real KeyStore vault" "no device or emulator attached to adb"
  fi
else
  skip "Android suites" "no ./android/gradlew on this checkout"
fi

# ---------------------------------------------------------------- ios
if command -v xcodebuild >/dev/null 2>&1; then
  DEVICE_ID="$(xcrun simctl list devices available 2>/dev/null | grep -E 'iPhone' | head -n 1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/' || true)"
  if [ -n "${DEVICE_ID}" ]; then
    DESTINATION="id=${DEVICE_ID}"
  else
    DESTINATION="generic/platform=iOS Simulator"
  fi
  step "iOS: wallet SPI, chain decoders, passkey engine & confirmation gate" \
    xcodebuild test -scheme GoatWebView-Package -destination "${DESTINATION}" \
      -derivedDataPath .derivedData \
      -only-testing:GoatWebViewTests/GoatWeb3WalletManagerTests \
      -only-testing:GoatWebViewTests/GoatWeb3DecoderTests \
      -only-testing:GoatWebViewTests/GoatWeb3ConfirmGateTests \
      -only-testing:GoatWebViewTests/GoatPasskeyTests \
      -only-testing:GoatWebViewTests/GoatVaultKeychainTests
else
  skip "iOS suites" "xcodebuild not on PATH"
fi

# ---------------------------------------------------------------- javascript
step "Web: injected providers, WebAuthn polyfill & goat.vault" \
  npm --prefix miniapp-web test
step "Bridge mock: catalog parity & the A1-A10 adversarial suite" \
  npm --prefix packages/bridge-mock test

# T16's second half. Skips its own device-dependent step loudly when no device is attached.
step "Latency budgets (WebAuthn serialization, BOC parse, bridge round-trip)" \
  bash scripts/benchmark-wallet-passkey-latency.sh

echo ""
echo "================================================================================"
echo "  passed: ${PASSED}   failed: ${FAILED}   skipped: ${SKIPPED}"
if [ "${FAILED}" -gt 0 ]; then
  echo "❌ Wallet/passkey verification FAILED."
  echo "================================================================================"
  exit 1
fi
echo "✅ Wallet, passkey and vault adapters verified."
echo "================================================================================"
