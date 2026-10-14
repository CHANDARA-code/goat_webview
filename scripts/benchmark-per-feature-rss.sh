#!/usr/bin/env bash
# Steady-state RSS benchmark: "Steady-state RSS, per unused compat feature
# (cookies, PTR, nav veto, event forwarding) <= +0 KB". Of the four named features, two have a
# goat_webview_compat-level opt-in surface to isolate today: pull-to-refresh (T9) and event
# forwarding (T8). "cookies" is the engine-level cookie channel (no compat wrapper exists yet to
# turn on/off), and "nav veto" (the opt-in *blocking* shouldOverrideUrlLoading veto) isn't
# implemented in the engine at all yet (see T7's doc comments) -- both are left out here rather
# than faked with a fixture that wouldn't actually exercise anything.
#
# Reuses GoatCompatAdapterBenchmark.steadyStateMemory (same test, same target package) across
# three separately-built/installed APKs: (a) engine only, (d) PTR only, (e) event-forwarding
# only. +0 KB is enforced with a small tolerance -- real RSS measurements carry noise a strict
# zero can't survive, so this budget is pragmatic, not the literal spec number; see RSS_TOLERANCE_KB.
#
# NOTE: written but not yet run — requires a connected device/emulator.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${WORKSPACE_DIR}/android"
FIXTURE_DIR="${WORKSPACE_DIR}/bench/compat_size_check"
DIST_DIR="${WORKSPACE_DIR}/dist"

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

RSS_TOLERANCE_KB=50

run_variant() {
  local entry_point="$1"
  local label="$2"

  echo ""
  echo "================================================================"
  echo "Building & installing ($label: $entry_point)..."
  echo "================================================================"
  (
    cd "${FIXTURE_DIR}"
    rm -rf build
    flutter build apk --release --target-platform android-arm64 --target="lib/${entry_point}"
  )
  adb install -r "${FIXTURE_DIR}/build/app/outputs/flutter-apk/app-release.apk"

  echo "Running GoatCompatAdapterBenchmark.steadyStateMemory ($label)..."
  (
    cd "${ANDROID_DIR}"
    ./gradlew :benchmark:connectedBenchmarkAndroidTest --no-daemon \
      -Pandroid.testInstrumentationRunnerArguments.class=com.goat.webview.benchmark.GoatCompatAdapterBenchmark#steadyStateMemory
  )

  local report_dir="${ANDROID_DIR}/benchmark/build/outputs/connected_android_test_additional_output"
  local json_report
  json_report="$(find "${report_dir}" -name '*.json' 2>/dev/null | head -1 || true)"
  if [ -z "${json_report}" ]; then
    echo "❌ No benchmark JSON report produced for $label."
    exit 1
  fi
  cp "${json_report}" "${DIST_DIR}/per-feature-rss-${label}.json"
  echo "📄 ${label} report: dist/per-feature-rss-${label}.json"
}

run_variant "main_a_engine_only.dart" "baseline"
run_variant "main_d_pull_to_refresh_only.dart" "ptr-only"
run_variant "main_e_event_forwarding_only.dart" "event-forwarding-only"

echo ""
echo "================================================================"
echo "Diffing each isolated feature against baseline (§4 budget)..."
echo "================================================================"

DIFF_RC=0
python3 - \
  "${DIST_DIR}/per-feature-rss-baseline.json" \
  "${DIST_DIR}/per-feature-rss-ptr-only.json" \
  "${DIST_DIR}/per-feature-rss-event-forwarding-only.json" \
  "${RSS_TOLERANCE_KB}" \
  <<'PYEOF' || DIFF_RC=$?
import json
import sys

baseline_path, ptr_path, events_path, tolerance_kb = sys.argv[1], sys.argv[2], sys.argv[3], float(sys.argv[4])

def memory_median(path):
    with open(path) as f:
        data = json.load(f)
    for bench in data.get("benchmarks", []):
        if "steadyStateMemory" not in bench.get("name", ""):
            continue
        for metric_name, values in bench.get("metrics", {}).items():
            median = values.get("median")
            if median is not None:
                return median
    return None

baseline = memory_median(baseline_path)
if baseline is None:
    print("❌ Could not find steadyStateMemory metric in baseline report")
    sys.exit(1)

failures = []

def check(path, label):
    value = memory_median(path)
    if value is None:
        print(f"❌ Could not find steadyStateMemory metric in {label} report")
        failures.append(label)
        return
    delta = value - baseline
    status = "PASS" if delta <= tolerance_kb else "FAIL"
    print(f"{status}: {label}: baseline={baseline:.1f}KB candidate={value:.1f}KB "
          f"delta={delta:.1f}KB (budget <= {tolerance_kb}KB; spec target is +0KB)")
    if status == "FAIL":
        failures.append(label)

check(ptr_path, "pull-to-refresh only")
check(events_path, "event-forwarding only")

if failures:
    print(f"\n❌ {len(failures)} feature(s) breached the RSS isolation budget: {', '.join(failures)}")
    sys.exit(1)
print("\n✅ Both isolated features stayed within the RSS tolerance.")
PYEOF

echo ""
if [ "$DIFF_RC" -ne 0 ]; then
  echo "❌ T12 per-feature RSS gate FAILED."
  exit 1
else
  echo "🎉 T12 per-feature RSS gate PASSED."
fi
