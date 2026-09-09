# Migration Guide: Migrating from `flutter_inappwebview` to `goat_webview_compat`

This guide provides exhaustive architectural and API reference documentation for migrating Flutter mini-app host applications from `flutter_inappwebview` (versions 5.x and 6.x) to `goat_webview_compat`.

---

## 1. Overview & Migration Principles

### 1.1 Purpose of `goat_webview_compat`
`goat_webview_compat` is a staged, drop-in compatibility adapter designed to allow existing Flutter code written against `flutter_inappwebview` ^6.1.5 (and legacy 5.x options) to compile and run against the high-performance Goat WebView engine without requiring large-scale rewrites.

By simply replacing the import statement:
```dart
// Before:
import 'package:flutter_inappwebview/flutter_inappwebview.dart';

// After:
import 'package:goat_webview_compat/goat_webview_compat.dart';
```
host applications immediately gain:
- Multi-tenant instance recycling and pre-warmed platform view pooling.
- Hardware-isolated cookie jars and sandbox filesystems per `appId`.
- OWASP MASVS zero-trust mobile security posture.
- Deterministic sub-5ms bridge IPC throughput (`window.flutter_inappwebview.callHandler`).

### 1.2 The 10 Non-Negotiable Guarantees (G1–G10)
All compatibility layers in Goat WebView adhere to 10 strict performance and security guarantees:

1. **G1: Zero-Retention of Configuration Objects**: The widget state (`_InAppWebViewState`) and controller (`InAppWebViewController`) hold zero references to `InAppWebViewSettings`, `URLRequest`, or other config bags. Settings and requests are processed ephemerally on invocation and immediately released to garbage collection.
2. **G2: Memory Overhead Budget**: The adapter enforces an app-process steady-state RAM ceiling ≤ 150 MB and an RSS adapter delta ≤ +150 KB.
3. **G3: Cold-Start Latency Preservation**: Introducing the compat layer adds < 5 ms overhead to cold webview instantiation.
4. **G4: Explicit Controller Lifecycles**: Controllers with their own lifecycles (such as `PullToRefreshController`) manage their state explicitly and are isolated from widget state retention.
5. **G5: Bounded Handler Registry with Mandatory Teardown**: JavaScript handler registrations are maintained in a bounded, per-instance registry on `InAppWebViewController`. Invoking `dispose()` explicitly clears all handler closures and cancels all stream subscriptions.
6. **G6: Pure Mapping Functions**: Conversions from settings bags to engine parameters (e.g. `toCreationParams`) are pure, side-effect-free functions that do not retain input references.
7. **G7: Event-Driven Native Notification Enablement**: Event callbacks (`onReceivedError`, `onReceivedHttpError`, `onPageCommitVisible`, `onConsoleMessage`, etc.) are only enabled natively if the consumer explicitly registers a callback, eliminating cross-language IPC overhead for unused events.
8. **G8: Native External Scheme Resolution (No Blocking IPC)**: External schemes (`tel:`, `sms:`, `mailto:`, `tg:`, `fb:`, `whatsapp:`, `intent://`, and `t.me`) are resolved natively via `compatExternalSchemeResolver: true` without blocking Dart event loop round-trips.
9. **G9: Multi-Tenant Cookie & Sandbox Isolation**: Cookie and storage operations are strictly partitioned by tenant `appId` in accordance with MASVS-STORAGE.
10. **G10: Automated Lint Enforcement**: The custom analyzer plugin `tools/goat_compat_lint` statically enforces that no migration/compat configuration type is stored in long-lived state or class fields (`goat_compat_retained_config`).

---

## 2. Exhaustive Settings Mapping Table (`InAppWebViewSettings`)

`InAppWebViewSettings` defines **37 fields**. In `goat_webview_compat`, fields are strictly segregated into three architectural tiers:
1. **Mapped to Engine Primitives** (10 fields extracted by `toCreationParams` / native platform resolvers).
2. **Engine-Enforced Security Invariants** (11 fields locked to safe zero-trust defaults per OWASP MASVS).
3. **Silently Dropped No-Ops** (16 fields accepted for drop-in compilation with documented no-op semantics).

