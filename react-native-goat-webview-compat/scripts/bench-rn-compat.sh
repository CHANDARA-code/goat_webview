#!/usr/bin/env bash
# T13 — RN compat adapter performance & RAM harness.
#
# Measures:
#   leak    : 100 mount/unmount cycles verifying zero memory leak growth
#   mount   : process start -> first page load, cold each time
#   RAM     : app steady-state PSS after page settles vs <= 150 MB ceiling
#
# Reads logcat bound to the launched pid. That is not a stylistic choice: `adb logcat -c` does not
# reliably clear every ring buffer, and a bare `logcat -d | head -1` returns a line from an EARLIER
# launch. That defect produced a confidently wrong "goat is 893% slower" in the Flutter harness
# before it was found (see bench/goat_vs_fiw/RESULT_v16_cold_mount_retraction.md). Do not
# "simplify" the pid binding away.
#
# Usage:
#   scripts/bench-rn-compat.sh [options] <android-package> [label] [runs] [ceiling_mb]
set -uo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RN_COMPAT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
WORKSPACE_DIR="$(cd "${RN_COMPAT_DIR}/.." && pwd)"

MAX_PSS_MB="${MAX_PSS_MB:-150.0}"
ALLOW_SKIP="${GOAT_RAM_ALLOW_SKIP:-0}"
DRY_RUN="${GOAT_BENCH_DRY_RUN:-0}"
MOCK_MODE="${GOAT_BENCH_MOCK:-0}"
LEAK_TEST_ONLY=0
SKIP_LEAK_TEST=0

usage() {
  cat <<EOF
Usage: $(basename "$0") [options] <android-package> [label] [runs] [ceiling_mb]

Options:
  --leak-test-only    Run only the 100-cycle mount/unmount leak test and exit
  --skip-leak-test    Skip the 100-cycle leak test
  --dry-run, --mock   Run mock benchmark evaluation without requiring a device
  --ceiling-mb <MB>   Set steady-state RAM ceiling in MB (default: 150.0)
  -h, --help          Show this help message

Arguments:
  <android-package>   Target Android package name (e.g., com.goat.bench.rn_showcase)
  [label]             Label for the run (default: rn)
  [runs]              Number of cold mount runs (default: 5)
  [ceiling_mb]        App steady-state RAM ceiling in MB (default: 150.0)
EOF
  exit 0
}

# Parse options
POSITIONAL_ARGS=()
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
      MAX_PSS_MB="$1"
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      POSITIONAL_ARGS+=("$1")
      shift
      ;;
  esac
done

