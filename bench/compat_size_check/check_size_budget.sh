#!/usr/bin/env bash
# Size / tree-shake verification.
#
# Builds three release APKs from the same project, differing only in which
# entry point is used:
#   (a) main_a_engine_only.dart    -- goat_webview only, no compat import
#   (b) main_b_adapter_unused.dart -- goat_webview_compat imported, never referenced
#   (c) main_c_adapter_used.dart   -- goat_webview_compat's InAppWebView actually used
#
# Then checks:
#   (b) - (a) <= 20 KB   (barrel import of an unused adapter must tree-shake away)
#   (c) - (a) <= 80 KB   (the adapter's real cost when actually used)
#   no goat_webview_compat symbol present in (b)'s Dart AOT symbol map
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

DEVTOOLS_DIR="${HOME}/.flutter-devtools"
B_BUDGET_KB=20
C_BUDGET_KB=80

build_variant() {
  local target="$1"
  rm -rf build
  flutter build apk --release --target-platform android-arm64 --analyze-size \
    --target="lib/${target}" >/tmp/goat_size_check_build.log 2>&1
  cp build/app/outputs/flutter-apk/app-release.apk "/tmp/goat_size_${target%.dart}.apk"
  # --analyze-size writes a freshly-numbered JSON on every run; the highest
  # numbered file after the build is this run's report.
  ls -t "${DEVTOOLS_DIR}"/apk-code-size-analysis_*.json | head -1 | \
    xargs -I{} cp {} "/tmp/goat_size_${target%.dart}.json"
}

echo "Building (a) engine only..."
build_variant main_a_engine_only.dart
echo "Building (b) adapter imported, unused..."
build_variant main_b_adapter_unused.dart
echo "Building (c) adapter fully used..."
build_variant main_c_adapter_used.dart

A_BYTES=$(stat -f%z /tmp/goat_size_main_a_engine_only.apk 2>/dev/null || stat -c%s /tmp/goat_size_main_a_engine_only.apk)
B_BYTES=$(stat -f%z /tmp/goat_size_main_b_adapter_unused.apk 2>/dev/null || stat -c%s /tmp/goat_size_main_b_adapter_unused.apk)
C_BYTES=$(stat -f%z /tmp/goat_size_main_c_adapter_used.apk 2>/dev/null || stat -c%s /tmp/goat_size_main_c_adapter_used.apk)

B_DELTA_KB=$(( (B_BYTES - A_BYTES) / 1024 ))
C_DELTA_KB=$(( (C_BYTES - A_BYTES) / 1024 ))

echo ""
echo "================================================================"
echo "T13 size / tree-shake report"
echo "================================================================"
echo "(a) engine only          : ${A_BYTES} bytes"
echo "(b) adapter imported     : ${B_BYTES} bytes   delta (b)-(a) = ${B_DELTA_KB} KB  (budget <= ${B_BUDGET_KB} KB)"
echo "(c) adapter fully used   : ${C_BYTES} bytes   delta (c)-(a) = ${C_DELTA_KB} KB  (budget <= ${C_BUDGET_KB} KB)"
echo ""

FAILURES=0

if [ "$B_DELTA_KB" -gt "$B_BUDGET_KB" ]; then
  echo "FAIL: (b)-(a) = ${B_DELTA_KB} KB exceeds budget of ${B_BUDGET_KB} KB"
  FAILURES=$((FAILURES + 1))
else
  echo "PASS: (b)-(a) within budget"
fi

if [ "$C_DELTA_KB" -gt "$C_BUDGET_KB" ]; then
  echo "FAIL: (c)-(a) = ${C_DELTA_KB} KB exceeds budget of ${C_BUDGET_KB} KB"
  FAILURES=$((FAILURES + 1))
else
  echo "PASS: (c)-(a) within budget"
fi

echo ""
echo "Checking (b)'s Dart AOT symbol map for stray goat_webview_compat symbols..."
SYMBOL_CHECK_RC=0
python3 - "/tmp/goat_size_main_b_adapter_unused.json" <<'PYEOF' || SYMBOL_CHECK_RC=$?
import json, sys
with open(sys.argv[1]) as f:
    data = json.load(f)
found = []
def walk(node, path=''):
    name = node.get('n', '')
    p = f'{path}/{name}' if path else name
    if 'goat_webview_compat' in p or 'InAppWebView' in name or 'PullToRefresh' in name:
        found.append(p)
    for child in node.get('children', []):
        walk(child, p)
walk(data)
if found:
    print(f"FAIL: {len(found)} stray compat symbol(s) present in unused-adapter build:")
    for f2 in found:
        print(f"  {f2}")
    sys.exit(1)
print("PASS: no goat_webview_compat symbols present")
PYEOF

if [ "$SYMBOL_CHECK_RC" -ne 0 ]; then
  FAILURES=$((FAILURES + 1))
fi

echo ""
if [ "$FAILURES" -gt 0 ]; then
  echo "T13 size budget gate FAILED (${FAILURES} check(s))."
  exit 1
else
  echo "T13 size budget gate PASSED."
  exit 0
fi
