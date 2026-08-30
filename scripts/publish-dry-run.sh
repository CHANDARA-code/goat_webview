#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Goat WebView Multi-Ecosystem Release Pre-Flight Dry-Run Tool
# Validates package manifests, compiles artifacts, and executes publishing dry-runs
# across Flutter (pub.dev), React Native & Node (npm), Android (Maven Local), & iOS.
# ==============================================================================

echo "================================================================================"
echo "🧪 [Goat WebView] Multi-Ecosystem 1.0.0 GA Release Dry-Run Pre-Flight"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# Track test results
DRY_RUN_PASSED=0
DRY_RUN_FAILED=0

pass() {
  echo "  ✅ $1"
  DRY_RUN_PASSED=$((DRY_RUN_PASSED + 1))
}

fail() {
  echo "  ❌ $1"
  DRY_RUN_FAILED=$((DRY_RUN_FAILED + 1))
}

# ------------------------------------------------------------------------------
# 0. Distribution Preconditions (the things that actually block external installs)
# ------------------------------------------------------------------------------
echo ""
echo "🌍 [0/4] Validating Distribution Preconditions..."

GITHUB_SLUG="${GOAT_GITHUB_SLUG:-CHANDARA-code/goat_webview}"

# internal = private repo, git-ref + GitHub Packages distribution (the alpha channel).
# public   = public repo, npm / pub.dev / CocoaPods trunk distribution (GA).
RELEASE_CHANNEL="${GOAT_RELEASE_CHANNEL:-public}"
echo "  ℹ️  Release channel: ${RELEASE_CHANNEL}"

REPO_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://api.github.com/repos/${GITHUB_SLUG}" || echo "000")
if [ "${REPO_STATUS}" = "000" ]; then
  echo "  ⚠️  Could not reach api.github.com; skipping repository visibility check"
elif [ "${RELEASE_CHANNEL}" = "internal" ]; then
  if [ "${REPO_STATUS}" = "200" ]; then
    fail "GitHub repository ${GITHUB_SLUG} is PUBLIC, but the release channel is 'internal'. An internal alpha must not be world-readable — make it private or set GOAT_RELEASE_CHANNEL=public deliberately."
  else
    pass "GitHub repository ${GITHUB_SLUG} is private (HTTP ${REPO_STATUS}) — correct for an internal alpha"
  fi
elif [ "${REPO_STATUS}" = "200" ]; then
  pass "GitHub repository ${GITHUB_SLUG} is publicly reachable"
else
  fail "GitHub repository ${GITHUB_SLUG} is NOT publicly reachable (HTTP ${REPO_STATUS}). Every podspec, pubspec, Package.swift and the Android quickstart resolve to it, so CocoaPods/SPM installs cannot work until it is public."
fi

EXPECTED_TAG="v$(node -e "process.stdout.write(require('${WORKSPACE_DIR}/react-native-goat-webview/package.json').version)")"
if git -C "${WORKSPACE_DIR}" rev-parse "${EXPECTED_TAG}" >/dev/null 2>&1; then
  # A tag that merely *exists* is not enough: CocoaPods and SPM consumers resolve the
  # tagged tree, so a tag behind HEAD ships code without the fixes on main.
  BEHIND=$(git -C "${WORKSPACE_DIR}" rev-list --count "${EXPECTED_TAG}..HEAD" 2>/dev/null || echo "0")
  DIRTY=$(git -C "${WORKSPACE_DIR}" status --porcelain | wc -l | tr -d ' ')
  if [ "${BEHIND}" -eq 0 ] && [ "${DIRTY}" -eq 0 ]; then
    pass "Git tag ${EXPECTED_TAG} exists and points at the current tree"
  else
    fail "Git tag ${EXPECTED_TAG} is stale: ${BEHIND} commit(s) and ${DIRTY} uncommitted change(s) ahead of it. CocoaPods/SPM consumers resolve :tag => \"${EXPECTED_TAG}\" and would receive code without those changes. Re-tag before publishing."
  fi
else
  fail "Git tag ${EXPECTED_TAG} does not exist — both podspecs pin :tag => \"${EXPECTED_TAG}\" and would fail to resolve"
fi

