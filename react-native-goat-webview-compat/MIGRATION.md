# Migration Guide: Migrating from `react-native-webview` to `react-native-goat-webview-compat`

This guide provides exhaustive architectural and API reference documentation for migrating React Native mini-app host applications from `react-native-webview` (versions 13.x through 16.x) to `react-native-goat-webview-compat`.

---

## 1. Overview & Migration Principles

### 1.1 Purpose of `react-native-goat-webview-compat`
`react-native-goat-webview-compat` is a staged, drop-in compatibility adapter designed to allow existing React Native code written against `react-native-webview` to compile and run against the high-performance Goat WebView engine without requiring large-scale rewrites of JSX, ref calls, or in-page communication scripts.

By simply replacing the import statement:
```tsx
// Before:
import { WebView } from 'react-native-webview';

// After:
import { WebView } from 'react-native-goat-webview-compat';
```
host applications immediately gain:
- React Native New Architecture (Fabric NativeComponent + TurboModule) integration.
- Hardware-isolated cookie jars and sandbox filesystems per `appId`.
- OWASP MASVS zero-trust mobile security posture.
- Deterministic sub-5ms bridge IPC throughput (`window.ReactNativeWebView.postMessage`).
- Tree-shaking guarantees (`"sideEffects": false` ESM build, < 2.7 KB gzipped full surface).

### 1.2 The 10 Non-Negotiable Guarantees (G1–G10)
All compatibility layers in Goat WebView adhere to 10 strict performance and architectural guarantees:

1. **G1 — Zero-Retention of Configuration Objects**: The consumer's `source`, prop object, `injectedJavaScript`, `originWhitelist`, etc. are consumed **once** into a flat primitive `creationProps` object (`toCreationProps`), then unreachable. The wrapper component does not keep the props/`source` object in `state`, a `ref`, a class field, or module-scope variables.
2. **G2 — Lazy Native Allocation Released on Unmount**: Compat features the page never uses (pull-to-refresh, cookie clear, opt-in scroll/HTTP error forwarding) allocate no JS objects and trigger no native allocation until invoked, and every native object/listener is freed on unmount.
3. **G3 — Tree-Shakeable**: `package.json` sets `"sideEffects": false`; ships an ESM `module` build. Importing `<WebView>` only adds ≤ 2.5 KB gzipped and completely shakes away `CookieManager`.
4. **G4 — No Per-Render Allocation**: Document-start bootstrap is a module-level `const string`. Prop-to-primitive mapping is memoised via `useMemo` on primitive inputs, never rebuilt each render, never stored beyond the current element.
5. **G5 — Bounded, Cleared Maps**: In-flight message and subscription state is bounded and cleared on component unmount. No module-global map keyed by view tag.
6. **G6 — No Idle Work**: The adapter creates zero `setInterval`, no polling loops, no keep-alive background tasks, and no animation frame loops.
7. **G7 — Opt-In Event Bridging**: Native-to-JS forwarding for `onScroll`, `onHttpError`, `onRenderProcessGone`, `onContentProcessDidTerminate` uses the `hasOnX` pattern: native events are emitted if and only if the consumer provided that callback.
8. **G8 — No Default Per-Navigation Round-Trip**: `onShouldStartLoadWithRequest` async veto is off by default. Default navigation uses native `originWhitelist` evaluation and native scheme resolution (`tel:`, `sms:`, `mailto:`, `tg:`, `whatsapp:`, `intent:`, `t.me`) without blocking the JS event loop.
9. **G9 — Static Compat Bootstrap**: The `window.ReactNativeWebView` shim JS is one `const string` injected once per document by the engine's document-start hook (`compatBootstrapScript`).
10. **G10 — Perf/RAM Budget CI Gate**: The benchmark harness enforces app-process steady-state RAM ≤ 150 MB and candidate RSS overhead ≤ +150 KB.

---

## 2. Exhaustive Props Mapping Table (`WebViewProps`)

`WebViewProps` in `react-native-goat-webview-compat` is methodically categorized into three tiers:
1. **Supported & Mapped Props** (directly wired to the Fabric host component, React state, or document injection).
2. **Accepted for Compatibility / Documented No-Ops** (accepted so TypeScript compiles without errors, but inert or engine-enforced).
3. **Omitted / Unsupported Props** (advanced browser capabilities not applicable to sandboxed mini-app runtimes).

### 2.1 Supported & Mapped Props

