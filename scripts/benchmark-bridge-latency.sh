#!/usr/bin/env bash
# Bridge latency benchmark: "Bridge round-trip latency p50/p95
# <= +0.1ms / +0.2ms". Builds and runs the two dedicated latency-probe entry points in
# bench/compat_size_check (main_bridge_latency_baseline.dart / _candidate.dart), each of which
# drives 200 sequential evaluateJavascript round trips and prints one `BENCHMARK` JSON line with
# the resulting p50Ms/p95Ms, then diffs candidate against baseline against the §4 budget.
#
# NOTE: written but not yet run — requires a connected device/emulator.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
FIXTURE_DIR="${WORKSPACE_DIR}/bench/compat_size_check"
DIST_DIR="${WORKSPACE_DIR}/dist"
PACKAGE_ID="com.goat.bench.compat_size_check"
ACTIVITY="${PACKAGE_ID}/.MainActivity"

mkdir -p "${DIST_DIR}"

if ! command -v adb >/dev/null 2>&1; then
  echo "❌ adb not found on PATH. Install Android platform-tools first."
  exit 1
fi

DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')"
if [ "$DEVICE_COUNT" -eq 0 ]; then
  echo "❌ No connected Android device/emulator. Start one and re-run."
  exit 1
fi

P50_BUDGET_MS=0.1
P95_BUDGET_MS=0.2

run_variant() {
  local entry_point="$1"
  local event_name="$2"
  local label="$3"

  echo ""
  echo "================================================================"
  echo "Building, installing & running ($label: $entry_point)..."
  echo "================================================================"
  (
    cd "${FIXTURE_DIR}"
    rm -rf build
    flutter build apk --debug --target="lib/${entry_point}"
  )
  adb install -r "${FIXTURE_DIR}/build/app/outputs/flutter-apk/app-debug.apk"
  adb shell am force-stop "${PACKAGE_ID}"
  adb logcat -c
  adb shell am start -n "${ACTIVITY}"

  # The loop is 200 sequential awaited round trips -- generous, fixed wait rather than a
  # polling loop, since this script isn't wired into a CI notification/event system.
  sleep 15

  local line
  line="$(adb logcat -d | grep "${event_name}" | tail -1 || true)"
  if [ -z "${line}" ]; then
    echo "❌ No '${event_name}' BENCHMARK line found in logcat for $label."
    exit 1
  fi
  echo "${line#*BENCHMARK }" > "${DIST_DIR}/bridge-latency-${label}.json"
  echo "📄 ${label}: $(cat "${DIST_DIR}/bridge-latency-${label}.json")"
}

run_variant "main_bridge_latency_baseline.dart" "bridge_latency_baseline" "baseline"
run_variant "main_bridge_latency_candidate.dart" "bridge_latency_candidate" "candidate"

echo ""
echo "================================================================"
echo "Diffing candidate against baseline (§4 budget)..."
echo "================================================================"

DIFF_RC=0
python3 - \
  "${DIST_DIR}/bridge-latency-baseline.json" \
  "${DIST_DIR}/bridge-latency-candidate.json" \
  "${P50_BUDGET_MS}" \
  "${P95_BUDGET_MS}" \
  <<'PYEOF' || DIFF_RC=$?
import json
import sys

with open(sys.argv[1]) as f:
    baseline = json.load(f)
with open(sys.argv[2]) as f:
    candidate = json.load(f)
p50_budget, p95_budget = float(sys.argv[3]), float(sys.argv[4])

failures = []

def check(key, budget):
    delta = candidate[key] - baseline[key]
    status = "PASS" if delta <= budget else "FAIL"
    print(f"{status}: {key}: baseline={baseline[key]:.4f}ms candidate={candidate[key]:.4f}ms "
          f"delta={delta:.4f}ms (budget <= {budget}ms)")
    if status == "FAIL":
        failures.append(key)

check("p50Ms", p50_budget)
check("p95Ms", p95_budget)

if failures:
    print(f"\n❌ {len(failures)} §4 budget(s) breached: {', '.join(failures)}")
    sys.exit(1)
print("\n✅ Bridge round-trip latency within §4 budget.")
PYEOF

echo ""
if [ "$DIFF_RC" -ne 0 ]; then
  echo "❌ T12 bridge-latency gate FAILED."
  exit 1
else
  echo "🎉 T12 bridge-latency gate PASSED."
fi