| # | Setting | Dart Type & Default | Compatibility Status | Engine Behavior & Rationale |
|---|---------|---------------------|----------------------|-----------------------------|
| 1 | `useShouldOverrideUrlLoading` | `bool` (`false`) | **Mapped to Native Resolver** | Deep-link schemes (`tel:`, `sms:`, `mailto:`, `tg:`, `fb:`, `whatsapp:`, `intent://`, and universal link `t.me`) are resolved natively via `compatExternalSchemeResolver: true`. Async blocking Dart navigation vetoes are bypassed by default to uphold Guarantee G8 (no per-navigation thread stalls). |
| 2 | `pullToRefreshEnabled` | `bool` (`false`) | **Mapped to Controller Presence** | Setting on `InAppWebViewSettings` is mapped into `toCreationParams['pullToRefreshEnabled']`; native pull-to-refresh (`SwipeRefreshLayout` / `UIRefreshControl`) is activated if `pullToRefreshController != null` or `pullToRefreshEnabled: true`. |
| 3 | `userAgentSuffix` | `String?` (`null`) | **Mapped Primitive** | Mapped via `toCreationParams['userAgentSuffix']`. Appended to the platform webview user-agent token. |
| 4 | `cacheMode` | `CacheMode` (`loadDefault`) | **Mapped Primitive** | Mapped via `toCreationParams['cacheMode']` (`loadDefault`, `loadCacheElseNetwork`, `loadNoCache`, `loadCacheOnly`) into the native engine cache policy. |
| 5 | `transparentBackground` | `bool` (`false`) | **Mapped Primitive** | Mapped via `toCreationParams['transparentBackground']`. Configures background transparency on the host view container. |
| 6 | `isInspectable` | `bool` (`false`) | **Mapped Primitive & Flavor Bound** | Mapped via `toCreationParams['isInspectable']`. Engine allows remote WebContents/WebKit inspection in debug builds or when explicitly enabled. |
| 7 | `allowsBackForwardNavigationGestures` | `bool` (`true`) | **Mapped Primitive** | Mapped via `toCreationParams['allowsBackForwardNavigationGestures']`. Toggles native iOS edge swipe gestures and Android back-forward gestures. |
| 8 | `mediaPlaybackRequiresUserGesture` | `bool` (`true`) | **Mapped Primitive** | Mapped via `toCreationParams['mediaPlaybackRequiresUserGesture']`. Controls whether HTML5 video/audio playback requires user interaction. |
| 9 | `supportZoom` | `bool` (`true`) | **Mapped Primitive** | Mapped via `toCreationParams['supportZoom']`. Toggles platform built-in zoom controls and pinch-to-zoom gestures. |
| 10 | `contentInsetAdjustmentBehavior` | `ScrollViewContentInsetAdjustmentBehavior` (`never`) | **Mapped Primitive** | Mapped via `toCreationParams['contentInsetAdjustment']`. Configures scroll view content inset behavior against safe area borders. |
| 11 | `useHybridComposition` | `bool` (`true`) | **Honored Implicitly** | Android engine permanently uses Texture Layer Hybrid Composition (`PlatformViewLink` with `PlatformViewsService.initExpensiveAndroidView`); iOS uses native `UiKitView`. |
| 12 | `javaScriptEnabled` | `bool` (`true`) | **Engine Enforced** | Always enabled in the Goat engine; setting to `false` is a no-op as mini-app runtimes strictly require JavaScript execution. |
| 13 | `domStorageEnabled` | `bool` (`true`) | **Engine Enforced** | Always enabled in Goat WebView; setting to `false` is a no-op. |
| 14 | `databaseEnabled` | `bool` (`true`) | **Engine Enforced** | Always enabled in Goat WebView; setting to `false` is a no-op. |
| 15 | `allowFileAccess` | `bool` (`true`) | **Dropped (Security)** | Strictly disabled in native engine per OWASP MASVS MSTG-NETWORK-01 to prevent unauthorized local filesystem traversal. |
| 16 | `allowContentAccess` | `bool` (`true`) | **Dropped (Security)** | Disabled in native engine to isolate mini-apps from content providers. |
| 17 | `allowFileAccessFromFileURLs` | `bool` (`false`) | **Dropped (Security)** | Strictly disabled to eliminate cross-origin file URL exfiltration vectors. |
| 18 | `allowUniversalAccessFromFileURLs` | `bool` (`false`) | **Dropped (Security)** | Strictly disabled to enforce standard same-origin boundaries across all loaded frames. |
| 19 | `mixedContentMode` | `MixedContentMode?` (`null`) | **Dropped (Security)** | Cleartext HTTP traffic within HTTPS frames is permanently blocked per MASVS-NETWORK requirements. |
| 20 | `sharedCookiesEnabled` | `bool` (`false`) | **Dropped (Security)** | Cross-tenant cookie sharing is prohibited. Goat WebView strictly partitions cookies per `appId`. |
| 21 | `thirdPartyCookiesEnabled` | `bool` (`true`) | **Dropped (Isolation)** | Cookie management is scoped to the tenant domain and partition jar; arbitrary 3rd-party cookie tracking is constrained. |
| 22 | `applicationNameForUserAgent` | `String?` (`null`) | **Dropped (No-op)** | Custom application name in user agent is ignored to prevent user-agent spoofing issues; use `userAgentSuffix` instead. |
| 23 | `userAgent` | `String?` (`null`) | **Dropped (No-op)** | Custom full user agent replacement is ignored to prevent breaking platform-specific CSS media queries. |
| 24 | `allowsInlineMediaPlayback` | `bool` (`false`) | **Dropped (No-op)** | WebKit defaults apply. |
| 25 | `verticalScrollBarEnabled` | `bool` (`true`) | **Dropped (No-op)** | Scrollbars are styled and controlled via CSS within the web document. |
| 26 | `horizontalScrollBarEnabled` | `bool` (`true`) | **Dropped (No-op)** | Scrollbars are styled and controlled via CSS within the web document. |
| 27 | `disableHorizontalScroll` | `bool` (`false`) | **Dropped (No-op)** | Viewport scrolling boundaries are governed by CSS (`overflow-x: hidden`). |
| 28 | `disableVerticalScroll` | `bool` (`false`) | **Dropped (No-op)** | Viewport scrolling boundaries are governed by CSS. |
| 29 | `disableContextMenu` | `bool` (`false`) | **Dropped (No-op)** | Standard native context menus apply unless suppressed in JavaScript. |
| 30 | `supportMultipleWindows` | `bool` (`false`) | **Dropped (No-op)** | Window opening requests (`window.open`) are handled according to `GoatPopupRoutingPolicy`. |
| 31 | `limitsNavigationsToAppBoundDomains` | `bool` (`false`) | **Dropped (No-op)** | Domain boundaries are enforced via `GoatWebView.hostDomainAllowlist`. |
| 32 | `incognito` | `bool` (`false`) | **Dropped (No-op)** | Privacy isolation is provided per tenant `appId`. |
| 33 | `clearCache` | `bool` (`false`) | **Dropped (No-op)** | Global or tenant cache purging should be triggered via `GoatWebViewController.clearCache()` or `CookieManager`. |
| 34 | `disableDefaultErrorPage` | `bool` (`false`) | **Dropped (No-op)** | Native error handling is displayed via `onReceivedError` / `onReceivedHttpError`. |
| 35 | `minimumFontSize` | `double` (`8`) | **Dropped (No-op)** | Dynamic type scaling is handled through Flutter accessibility settings. |
| 36 | `initialScale` | `double` (`0`) | **Dropped (No-op)** | Viewport scaling is governed by HTML `<meta name="viewport">`. |
| 37 | `javaScriptCanOpenWindowsAutomatically` | `bool` (`false`) | **Dropped (No-op)** | Window popups are routed through `popupRoutingPolicy`. |

