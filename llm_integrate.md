# Integrating Goat WebView — a guide for developers and coding agents

This is a single-file, task-oriented integration reference. It is written to be read top-to-bottom
by a developer *or* an LLM coding assistant that has been asked to "add Goat WebView to this app".
Every code path below is backed by source in this repository; where a capability is partial,
simulated, or alpha-only it is called out explicitly rather than smoothed over.

For narrative, per-platform deep dives see `docs-site/docs/getting-started/` (`host-android.md`,
`host-ios.md`, `host-flutter.md`, `host-react-native.md`, `quickstart.md`). This file is the
orientation layer above them.

---

## 1. What Goat WebView is (and is not)

**Is:** an embeddable, sandboxed, WeChat-style **mini-app WebView engine**. A host app (Android,
iOS, Flutter, React Native, or a plain browser page) mounts one engine view; sandboxed web
"mini-apps" run inside it and reach native capabilities through a single audited message bridge
(**210 declared actions across 18 domains**). Multi-tenant: every `appId` gets its own storage,
cookie jar, filesystem area, and hardware-keystore namespace.

**Is not:** a general-purpose drop-in for the system WebView for arbitrary third-party web content.
The security model assumes the content you load is *your* mini-app bundle (served from the virtual
origin `https://appassets.androidplatform.net` / `goat://assets/…`) or a URL you control.

---

## 2. Repository coordinates

| | |
|---|---|
| Version | `1.0.0-alpha.2` (Flutter/iOS/RN packages), Android `com.goat.webview:*` `1.0.0-alpha.2` |
| Git tag consumers pin | `v1.0.0-alpha.2` |
| GitHub slug | `CHANDARA-code/goat_webview` |
| License | MIT |
| Branch this doc ships on | `release/v1.0.0-alpha.2` |

> **Alpha.** Prerelease version selectors do not match `from:` / `^` ranges by default — pin the
> exact version (`exact: "1.0.0-alpha.2"`, `:tag => 'v1.0.0-alpha.2'`, `goat_webview: 1.0.0-alpha.2`).

---

## 3. Which package do I need?

```
Are you the HOST app embedding the engine?
├── Android (Kotlin/Compose) ....... com.goat.webview:core   (+ :features-all-in for hardware plugins)
├── iOS (Swift/SwiftUI/UIKit) ....... SwiftPM "GoatWebView"   (+ "GoatWebViewAllIn" or single feature libs)
├── Flutter ........................ goat_webview  (+ goat_webview_biometrics / _payments / … companions)
├── React Native ................... react-native-goat-webview
└── Web page hosting a mini-app iframe/runtime ... miniapp-web/src/miniapp-bridge (or the prebuilt min.js)

Are you MIGRATING an app off another WebView library?
├── from flutter_inappwebview ....... goat_webview_compat        (drop-in value types + widget/controller façade)
└── from react-native-webview ....... react-native-goat-webview-compat  (drop-in <WebView>)

Are you writing the MINI-APP (the web content that runs inside)?
├── plain JS/TS .................... import { GoatBridge } from 'miniapp-web/src/miniapp-bridge'
├── WeChat / Alipay / uni-app / Taro source you want to run unmodified ... @goat/adapter-dsl (see §8 — partial)
└── local dev without a host ....... @goat/bridge-mock  (zero-dependency browser bridge simulator)
```

---

## 4. Minimal host integration per platform

All snippets load the default mini-app bundle from the engine's virtual origin. Swap `initialUrl`
for a URL you control if you are in "remote mini-app" mode.

### 4.1 Android

```kotlin
// build.gradle.kts
dependencies {
    implementation("com.goat.webview:core:1.0.0-alpha.2")
    implementation("com.goat.webview:features-all-in:1.0.0-alpha.2") // BLE/NFC/Location/Media/Scanner/Biometrics/Payments/Sensors/Web3
    implementation("com.goat.webview:core-compose:1.0.0-alpha.2")    // only if you use the Composable
    implementation("androidx.webkit:webkit:1.11.0")
}
```

