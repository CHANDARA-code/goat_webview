# Changelog

All notable changes to the Goat WebView Engine are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-alpha.2] - 2026-09-09

### 🚀 Added

* **Web3, Passkey & Digital-Wallet-Passes vertical.** Bridge surface expands to **210 declared
  actions** with strict Android / iOS / `@goat/bridge-mock` parity.
  * Android: `feature-web3` (hardware-isolated EVM / Solana / TON decoders, `GoatWalletAdapter`
    SPI, Permit2 uint160 allowance check, `Web3ConfirmGate`, zero Compose deps), opt-in
    `feature-web3-compose` modal, `feature-wallet-passes` (Google Wallet), `feature-payments-wechat`,
    and an AndroidKeyStore AES-256-GCM / HKDF-SHA256 vault in `feature-biometrics` (device-verified
    on SM-N975F / API 31).
  * iOS: `Sources/GoatWebView/{Web3,Passkey,Passes}` — full EVM (Keccak256, ABI, EIP-712), Solana
    and TON decoders, `GoatVaultEngine`, `GoatPasskeyPlugin`, `AppleWalletPassAdapter`.
  * Web: `miniapp-web/src/injected/` — EIP-6963, Solana, TON-Connect init, WebAuthn polyfill,
    passkey API. `packages/server` gains `GoogleWalletIssuer` (RS256) and `PkPassBuilder` (SHA-1).
  * The signer is **host-supplied**; the engine generates no keys and holds no seed. The vault
    **fails closed** when secure hardware is unavailable.
* **`goat_webview_compat`** — drop-in replacement for `package:flutter_inappwebview`
  (`InAppWebView` widget + `InAppWebViewController` façade, lazy `CookieManager`, pull-to-refresh,
  document-start injection), with a `custom_lint` rule (`goat_compat_retained_config`) forbidding
  retained migration config. Ships `tools/goat_compat_lint`.
* **`react-native-goat-webview-compat`** — drop-in replacement for `react-native-webview`
  (`<WebView>` wrapper, 10 Fabric commands, `window.ReactNativeWebView.postMessage` emulation) plus
  an ESLint `no-retained-compat-config` rule.
* **`@goat/adapter-dsl`** — portable WeChat (`wx.*`) / Alipay (`my.*`) / uni-app / Taro shims,
  each entry point < 2.2 KB gzipped, with a `canIUse` capability router and a 20 Hz native sensor
  rate limiter. Android `feature-bluetooth` gains a real GATT client (`AndroidBleTransport`).
* **2D/3D web-games embeddability suite** (`tests/games/`) — LittleJS, Phaser 3, Three.js,
  React-Three-Fiber, Babylon.js and PixiJS demos with a 4-tier E2E harness
  (`tests/games/e2e-verify.ts`, 262 assertions) covering offline `file:///` asset resolution, DPR
  clamping, non-passive touch shielding, and ≤ 0.05 KB/cycle retention over 100 unmount cycles.
* **Core-engine reliability & lifecycle.** Android: `feature-sensors` / `feature-web3` decoupled
  from `:core`, new `core-compose` module, `GoatDeviceTier` low-RAM skip-prewarm, bridge
  sender-origin validation. iOS: `GoatLifecycleManager`, `GoatProcessPoolManager` /
  `GoatWebViewPool`, `GoatNetworkPrewarmer`, `GoatAssetByteCache`, `GoatBinaryPortManager`,
  `GoatThemeManager`, `GoatOrientationController`, `GoatIntegrityVerifier`, design tokens.
* New verification gates: `verify-action-parity.mjs`, `verify-suites-are-gated.mjs`,
  `verify-companion-actions.mjs`, `verify-web3-runtime-sync.mjs`,
  `verify-wallet-passkey-adapters.sh` (13 steps), `benchmark-wallet-passkey-latency.sh`.

### 🧪 Automated Verification (public repo, this drop)

* 210-action bridge parity across Android, iOS and `@goat/bridge-mock`.
* Android: `./gradlew -p android test` — **1023 tests, 0 failures** across 18 modules.
* iOS: `xcodebuild test -scheme GoatWebView-Package` — pass (wallet SPI, chain decoders, passkey
  engine, confirm gate).
