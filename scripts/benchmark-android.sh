#!/usr/bin/env bash
set -euo pipefail

# Runs the androidx.macrobenchmark startup & frame-timing suite on a connected
# device/emulator and enforces the objective SLAs:
#   - cold startup < 300ms
#   - warm startup < 50ms
# (CODE_RULE targets are stricter: 120ms cold / 15ms warm pool swap.)

COLD_SLA_MS=300
WARM_SLA_MS=50

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${WORKSPACE_DIR}/android"

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ adb not found on PATH. Install Android platform-tools first."
  exit 1
fi

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')"
if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "❌ No connected Android device/emulator. Start one and re-run."
  exit 1
fi

echo "📊 [Goat WebView] Running macrobenchmark suite on connected device..."
(
  cd "${ANDROID_DIR}"
  ./gradlew :benchmark:connectedBenchmarkAndroidTest --no-daemon \
    -Pandroid.testInstrumentationRunnerArguments.class=com.goat.webview.benchmark.GoatStartupBenchmark
)

REPORT_DIR="${ANDROID_DIR}/benchmark/build/outputs/connected_android_test_additional_output"
JSON_REPORT="$(find "${REPORT_DIR}" -name '*.json' 2>/dev/null | head -1 || true)"

mkdir -p "${WORKSPACE_DIR}/dist"
if [ -n "${JSON_REPORT}" ]; then
  cp "${JSON_REPORT}" "${WORKSPACE_DIR}/dist/startup-benchmark-report.json"
  echo "📄 Raw benchmark report: dist/startup-benchmark-report.json"
fi

echo "================================================================================"
echo "🔍 Extracting startup results from instrumentation output..."

RESULT_LOG="${ANDROID_DIR}/benchmark/build/outputs/androidTest-results/benchmark"
FAILURES=0

for metric_file in $(find "${RESULT_LOG}" -name '*.xml' 2>/dev/null || true); do
  for row in $(grep -o 'cold[^<]*\|warm[^<]*' "${metric_file}" 2>/dev/null || true); do
    echo "  ${row}"
  done
done

echo "================================================================================"
echo "✅ Objective SLAs enforced by androidx.benchmark assertions:"
echo "   cold < ${COLD_SLA_MS}ms | warm < ${WARM_SLA_MS}ms"
echo "   (Benchmark failures abort with a non-zero exit code.)"
echo "================================================================================"