| Prop Name | Type | Description & Engine Mapping |
| :--- | :--- | :--- |
| `source` | `WebViewSource` (`{ uri }` \| `{ html, baseUrl }`) | Extracted via `toCreationProps`. `uri` maps to `GoatWebViewNativeComponent.initialUrl`. `html` is accepted for inline HTML documents. |
| `appId` | `string` (default `'default'`) | **Goat Extension**: Selects the isolated multi-tenant partition for storage, cookies, and permissions. |
| `assetBundleName` | `string` (default `'miniapp.zip'`) | **Goat Extension**: Virtual asset bundle filename when loading packaged mini-apps. |
| `injectedJavaScriptBeforeContentLoaded` | `string` | Injected into the document at `document-start` via `initialUserScripts` immediately after `compatBootstrapScript`. |
| `injectedJavaScript` | `string` | Executed upon document load via `injectJavaScript` Fabric command. |
| `injectedJavaScriptObject` | `Record<string, unknown>` | Exposed synchronously in JavaScript via `window.ReactNativeWebView.injectedObject`. |
| `pullToRefreshEnabled` | `boolean` (default `false`) | Lazily attaches platform-native pull-to-refresh (`SwipeRefreshLayout` on Android, `UIRefreshControl` on iOS). |
| `incognito` | `boolean` (default `false`) | Maps to ephemeral, non-persistent session storage in the native engine. |
| `originWhitelist` | `readonly string[]` | Compiled to regular expressions. Non-matching external navigations are routed via React Native's `Linking.openURL`. |
| `onLoadStart` | `(event: WebViewNavigationEvent) => void` | Synthesized from native `onPageStarted` event. |
| `onLoad` | `(event: WebViewNavigationEvent) => void` | Synthesized from native `onPageLoaded` event upon successful load. |
| `onLoadEnd` | `(event: WebViewNavigationEvent \| WebViewErrorEvent) => void` | Synthesized on either load completion or load failure. |
| `onLoadProgress` | `(event: { nativeEvent: { progress: number } }) => void` | Normalized progress updates from native `onProgressChanged` (0.0 to 1.0). |
| `onNavigationStateChange` | `(event: WebViewNavigation) => void` | Fired on `onPageStarted`, `onPageLoaded`, and document title updates with `url`, `title`, `loading`, `canGoBack`, `canGoForward`. |
| `onError` | `(event: WebViewErrorEvent) => void` | Fired when page network or DNS loading fails with platform error description. |
| `onHttpError` | `(event: WebViewHttpErrorEvent) => void` | Opt-in (G7): Enabled via `hasOnHttpError`. Fired on HTTP error status codes (4xx, 5xx). |
| `onMessage` | `(event: WebViewMessageEvent) => void` | Receives messages posted from within the page via `window.ReactNativeWebView.postMessage(data)`. |
| `onScroll` | `(event: NativeSyntheticEvent<{ x: number, y: number }>) => void` | Opt-in (G7): Enabled via `hasOnScroll`. Dispatches scroll offset changes. |
| `onRenderProcessGone` | `(event: { nativeEvent: { didCrash: boolean } }) => void` | Captures Android WebContents render process terminations or out-of-memory terminations. |
| `onContentProcessDidTerminate` | `(event: NativeSyntheticEvent<Record<string, never>>) => void` | Captures iOS WebKit WKWebView content process terminations. |
| `startInLoadingState` | `boolean` | Initializes component in loading state for placeholder rendering. |
| `renderLoading` | `() => ReactElement` | Custom loading component rendered while `state.loading === true`. |
| `renderError` | `(domain, code, desc) => ReactElement` | Custom error component rendered when `state.hasError === true`. |
| `style`, `containerStyle` | `StyleProp<ViewStyle>` | Styles applied to host `View` and `GoatWebViewNativeComponent`. |
| `testID` | `string` | Automation and test identifier. |

### 2.2 Accepted for Compatibility (Documented No-Ops)

| Prop Name | Type & Default | Behavior & Migration Rationale |
| :--- | :--- | :--- |
| `cacheMode` | `CacheMode` (`'LOAD_DEFAULT'`) | Caching is governed by Goat WebView's multi-tier caching engine. |
| `userAgent` | `string?` | Standard mobile WebKit/Blink user agent strings are maintained for uniform rendering. |
| `applicationNameForUserAgent` | `string?` | Mapped to `userAgentSuffix` in `toCreationProps`. |
| `webviewDebuggingEnabled` | `boolean` (`false`) | WebContents / WebKit debugging is bound to the debug/staging build flavor for production security. |
| `mediaPlaybackRequiresUserAction`| `boolean` (`true`) | Standard platform HTML5 media autoplay rules apply. |
| `javaScriptCanOpenWindowsAutomatically` | `boolean` (`false`) | Popups are managed per `GoatPopupRoutingPolicy`. |
| `javaScriptEnabled` | `boolean` (`true`) | Always enabled in Goat WebView; setting to `false` is a no-op as mini-apps require JS execution. |
| `webviewBackgroundColor` | `string?` | Background opacity and color are governed by the parent host container styling. |
| `onShouldStartLoadWithRequest` | `(req: ShouldStartLoadRequest) => boolean` | Async blocking JS vetoes are disabled by default (G8) to avoid UI thread jank; external schemes are resolved natively. |
| `onFileDownload` | `(event: FileDownloadEvent) => void` | Accepted in props; file download flows in mini-apps should use the sandboxed `FS_DOWNLOAD_FILE` bridge action. |
| `onOpenWindow` | `(event: WebViewOpenWindowEvent) => void` | Window opening requests are routed natively per `popupRoutingPolicy`. |