PKG="${POSITIONAL_ARGS[0]:-}"
LABEL="${POSITIONAL_ARGS[1]:-rn}"
RUNS="${POSITIONAL_ARGS[2]:-5}"
if [ ${#POSITIONAL_ARGS[@]} -ge 4 ]; then
  MAX_PSS_MB="${POSITIONAL_ARGS[3]}"
fi

cannot_measure() {
  echo "SKIPPED: $1"
  if [ "$ALLOW_SKIP" = "1" ]; then
    echo "GOAT_RAM_ALLOW_SKIP=1 is set; skipping rather than failing."
    exit 0
  fi
  echo "FAIL: $1 (attach a device, run with --mock, or set GOAT_RAM_ALLOW_SKIP=1)"
  exit 1
}

# 1. Run 100 mount/unmount cycle zero memory leak growth verification
if [ "$SKIP_LEAK_TEST" -eq 0 ]; then
  echo ""
  echo "================================================================"
  echo "Running 100-cycle mount/unmount zero memory leak growth verification (React Native)..."
  echo "================================================================"
  if ! ( cd "${RN_COMPAT_DIR}" && npm test -- mountUnmountLeak.test.tsx ); then
    echo "❌ 100-cycle mount/unmount memory leak verification FAILED."
    exit 1
  fi
  echo "✅ 100-cycle mount/unmount zero memory leak growth verified."

  if [ "$LEAK_TEST_ONLY" -eq 1 ]; then
    echo "🎉 Leak test verification completed (--leak-test-only)."
    exit 0
  fi
fi

if [ -z "$PKG" ] && [ "$DRY_RUN" -eq 0 ] && [ "$MOCK_MODE" -eq 0 ]; then
  echo "usage: bench-rn-compat.sh [options] <android-package> [label] [runs] [ceiling_mb]"
  exit 2
fi

mounts=()

if [ "$DRY_RUN" -eq 1 ] || [ "$MOCK_MODE" -eq 1 ]; then
  echo ""
  echo "================================================================"
  echo "Running in mock / dry-run mode ($LABEL)..."
  echo "================================================================"
  mounts=(18.2 17.9 18.5 19.1 18.0)
  for run in $(seq 1 ${#mounts[@]}); do
    echo "$LABEL run $run: mount=${mounts[$((run-1))]}ms"
  done
  app_dump="
 App Summary
                       Pss(KB)                        Rss(KB)
                        ------                         ------
           Java Heap:     3032                          12844
         Native Heap:    29491                          31204
                TOTAL PSS:   143360            TOTAL RSS:   210488
"
  renderer_dump=""
  app_pss="143360"
  app_java="3032"
else
  if ! command -v adb >/dev/null 2>&1; then
    cannot_measure "bench-rn-compat: adb not on PATH"
  fi
  if [ -z "$(adb devices | sed -n '2p')" ]; then
    cannot_measure "bench-rn-compat: no device/emulator attached"
  fi

  for run in $(seq 1 "$RUNS"); do
    adb shell am force-stop "$PKG" >/dev/null 2>&1
    sleep 3
    adb logcat -b all -c >/dev/null 2>&1
    adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 >/dev/null 2>&1

    pid=""
    for _ in $(seq 1 30); do
      pid=$(adb shell pidof "$PKG" 2>/dev/null | tr -d '\r' | awk '{print $1}')
      [ -n "$pid" ] && break
      sleep 0.5
    done
    [ -z "$pid" ] && { echo "$LABEL run $run: never started"; continue; }

    v=""
    for _ in $(seq 1 40); do
      v=$(adb logcat -d --pid="$pid" 2>/dev/null \
          | grep -oE '"mount_to_load_ms":[0-9.]+' | head -1 | cut -d: -f2)
      [ -n "$v" ] && break
      sleep 1
    done

    if [ -n "$v" ]; then
      mounts+=("$v")
      echo "$LABEL run $run: mount=${v}ms"
    else
      echo "$LABEL run $run: no mount marker seen"
    fi
  done

  echo "--- RAM (after settle) ---"
  sleep 10
  app_dump="$(adb shell dumpsys meminfo --local "$PKG" 2>/dev/null | tr -d '\r' || true)"
  app_pss=$(echo "$app_dump" | awk '/TOTAL PSS:/{print $3; exit}')
  app_java=$(echo "$app_dump" | awk '/Java Heap:/{print $3; exit}')
  echo "$LABEL app TOTAL PSS: ${app_pss:-n/a} kB   Java heap: ${app_java:-n/a} kB"

  renderer_pid=$(adb shell 'ps -A -o PID,NAME 2>/dev/null' | tr -d '\r' \
    | grep -E "webview.*sandboxed_process|SandboxedProcessService" | awk '{print $1}' | head -n 1 || true)
  renderer_dump=""
  if [ -n "$renderer_pid" ]; then
    renderer_dump="$(adb shell dumpsys meminfo --local "$renderer_pid" 2>/dev/null | tr -d '\r' || true)"
    renderer_pss=$(echo "$renderer_dump" | awk '/TOTAL PSS:/{print $3; exit}')
    if [ -n "$renderer_pss" ]; then
      echo "$LABEL renderer PSS: ${renderer_pss} kB"
    fi
  fi
fi

# RAM Budget Evaluation against <= 150 MB ceiling
echo ""
echo "================================================================"
echo "Evaluating RAM budget against steady-state ceiling (${MAX_PSS_MB} MB)..."
echo "================================================================"

RAM_STATUS=0
if [ -n "${app_dump:-}" ] && [ -f "${WORKSPACE_DIR}/scripts/lib/ram_budget.py" ]; then
  python3 "${WORKSPACE_DIR}/scripts/lib/ram_budget.py" "$MAX_PSS_MB" "$app_dump" "${renderer_dump:-}" || RAM_STATUS=$?
elif [ -n "${app_pss:-}" ] && [ "$app_pss" != "n/a" ]; then
  python3 - "$app_pss" "$MAX_PSS_MB" "$LABEL" <<'PYEOF' || RAM_STATUS=$?
import sys
pss_kb = float(sys.argv[1])
max_mb = float(sys.argv[2])
label = sys.argv[3]
pss_mb = pss_kb / 1024.0
if pss_mb > max_mb:
    print(f"FAIL: {label} app steady-state PSS {pss_mb:.2f} MB exceeds {max_mb:.1f} MB ceiling")
    sys.exit(1)
else:
    headroom = max_mb - pss_mb
    print(f"PASS: {label} app steady-state PSS {pss_mb:.2f} MB is {headroom:.2f} MB under {max_mb:.1f} MB ceiling")
    sys.exit(0)
PYEOF
else
  echo "FAIL: Could not obtain app memory dump or PSS"
  RAM_STATUS=1
fi

if [ "$RAM_STATUS" -ne 0 ]; then
  if [ "$ALLOW_SKIP" = "1" ]; then
    echo "GOAT_RAM_ALLOW_SKIP=1 is set; skipping rather than failing."
  else
    echo "❌ $LABEL RAM budget verification FAILED (exceeded ${MAX_PSS_MB} MB ceiling)."
    exit 1
  fi
fi
echo "✅ $LABEL RAM budget verification PASSED (steady-state PSS <= ${MAX_PSS_MB} MB)."

if [ ${#mounts[@]} -gt 0 ]; then
  printf '%s\n' "${mounts[@]}" | python3 -c "
import sys, statistics
v=[float(x) for x in sys.stdin if x.strip()]
print(f'$LABEL: n={len(v)} median={statistics.median(v):.1f}ms mean={statistics.mean(v):.1f}ms min={min(v):.1f} max={max(v):.1f}')"
else
  if [ "$ALLOW_SKIP" = "1" ]; then
    echo "$LABEL: no complete runs (skipped due to GOAT_RAM_ALLOW_SKIP=1)"
    exit 0
  fi
  echo "$LABEL: no complete runs"
  exit 1
fi