**Jetpack Compose (turnkey — manages bundle extraction + init):**

```kotlin
import com.goat.webview.compose.GoatWebView

@Composable
fun MiniAppScreen() {
    GoatWebView(
        appId = "com.mycompany.miniapp",
        modifier = Modifier.fillMaxSize(),
        onAppServiceReady = { appId -> /* mini-app worker thread is up */ },
        onAppServiceCrash = { appId, err -> /* handle */ },
    )
}
```

`:core-compose` is a **separate module** — a View-based host pays zero Compose cost, and `:core`
exposes no Compose APIs.

**Plain View:** `com.goat.webview.view.GoatView` is a `FrameLayout`. Construct with a `Context`,
then `initialize(assetDir, appId = "…", entryUrl = null)` (pass `assetDir = null` for URL mode and
call `loadUrl(url)`); forward `onResume()` / `onPause()` / `destroy()` from the host lifecycle.
`var hostDomainAllowlist: Set<String>?` restricts navigation for a URL-mode mini-app. Full
walk-through: `docs-site/docs/getting-started/host-android.md`.

Feature plugins (`:features-all-in`) **auto-register**. To add a custom bridge action, implement
`com.goat.webview.GoatBridgePlugin` and register it — never edit a core dispatcher. Optional
warm-start: `GoatFastPool.registerMemoryCallbacks(this)` in `Application.onCreate()` (pool prewarm
auto-skips on `<= 3 GB` / `isLowRamDevice()` — `GoatDeviceTier`).

### 4.2 iOS

```swift
// Package.swift
dependencies: [ .package(url: "https://github.com/CHANDARA-code/goat_webview.git", exact: "1.0.0-alpha.2") ]
// target deps: "GoatWebView" (core) or "GoatWebViewAllIn", or single libs:
//   GoatWebViewMedia / GoatWebViewScanner / GoatWebViewLocation / GoatWebViewBiometrics / GoatWebViewBluetooth / GoatWebViewNetwork
```

```ruby
# Podfile alternative — subspecs: Core, Media, Scanner, Location, Biometrics, Bluetooth, Network
pod 'GoatWebView', :git => 'https://github.com/CHANDARA-code/goat_webview.git', :tag => 'v1.0.0-alpha.2'
```

`GoatWebView.GoatView` is a `UIView` (`init(frame:)`, then `initialize(appId:initialRoute:)`) — for
SwiftUI, wrap it in a `UIViewRepresentable` with a Coordinator. The exact initializer, the
Coordinator pattern, and the `goat://assets/{appId}/index.html` scheme are in
`docs-site/docs/getting-started/host-ios.md`. Custom actions: `goatView.registerPlugin(myPlugin)`
where `myPlugin: GoatBridgePlugin`. Web3 / passkey / passes sources live inside the main
`GoatWebView` target — there is no separate SPM feature module for those (that split is
Android-only).

### 4.3 Flutter

```yaml
# pubspec.yaml
dependencies:
  goat_webview: 1.0.0-alpha.2
  goat_webview_biometrics: 1.0.0-alpha.2   # optional companions: _payments _location _scanner _media _bluetooth _network _sensors _web3 _all
```

```dart
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';

@override
void initState() {
  super.initState();
  GoatWebViewEngine.prewarm();          // optional: warm Chromium before first mount
}

GoatWebView(
  appId: 'com.mycompany.miniapp',
  hostDomainAllowlist: const ['appassets.androidplatform.net'],
  pullToRefreshEnabled: true,
  onWebViewCreated: (controller) {
    GoatBiometricsCapabilityPlugin.register();
    GoatBiometricsCapabilityPlugin.attachTo(controller);
  },
  onConsoleMessage: (msg, level) => debugPrint('[miniapp:$level] $msg'),
);
```