### 2.3 Omitted / Unsupported Props

The following props from `react-native-webview` are not supported in `react-native-goat-webview-compat` and should be removed during migration:
- `allowsBackForwardNavigationGestures` (use Android back buttons or mini-app navigation actions)
- `allowsInlineMediaPlayback` (WebKit defaults apply)
- `bounces` / `overScrollMode` (governed by CSS scroll bouncing)
- `dataDetectorTypes` (not active in mini-app documents)
- `decelerationRate`
- `domStorageEnabled` / `databaseEnabled` (permanently enabled in engine)
- `keyboardDisplayRequiresUserAction`
- `scalesPageToFit`
- `sharedCookiesEnabled` / `thirdPartyCookiesEnabled` (prohibited by multi-tenant partition boundaries)
- `allowsAirPlayForMediaPlayback` / `allowsProtectedMedia`
- `menuItems` / `onCustomMenuSelection`
- `nativeConfig` (the native component is fixed to `GoatWebViewNativeComponent`)

---

## 3. Exhaustive Fabric Commands & Ref Methods Table

The `WebViewRef` returned by `useImperativeHandle` mirrors `react-native-webview`'s ref interface:

| Method | Signature | Execution Mechanism & Fallback |
| :--- | :--- | :--- |
| `goBack` | `() => void` | Dispatches Fabric command `Commands.goBack(nativeRef)`. If unmounted, falls back to TurboModule `GoatWebViewNativeModule.executeAction('NAVIGATE_BACK')`. |
| `goForward` | `() => void` | Dispatches Fabric command `Commands.goForward(nativeRef)`. |
| `reload` | `() => void` | Dispatches Fabric command `Commands.reload(nativeRef)`. |
| `stopLoading` | `() => void` | Dispatches Fabric command `Commands.stopLoading(nativeRef)`. |
| `postMessage` | `(data: string) => void` | Dispatches Fabric command `Commands.postMessage(nativeRef, data)` for direct host-to-page messaging. |
| `injectJavaScript` | `(data: string) => void` | Dispatches Fabric command `Commands.injectJavaScript(nativeRef, data)`. |
| `requestFocus` | `() => void` | Dispatches Fabric command `Commands.requestFocus(nativeRef)`. |
| `clearCache` | `(includeDiskFiles: boolean) => void` | Dispatches Fabric command `Commands.clearCache(nativeRef, includeDiskFiles)`. Falls back to `GoatWebViewNativeModule.clearCache(appId)`. |
| `clearHistory` | `() => void` | **Android Fabric command**: Purges the back-forward navigation history list (`Commands.clearHistory`). |
| `clearFormData` | `() => void` | **Android Fabric command**: Clears stored autocomplete form data (`Commands.clearFormData`). |

---

## 4. In-Page Bridge Emulation (`window.ReactNativeWebView`)

In `react-native-webview`, JavaScript running inside the webview communicates with the React Native host using:
```javascript
window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'EVENT_NAME', payload: { ... } }));
```

`react-native-goat-webview-compat` automatically injects `compatBootstrapScript` at `document-start` before any page script executes.

### 4.1 How It Works
1. The bootstrap script defines `window.ReactNativeWebView` on `window`.
2. When the page calls `window.ReactNativeWebView.postMessage(data)`:
   - The call is mapped to Goat WebView's underlying high-speed `window.nativeBridge.postMessage`.
   - The action is set to `__RNW_MESSAGE__`, and the message data is packaged into the payload.
3. The native `GoatWebViewNativeComponent` emits an `onBridgeMessage` event to the React Native component.
4. `WebView.tsx` intercepts `__RNW_MESSAGE__`, reconstructs the `WebViewMessageEvent`, and executes `props.onMessage`.

---

## 5. Multi-Tenant Cookie Management (`CookieManager`)

`CookieManager` provides drop-in compatibility for clearing cookies:

```typescript
import { CookieManager } from 'react-native-goat-webview-compat';

// Clear all cookies for the default mini-app partition:
await CookieManager.clearAll();

// Clear cookies for a specific tenant partition:
await CookieManager.clearAll('tenant_sub_app');

// Clear a specific cookie by name:
await CookieManager.clearByName('https://api.example.com', 'session_token', 'tenant_sub_app');
```

---

## 6. Zero-Retention Architecture & ESLint Rule

### 6.1 Why Retaining Config Violates Performance Contracts (G1)
In React Native, storing configuration objects or prop bags in component state or persistent refs prevents garbage collection of headers, URIs, and payload strings across the app lifecycle:

```tsx
// ❌ INCORRECT (Anti-Pattern): Retaining config objects in ref/state
function BadMiniAppScreen() {
  // Retaining this reference forces memory retention across all screen renders
  const savedProps = useRef<WebViewProps>({
    source: { uri: 'https://miniapp.enterprise.com' },
  });
  ...
}
```

Goat WebView enforces **Zero-Retention (G1)**:
- `props` are consumed ephemerally into primitive fields via `toCreationProps`.
- No module-level, ref-level, or class-level retention of `WebViewProps`, `WebViewSource`, or `CreationProps`.

### 6.2 Enabling `eslint-plugin-no-retained-compat-config`
The companion ESLint rule statically verifies compliance with Guarantee G1.

Add the plugin to your project's `.eslintrc.js`:
```javascript
module.exports = {
  plugins: ['react-native-goat-webview-compat'],
  rules: {
    'react-native-goat-webview-compat/no-retained-compat-config': 'error',
  },
};
```

#### Rule Test Cases:
- **Disallowed**:
  - `const config: WebViewProps = ...` at module scope.
  - `const src: WebViewSource = ...` at module scope.
  - `const r = useRef<WebViewProps>(null)` in components.
  - `class Screen { private cfg: CreationProps; }`.
- **Allowed**:
  - Building props inline and passing directly into `<WebView source={{ uri: '...' }} />`.

---

## 7. Drop-In Mini-App vs. Standalone Browser Fallback Guidance

### 7.1 Decision Matrix

| Use Case / Scenario | Recommended Solution | Rationale |
| :--- | :--- | :--- |
| **Interactive Mini-App Screens** | `react-native-goat-webview-compat` | High performance, instant pre-warmed pooling, zero leak overhead, Fabric native commands. |
| **Micro-Frontends & Bundled Web Apps** | `react-native-goat-webview-compat` | Sandboxed isolation, encrypted asset storage, native deep-link scheme resolution. |
| **Checkout / In-App Payment Flow** | `react-native-goat-webview-compat` | Native bridge support, zero-retention memory guarantees. |
| **OAuth 2.0 / SSO Login Flows** | Standalone Browser Fallback (e.g. `react-native-inappbrowser-reborn`) | OAuth flows require full system browser sessions, `ASWebAuthenticationSession` / Custom Tabs for session sharing. |
| **General Web Browsing with URL Bar** | Standalone Browser Fallback | Browsing arbitrary external web links with address bars, back/forward buttons, sharing menus. |
| **Self-Signed Certificates / Cert Bypasses** | Standalone Browser Fallback | Goat WebView enforces strict zero-trust certificate validation in production. |

### 7.2 Coexistence Strategy in `package.json`
If your project requires `react-native-goat-webview-compat` for mini-apps while temporarily keeping `react-native-webview` for an existing legacy screen or OAuth browser dialog, both packages can coexist without naming collisions:

```json
{
  "dependencies": {
    "react-native-goat-webview-compat": "file:./react-native-goat-webview-compat",
    "react-native-webview": "^13.8.0"
  }
}
```

In your application code:
```tsx
// For high-performance mini-app screens:
import { WebView as GoatWebView } from 'react-native-goat-webview-compat';

// For standalone arbitrary web browsing:
import { WebView as LegacyBrowser } from 'react-native-webview';
```

---

## 8. Verification & Quality Gates

The compatibility adapter is verified on every build:
- **Unit & Lifecycle Tests**: `npm test` runs 31 tests across 4 test suites (mount/unmount leak verification, cookie isolation, creation prop purity, and bridge messaging).
- **Static Analysis & Lint Enforcement**: `npm run test:lint-rule` validates `no-retained-compat-config` against AST fixtures.
- **TypeScript Build**: `npm run build` compiles CommonJS, ESM, and Type Declaration targets.
- **Size Budget Gate**: `npm run check:size` enforces that the full bundle is ≤ 20 KB gzipped (currently ~2.6 KB) and proves that `CookieManager` is cleanly tree-shaken when importing only `<WebView>`.
