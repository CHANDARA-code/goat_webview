# 🐐 Goat WebView

> **Enterprise-Grade Multi-Platform Mini-App Engine & SuperApp Runtime**  
> Instant startup (<300ms cold, <50ms warm) • Zero white flash • 210+ Native Bridge Actions • Web3 / Passkey / Wallet Passes • Drop-in `flutter_inappwebview` & `react-native-webview` adapters • Multi-tenant Sandboxing • OWASP MASVS v2.0 Compliant

---

## 📖 Overview

**Goat WebView** is a high-performance, multi-platform embedded mini-app engine engineered specifically for modern SuperApps. Traditional mobile WebViews suffer from sluggish initialization, memory bloat, high security risks (such as `@JavascriptInterface` Remote Code Execution and Zip Slip directory traversal), and disjointed platform-specific bridge implementations.

Goat WebView overcomes these challenges by providing a unified multi-tenant architecture across **Android (Kotlin/Compose)**, **iOS (Swift/WebKit)**, **React Native (Fabric/TurboModules)**, **Flutter (Hybrid Composition PlatformView)**, and **Web**. It features:
- **Instantaneous Startup**: Cold start in <300ms and pre-warmed start in <50ms via `GoatFastPool` lifecycle recycling and V8 bytecode pre-compilation.
- **Zero-Trust Security**: Exclusive communication via AndroidX `WebMessageListener` and WebKit message handlers restricted to virtual HTTPS domains (`https://appassets.androidplatform.net` and `goat://assets/`).
- **Multi-Tenant Sandboxing**: 100% partition isolation for local storage keyspaces (`goat_storage_<appId>`), cookies (`WKWebsiteDataStore`), filesystem directories, and Hardware KeyStore keys.
- **Dual-Thread Execution Architecture**: Modeled after WeChat/Skyline, executing JavaScript business logic in an isolated Worker thread (`AppService`) decoupled from the DOM rendering thread (`AppView`).
- **Comprehensive SuperApp Capability Matrix**: 210+ standardized bridge actions across 18 functional domains including Biometrics, BLE/NFC, Geofencing, Same-Layer Video/Map rendering, Subpackages, and Payment Gateways.

---

## ✨ New in `1.0.0-alpha.2`

- **Web3, Passkey & Vault vertical** — hardware-isolated EVM / Solana / TON transaction decoders, a host-supplied `GoatWalletAdapter` SPI (goat holds no keys), EIP-6963 / Solana / TON-Connect provider discovery, W3C passkey (`navigator.credentials`) with an AndroidKeyStore / iOS-Keychain AES-256-GCM vault that **fails closed** on missing hardware, and Google Wallet / Apple PassKit pass builders. Android modules: `feature-web3`, `feature-web3-compose`, `feature-wallet-passes`, `feature-payments-wechat`. iOS: `Sources/GoatWebView/{Web3,Passkey,Passes}`.
- **`goat_webview_compat`** — drop-in replacement for `package:flutter_inappwebview` (`InAppWebView` widget + `InAppWebViewController` façade, lazy `CookieManager`, pull-to-refresh, document-start injection), with a `custom_lint` rule that forbids retaining migration config. See [`goat_webview_compat/MIGRATION.md`](./goat_webview_compat/MIGRATION.md).
- **`react-native-goat-webview-compat`** — drop-in replacement for `react-native-webview` (`<WebView>` wrapper, 10 Fabric commands, `window.ReactNativeWebView.postMessage` emulation), with an ESLint zero-retention rule. See [`react-native-goat-webview-compat/MIGRATION.md`](./react-native-goat-webview-compat/MIGRATION.md).
- **`@goat/adapter-dsl`** — portable WeChat (`wx.*`) / Alipay (`my.*`) / uni-app / Taro shims, each entry point < 2.2 KB gzipped, with a `canIUse` capability router and a 20 Hz native sensor rate limiter.
- **2D/3D web-games embeddability suite** (`tests/games/`) — LittleJS, Phaser 3, Three.js, React-Three-Fiber (plus Babylon.js and PixiJS) demos with a 4-tier E2E harness (`node --experimental-strip-types tests/games/e2e-verify.ts`, 262 assertions) proving offline `file:///` asset resolution, DPR clamping, and ≤ 0.05 KB/cycle retention across 100 unmount cycles.
- **Core-engine hardening** — Android `feature-sensors` / `feature-web3` decoupled from `:core`, `GoatDeviceTier` low-RAM skip-prewarm, bridge sender-origin validation; iOS `GoatLifecycleManager`, `GoatProcessPoolManager` / `GoatWebViewPool`, `GoatNetworkPrewarmer`, `GoatAssetByteCache`, `GoatThemeManager`, `GoatOrientationController`, `GoatIntegrityVerifier`.

