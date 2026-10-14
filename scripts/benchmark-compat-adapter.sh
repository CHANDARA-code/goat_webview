#!/usr/bin/env bash
# Compat adapter benchmark: builds the two
# bench/compat_size_check variants (engine-only baseline, adapter-fully-used
# candidate), runs GoatCompatAdapterBenchmark against each, and fails the
# build if the candidate breaches any §4 budget relative to the baseline
# or breaches the revised <= 150 MB app-process steady-state RAM ceiling.
# Also verifies zero memory leak growth across 100 mount/unmount cycles
# via goat_webview_compat/test/mount_unmount_leak_test.dart.
#
# NOTE: physical device is required for official release numbers.
# Can be run against an emulator or in mock mode (--mock / --dry-run)
# to smoke-test harness plumbing and budget math.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${WORKSPACE_DIR}/android"
FIXTURE_DIR="${WORKSPACE_DIR}/bench/compat_size_check"
DIST_DIR="${WORKSPACE_DIR}/dist"

mkdir -p "${DIST_DIR}"

ALLOW_SKIP="${GOAT_BENCHMARK_ALLOW_SKIP:-0}"
DRY_RUN="${GOAT_BENCH_DRY_RUN:-0}"
MOCK_MODE="${GOAT_BENCH_MOCK:-0}"
LEAK_TEST_ONLY=0
SKIP_LEAK_TEST=0
MAX_STEADY_STATE_RAM_MB="${MAX_STEADY_STATE_RAM_MB:-150.0}" # revised <= 150 MB app-process steady-state RAM ceiling

usage() {
  cat <<EOF
Usage: $(basename "$0") [options]

Options:
  --leak-test-only    Run only the 100-cycle mount/unmount leak test and exit
  --skip-leak-test    Skip the 100-cycle leak test
  --dry-run, --mock   Run mock benchmark evaluation without requiring a device
  --ceiling-mb <MB>   Set steady-state RAM ceiling in MB (default: 150.0)
  -h, --help          Show this help message
EOF
  exit 0
}

while [ $# -gt 0 ]; do
  case "$1" in
    --leak-test-only)
      LEAK_TEST_ONLY=1
      shift
      ;;
    --skip-leak-test)
      SKIP_LEAK_TEST=1
      shift
      ;;
    --dry-run|--mock)
      DRY_RUN=1
      MOCK_MODE=1
      shift
      ;;
    --ceiling-mb)
      shift
      MAX_STEADY_STATE_RAM_MB="$1"
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      echo "Unknown option: $1"
      usage
      ;;
  esac
done

cannot_measure() {
  echo "SKIPPED: $1"
  if [ "$ALLOW_SKIP" = "1" ]; then
    echo "GOAT_BENCHMARK_ALLOW_SKIP=1 is set, so this is not being treated as a failure."
    echo "NOTE: no benchmark measurement was taken. This run proves nothing about perf."
    exit 0
  fi
  echo "FAIL: refusing to report a passing benchmark without measuring it."
  echo "      Attach a device/emulator, run with --mock, or set GOAT_BENCHMARK_ALLOW_SKIP=1 to acknowledge the gap."
  exit 1
}

# 1. Zero Memory Leak Growth across 100 Mount/Unmount Cycles
if [ "$SKIP_LEAK_TEST" -eq 0 ]; then
  echo ""
  echo "================================================================"
  echo "Running 100-cycle mount/unmount zero memory leak growth verification..."
  echo "================================================================"
  if ! ( cd "${WORKSPACE_DIR}/goat_webview_compat" && flutter test test/mount_unmount_leak_test.dart ); then
    echo "❌ 100-cycle mount/unmount memory leak verification FAILED."
    exit 1
  fi
  echo "✅ 100-cycle mount/unmount zero memory leak growth verified."

  if [ "$LEAK_TEST_ONLY" -eq 1 ]; then
    echo "🎉 Leak test verification completed (--leak-test-only)."
    exit 0
  fi
fi

# Budgets from §4 (candidate - baseline).
COLD_STARTUP_BUDGET_PCT=1.0
WARM_STARTUP_BUDGET_MS=0.5
MEMORY_BUDGET_KB=1024   # "all compat features active" row: <= +1.0 MB delta

