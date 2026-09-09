#!/usr/bin/env bash
# T1 criterion: minified + gzipped bundle < 20 KB, and each DSL entry point must be
# independently importable without dragging the others in.
set -uo pipefail
cd "$(dirname "$0")/.."
BUDGET="${1:-20480}"
ESB=node_modules/.bin/esbuild
OUT=.size-check
rm -rf "$OUT"; mkdir -p "$OUT"

status=0
total_ok=1
for entry in index wechat/index alibaba/index uniapp/index taro/index \
             features/storage/index features/sensors/index features/scanner/index \
             features/location/index features/bluetooth/index \
             features/media/index features/payments/index \
             features/biometrics/index features/navigation/index features/binary/index; do
  name=$(echo "$entry" | tr '/' '-')
  $ESB "src/$entry.ts" --bundle --minify --format=esm --outfile="$OUT/$name.js" --log-level=error || exit 1
  sz=$(gzip -9 -c "$OUT/$name.js" | wc -c | tr -d ' ')
  printf '%-16s %6s bytes gzipped\n' "$entry" "$sz"
  if [ "$sz" -gt "$BUDGET" ]; then
    echo "FAIL: $entry exceeds the ${BUDGET}B budget"
    status=1; total_ok=0
  fi
done
[ "$total_ok" = "1" ] && echo "ok: every entry point within the ${BUDGET}B budget"

# The bootstrap must stay literal: no eval, no Function construction (T1 criterion).
if grep -qE "\beval\(|new Function\(" "$OUT/index.js"; then
  echo "FAIL: bundle contains eval() or new Function()"
  status=1
else
  echo "ok: no eval / dynamic Function in the bundle"
fi
exit $status

