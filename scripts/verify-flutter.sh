#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🎯 [Goat WebView] Flutter PlatformView & MethodChannel Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}/goat_webview"

# Auto-detect flutter PATH across user setups
if [ -d "${HOME}/fvm/default/bin" ]; then
  export PATH="${HOME}/fvm/default/bin:${PATH}"
elif [ -d "/opt/homebrew/bin" ]; then
  export PATH="/opt/homebrew/bin:${PATH}"
fi

if ! command -v flutter >/dev/null 2>&1; then
  echo "❌ Error: Flutter CLI not found on PATH."
  exit 1
fi

echo "Flutter CLI: $(which flutter) ($(flutter --version | head -n 1))"

echo "🧪 Running Flutter unit & widget tests..."
flutter test

echo "🔍 Running Flutter static analysis..."
flutter analyze

echo "✅ [Flutter] Dart tests and analysis passed."

# `flutter test` and `flutter analyze` cover Dart only. The plugin's Android half
# (goat_webview/android/src/main/kotlin/.../flutter/*.kt) is compiled by nothing else in this repo:
# verify-android.sh builds the SDK's own android project, and verify-showcase.sh builds android/app,
# neither of which includes this module. That gap is not theoretical -- on 2026-09-06 a change to
# GoatPlatformView.kt failed to compile with "Unresolved reference 'hostDomainAllowlist'" and only
# surfaced from a manual host build.
#
# The module cannot be compiled standalone: goat_webview/android has no settings.gradle, so gradle
# reports "no repositories are defined". Building a real Flutter host is the check that works, and
# mirrors what verify-ios.sh already does for the iOS half.
HOST_APP="${WORKSPACE_DIR}/bench/goat_vs_fiw/app_goat"
if [ -d "${HOST_APP}/android" ]; then
  echo ""
  echo "🤖 Compiling the plugin's Android half via a Flutter host..."
  # The host resolves com.goat.webview:core from mavenLocal rather than from source, so a :core
  # change is invisible here until it is republished.
  ( cd "${WORKSPACE_DIR}/android" && ./gradlew :core:assembleRelease :core:publishToMavenLocal \
      -PGOAT_PUBLISH_VERSION=1.0.0 --console=plain --no-configuration-cache -q )
  ( cd "${HOST_APP}" && flutter build apk --debug --target-platform android-arm64 )
  echo "✅ [Flutter] Plugin Android half compiles against a real host."
else
  echo "⏭  [Flutter] No Flutter host found; skipping the Android consumer build."
fi

# goat_webview_compat is the drop-in flutter_inappwebview replacement -- the package a consumer
# actually swaps in. It has a test suite and verify-all.sh was not running it.
COMPAT_DIR="${WORKSPACE_DIR}/goat_webview_compat"
if [ -d "${COMPAT_DIR}" ]; then
  echo ""
  # Critical suites that must always be executed:
  #   test/mount_unmount_leak_test.dart  — 100-cycle mount/unmount leak & zero-retention verification
  #   test/in_app_web_view_controller_test.dart — controller lifecycle & handler registry teardown
  #   test/cookie_manager_test.dart      — multi-tenant cookie isolation
  #   test/goat_webview_compat_test.dart — widget creation-prop purity
  echo "🔁 [Flutter] Running goat_webview_compat tests (including 100-cycle leak suite: test/mount_unmount_leak_test.dart)..."
  ( cd "${COMPAT_DIR}" && flutter test )
  # Verify the leak test file is present so this gate cannot silently be skipped if the file is removed.
  if [ ! -f "${COMPAT_DIR}/test/mount_unmount_leak_test.dart" ]; then
    echo "❌ Error: test/mount_unmount_leak_test.dart is missing — the 100-cycle leak suite must always be present."
    exit 1
  fi
  echo "✅ [Flutter] goat_webview_compat tests passed (mount_unmount_leak_test.dart confirmed present)."

  echo ""
  echo "🔍 [Flutter] Running goat_webview_compat static analysis..."
  ( cd "${COMPAT_DIR}" && flutter analyze --fatal-infos --fatal-warnings )
  echo "✅ [Flutter] goat_webview_compat static analysis passed (0 errors, 0 warnings)."

  echo ""
  echo "🛡️  [Flutter] Running custom_lint zero-retention verification in goat_webview_compat..."
  ( cd "${COMPAT_DIR}" && dart run custom_lint )
  echo "✅ [Flutter] goat_webview_compat zero-retention custom lints passed."

  echo ""
  echo "📦 [Flutter] Verifying tree-shaking & size check gate (unused adapter delta <= 20 KB)..."
  DEVTOOLS_DIR="${HOME}/.flutter-devtools"
  if [ -d "${DEVTOOLS_DIR}" ] && [ -f "${DEVTOOLS_DIR}/apk-code-size-analysis_01.json" ] && [ -f "${DEVTOOLS_DIR}/apk-code-size-analysis_02.json" ]; then
    python3 - <<'PYEOF'