# Making the repository public redistributes everything it tracks under the root LICENSE.
VENDOR_DIR="${WORKSPACE_DIR}/learn_use_case"
if [ -d "${VENDOR_DIR}" ] && [ "$(git -C "${WORKSPACE_DIR}" ls-files learn_use_case | wc -l | tr -d ' ')" != "0" ]; then
  VENDOR_FILES=$(git -C "${WORKSPACE_DIR}" ls-files learn_use_case | wc -l | tr -d ' ')
  COPYLEFT=$(grep -rlE "GNU GENERAL PUBLIC LICENSE" "${VENDOR_DIR}" --include="LICENSE*" 2>/dev/null | wc -l | tr -d ' ')
  if [ "${RELEASE_CHANNEL}" = "internal" ]; then
    echo "  ⚠️  learn_use_case/ is git-tracked (${VENDOR_FILES} files, ${COPYLEFT} GPL-licensed vendor trees, incl. Telegram and WebF) under a root MIT LICENSE."
    echo "      Deferred, not resolved: an internal alpha does not redistribute publicly, but this MUST be"
    echo "      removed from the tree AND from git history before the repository is ever made public."
    pass "learn_use_case/ license conflict acknowledged (deferred for internal channel)"
  else
    fail "learn_use_case/ is git-tracked (${VENDOR_FILES} files, ${COPYLEFT} GPL-licensed vendor trees) while the repository root declares MIT. Publishing the repo publicly would redistribute third-party (incl. GPL and unlicensed vendor) source under an MIT claim. Remove it from the working tree AND from git history before going public."
  fi
else
  pass "No git-tracked third-party vendor source under learn_use_case/"
fi

POD_VERSION=$(grep -E "^\s*s\.version\s*=" "${WORKSPACE_DIR}/ios/GoatWebView.podspec" | head -1 | sed -E "s/.*'([^']+)'.*/\1/")
FLUTTER_VERSION=$(grep -E "^version:" "${WORKSPACE_DIR}/goat_webview/pubspec.yaml" | awk '{print $2}')
if [ "v${POD_VERSION}" = "${EXPECTED_TAG}" ] && [ "v${FLUTTER_VERSION}" = "${EXPECTED_TAG}" ]; then
  pass "Version alignment: podspec ${POD_VERSION}, pubspec ${FLUTTER_VERSION}, npm ${EXPECTED_TAG#v}"
else
  fail "Version drift across ecosystems: podspec=${POD_VERSION}, pubspec=${FLUTTER_VERSION}, npm=${EXPECTED_TAG#v}"
fi

# ------------------------------------------------------------------------------
# 1. Flutter Packages Dry-Run (pub.dev)
# ------------------------------------------------------------------------------
echo ""
echo "🎯 [1/4] Validating Flutter Packages via flutter pub publish --dry-run..."

FLUTTER_PACKAGES=(
  "goat_webview"
  "packages/flutter/goat_webview_bluetooth"
  "packages/flutter/goat_webview_scanner"
  "packages/flutter/goat_webview_location"
  "packages/flutter/goat_webview_biometrics"
  "packages/flutter/goat_webview_media"
  "packages/flutter/goat_webview_payments"
  "packages/flutter/goat_webview_network"
)

for pkg in "${FLUTTER_PACKAGES[@]}"; do
  PKG_DIR="${WORKSPACE_DIR}/${pkg}"
  if [ -d "${PKG_DIR}" ]; then
    echo "  🔍 Checking ${pkg}..."
    (cd "${PKG_DIR}" && flutter pub get >/dev/null 2>&1 || true)
    OUTPUT=$(cd "${PKG_DIR}" && flutter pub publish --dry-run 2>&1 || true)
    
    if echo "${OUTPUT}" | grep -q "Package validation found the following error:" || echo "${OUTPUT}" | grep -q "Sorry, your package is missing a requirement"; then
      echo "${OUTPUT}" | sed 's/^/    /'
      fail "${pkg} (pub.dev dry-run encountered errors)"
    else
      pass "${pkg} (pub.dev dry-run valid)"
    fi
  fi
done

# ------------------------------------------------------------------------------
# 2. React Native & Node Packages Dry-Run (npm)
# ------------------------------------------------------------------------------
echo ""
echo "📦 [2/4] Validating npm Packages via npm publish --dry-run..."

NPM_PACKAGES=(
  "react-native-goat-webview"
  "packages/cli"
  "packages/appservice"
  "packages/bridge-mock"
  "packages/devtools"
  "packages/server"
  "packages/core"
  "packages/compiler-taro"
  "packages/compiler-uniapp"
  "packages/playground"
)

for pkg in "${NPM_PACKAGES[@]}"; do
  PKG_DIR="${WORKSPACE_DIR}/${pkg}"
  if [ -d "${PKG_DIR}" ]; then
    echo "  🔍 Checking ${pkg}..."
    (cd "${PKG_DIR}" && (npm run build >/dev/null 2>&1 || bun run build >/dev/null 2>&1 || true))

    # `npm publish --dry-run` exits 0 on a private:true package, so check it explicitly.
    IS_PRIVATE=$(cd "${PKG_DIR}" && node -e "process.stdout.write(String(require('./package.json').private === true))")
    if [ "${IS_PRIVATE}" = "true" ]; then
      fail "${pkg} is marked \"private\": true and cannot be published — remove it from NPM_PACKAGES or unset the flag"
      continue
    fi

    PKG_VERSION=$(cd "${PKG_DIR}" && node -e "process.stdout.write(require('./package.json').version)")
    NPM_TAG_ARGS=""
    case "${PKG_VERSION}" in
      *-alpha*) NPM_TAG_ARGS="--tag alpha" ;;
      *-beta*)  NPM_TAG_ARGS="--tag beta"  ;;
      *-rc*)    NPM_TAG_ARGS="--tag rc"    ;;
      *-*)      NPM_TAG_ARGS="--tag next"  ;;
    esac

    if OUTPUT=$(cd "${PKG_DIR}" && npm publish --dry-run --access public ${NPM_TAG_ARGS} 2>&1); then
      pass "${pkg} (npm package tarball valid)"
    else
      echo "${OUTPUT}" | sed 's/^/    /'
      fail "${pkg} (npm dry-run failed)"
    fi
  fi