if [ "$DRY_RUN" -eq 1 ] || [ "$MOCK_MODE" -eq 1 ]; then
  echo ""
  echo "================================================================"
  echo "Running in mock / dry-run mode (generating mock benchmark reports)..."
  echo "================================================================"
  cat <<'EOF' > "${DIST_DIR}/compat-adapter-benchmark-baseline.json"
{
  "benchmarks": [
    {
      "name": "coldStartup",
      "metrics": { "timeToInitialDisplayMs": { "median": 250.0 } }
    },
    {
      "name": "warmStartup",
      "metrics": { "timeToInitialDisplayMs": { "median": 45.0 } }
    },
    {
      "name": "steadyStateMemory",
      "metrics": { "memoryRssAnonLastKb": { "median": 142000.0 } }
    }
  ]
}
EOF
  cat <<'EOF' > "${DIST_DIR}/compat-adapter-benchmark-candidate.json"
{
  "benchmarks": [
    {
      "name": "coldStartup",
      "metrics": { "timeToInitialDisplayMs": { "median": 252.0 } }
    },
    {
      "name": "warmStartup",
      "metrics": { "timeToInitialDisplayMs": { "median": 45.2 } }
    },
    {
      "name": "steadyStateMemory",
      "metrics": { "memoryRssAnonLastKb": { "median": 142800.0 } }
    }
  ]
}
EOF
  echo "📄 Generated mock reports in dist/"
else
  if ! command -v adb >/dev/null 2>&1; then
    cannot_measure "adb not found on PATH. Install Android platform-tools first."
  fi

  DEVICE_COUNT="$(adb devices | awk 'NR>1 && $2=="device" {count++} END {print count+0}')"
  if [ "$DEVICE_COUNT" -eq 0 ]; then
    cannot_measure "no connected Android device or emulator."
  fi

  run_variant() {
    local entry_point="$1"
    local label="$2"

    echo ""
    echo "================================================================"
    echo "Building & installing compat_size_check ($label: $entry_point)..."
    echo "================================================================"
    (
      cd "${FIXTURE_DIR}"
      rm -rf build
      flutter build apk --release --target-platform android-arm64 --target="lib/${entry_point}"
    )
    adb install -r "${FIXTURE_DIR}/build/app/outputs/flutter-apk/app-release.apk"

    echo "Running GoatCompatAdapterBenchmark ($label)..."
    (
      cd "${ANDROID_DIR}"
      ./gradlew :benchmark:connectedBenchmarkAndroidTest --no-daemon \
        -Pandroid.testInstrumentationRunnerArguments.class=com.goat.webview.benchmark.GoatCompatAdapterBenchmark
    )

    local report_dir="${ANDROID_DIR}/benchmark/build/outputs/connected_android_test_additional_output"
    local json_report
    json_report="$(find "${report_dir}" -name '*.json' 2>/dev/null | head -1 || true)"
    if [ -z "${json_report}" ]; then
      echo "❌ No benchmark JSON report produced for $label."
      exit 1
    fi
    cp "${json_report}" "${DIST_DIR}/compat-adapter-benchmark-${label}.json"
    echo "📄 ${label} report: dist/compat-adapter-benchmark-${label}.json"
  }

  run_variant "main_a_engine_only.dart" "baseline"
  run_variant "main_c_adapter_used.dart" "candidate"
fi

echo ""
echo "================================================================"
echo "Diffing candidate against baseline (§4 budgets & ≤ ${MAX_STEADY_STATE_RAM_MB} MB ceiling)..."
echo "================================================================"

DIFF_RC=0
python3 - \
  "${DIST_DIR}/compat-adapter-benchmark-baseline.json" \
  "${DIST_DIR}/compat-adapter-benchmark-candidate.json" \
  "${COLD_STARTUP_BUDGET_PCT}" \
  "${WARM_STARTUP_BUDGET_MS}" \
  "${MEMORY_BUDGET_KB}" \
  "${MAX_STEADY_STATE_RAM_MB}" \
  "${WORKSPACE_DIR}" \
  <<'PYEOF' || DIFF_RC=$?
import json
import os
import sys

baseline_path, candidate_path = sys.argv[1], sys.argv[2]
cold_budget_pct = float(sys.argv[3]) if len(sys.argv) > 3 else 1.0
warm_budget_ms = float(sys.argv[4]) if len(sys.argv) > 4 else 0.5
mem_budget_kb = float(sys.argv[5]) if len(sys.argv) > 5 else 1024.0
max_ram_ceiling_mb = float(sys.argv[6]) if len(sys.argv) > 6 else 150.0
workspace_dir = sys.argv[7] if len(sys.argv) > 7 else "."

sys.path.insert(0, os.path.join(workspace_dir, "scripts", "lib"))
try:
    import ram_budget
except ImportError:
    ram_budget = None