`GoatWebViewController` exposes `callJs`, `executeAction`, `setTheme`, `pause`, `resume`,
`switchMiniApp(url)` (prefer this over rebuilding the widget — it reuses the platform view).
`GoatCookieManager` is partitioned per `appId`. **iOS caveat:** only call `GoatCookieManager` for
an `appId` that has already had a `GoatWebView` mounted this process — a never-attached partition
is a native `WKWebsiteDataStore` trap, not a catchable Dart error.

### 4.4 React Native

```bash
npm install react-native-goat-webview   # (RN 0.74+, React 18/19; Fabric or Paper)
cd ios && pod install
```

```tsx
import { GoatWebView, useGoatBridge } from 'react-native-goat-webview';

<GoatWebView appId="com.mycompany.miniapp" style={{ flex: 1 }} />;
```

Fabric ref commands: `goBack goForward reload stopLoading injectJavaScript requestFocus
postMessage clearCache clearHistory clearFormData`. Hooks: `useGoatBridge`, `useGoatWallet`,
`usePasskey`.

### 4.5 Web — writing the mini-app

```ts
import { GoatBridge } from 'miniapp-web/src/miniapp-bridge'; // or load the prebuilt miniapp-bridge.min.js

const bridge = new GoatBridge();                       // auto-detects window.nativeBridge; falls back to mock
const info  = await bridge.callNative('GET_DEVICE_INFO');
if (await bridge.canIUse('BIOMETRIC_AUTH')) {
  await bridge.callNative('BIOMETRIC_AUTH', { title: 'Authorize' });
}
```

Host-less development: `@goat/bridge-mock` implements the full action catalog in the browser with
no native side, so mini-app UI can be built and tested standalone.

---

## 5. The native bridge model

- **Transport:** `WebMessageListener` (Android) / `WKScriptMessageHandlerWithReply` (iOS). Origin
  is pinned to `https://appassets.androidplatform.net`. `@JavascriptInterface` is **banned** and
  the build fails if it reappears.
- **Shape:** `callNative(action, payload) -> Promise<result>`. `action` is one of the 210 declared
  strings; unknown actions reject. Events flow the other way as `native_call` CustomEvents / a
  message channel.
- **Capability discovery:** `canIUse(action)` — always gate optional hardware calls with it; a
  declared-but-unbacked action answers `false` rather than throwing on a device.
- **Adding an action:** register a `GoatBridgePlugin` module (Android/iOS) — do **not** edit
  `GoatBridgeActionHandler` / the core dispatcher. See `docs-site/docs/api/` for the per-domain
  catalog and `packages/bridge-mock` for reference handler implementations.
- Authoritative surface: `scripts/verify-action-parity.mjs` proves every declared action
  dispatches on **both** Android and iOS and is mocked in `@goat/bridge-mock`.

---

## 6. Drop-in migration from another WebView library

These are **staged-migration aids** — swap one screen/spike at a time, not the whole app in one
commit. Each enforces a "zero-retention" rule via a bundled linter (config/option value types must
be built inline and handed straight to the widget, never stored in long-lived state).

### 6.1 `flutter_inappwebview` → `goat_webview_compat`

```yaml
# flutter_inappwebview: ^6.1.5
goat_webview_compat: 1.0.0-alpha.2   # or path: ../goat_webview_compat inside this monorepo
```

```dart
// - import 'package:flutter_inappwebview/flutter_inappwebview.dart';
// + import 'package:goat_webview_compat/goat_webview_compat.dart';
```

Existing `InAppWebView(...)` / `InAppWebViewController` code compiles unchanged: `initialUrlRequest`,
`initialSettings` (`isInspectable`, `transparentBackground`, `pullToRefreshEnabled`),
`onWebViewCreated`, `addJavaScriptHandler`, lazy `CookieManager`, document-start injection, and
navigation getters are mapped. Read `goat_webview_compat/MIGRATION.md` for the coverage matrix and
run `dart run custom_lint` to enforce the zero-retention rule in your own code.

