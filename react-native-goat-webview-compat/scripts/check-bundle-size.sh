#!/usr/bin/env bash
# T14 — bundle-size / tree-shake verification.
#
# Three things are checked, because they fail differently:
#
#   1. The (a)/(b)/(c) variant diff T14 actually asks for:
#        (a) engine only, adapter never imported          -- the baseline
#        (b) adapter imported, <WebView> rendered, no optional feature
#        (c) adapter fully used (every optional feature imported)
#      and asserts (b)-(a) <= +15 KB and (c)-(a) <= +40 KB gzipped.
#   2. Total minified+gzipped size against an absolute budget. Catches the adapter quietly growing.
#   3. Tree-shakeability: importing only <WebView> must NOT pull in CookieManager. The package
#      declares "sideEffects": false, and this is the check that the claim is true -- a stray
#      top-level side effect silently defeats it and every consumer then ships the whole surface.
#
#   scripts/check-bundle-size.sh [budget-bytes]
set -uo pipefail
cd "$(dirname "$0")/.."

BUDGET="${1:-20480}"          # 20 KB gzipped, matching the DSL adapter's stated budget
DELTA_B_BUDGET="${DELTA_B_BUDGET:-15360}"   # T14: (b) - (a) <= +15 KB
DELTA_C_BUDGET="${DELTA_C_BUDGET:-40960}"   # T14: (c) - (a) <= +40 KB
OUT=".size-check"
rm -rf "$OUT"; mkdir -p "$OUT"

if [ ! -x node_modules/.bin/esbuild ] && ! command -v esbuild >/dev/null 2>&1; then
  echo "check-bundle-size: esbuild not available; install devDependencies first"
  exit 1
fi
ESBUILD="node_modules/.bin/esbuild"
[ -x "$ESBUILD" ] || ESBUILD="esbuild"

# react and react-native are peer deps supplied by the host app, so they are external here --
# bundling them would measure React Native, not this adapter. The engine
# (react-native-goat-webview) is external for the same reason, which is what makes (a) a true
# "engine only" baseline: every byte of the (b)-(a) and (c)-(a) deltas is adapter code.
EXTERNALS="--external:react --external:react-native --external:react-native-goat-webview"

build() { # build <entry> <outfile>
  $ESBUILD "$1" --bundle --minify --format=esm $EXTERNALS \
    --outfile="$2" --log-level=error
}

echo "==> (a) engine only — adapter never imported"
cat > "$OUT/entry-a-engine-only.tsx" <<'ENTRY'
import { GoatWebView } from 'react-native-goat-webview';
export default GoatWebView;
ENTRY
build "$OUT/entry-a-engine-only.tsx" "$OUT/a-engine-only.js" || exit 1

echo "==> (b) adapter imported, <WebView> only, no optional feature"
cat > "$OUT/entry-b-webview-only.ts" <<'ENTRY'
import { WebView } from '../src/index';
export default WebView;
ENTRY
build "$OUT/entry-b-webview-only.ts" "$OUT/b-webview-only.js" || exit 1

echo "==> (c) adapter fully used — every optional feature imported"
build src/index.tsx "$OUT/c-full.js" || exit 1

gz() { gzip -9 -c "$1" | wc -c | tr -d ' '; }
A=$(gz "$OUT/a-engine-only.js")
B=$(gz "$OUT/b-webview-only.js")
C=$(gz "$OUT/c-full.js")
DELTA_B=$((B - A))
DELTA_C=$((C - A))

printf '\n(a) engine only        : %s bytes gzipped\n' "$A"
printf '(b) adapter, WebView   : %s bytes gzipped  (delta %+d, budget +%s)\n' "$B" "$DELTA_B" "$DELTA_B_BUDGET"
printf '(c) adapter, all used  : %s bytes gzipped  (delta %+d, budget +%s)\n' "$C" "$DELTA_C" "$DELTA_C_BUDGET"
printf 'absolute budget        : %s bytes\n\n' "$BUDGET"

status=0

if [ "$DELTA_B" -gt "$DELTA_B_BUDGET" ]; then
  echo "FAIL: (b)-(a) = ${DELTA_B}B exceeds the +${DELTA_B_BUDGET}B budget"
  status=1
else
  echo "ok: (b)-(a) within +${DELTA_B_BUDGET}B"
fi

if [ "$DELTA_C" -gt "$DELTA_C_BUDGET" ]; then
  echo "FAIL: (c)-(a) = ${DELTA_C}B exceeds the +${DELTA_C_BUDGET}B budget"
  status=1
else
  echo "ok: (c)-(a) within +${DELTA_C_BUDGET}B"
fi

if [ "$C" -gt "$BUDGET" ]; then
  echo "FAIL: full surface ${C}B exceeds the ${BUDGET}B budget"
  status=1
else
  echo "ok: full surface within absolute budget"
fi

# The tree-shake assertion: CookieManager must not survive into a WebView-only import.
#
# T14's acceptance also names "veto" and "pullToRefresh" module symbols here. Those are NOT
# separate modules in this adapter -- `onShouldStartLoadWithRequest` and `pullToRefreshEnabled`
# are props read in src/WebView.tsx and src/toCreationProps.ts and forwarded to native as flags,
# so there is nothing to shake out of a bundle that contains <WebView> at all. CookieManager
# (src/cookies.ts) is the only genuinely separable optional feature, so it is the only one this
# assertion can make.
if grep -q "COOKIE_REMOVE_ALL" "$OUT/b-webview-only.js"; then
  echo "FAIL: CookieManager was pulled into a WebView-only import — tree-shaking is not working."
  echo "      Check for a top-level side effect, or a \"sideEffects\" field that no longer matches."
  status=1
else
  echo "ok: CookieManager tree-shaken out of a WebView-only import"
fi

exit $status