def load_medians(path):
    """androidx.benchmark's connected-test JSON: {"benchmarks": [{"name", "metrics": {metric: {"median": ...}}}]}."""
    with open(path) as f:
        data = json.load(f)
    out = {}
    for bench in data.get("benchmarks", []):
        name = bench.get("name", "")
        metrics = bench.get("metrics", {})
        for metric_name, values in metrics.items():
            median = values.get("median")
            if median is not None:
                out[f"{name}/{metric_name}"] = median
    return out

baseline = load_medians(baseline_path)
candidate = load_medians(candidate_path)

failures = []

def check(key_substr, budget, label, is_pct=False):
    # Exact keys, not "first key containing X". MemoryUsageMetric emits THREE steadyStateMemory
    # metrics (memoryHeapSizeLastKb / memoryRssAnonLastKb / memoryRssFileLastKb); substring
    # matching silently picked the heap one (~3.8 MB), against which a 150 MB ceiling can never
    # fail. A missing metric is a FAILURE, never a SKIP -- a skip is how a gate passes vacuously.
    b_key = key_substr if key_substr in baseline else None
    c_key = key_substr if key_substr in candidate else None
    if b_key is None or c_key is None:
        print(f"FAIL: {label} -- metric '{key_substr}' missing from "
              f"{'baseline' if b_key is None else 'candidate'} report; "
              f"available: {sorted(baseline if b_key is None else candidate)}")
        failures.append(f"{label} (metric '{key_substr}' not measured)")
        return
    b_val, c_val = baseline[b_key], candidate[c_key]
    delta = c_val - b_val
    if is_pct:
        pct = (delta / b_val * 100) if b_val else 0.0
        status = "PASS" if pct <= budget else "FAIL"
        print(f"{status}: {label}: baseline={b_val:.3f} candidate={c_val:.3f} delta={pct:.2f}% (budget <= {budget}%)")
        if status == "FAIL":
            failures.append(label)
    else:
        status = "PASS" if delta <= budget else "FAIL"
        print(f"{status}: {label}: baseline={b_val:.3f} candidate={c_val:.3f} delta={delta:.3f} (budget <= {budget})")
        if status == "FAIL":
            failures.append(label)

COLD_KEY = "coldStartup/timeToInitialDisplayMs"
WARM_KEY = "warmStartup/timeToInitialDisplayMs"
# Resident anonymous memory is the row §4 means by "steady-state RSS"; heap alone understates it
# by ~20x and file-backed pages are shared, not attributable to the adapter.
MEM_KEY = "steadyStateMemory/memoryRssAnonLastKb"

check(COLD_KEY, cold_budget_pct, "Cold start to FCP", is_pct=True)
check(WARM_KEY, warm_budget_ms, "Warm start")
check(MEM_KEY, mem_budget_kb, "Steady-state RSS delta (all features active)")

# Absolute steady-state RAM ceiling assertion (<= 150 MB)
c_mem_key = MEM_KEY if MEM_KEY in candidate else None
if c_mem_key is not None:
    cand_kb = candidate[c_mem_key]
    cand_mb = cand_kb / 1024.0
    if ram_budget is not None:
        verdict, app_mb, _, lines = ram_budget.evaluate_pss(cand_mb, ceiling_mb=max_ram_ceiling_mb)
        print("\n" + "\n".join(lines))
        if verdict != ram_budget.PASS:
            failures.append(f"Candidate steady-state RAM ceiling ({cand_mb:.2f} MB > {max_ram_ceiling_mb:.1f} MB)")
    else:
        if cand_mb <= max_ram_ceiling_mb:
            headroom = max_ram_ceiling_mb - cand_mb
            print(f"PASS: Candidate steady-state RAM: {cand_mb:.2f} MB (ceiling <= {max_ram_ceiling_mb:.1f} MB, headroom={headroom:.2f} MB)")
        else:
            print(f"FAIL: Candidate steady-state RAM: {cand_mb:.2f} MB exceeds {max_ram_ceiling_mb:.1f} MB ceiling")
            failures.append(f"Candidate steady-state RAM ceiling ({cand_mb:.2f} MB > {max_ram_ceiling_mb:.1f} MB)")
else:
    print(f"FAIL: Steady-state RAM ceiling -- '{MEM_KEY}' not found in candidate report")
    failures.append("Steady-state RAM ceiling (metric not measured)")

if failures:
    print(f"\n❌ {len(failures)} §4 / RAM budget(s) breached: {', '.join(failures)}")
    sys.exit(1)
print("\n✅ All measured §4 performance deltas and RAM budget ceiling within thresholds.")
PYEOF

echo ""
if [ "$DIFF_RC" -ne 0 ]; then
  echo "❌ T12 perf/RAM budget gate FAILED."
  exit 1
else
  echo "🎉 T12 perf/RAM budget gate PASSED."
fi