---

## 📱 Supported Platforms & Maturity

| Platform / Package | Architecture / Bindings | Minimum OS / Runtime | Maturity Status |
|---|---|---|:---:|
| **Android Core SDK** | Kotlin 1.9+, Jetpack Compose, AndroidX `WebViewCompat` | Android 7.0+ (API 24+), Target SDK 35 | **Production-Ready (v1.0.0)** |
| **iOS Core SDK** | Swift 5.9+, `WKWebView`, `WKScriptMessageHandlerWithReply` | iOS 14.0+ | **Production-Ready (v1.0.0)** |
| **React Native** | TypeScript, TurboModules (JSI), Fabric Native Components | React Native 0.74+, React 18/19 | **Production-Ready (v1.0.0)** |
| **Flutter** | Dart 3+, Hybrid Composition `PlatformView`, `MethodChannel` | Flutter 3.29.0+, Dart 3.7+ | **Production-Ready (v1.0.0)** |
| **Web JS SDK** (`miniapp-web`) | TypeScript, Custom React Hooks, Virtual Domain Shims | Modern Evergreen Browsers / ES2022 | **Production-Ready (v1.0.0)** |
| **Dual-Thread Engine** (`@goat/appservice`) | Web Workers, Virtual DOM reconciliation, Frame Batcher | Node 20+ / Web Worker Runtimes | **Production-Ready (v1.0.0)** |
| **Developer Tooling** (10 packages) | CLI, DevTools Studio IDE, CDP Server, VS Code Extension | Node 20+, Bun | **Production-Ready (v1.0.0)** |

---

## 🛠️ Prerequisites

Ensure your development environment meets the following toolchain requirements:

- **Node.js**: `v20.x` or higher (LTS recommended) & `npm`
- **Bun**: Latest version (`curl -fsSL https://bun.sh/install | bash`)
- **Java Development Kit (JDK)**: JDK 17 (Eclipse Temurin / OpenJDK 17) with `JAVA_HOME` set
- **Android SDK**: Android SDK Command-line Tools, API Platform 34/35, `ANDROID_HOME` configured
- **Xcode** (macOS only): Xcode 15.0+ or 16.0+ with Command Line Tools (`xcodebuild`, iOS Simulators)
- **Flutter**: Flutter SDK `3.29.0` (stable channel)
- **CocoaPods**: CocoaPods `1.14+` (`sudo gem install cocoapods` or Homebrew)

---

## 🚀 Workspace Setup & Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/CHANDARA-code/goat_webview.git
cd goat_webview

# 2. Install workspace dependencies (automatically configures Husky git hooks)
npm install

# 3. Install platform & package dependencies
npm --prefix react-native-goat-webview install
(cd goat_webview && flutter pub get)
(cd goat_webview/example && flutter pub get)
npm --prefix miniapp-web install

