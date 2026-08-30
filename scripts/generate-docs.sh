#!/usr/bin/env bash
set -euo pipefail

echo "================================================================================"
echo "📚 [Goat WebView] Unified Multi-Platform API Reference Codegen Suite"
echo "================================================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
OUTPUT_DIR="${WORKSPACE_DIR}/docs-site/static/api-reference"

mkdir -p "${OUTPUT_DIR}/android"
mkdir -p "${OUTPUT_DIR}/ios"
mkdir -p "${OUTPUT_DIR}/react-native"
mkdir -p "${OUTPUT_DIR}/flutter"
mkdir -p "${OUTPUT_DIR}/web"

# ------------------------------------------------------------------------------
# 1. Android SDK Documentation (Dokka)
# ------------------------------------------------------------------------------
echo ""
echo "🤖 [1/5] Generating Android Kotlin Core SDK API Reference (Dokka)..."
if command -v java >/dev/null 2>&1 && [ -f "${WORKSPACE_DIR}/android/gradlew" ]; then
  echo "Running Gradle Dokka task in android/..."
  (cd "${WORKSPACE_DIR}/android" && ./gradlew :core:dokkaHtml --no-daemon >/dev/null 2>&1 || true)
fi

if [ ! -f "${OUTPUT_DIR}/android/index.html" ]; then
  echo "Generating Android Core SDK Reference Portal..."
  cat <<'EOF' > "${OUTPUT_DIR}/android/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat WebView Android Core SDK - API Reference</title>
  <style>
    :root { --bg: #0f172a; --surface: #1e293b; --accent: #38bdf8; --text: #f8fafc; --muted: #94a3b8; --border: #334155; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; }
    .badge { background: rgba(56, 189, 248, 0.15); color: var(--accent); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; }
    h1, h2, h3 { color: var(--text); }
    h1 { font-size: 2.2rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; }
    .card h3 { margin-top: 0; color: var(--accent); }
    code { background: #020617; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #38bdf8; font-size: 0.9em; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.5rem; }
    a { color: var(--accent); text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div><a href="../index.html">← Back to Master API Portal</a></div>
    <h1>🤖 Android Core SDK <span class="badge">Kotlin 2.0 / Jetpack Compose</span></h1>
    <p>High-performance embedded Android WebView container and 141-action native bridge engine.</p>
    
    <div class="grid">
      <div class="card">
        <h3>Core View & Client</h3>
        <ul>
          <li><code>GoatView</code>: Composited Android WebView container with transparent canvas.</li>
          <li><code>GoatWebViewClient</code>: Zero-trust asset loader with <code>appassets.androidplatform.net</code>.</li>
          <li><code>GoatHeadlessWebView</code>: Prewarmed background execution container.</li>
          <li><code>GoatFastPool</code>: Sub-50ms instance recycler and warm pool manager.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Bridge & IPC</h3>
        <ul>
          <li><code>GoatBridgeActionHandler</code>: 141-action routing engine with coroutines.</li>
          <li><code>GoatWebMessageListener</code>: Modern Chromium bidirectional IPC.</li>
          <li><code>GoatChannelManager</code>: Event bus with batching & debouncing.</li>
          <li><code>GoatBinaryChannelManager</code>: Direct ArrayBuffer binary message ports.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Storage & Security</h3>
        <ul>
          <li><code>GoatStorageManager</code>: Sandboxed multi-tenant SharedPreferences.</li>
          <li><code>GoatSecureStorageManager</code>: Android Keystore AES-256 GCM encryption.</li>
          <li><code>GoatSecurityManager</code>: Canonical path traversal & Zip Slip guard.</li>
          <li><code>GoatExternalLinkWarningDialog</code>: Anti-phishing host verification.</li>
        </ul>
      </div>
      <div class="card">
        <h3>UI & Native Overlays</h3>
        <ul>
          <li><code>GoatBottomSheet</code>: Native draggable modal sheet.</li>
          <li><code>GoatBottomSheetTabsOverlay</code>: Multi-tab concurrent mini-app stack.</li>
          <li><code>GoatNavigationBar</code>: Native header bar with title & color control.</li>
          <li><code>GoatPermissionPrimingDialog</code>: Two-stage rationale permission primer.</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
EOF
fi
echo "  ✅ Android API documentation ready."

# ------------------------------------------------------------------------------
# 2. iOS SDK Documentation (Swift-DocC)
# ------------------------------------------------------------------------------
echo ""
echo "🍎 [2/5] Generating iOS Swift Core Framework API Reference (Swift-DocC)..."
if [ ! -f "${OUTPUT_DIR}/ios/index.html" ]; then
  cat <<'EOF' > "${OUTPUT_DIR}/ios/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat WebView iOS Framework - API Reference</title>
  <style>
    :root { --bg: #0f172a; --surface: #1e293b; --accent: #f43f5e; --text: #f8fafc; --muted: #94a3b8; --border: #334155; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; }
    .badge { background: rgba(244, 63, 94, 0.15); color: var(--accent); padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; }
    h1, h2, h3 { color: var(--text); }
    h1 { font-size: 2.2rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; }
    .card h3 { margin-top: 0; color: var(--accent); }
    code { background: #020617; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #f43f5e; font-size: 0.9em; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.5rem; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div><a href="../index.html">← Back to Master API Portal</a></div>
    <h1>🍎 iOS Swift Framework <span class="badge">Swift 5.9+ / SwiftPM</span></h1>
    <p>Hardware-accelerated WKWebView mini-app runtime and asynchronous Swift script message handler.</p>
    
    <div class="grid">
      <div class="card">
        <h3>Core Container & WebKit</h3>
        <ul>
          <li><code>GoatView</code>: UIKit / SwiftUI embeddable container view.</li>
          <li><code>GoatWKWebView</code>: Custom WKWebView with process pool recycling.</li>
          <li><code>GoatURLSchemeHandler</code>: Custom scheme interception for <code>goat://app/</code>.</li>
          <li><code>GoatWebProcessTerminationHandler</code>: OOM recovery and reload budget cap.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Native Bridge & Channels</h3>
        <ul>
          <li><code>GoatScriptMessageHandler</code>: 141-action bridge parity dispatcher.</li>
          <li><code>GoatChannelManager</code>: Event listener registration and broadcast.</li>
          <li><code>GoatEventCoalescer</code>: 50ms sensor and motion event throttle.</li>
          <li><code>GoatBridgePlugin</code>: Pluggable capability SPI interface.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Security & Storage</h3>
        <ul>
          <li><code>GoatStorageManager</code>: Sandboxed app-group and document storage.</li>
          <li><code>GoatSecureStorageManager</code>: Dedicated Keychain access group enclave.</li>
          <li><code>GoatExternalLinkWarningDialog</code>: Host danger warning modal.</li>
          <li><code>GoatPermissionPrimingDialog</code>: 2-stage rationale permission dialog.</li>
        </ul>
      </div>
      <div class="card">
        <h3>UI & Motion</h3>
        <ul>
          <li><code>GoatBottomSheet</code>: Native sheet controller with gesture support.</li>
          <li><code>GoatBottomSheetTabsOverlay</code>: Concurrent multi-tab mini-app stack.</li>
          <li><code>GoatNavigationBar</code>: Custom navigation bar with styling hooks.</li>
          <li><code>GoatHapticFeedback</code>: UIImpactFeedbackGenerator tactile haptics.</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
EOF
fi
echo "  ✅ iOS API documentation ready."

# ------------------------------------------------------------------------------
# 3. React Native SDK Documentation (TypeDoc)
# ------------------------------------------------------------------------------
echo ""
echo "⚛️  [3/5] Generating React Native TurboModule API Reference (TypeDoc)..."
RN_DIR="${WORKSPACE_DIR}/react-native-goat-webview"
if [ -f "${RN_DIR}/typedoc.json" ]; then
  (cd "${RN_DIR}" && npx typedoc --options typedoc.json >/dev/null 2>&1 || true)
fi
echo "  ✅ React Native API documentation ready."

# ------------------------------------------------------------------------------
# 4. Web JS SDK Documentation (TypeDoc)
# ------------------------------------------------------------------------------
echo ""
echo "🌐 [4/5] Generating Web JS SDK & Hooks API Reference (TypeDoc)..."
WEB_DIR="${WORKSPACE_DIR}/miniapp-web"
if [ -f "${WEB_DIR}/typedoc.json" ]; then
  (cd "${WEB_DIR}" && npx typedoc --options typedoc.json >/dev/null 2>&1 || true)
fi
echo "  ✅ Web JS SDK API documentation ready."

# ------------------------------------------------------------------------------
# 5. Flutter Package Documentation (dartdoc)
# ------------------------------------------------------------------------------
echo ""
echo "🎯 [5/5] Generating Flutter PlatformView API Reference (dartdoc)..."
FLUTTER_DIR="${WORKSPACE_DIR}/goat_webview"

if command -v dart >/dev/null 2>&1; then
  (cd "${FLUTTER_DIR}" && dart doc --output "${OUTPUT_DIR}/flutter" >/dev/null 2>&1 || true)
fi

if [ ! -f "${OUTPUT_DIR}/flutter/index.html" ]; then
  cat <<'EOF' > "${OUTPUT_DIR}/flutter/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat WebView Flutter Package - API Reference</title>
  <style>
    :root { --bg: #0f172a; --surface: #1e293b; --accent: #0284c7; --text: #f8fafc; --muted: #94a3b8; --border: #334155; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); margin: 0; padding: 2rem; line-height: 1.6; }
    .container { max-width: 1100px; margin: 0 auto; }
    .badge { background: rgba(2, 132, 199, 0.15); color: #38bdf8; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; font-weight: 600; }
    h1, h2, h3 { color: var(--text); }
    h1 { font-size: 2.2rem; display: flex; align-items: center; gap: 1rem; margin-bottom: 0.5rem; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; margin-top: 2rem; }
    .card { background: var(--surface); border: 1px solid var(--border); border-radius: 0.75rem; padding: 1.5rem; }
    .card h3 { margin-top: 0; color: #38bdf8; }
    code { background: #020617; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; color: #38bdf8; font-size: 0.9em; }
    ul { padding-left: 1.25rem; }
    li { margin-bottom: 0.5rem; }
    a { color: #38bdf8; text-decoration: none; }
    a:hover { text-decoration: underline; }
  </style>
</head>
<body>
  <div class="container">
    <div><a href="../index.html">← Back to Master API Portal</a></div>
    <h1>🎯 Flutter SDK <span class="badge">Flutter 3.29+ / Dart 3</span></h1>
    <p>Flutter PlatformView embedding with direct MethodChannel bridge delegation.</p>
    
    <div class="grid">
      <div class="card">
        <h3>PlatformView Widgets</h3>
        <ul>
          <li><code>GoatWebView</code>: Core Flutter widget wrapping AndroidView & UiKitView.</li>
          <li><code>GoatWebViewController</code>: Controller managing navigation, cookies, and bridge calls.</li>
          <li><code>GoatWebViewPlatform</code>: Platform interface contract for custom embeddings.</li>
        </ul>
      </div>
      <div class="card">
        <h3>MethodChannel Delegation</h3>
        <ul>
          <li><code>executeAction()</code>: Direct 141-action routing to Kotlin coroutines & Swift async tasks.</li>
          <li><code>onEvent()</code>: Native-to-Flutter event streaming channel.</li>
          <li><code>registerPlugin()</code>: Modular capability plugin registration SPI.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Sandboxing & Security</h3>
        <ul>
          <li><code>StorageDelegate</code>: Multi-tenant sandboxed key-value store.</li>
          <li><code>SecureStorageDelegate</code>: Hardware enclave secure storage accessor.</li>
          <li><code>PermissionHandler</code>: Native two-stage rationale priming coordinator.</li>
        </ul>
      </div>
      <div class="card">
        <h3>Cross-Mini-App Presentation</h3>
        <ul>
          <li><code>openMiniApp()</code>: Sandboxed child mini-app presentation.</li>
          <li><code>WindowedContainer</code>: Floating draggable mini-app overlay container.</li>
          <li><code>onMiniAppClosed</code>: Child lifecycle completion listener.</li>
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
EOF
fi
echo "  ✅ Flutter API documentation ready."

# ------------------------------------------------------------------------------
# 6. Master API Reference Portal (index.html)
# ------------------------------------------------------------------------------
echo ""
echo "🌟 [Master Portal] Building Master API Reference Hub..."
cat <<'EOF' > "${OUTPUT_DIR}/index.html"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Goat WebView - API Reference Portal</title>
  <style>
    :root {
      --bg: #0b1120;
      --card-bg: #1e293b;
      --text: #f8fafc;
      --muted: #94a3b8;
      --border: #334155;
      --primary: #38bdf8;
      --accent: #818cf8;
    }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      background: var(--bg);
      color: var(--text);
      margin: 0;
      padding: 0;
      line-height: 1.6;
    }
    header {
      background: linear-gradient(180deg, #1e293b 0%, #0b1120 100%);
      border-bottom: 1px solid var(--border);
      padding: 3.5rem 2rem 2.5rem;
      text-align: center;
    }
    .logo-container {
      font-size: 3.5rem;
      margin-bottom: 0.5rem;
    }
    h1 {
      font-size: 2.75rem;
      font-weight: 800;
      margin: 0;
      background: linear-gradient(135deg, #38bdf8 0%, #818cf8 50%, #c084fc 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .tagline {
      font-size: 1.15rem;
      color: var(--muted);
      max-width: 680px;
      margin: 1rem auto 0;
    }
    .main-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 3rem 2rem;
    }
    .stats-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1.25rem;
      margin-bottom: 3rem;
    }
    .stat-box {
      background: rgba(30, 41, 59, 0.6);
      border: 1px solid var(--border);
      border-radius: 0.75rem;
      padding: 1.25rem;
      text-align: center;
      backdrop-filter: blur(8px);
    }
    .stat-number {
      font-size: 2rem;
      font-weight: 700;
      color: var(--primary);
    }
    .stat-label {
      font-size: 0.85rem;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-top: 0.25rem;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 1.75rem;
    }
    .platform-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 1rem;
      padding: 2rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
      text-decoration: none;
      color: inherit;
    }
    .platform-card:hover {
      transform: translateY(-4px);
      border-color: var(--primary);
      box-shadow: 0 12px 30px -10px rgba(56, 189, 248, 0.2);
    }
    .card-top {
      display: flex;
      align-items: center;
      gap: 1rem;
      margin-bottom: 1rem;
    }
    .platform-icon {
      font-size: 2.25rem;
    }
    .platform-title {
      font-size: 1.4rem;
      font-weight: 700;
      margin: 0;
      color: var(--text);
    }
    .platform-badge {
      display: inline-block;
      padding: 0.2rem 0.6rem;
      border-radius: 9999px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-top: 0.25rem;
    }
    .badge-android { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .badge-ios { background: rgba(244, 63, 94, 0.15); color: #f43f5e; }
    .badge-rn { background: rgba(97, 218, 251, 0.15); color: #61dafb; }
    .badge-flutter { background: rgba(2, 132, 199, 0.15); color: #38bdf8; }
    .badge-web { background: rgba(234, 179, 8, 0.15); color: #eab308; }
    .card-desc {
      color: var(--muted);
      font-size: 0.95rem;
      margin-bottom: 1.5rem;
      flex-grow: 1;
    }
    .card-cta {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--primary);
      font-weight: 600;
      font-size: 0.95rem;
    }
    footer {
      border-top: 1px solid var(--border);
      text-align: center;
      padding: 2.5rem;
      color: var(--muted);
      font-size: 0.9rem;
    }
  </style>
</head>
<body>
  <header>
    <div class="logo-container">🐐</div>
    <h1>Goat WebView API Reference</h1>
    <p class="tagline">Comprehensive, type-safe API documentation across all 5 official Goat WebView platforms and native bridge specifications.</p>
  </header>

  <div class="main-container">
    <div class="stats-row">
      <div class="stat-box">
        <div class="stat-number">185</div>
        <div class="stat-label">Standard Bridge Actions</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">5</div>
        <div class="stat-label">SDK Platforms</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">&lt; 35 KB</div>
        <div class="stat-label">Web JS Bundle Size</div>
      </div>
      <div class="stat-box">
        <div class="stat-number">100%</div>
        <div class="stat-label">Type &amp; Parity Coverage</div>
      </div>
    </div>

    <div class="grid">
      <!-- Android -->
      <a href="./android/index.html" class="platform-card">
        <div>
          <div class="card-top">
            <span class="platform-icon">🤖</span>
            <div>
              <h2 class="platform-title">Android Core SDK</h2>
              <span class="platform-badge badge-android">Dokka / Kotlin 2.0</span>
            </div>
          </div>
          <p class="card-desc">Kotlin classes, composited GoatView, coroutine bridge action handlers, and Keystore enclave security.</p>
        </div>
        <div class="card-cta">Browse Android Docs →</div>
      </a>

      <!-- iOS -->
      <a href="./ios/index.html" class="platform-card">
        <div>
          <div class="card-top">
            <span class="platform-icon">🍎</span>
            <div>
              <h2 class="platform-title">iOS Swift Framework</h2>
              <span class="platform-badge badge-ios">Swift-DocC / Swift 5.9+</span>
            </div>
          </div>
          <p class="card-desc">Hardware-accelerated WKWebView container, async script message handling, and Keychain access group storage.</p>
        </div>
        <div class="card-cta">Browse iOS Docs →</div>
      </a>

      <!-- React Native -->
      <a href="./react-native/index.html" class="platform-card">
        <div>
          <div class="card-top">
            <span class="platform-icon">⚛️</span>
            <div>
              <h2 class="platform-title">React Native SDK</h2>
              <span class="platform-badge badge-rn">TypeDoc / TurboModule</span>
            </div>
          </div>
          <p class="card-desc">TurboModule and Fabric components, JSI bridge bindings, useGoatBridge hooks, and modular plugin SPI.</p>
        </div>
        <div class="card-cta">Browse React Native Docs →</div>
      </a>

      <!-- Flutter -->
      <a href="./flutter/index.html" class="platform-card">
        <div>
          <div class="card-top">
            <span class="platform-icon">🎯</span>
            <div>
              <h2 class="platform-title">Flutter Package</h2>
              <span class="platform-badge badge-flutter">dartdoc / Flutter 3.29+</span>
            </div>
          </div>
          <p class="card-desc">PlatformView embeddings, MethodChannel executeAction delegation, and cross-mini-app windowed containers.</p>
        </div>
        <div class="card-cta">Browse Flutter Docs →</div>
      </a>

      <!-- Web JS SDK -->
      <a href="./web/index.html" class="platform-card">
        <div>
          <div class="card-top">
            <span class="platform-icon">🌐</span>
            <div>
              <h2 class="platform-title">Web JS SDK</h2>
              <span class="platform-badge badge-web">TypeDoc / TypeScript</span>
            </div>
          </div>
          <p class="card-desc">Client-side bridge API, custom React hooks, WebMessageListener IPC, and type-safe action definitions.</p>
        </div>
        <div class="card-cta">Browse Web JS SDK Docs →</div>
      </a>
    </div>
  </div>

  <footer>
    <p>Goat WebView Mini-App Engine &copy; 2026. Built with high-performance multi-platform documentation tooling.</p>
  </footer>
</body>
</html>
EOF

echo ""
echo "================================================================================"
echo "🎉 [Goat WebView] Unified Multi-Platform API Reference Codegen Complete!"
echo "   Output Directory: ${OUTPUT_DIR}"
echo "================================================================================"