---

## 3. Legacy Options (`InAppWebViewOptions` / `InAppWebViewGroupOptions`)

Codebases migrating from `flutter_inappwebview` 5.x frequently use `InAppWebViewGroupOptions` and `InAppWebViewOptions`. `goat_webview_compat` provides deprecated drop-in shims for these types.

### 3.1 Mapping Legacy Options to Settings
Both `InAppWebViewOptions` and `InAppWebViewGroupOptions` implement `.toSettings()`:

```dart
// Legacy 5.x code:
final options = InAppWebViewGroupOptions(
  crossPlatform: InAppWebViewOptions(
    javaScriptEnabled: true,
    transparentBackground: true,
    useShouldOverrideUrlLoading: true,
    useOnLoadResource: true,
    clearCache: true,
    userAgent: 'custom-ua',
    supportZoom: false,
  ),
);

// Converted via .toSettings():
final InAppWebViewSettings settings = options.toSettings();
```

### 3.2 Handling `useOnLoadResource`
Notice that `useOnLoadResource` existed on `InAppWebViewOptions`, but has no direct field on `InAppWebViewSettings`. In Goat WebView, resource loading events are enabled natively if and only if the `onLoadResource` callback is supplied on the underlying `GoatWebView` (Guarantee G7). Therefore, `useOnLoadResource` is dropped from `.toSettings()` to prevent misconfiguration.