### 6.2 `react-native-webview` → `react-native-goat-webview-compat`

```tsx
// - import { WebView } from 'react-native-webview';
// + import { WebView } from 'react-native-goat-webview-compat';
```

`<WebView source={{uri}} pullToRefreshEnabled onMessage={…} />`, `ref` commands, and
`window.ReactNativeWebView.postMessage` emulation work unmodified. 10 Fabric commands are wired.
`eslint-plugin/` ships a `no-retained-compat-config` rule. See
`react-native-goat-webview-compat/MIGRATION.md`.

---

## 7. Web3, Passkey & Wallet Passes

Enabled by `android/feature-web3(-compose)`, `android/feature-wallet-passes`,
`ios/Sources/GoatWebView/{Web3,Passkey,Passes}`, and `miniapp-web/src/injected/`.

- **Provider discovery in the mini-app:** standard `eip6963:announceProvider`, a Solana provider,
  and TON-Connect are injected. `navigator.credentials.get/create` (W3C passkeys) work against the
  engine's passkey engine.
- **Custody is SPI-only.** The engine ships `GoatWalletAdapter` (+ EVM/Solana/TON signer
  protocols), the transaction **decoders**, and the confirmation modal. **The host supplies the
  signer.** The engine generates no keys and holds no seed. `GoatReferenceWalletAdapter` exists so
  the surface is runnable end-to-end; every value it returns is `SIMULATED_`-prefixed — it is not a
  wallet.
- **Vault fails closed.** The AES-256-GCM vault is anchored to AndroidKeyStore / iOS Keychain and
  refuses to operate (typed error) when that hardware is unavailable — it never silently downgrades
  to a software key.
- **Server pass issuers:** `packages/server/src/wallet/` — `google-wallet` (RS256 JWT) and
  `pkpass` (SHA-1 manifest). These build/sign real pass payloads; distribution is yours.
- Deep dive + threat model: `docs-site/docs/security/wallet-passkey-vault.md`. Full gate:
  `bash scripts/verify-wallet-passkey-adapters.sh`.

---

## 8. Portable mini-app DSL adapters (`@goat/adapter-dsl`) — partial

Lets unmodified WeChat (`wx.*`) / Alipay (`my.*`) / uni-app / Taro mini-app code run against the
engine's bridge. Modular entry points (`@goat/adapter-dsl/wechat|alibaba|uniapp|taro`), each
< 2.2 KB gzipped, a `canIUse` router, and a 20 Hz native sensor rate limiter.

**Status is genuinely mixed** — the document-start bootstrap, `canIUse`, and the storage/sensors/
scanner/location/BLE web modules are done; navigation is 2-of-5 mapped; biometrics is blocked (no
engine action); several feature modules are unstarted. Treat it as a portability *shim under
active development*, not a compatibility guarantee. The authoritative per-feature state is the
table at the top of `packages/adapter-dsl/README.md`, and every mapped action is asserted against
the engine's Kotlin source by `packages/adapter-dsl/src/__tests__/features.test.ts`.

---

## 9. Security invariants the host must uphold

Do not "simplify" past any of these — each is load-bearing and enforced by `CODE_RULE.md` +
`scripts/`:

1. **No `@JavascriptInterface`.** Only `WebMessageListener` / `WKScriptMessageHandlerWithReply`,
   origin restricted to `https://appassets.androidplatform.net`.
2. **Zip Slip guard** on every archive extraction (canonical path must stay under the staging dir).
3. **Per-`appId` multi-tenant isolation** for storage, cookies, filesystem, and keystore keys.
   Zero PII in logs at any level.
4. **New bridge actions are `GoatBridgePlugin` modules** — never a core-dispatcher edit.
5. **Fail-closed hardware.** If a native API has no real implementation on a platform, it returns a
   typed error, never fabricated data.