* `verify-wallet-passkey-adapters.sh` — 12 pass / 0 fail / 1 skip (on-device KeyStore needs a
  physical device).
* Flutter: `goat_webview` 50/50, `goat_webview_compat` 29/29 + `custom_lint` clean.
* React Native: `react-native-goat-webview` 39/39, `react-native-goat-webview-compat` 31/31 +
  lint-rule + bundle-size gate.
* Web / packages: `miniapp-web` 151/151, `bridge-mock` 402/402, `server` 326/326,
  `adapter-dsl` 67/67 + size gate; all 10 tooling packages green.
* Games: `tests/games/e2e-verify.ts` — 262/262 assertions.
* `run-security-fuzz.sh` pass; master 4-tier E2E 939/939; cross-mini-app E2E 97/97.

## [1.0.0] - 2026-08-29

### ⚠️ Known Deviations for 1.0.0

The following items are intentionally shipped as documented deviations in 1.0.0 and are scheduled for the 1.1.0 line:

* **Android core AAR exceeds the CODE_RULE 500 KB cap** — `android/core` publishes at ~1.4 MB because the inline 18-domain bridge dispatcher, payments gateway and Compose UI still live in the core module. Remediation: extract inline domains into the existing `feature-*` plugin modules (the plugin SPI already exists; the CI size gate is set at 1,600 KB as the interim budget).
* **iOS SPM package ships a single target** — `ios/Package.swift` declares one `GoatWebView` target (the CocoaPods podspec does expose 7 subspecs). Remediation: restructure `ios/Sources/` into per-capability directories and declare real SPM targets.
* **Stripe/Alipay/PayPay server payment drivers are reference simulations** — they mint local client tokens and simulate the PSP round trip without real PSP API calls (documented in `payment-gate-way-arch.md`). Only the Bakong KHQR driver produces real EMVCo-compliant output. Production drivers are a per-merchant integration.
* **Payment create/claim/query routes are unauthenticated by design** — they rely on high-entropy `intentId` secrecy per the threat model in `payment-gate-way-arch.md` §4.

### 🚀 Highlights & Features
* **Multi-Platform Native Bridge Parity**: 18 bridge domains across Android, iOS, React Native, Flutter, and Web runtimes.
* **Apple Native Frameworks**: Hardware-backed CoreMotion, CoreLocation, AVFoundation, Contacts, UserNotifications, CoreNFC, CoreBluetooth, and StoreKit 2.
* **React Native Fabric & TurboModules**: Multi-target compilation (`lib/commonjs/`, `lib/module/`, `lib/typescript/`) with full AppService lifecycle bindings.
* **Flutter Modular Ecosystem**: Root engine plugin (`goat_webview`) plus 7 dedicated capability companion packages with pub.dev publishing readiness.

### 🛡️ Security & Zero-Trust Hardening
* **Dual-Thread VDOM Sandbox**: Immune to prototype pollution, script injection, and DOM-based XSS attacks.
* **Hardware KeyStore Purge**: Cryptographic master key erasure and preference partitioning on tenant eviction (OWASP MASVS-CRYPTO-1).
* **FastPool Zero-Leak Recycler**: 9-step memory sanitization preventing cross-tenant IPC event leakage.
* **Enterprise SSRF & DNS Rebinding Protection**: Validates virtual schemes and blocks private, loopback, and cloud metadata IP ranges.

### 🧪 Automated Verification
* 391 / 391 iOS XCTests passed.
* 680 / 680 Android Unit & Integration tests passed.
* 33 / 33 React Native Jest tests passed.
* 37 / 37 Flutter package tests (plus 20 / 20 example-app tests) and static analysis passed.
* 307 / 307 Node server (OTA, payments proxy, manifest, CDP) Vitest tests passed.
* 939 / 939 Master 4-Tier E2E tests passed (plus 97 / 97 Task 10201 cross-mini-app E2E, 144 / 144 AppService dual-thread E2E).
* 197-action IPC mutation fuzz suite (1,000+ cycles) passed.
