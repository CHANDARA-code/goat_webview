#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "🤖 [Goat WebView] Android Core Engine & Host Verification Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
cd "${WORKSPACE_DIR}/android"

# Detect JAVA_HOME across macOS and Linux environments
if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME}/bin/java" ]; then
  if command -v /usr/libexec/java_home >/dev/null 2>&1; then
    export JAVA_HOME="$(/usr/libexec/java_home -v 17 2>/dev/null || /usr/libexec/java_home 2>/dev/null || true)"
  fi
  if [ -z "${JAVA_HOME:-}" ] || [ ! -x "${JAVA_HOME}/bin/java" ]; then
    if [ -d "/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home" ]; then
      export JAVA_HOME="/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home"
    elif [ -d "/usr/lib/jvm/java-17-openjdk-amd64" ]; then
      export JAVA_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
    elif [ -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]; then
      export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
    fi
  fi
fi

if [ -n "${JAVA_HOME:-}" ]; then
  export PATH="${JAVA_HOME}/bin:${PATH}"
fi

echo "Java Home: ${JAVA_HOME:-system default}"
if [ ! -f "./gradlew" ]; then
  echo "❌ Error: Gradle wrapper not found at ${WORKSPACE_DIR}/android/gradlew"
  exit 1
fi

chmod +x ./gradlew
./gradlew testDebugUnitTest --no-daemon

echo "✅ [Android] 100% Android Unit & Integration Tests Passed."