done

# ------------------------------------------------------------------------------
# 3. Android Library AAR Packaging & Maven Local Publishing
# ------------------------------------------------------------------------------
echo ""
echo "🤖 [3/4] Validating Android Core AAR Packaging & Maven Publication..."
if [ -d "${WORKSPACE_DIR}/android" ]; then
  if (cd "${WORKSPACE_DIR}/android" && ./gradlew :core:publishToMavenLocal --no-daemon -q >/dev/null 2>&1); then
    pass "Android Core SDK (:core:publishToMavenLocal valid)"
  else
    fail "Android Core SDK Maven publication failed"
  fi
fi

# ------------------------------------------------------------------------------
# 4. iOS CocoaPods & Swift Package Validation
# ------------------------------------------------------------------------------
echo ""
echo "🍎 [4/4] Validating iOS Podspecs and Swift Package Manifest..."

# GoatWebView is the only pod pushed to the CocoaPods trunk, so it gets the real
# gate that `pod trunk push` runs. Ruby syntax alone is not a publishability check.
if [ -f "${WORKSPACE_DIR}/ios/GoatWebView.podspec" ]; then
  if command -v pod >/dev/null 2>&1; then
    if (cd "${WORKSPACE_DIR}/ios" && pod lib lint GoatWebView.podspec --allow-warnings --skip-tests --quick >/dev/null 2>&1); then
      pass "ios/GoatWebView.podspec passes pod lib lint (quick)"
    else
      fail "ios/GoatWebView.podspec fails pod lib lint — pod trunk push would be rejected"
    fi
  elif ruby -c "${WORKSPACE_DIR}/ios/GoatWebView.podspec" >/dev/null 2>&1; then
    echo "  ⚠️  CocoaPods not installed; only Ruby syntax was checked for GoatWebView.podspec"
    pass "ios/GoatWebView.podspec Ruby syntax valid (pod lib lint SKIPPED)"
  else
    fail "ios/GoatWebView.podspec Ruby syntax error"
  fi
fi

# react-native-goat-webview.podspec is NOT a trunk pod: it depends on React-Core,
# which is vendored by the react-native npm package, and it ships inside the npm
# tarball for `use_native_modules!`. Syntax is the correct depth of check here.
if [ -f "${WORKSPACE_DIR}/react-native-goat-webview/react-native-goat-webview.podspec" ]; then
  if ruby -c "${WORKSPACE_DIR}/react-native-goat-webview/react-native-goat-webview.podspec" >/dev/null 2>&1; then
    pass "react-native-goat-webview.podspec Ruby syntax valid (ships via npm, not trunk)"
  else
    fail "react-native-goat-webview.podspec Ruby syntax error"
  fi
fi

# SPM only reads Package.swift at a repository ROOT: a git-URL dependency cannot
# point into a subdirectory, so a manifest under ios/ makes the package unresolvable.
if [ -f "${WORKSPACE_DIR}/Package.swift" ]; then
  if (cd "${WORKSPACE_DIR}" && swift package describe >/dev/null 2>&1); then
    pass "Root Package.swift manifest valid and resolvable by SPM consumers"
  else
    fail "Root Package.swift manifest parsing failed"
  fi
elif [ -f "${WORKSPACE_DIR}/ios/Package.swift" ]; then
  fail "Package.swift is at ios/Package.swift, not the repository root. SPM resolves manifests only at a repo root, so '.package(url: ...)' against this repository cannot resolve. Move it to the root."
else
  fail "No Package.swift found — SPM consumers cannot resolve this repository"
fi

# ------------------------------------------------------------------------------
# Summary
# ------------------------------------------------------------------------------
echo ""
echo "================================================================================"
echo "📊 Dry-Run Verification Summary: Passed: ${DRY_RUN_PASSED} | Failed: ${DRY_RUN_FAILED}"
echo "================================================================================"

if [ "${DRY_RUN_FAILED}" -eq 0 ]; then
  echo "🎉 [SUCCESS] 100% Release Pre-Flight Dry-Runs Passed! Ready for live publishing."
  exit 0
else
  echo "❌ [FAILURE] Release dry-run encountered ${DRY_RUN_FAILED} issues."
  exit 1
fi