---

## 4. Widget & Callback Parity Guide

### 4.1 Supported Callbacks on `InAppWebView`
The following callbacks on `InAppWebView` are fully supported:

| Callback | Arguments | Description |
|----------|-----------|-------------|
| `onWebViewCreated` | `(InAppWebViewController controller)` | Fired when the native platform view and controller are initialized. |
| `onLoadStart` | `(InAppWebViewController controller, WebUriCompat? url)` | Fired when the web view starts loading a URL. |
| `onLoadStop` | `(InAppWebViewController controller, WebUriCompat? url)` | Fired when the web view finishes loading a URL. |
| `onProgressChanged` | `(InAppWebViewController controller, int progress)` | Fired with load progress percentage (0–100). |
| `onReceivedError` | `(InAppWebViewController controller, WebResourceRequest request, WebResourceError error)` | Fired on network or DNS failure. `error.description` carries the platform-native diagnostic message. |
| `onReceivedHttpError` | `(InAppWebViewController controller, WebResourceRequest request, WebResourceResponse errorResponse)` | Fired on HTTP error status (4xx, 5xx) with `errorResponse.statusCode`. |
| `onPageCommitVisible` | `(InAppWebViewController controller, WebUriCompat? url)` | Fired when the first contentful paint / commit is visible in the view. |
| `onConsoleMessage` | `(InAppWebViewController controller, ConsoleMessage consoleMessage)` | Fired on JavaScript `console.log`, `warn`, `error`, or `debug`. |
| `gestureRecognizers` | `Set<Factory<OneSequenceGestureRecognizer>>?` | Platform view gesture recognizer routing. |
| `pullToRefreshController` | `PullToRefreshController?` | Pull-to-refresh controller handle. |

### 4.2 Omitted & Missing Callbacks
The following `flutter_inappwebview` callbacks are deliberately omitted:

- **`shouldOverrideUrlLoading`**: Omitted to uphold Guarantee G8. In `flutter_inappwebview`, this callback required synchronous/blocking IPC from the native webview to Dart for every link clicked. In Goat WebView, deep links and external apps (`tel`, `sms`, `mailto`, `tg`, `fb`, `whatsapp`, `intent`, `t.me`) are resolved natively and instantly via `compatExternalSchemeResolver: true`. If your application requires complex, custom URL intercept logic (e.g. OAuth query code extraction), refer to Section 7 for the standalone browser fallback strategy.
- **`onReceivedServerTrustAuthRequest`**: Intentionally omitted. SSL certificate error bypasses in production mobile applications are classified as critical security vulnerabilities (CWE-295 / OWASP MASVS-NETWORK). For development environments, valid TLS certificates must be deployed.
- **`onLoadResource` / `onUpdateVisitedHistory`**: Not wired on `InAppWebView` in the compat adapter. (Available directly on `GoatWebView` if needed).
- **`onContentSizeChanged` / `onRenderProcessGone`**: Omitted. Uncaught process terminations are captured via `GoatWebView.onAppServiceCrash`.
- **`onJsAlert` / `onJsConfirm` / `onJsPrompt`**: Standard browser dialogs are suppressed in mini-app runtimes; bridge communication should be used instead.

---

## 5. Controller API Parity Guide

### 5.1 Supported Methods on `InAppWebViewController`
`InAppWebViewController` acts as a zero-retention façade over `GoatWebViewController`:

| Method | Signature | Description |
|--------|-----------|-------------|
| `addJavaScriptHandler` | `void addJavaScriptHandler({required String handlerName, required JavaScriptHandlerCallback callback})` | Registers a named JavaScript bridge handler. Lazily subscribes to `onBridgeMessage`. |
| `removeJavaScriptHandler`| `void removeJavaScriptHandler({required String handlerName})` | Unregisters a named JavaScript bridge handler. |
| `evaluateJavascript` | `Future<String?> evaluateJavascript({required String source})` | Evaluates JavaScript string in the active document. |
| `canGoBack` | `Future<bool> canGoBack()` | Returns `true` if back navigation history exists. |
| `goBack` | `Future<void> goBack()` | Navigates back in history. |
| `canGoForward` | `Future<bool> canGoForward()` | Returns `true` if forward navigation history exists. |
| `goForward` | `Future<void> goForward()` | Navigates forward in history. |
| `reload` | `Future<void> reload()` | Reloads the current page. |
| `getUrl` | `Future<String?> getUrl()` | Returns the current URL. |
| `getTitle` | `Future<String?> getTitle()` | Returns the document title. |
| `loadUrl` | `Future<bool> loadUrl({required URLRequest urlRequest})` | Loads a URL from a `URLRequest`. Discards the request object immediately (G1). |
| `setRefreshing` | `Future<bool> setRefreshing(bool refreshing)` | Programmatically toggles the pull-to-refresh spinner. |
| `isRefreshing` | `Future<bool> isRefreshing()` | Queries whether the pull-to-refresh spinner is currently active. |
| `dispose` | `void dispose()` | Cancels all subscriptions, clears the handler registry, and disables the controller. |

### 5.2 JavaScript Bridge Emulation (`window.flutter_inappwebview`)
In `flutter_inappwebview`, web pages communicate with Flutter using:
```javascript
window.flutter_inappwebview.callHandler('handlerName', arg1, arg2).then(result => { ... });
```
`goat_webview_compat` automatically injects `compatBootstrapScript` at document start before any page script executes. This script establishes a compatible `window.flutter_inappwebview.callHandler` shim on top of Goat's underlying high-speed `window.nativeBridge`.

When a JavaScript call occurs:
1. The JS shim packages the call with action `__COMPAT_CALL__` and a unique `__compatRequestId`.
2. `InAppWebViewController` intercepts the message, unpacks the arguments, and executes the registered Dart callback.
3. The result is JSON-encoded and dispatched back into JavaScript via `window.__compatResolve($requestId, $result)`, resolving the JavaScript Promise seamlessly.

### 5.3 `CookieManager` Multi-Tenant Partitioning
`CookieManager.instance()` provides cookie manipulation methods:
- `removeSessionCookies({String appId = 'default'})`
- `deleteCookies({required String url, required String name, String appId = 'default'})`
- `deleteAllCookies({String appId = 'default'})`

**Important Note on Android Remote URLs**:
In URL-mode mini-apps loading remote HTTPS origins, `deleteAllCookies` resolves the tenant origin via `getTenantOrigin(appId)` (a virtual asset origin) and does not purge cookies on remote third-party HTTPS domains. Use `deleteCookies(url: ..., name: ...)` for targeted remote cookie deletion.

---

## 6. Zero-Retention Architecture & Custom Lint Rules

### 6.1 Why Storing Configuration Violates Memory Contracts (G1)
In many legacy Flutter apps, developers store configuration instances as mutable fields:
```dart
// ❌ INCORRECT (Anti-Pattern): Retaining config objects in State
class _MyScreenState extends State<MyScreen> {
  // Retaining this reference forces memory retention across the screen lifecycle
  final InAppWebViewSettings _settings = InAppWebViewSettings(
    isInspectable: true,
    cacheMode: CacheMode.loadNoCache,
  );
  ...
}
```
In super-app environments running dozens of concurrent or recycled mini-apps, retaining immutable settings bags, URL requests, and options trees leads to memory bloat and prevents garbage collection of associated string headers and parameters.

Goat WebView enforces **Zero-Retention**:
- Configuration objects must be constructed inline or passed ephemerally.
- State classes and controllers must never store fields of banned configuration types.

### 6.2 Enabling `tools/goat_compat_lint`
To detect and eliminate retained configuration anti-patterns during compilation, enable the custom linter plugin in your project's `analysis_options.yaml`:

```yaml
include: package:flutter_lints/flutter.yaml

analyzer:
  plugins:
    - custom_lint

linter:
  rules:
    prefer_const_constructors: true
    prefer_const_declarations: true
```

And include `goat_compat_lint` in your `pubspec.yaml`:
```yaml
dev_dependencies:
  custom_lint: ^0.6.4
  goat_compat_lint:
    path: ../tools/goat_compat_lint
```

The lint rule `goat_compat_retained_config` flags any field, top-level variable, or state notifier that stores any of the banned types:
- `InAppWebViewSettings`
- `InAppWebViewGroupOptions`
- `InAppWebViewOptions`
- `URLRequest`
- `PullToRefreshSettings`
- `LoadedResource`

### 6.3 Refactoring Example (Before and After)