import json, os, sys

devtools_dir = os.path.expanduser("~/.flutter-devtools")
f1 = os.path.join(devtools_dir, "apk-code-size-analysis_01.json")
f2 = os.path.join(devtools_dir, "apk-code-size-analysis_02.json")
f3 = os.path.join(devtools_dir, "apk-code-size-analysis_03.json")

with open(f1) as f: j1 = json.load(f)
with open(f2) as f: j2 = json.load(f)
j3 = json.load(open(f3)) if os.path.isfile(f3) else None

# Total package size is sum of top-level children values in code-size JSON
a_bytes = sum(c.get("value", 0) for c in j1.get("children", []))
b_bytes = sum(c.get("value", 0) for c in j2.get("children", []))
c_bytes = sum(c.get("value", 0) for c in j3.get("children", [])) if j3 else None

b_delta_kb = (b_bytes - a_bytes) / 1024.0
b_budget_kb = 20.0
c_budget_kb = 80.0

print(f"  (a) engine only          : {a_bytes:,} bytes")
print(f"  (b) adapter unused       : {b_bytes:,} bytes (delta: {b_delta_kb:+.2f} KB, budget <= {b_budget_kb} KB)")
if c_bytes is not None:
    c_delta_kb = (c_bytes - a_bytes) / 1024.0
    print(f"  (c) adapter fully used   : {c_bytes:,} bytes (delta: {c_delta_kb:+.2f} KB, budget <= {c_budget_kb} KB)")

failures = 0
if b_delta_kb > b_budget_kb:
    print(f"  ❌ FAIL: unused adapter delta {b_delta_kb:.2f} KB exceeds {b_budget_kb} KB budget")
    failures += 1
else:
    print(f"  ✅ PASS: unused adapter delta ({b_delta_kb:+.2f} KB) is within {b_budget_kb} KB budget")

if c_bytes is not None:
    c_delta_kb = (c_bytes - a_bytes) / 1024.0
    if c_delta_kb > c_budget_kb:
        print(f"  ❌ FAIL: full adapter delta {c_delta_kb:.2f} KB exceeds {c_budget_kb} KB budget")
        failures += 1
    else:
        print(f"  ✅ PASS: full adapter delta ({c_delta_kb:+.2f} KB) is within {c_budget_kb} KB budget")

# Symbol check for tree-shaking in (b)
found = []
def walk(node, path=""):
    name = node.get("n", "")
    p = f"{path}/{name}" if path else name
    if "goat_webview_compat" in p or "InAppWebView" in name or "PullToRefresh" in name:
        found.append(p)
    for child in node.get("children", []):
        walk(child, p)
walk(j2)

if found:
    print(f"  ❌ FAIL: {len(found)} stray compat symbol(s) present in unused-adapter build:")
    for sym in found:
        print(f"    {sym}")
    failures += 1
else:
    print("  ✅ PASS: tree-shaking verified — 0 goat_webview_compat symbols present in unused-adapter build")

if failures > 0:
    sys.exit(1)
PYEOF
    echo "✅ [Flutter] Tree-shaking & size check gate passed."
  elif [ -x "${WORKSPACE_DIR}/bench/compat_size_check/check_size_budget.sh" ]; then
    ( cd "${WORKSPACE_DIR}/bench/compat_size_check" && bash check_size_budget.sh )
    echo "✅ [Flutter] Tree-shaking & size check gate passed."
  else
    echo "❌ Error: Code size analysis reports not found."
    exit 1
  fi
fi

echo ""
echo "✅ [Flutter] All PlatformView, MethodChannel, static analysis, zero-retention, and size gates passed."

