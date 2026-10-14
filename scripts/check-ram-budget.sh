#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

APK="${1:-${ROOT_DIR}/bench/goat_vs_fiw/apks/goatmu_loop_base.apk}"
PKG="${2:-com.goat.bench.bench_goat}"
MAX_PSS_MB="${3:-150}"

# A gate that cannot measure must not report success. Set GOAT_RAM_ALLOW_SKIP=1 to opt into
# skipping (exit 0) when no device or APK is available; without it, either is a hard failure.
ALLOW_SKIP="${GOAT_RAM_ALLOW_SKIP:-0}"

cannot_measure() {
  echo "SKIPPED: $1"
  if [ "$ALLOW_SKIP" = "1" ]; then
    echo "GOAT_RAM_ALLOW_SKIP=1 is set, so this is not being treated as a failure."
    echo "NOTE: no RAM measurement was taken. This run proves nothing about RAM."
    exit 0
  fi
  echo "FAIL: refusing to report a passing RAM budget without measuring it."
  echo "      Attach a device/emulator, or set GOAT_RAM_ALLOW_SKIP=1 to acknowledge the gap."
  exit 1
}

command -v adb >/dev/null 2>&1 || cannot_measure "adb is not on PATH."

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')"
[ "$DEVICE_COUNT" -gt 0 ] || cannot_measure "no connected Android device or emulator."

if [ ! -f "$APK" ]; then
  echo "APK not found at $APK — building it."
  if [ -x "${ROOT_DIR}/bench/goat_vs_fiw/scripts/build-goat-apk.sh" ]; then
    BENCH_LOOP=true bash "${ROOT_DIR}/bench/goat_vs_fiw/scripts/build-goat-apk.sh" "$(basename "$APK")" \
      || cannot_measure "APK build failed."
  else
    cannot_measure "APK is absent and no builder script is available."
  fi
fi
[ -f "$APK" ] || cannot_measure "APK still absent after the build step."

adb install -r -g -d "$APK" >/dev/null 2>&1 || adb install -r -g "$APK" >/dev/null
adb shell "cmd package compile -m speed -f $PKG" >/dev/null 2>&1

adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
sleep 2
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 22
adb shell am force-stop "$PKG" >/dev/null 2>&1 || true
sleep 3

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1
sleep 18

APP_MEM_DUMP="$(adb shell dumpsys meminfo --local "$PKG" 2>/dev/null | tr -d '\r')"

RENDERER_PID="$(adb shell 'ps -A -o PID,NAME 2>/dev/null' | tr -d '\r' \
  | grep -E "webview.*sandboxed_process|SandboxedProcessService" | awk '{print $1}' | head -n 1 || true)"
RENDERER_MEM_DUMP=""
if [ -n "$RENDERER_PID" ]; then
  RENDERER_MEM_DUMP="$(adb shell dumpsys meminfo --local "$RENDERER_PID" 2>/dev/null | tr -d '\r' || true)"
fi

adb shell am force-stop "$PKG" >/dev/null 2>&1 || true

python3 "${SCRIPT_DIR}/lib/ram_budget.py" "$MAX_PSS_MB" "$APP_MEM_DUMP" "$RENDERER_MEM_DUMP"
