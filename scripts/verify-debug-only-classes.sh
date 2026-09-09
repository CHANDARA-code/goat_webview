#!/usr/bin/env bash
# Task 10186 validation rule 1: debug-only classes must not be linkable from a release artifact.
#
# These live in `android/core/src/debug/`, so exclusion is structural -- the release variant never
# compiles them -- rather than dependent on R8 shrinking them away. This script is the check that
# the structure has not been undone (e.g. by someone moving the file into src/main and trusting
# minification, which would silently ship the class whenever something referenced it).
#
# Fails the build if any listed class appears in the release AAR.
#
#   scripts/verify-debug-only-classes.sh [path-to-release-aar]
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AAR="${1:-$ROOT/android/core/build/outputs/aar/core-release.aar}"

DEBUG_ONLY_CLASSES=(
  "GoatProxyController"
)

if [ ! -f "$AAR" ]; then
  echo "verify-debug-only-classes: release AAR not found at $AAR"
  echo "  build it first: (cd android && ./gradlew :core:assembleRelease)"
  exit 1
fi

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unzip -o -q "$AAR" -d "$TMP" || { echo "failed to unzip $AAR"; exit 1; }

status=0
for cls in "${DEBUG_ONLY_CLASSES[@]}"; do
  hits=0
  # Entry names inside classes.jar, plus any stray entry in the AAR itself.
  if [ -f "$TMP/classes.jar" ]; then
    hits=$(unzip -l "$TMP/classes.jar" 2>/dev/null | grep -ci "$cls" || true)
  fi
  aar_hits=$(unzip -l "$AAR" 2>/dev/null | grep -ci "$cls" || true)
  total=$(( hits + aar_hits ))
  if [ "$total" -gt 0 ]; then
    echo "FAIL: '$cls' is present in the release artifact ($total entr(y|ies))"
    echo "      It must be compiled into the debug variant only (android/core/src/debug/)."
    status=1
  else
    echo "ok: '$cls' absent from $(basename "$AAR")"
  fi
done

exit $status