#### Before (Triggers `goat_compat_retained_config` Lint Violation):
```dart
class MyMiniAppScreen extends StatefulWidget {
  const MyMiniAppScreen({super.key});

  @override
  State<MyMiniAppScreen> createState() => _MyMiniAppScreenState();
}

class _MyMiniAppScreenState extends State<MyMiniAppScreen> {
  // LINT ERROR: goat_compat_retained_config
  final InAppWebViewSettings _settings = const InAppWebViewSettings(
    isInspectable: true,
  );

  // LINT ERROR: goat_compat_retained_config
  final URLRequest _initialRequest = URLRequest(
    url: WebUri('https://miniapp.enterprise.com'),
  );

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      initialUrlRequest: _initialRequest,
      initialSettings: _settings,
    );
  }
}
```

#### After (Compliant Zero-Retention Implementation):
```dart
class MyMiniAppScreen extends StatefulWidget {
  const MyMiniAppScreen({super.key});

  @override
  State<MyMiniAppScreen> createState() => _MyMiniAppScreenState();
}

class _MyMiniAppScreenState extends State<MyMiniAppScreen> {
  // Zero stored config fields — only transient widget references in build()
  InAppWebViewController? _controller;

  @override
  Widget build(BuildContext context) {
    return InAppWebView(
      initialUrlRequest: URLRequest(
        url: WebUri('https://miniapp.enterprise.com'),
      ),
      initialSettings: const InAppWebViewSettings(
        isInspectable: true,
      ),
      onWebViewCreated: (controller) {
        _controller = controller;
      },
    );
  }

  @override
  void dispose() {
    // Controller is explicitly cleaned up
    _controller?.dispose();
    _controller = null;
    super.dispose();
  }
}
```

---

## 7. Drop-in vs. Standalone Browser Fallback Guidance

Not every WebView use case belongs inside a mini-app runtime. The table below outlines when to use `goat_webview_compat` versus when to retain a full standalone browser package or system custom tab.

### 7.1 Decision Matrix

| Use Case / Scenario | Recommended Solution | Rationale |
|---------------------|----------------------|-----------|
| **Interactive Mini-App Screens** | `goat_webview_compat` | High performance, instant pre-warmed pooling, zero leak overhead, bridge handler support. |
| **Micro-Frontends & Bundled Web Apps** | `goat_webview_compat` | Secure sandbox isolation, encrypted asset storage, native scheme resolution. |
| **In-App Payment / E-Commerce Flows** | `goat_webview_compat` | Native bridge support, zero-retention memory guarantees. |
| **Terms of Service / Privacy Policy Docs** | Standalone Browser Fallback (e.g. `url_launcher`) | Static content requiring full OS browser chrome or custom tabs. |
| **OAuth 2.0 / SSO Login Flows** | Standalone Browser Fallback (e.g. `flutter_inappwebview` / `url_launcher`) | OAuth interceptors that require synchronous navigation vetoes (`shouldOverrideUrlLoading` blocking on query params) or `WebAuthenticationSession`. |
| **Full Browser Dialogs with URL Bar** | Standalone Browser Fallback | Browsing arbitrary external web links with back/forward/refresh chrome. |
| **Self-Signed Certificates / Cert Bypasses** | Standalone Browser Fallback | Goat WebView enforces strict zero-trust certificate validation in production. |

### 7.2 Coexistence Strategy in `pubspec.yaml`
If your project requires `goat_webview_compat` for mini-apps while temporarily keeping `flutter_inappwebview` for an existing OAuth dialog or legacy browser screen, both packages can coexist without namespace collision by using Dart library prefixing or selective imports:

```yaml
# pubspec.yaml
dependencies:
  flutter:
    sdk: flutter
  # Goat compat adapter for high-performance mini-apps
  goat_webview_compat:
    path: ../goat_webview_compat
  # Standalone browser for legacy OAuth dialogs
  flutter_inappwebview: ^6.1.5
```

In your Dart code, use selective imports:

```dart
// For mini-app screens:
import 'package:goat_webview_compat/goat_webview_compat.dart';

// For standalone browser dialogs:
import 'package:flutter_inappwebview/flutter_inappwebview.dart' as standalone_browser;

void openStandaloneOAuthDialog(BuildContext context, String authUrl) {
  Navigator.of(context).push(
    MaterialPageRoute(
      builder: (_) => standalone_browser.InAppBrowser(),
    ),
  );
}
```
This ensures zero naming collisions while providing a seamless, risk-free migration path.