# 4. (macOS) Install iOS CocoaPods dependencies
(cd ios && pod install 2>/dev/null || true)
(cd react-native-goat-webview/example/ios && pod install 2>/dev/null || true)
```

---

## 🧪 Testing & Verification

The repository enforces a 7-sub-suite verification matrix with 100% automated pass rates.

### Per-Platform Test Commands

| Platform / Track | Test Command | Shell Runner Script | Description |
|---|---|---|---|
| **Android Core** | `npm run test:android` | `bash scripts/verify-android.sh` | Runs JUnit 5 & Coroutines unit and integration tests |
| **iOS Core** | `npm run test:ios` | `bash scripts/verify-ios.sh` | Runs XCTest suite via `xcodebuild` (or `swift test`) |
| **React Native** | `npm run test:rn` | `bash scripts/verify-rn.sh` | Runs Jest & RNTL TurboModule and Fabric tests |
| **Flutter Plugin** | `npm run test:flutter` | `bash scripts/verify-flutter.sh` | Runs `flutter test` and `flutter analyze` |
| **Web JS SDK** | `npm run test:web` | `bash scripts/verify-web.sh` | Runs Web Bridge tests and production compilation |
| **Dual-Thread Engine** | `npm run test:appservice` | `npm --prefix packages/appservice test` | Runs AppService/AppView dual-thread E2E tests |
| **Tooling (10 Pkgs)** | `npm run verify:packages` | `bash scripts/verify-packages.sh` | Runs test suites across all 10 monorepo tooling packages |
| **Zero-Trust Security** | `npm run test:security` | `bash scripts/run-security-fuzz.sh` | Runs 210-action mutation fuzzing, SSRF & sandbox tests |
| **Wallet / Passkey / Vault** | — | `bash scripts/verify-wallet-passkey-adapters.sh` | 13-step gate: chain decoders, passkey engine, hardware vault, adversarial suite |
| **Web Games Embeddability** | — | `node --experimental-strip-types tests/games/e2e-verify.ts` | 4-tier games E2E harness (262 assertions, 100-cycle unmount endurance) |
| **Cross-MiniApp E2E** | `npm run test:e2e` | `bash scripts/verify-e2e.sh` | Runs 939 master monorepo 4-tier + 97 Task 10201 cross-mini-app E2E tests |

### Full Master CI Gate Command

Before submitting any Pull Request, you must execute the full local CI gate:

```bash
bash scripts/verify-all.sh
# or
npm run verify:all
```

---

## 📦 Installing the SDK Into Your Own App

### Android (Gradle)

```kotlin
// settings.gradle.kts — publish flow is GitHub Packages (local monorepo builds use :core / :features-all-in)
repositories {
    maven("https://maven.pkg.github.com/CHANDARA-code/goat_webview")
}

// app/build.gradle.kts
dependencies {
    implementation("com.goat.webview:core:1.0.0-alpha.2")
    implementation("com.goat.webview:features-all-in:1.0.0-alpha.2") // optional: BLE/NFC/Location/Media/Scanner/Biometrics/Payments
}
```

Feature plugins auto-register when `features-all-in` is on the classpath (`GoatView` defaults to `autoRegisterPlugins = true`, `autoRegisterPayments = true`).

> **Payments status (v1.0.0):** the on-device payment gateway, intent ledger and server proxy are
> production-shaped, but the bundled **Stripe, Alipay and PayPay server drivers are reference
> simulations** — they mint local tokens and make no real PSP network call. Only the Bakong KHQR
> driver emits genuinely real (EMVCo-compliant) output. Writing and certifying a real driver behind
> the same `PaymentDriver` interface is a per-merchant integration task. See
> [`payment-gate-way-arch.md`](payment-gate-way-arch.md) §5.

> **Note:** GitHub Packages requires a Personal Access Token with `read:packages`
> scope even for public packages. Add it to `~/.gradle/gradle.properties`:
> `gpr.user=<github-user>` / `gpr.key=<pat>`, and reference it from your repository block.

### iOS (Swift Package Manager / CocoaPods)

```swift
// Package.swift
.package(url: "https://github.com/CHANDARA-code/goat_webview.git", from: "1.0.0")
```

> **Alpha (`v1.0.0-alpha.2`):** pin the exact prerelease — a `from:` range will not match one:
> ```swift
> .package(url: "https://github.com/CHANDARA-code/goat_webview.git", exact: "1.0.0-alpha.2")
> ```
> Products: `GoatWebView` (core), `GoatWebViewAllIn`, or any single feature library
> (`GoatWebViewMedia`, `GoatWebViewScanner`, `GoatWebViewLocation`, `GoatWebViewBiometrics`,
> `GoatWebViewBluetooth`, `GoatWebViewNetwork`).

```ruby
# Podfile
pod 'GoatWebView', :git => 'https://github.com/CHANDARA-code/goat_webview.git', :tag => 'v1.0.0-alpha.2'
pod 'GoatWebView/Scanner'   # optional capability subspecs: Media, Scanner, Location, Biometrics, Bluetooth, Network
```

### Flutter (pub.dev)

```yaml
# pubspec.yaml
dependencies:
  goat_webview: ^1.0.0-alpha.2
  goat_webview_biometrics: ^1.0.0-alpha.2  # optional companions: payments, location, scanner, media, bluetooth, network