6. **Payment routes are deliberately unauthenticated** and rely on high-entropy `intentId` secrecy
   (`payment-gate-way-arch.md` §4). Do not add auth to them without reading the threat model; do
   not couple the 5 payment-gate layers to each other.

---

## 10. Verify a fresh checkout locally

```bash
# clone, then per package as needed (the repo does NOT use npm workspaces — install per package):
npm install                                   # root (husky only)
node scripts/verify-action-parity.mjs         # 210-action Android/iOS/mock parity
bash scripts/verify-rn.sh                      # RN + rn-compat: build, jest, lint-rule, size, native compile
bash scripts/verify-wallet-passkey-adapters.sh # web3 / passkey / vault (13 steps)
node --experimental-strip-types tests/games/e2e-verify.ts   # embeddability suite, 262 assertions
( cd goat_webview_compat && flutter pub get && flutter test )
( cd packages/adapter-dsl && npm install && npm test && npm run check:size )
bash scripts/verify-all.sh                     # full monorepo gate (installs miniapp-web deps itself)
```

Android/iOS native gates need `ANDROID_HOME` + a JDK 17 / Xcode respectively; scripts `skip`
loudly when a toolchain or device is absent rather than passing silently.

---

## 11. Known limitations & gotchas

- **Alpha versioning.** Pin exact versions (see §2); `^` / `from:` ranges skip prereleases.
- **React Native peer deps.** `react-native` is unpinned upstream and npm 7+ will otherwise pull a
  React-19-only version; this repo adds `react-native@^0.76.0` (dev) + `.npmrc legacy-peer-deps=true`
  to both RN packages. A plain `npm install` works; install `react-native-goat-webview` before
  `react-native-goat-webview-compat` if you work on both in the monorepo.
- **Reference PSP drivers are simulations.** Stripe / Alipay / PayPay server drivers mint local
  tokens and make no real network call; only the Bakong KHQR driver emits real EMVCo output.
  Certifying a real driver behind the `PaymentDriver` interface is a per-merchant task
  (`payment-gate-way-arch.md` §5).
- **iOS Keychain success path is unproven in CI** (an SPM XCTest bundle has no keychain
  entitlement) — only the fail-closed path is asserted. It works on device.
- **iOS BLE beyond scan/connect is stubbed** (GATT characteristic subscriptions). Android BLE GATT
  is real.
- **iOS cookie partitions:** never touch `GoatCookieManager` for an `appId` that has not had a
  live WebView this process (native trap).
- **`@goat/adapter-dsl` is partial** — see §8.
- **AAR size:** `android/core` currently ships above the `CODE_RULE.md` 500 KB target because the
  18-domain dispatcher still lives inline; the interim CI budget is 1,600 KB. Feature code is
  already split into `feature-*` modules — do not merge it back.

---

## 12. Authoritative documents in this repo

| Topic | File |
|---|---|
| Engineering standards & security invariants | `CODE_RULE.md` |
| Showcase architecture across 5 hosts | `PROJECT.md` |
| Per-platform host integration | `docs-site/docs/getting-started/host-*.md` |
| Full 18-domain / 210-action API catalog | `docs-site/docs/api/` |
| Payment gateway threat model & 5-layer gate | `payment-gate-way-arch.md` |
| Web3 / passkey / vault security model | `docs-site/docs/security/wallet-passkey-vault.md` |
| Flutter migration coverage matrix | `goat_webview_compat/MIGRATION.md` |
| React Native migration coverage matrix | `react-native-goat-webview-compat/MIGRATION.md` |
| DSL adapter per-feature state | `packages/adapter-dsl/README.md` |
| Test infrastructure (4-tier E2E) | `TEST_INFRA.md`, `TEST_READY.md` |
| Release notes | `CHANGELOG.md` |