```

```dart
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_biometrics/goat_webview_biometrics.dart';

GoatBiometricsCapabilityPlugin.register();

GoatWebView(
  appId: 'com.mycompany.miniapp',
  onWebViewCreated: (controller) {
    GoatBiometricsCapabilityPlugin.attachTo(controller);
  },
);
```

### React Native (npm)

```bash
npm install react-native-goat-webview
cd ios && pod install
```

```tsx
import { GoatWebView } from 'react-native-goat-webview';

<GoatWebView appId="com.mycompany.miniapp" style={{ flex: 1 }} />;
```

### Web Mini-App Runtime

The web-side SDK ships inside every mini-app bundle (`miniapp-web/dist/miniapp-bridge.min.js`): mini-apps talk to the host through the injected `window.nativeBridge` object and access the bridge via the global `window.goatBridge`:

```ts
// Inside a mini-app web bundle:
const bridge = window.goatBridge;
const deviceInfo = await bridge.callNative('GET_DEVICE_INFO');
```

For host-side tooling, install the AppService runtime:

```bash
npm install @goat/appservice @goat/core
```

---

## 🏛️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Parent Mini-App Runtime (appId_A)                               │
│                      GoatBridgeClient / GoatWebViewController / JS SDK                          │
└───────────────────────────────────────────────┬─────────────────────────────────────────────────┘
                                                │
               1. OPEN_MINI_APP                 │ 4. ON_MINI_APP_CLOSED Event
               (targetAppId: "B",               │    { targetAppId: "B", result: {...} }
                presentation: "WINDOWED",       │
                jsApiAlias: {"CONFIRM": "..."}) ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 GoatCrossMiniAppManager                                         │
│ - Instance Registry: [instanceId -> RunningMiniAppInstance]                                     │
│ - Presentation Modes: WINDOWED (Floating Draggable Card) | MODAL (Bottom Sheet) | EMBEDDED      │
│ - IPC Proxy Dispatcher: Evaluates jsApiAlias allowlist, routes to parent bridge                 │
│ - Sandbox Isolation: Independent KeyStore/Keychain, Storage partitions, Cookie jars             │
│ - FastPool Memory Recycler: Acquires warm WebView, executes 8-step sanitization on close        │
└───────────────────────────────────────┬─────────────────────────────────────────────────────────┘
                                        │
        2. Mount Floating Window Card   │ 3. Intercept Aliased JSAPI Calls
        & Wire Event Callbacks          │    (Proxy to Parent Handler)
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 Child Mini-App Runtime (appId_B)                                │
│ - Independent WebView / WKWebView Instance (acquired from GoatFastPool)                         │
│ - Isolated Storage: goat_storage_appId_B / filesDir/miniapps/appId_B/data/                      │
│ - Isolated Cookies: WKWebsiteDataStore(appId_B) / https://appId_B.appassets...                  │
│ - Fail-Closed Bridge Handler: Only mapped jsApiAlias can reach parent                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

For complete technical specifications, sequence diagrams, and interface contracts, see [`PROJECT.md`](./PROJECT.md).

---

## 🔗 Documentation & References

- 🤖 [**llm_integrate.md**](./llm_integrate.md) — Single-file integration reference for developers and coding agents: which package, minimal host snippet per platform, the bridge model, drop-in migration, and the gotchas.
- 📋 [**CONTRIBUTING.md**](./CONTRIBUTING.md) — Contribution workflow, branch conventions, and PR checklist.
- 🛡️ [**CODE_RULE.md**](./CODE_RULE.md) — Principal engineering standards, OWASP MASVS v2.0 compliance, and memory rules.
- 🤝 [**CODE_OF_CONDUCT.md**](./CODE_OF_CONDUCT.md) — Expected conduct for everyone participating here.
- 🔐 [**SECURITY.md**](./SECURITY.md) — How to report a vulnerability, and this release's known limitations.
- 📝 [**CHANGELOG.md**](./CHANGELOG.md) — Release notes and milestone progress in Keep-a-Changelog format.
- 🧪 [**TEST_INFRA.md**](./TEST_INFRA.md) — The 4-tier E2E test infrastructure and how to run each suite.
- 💳 [**payment-gate-way-arch.md**](./payment-gate-way-arch.md) — Payment proxy and security-gate architecture.
- 📐 [**PROJECT.md**](./PROJECT.md) — Showcase app architecture across all five host platforms.

### Package-Specific Documentation

- ⚛️ [**react-native-goat-webview**](./react-native-goat-webview/README.md) — React Native Fabric/TurboModule package.
- 🎯 [**goat_webview**](./goat_webview/README.md) — Flutter PlatformView & MethodChannel plugin.
- 🌐 [**miniapp-web**](./miniapp-web/README.md) — Mini-app Web JS SDK and custom React hooks.
- 📦 [**@goat/appservice**](./packages/appservice/README.md) — Dual-thread worker container & Virtual DOM renderer.
- 🖥️ [**@goat/server**](./packages/server/README.md) — Chrome DevTools Protocol relay & OTA gateway.
- 🛠️ [**@goat/cli**](./packages/cli/README.md) — Command Line Interface for scaffolding, bundling, and debugging.
- 🧪 [**@goat/bridge-mock**](./packages/bridge-mock/README.md) — Zero-dependency browser bridge simulator.
- 🎮 [**@goat/playground**](./packages/playground/README.md) — Interactive web sandbox with live native simulation.
- 💻 [**vscode-goat**](./packages/vscode-extension/README.md) — Visual Studio Code extension with device simulator.
- 🔍 [**@goat/devtools**](./packages/devtools/README.md) — DevTools Studio IDE.
- 🛡️ [**@goat/core**](./packages/core/README.md) — Zero-trust network security and SSRF defense pipeline.
- 🎋 [**@goat/compiler-taro**](./packages/compiler-taro/README.md) — Taro framework compiler adapter plugin.
- 🦄 [**@goat/compiler-uniapp**](./packages/compiler-uniapp/README.md) — Uni-app framework compiler adapter plugin.
- 🧩 [**@goat/adapter-dsl**](./packages/adapter-dsl/README.md) — Portable WeChat / Alipay / uni-app / Taro `wx.*` · `my.*` shims.
- 🔌 [**goat_webview_compat**](./goat_webview_compat/MIGRATION.md) — Drop-in replacement for `flutter_inappwebview`.
- 🔌 [**react-native-goat-webview-compat**](./react-native-goat-webview-compat/MIGRATION.md) — Drop-in replacement for `react-native-webview`.
- 🔄 [**Universal Migration Guide**](./MIGRATION.md) — Comprehensive guide for migrating from `flutter_inappwebview`, `react-native-webview`, and Mini-App DSLs.
- 🎮 [**tests/games**](./tests/games/) — 2D/3D web-games embeddability suite + 4-tier E2E harness.
- 🔐 [**Wallet, Passkey & Vault**](./docs-site/docs/security/wallet-passkey-vault.md) — Web3 signer SPI, passkey engine, and hardware vault security model.

---

## 📄 License

MIT © 2026 Goat Engine Authors & Contributors. See [`LICENSE`](./LICENSE) for details.
