# Project: Goat WebView Universal Multi-Platform Engine (`v1.0.0-alpha.2`)

## 1. System Architecture

Goat WebView is an enterprise-grade, multi-platform embedded web engine and super-app ecosystem providing seamless, high-performance web-to-native capabilities across **iOS (SwiftUI / UIKit / WebKit)**, **Android (Jetpack Compose / Android Views / Chromium WebView)**, **Flutter**, and **React Native (New Architecture Fabric / TurboModules)**.

```
+---------------------------------------------------------------------------------------------------+
|                                      Host Applications                                            |
|  +-------------------+  +-------------------+  +--------------------+  +-----------------------+  |
|  | iOS (SwiftUI)     |  | Android (Compose) |  | Flutter Host       |  | React Native (Fabric) |  |
|  | TabView Launcher  |  | Material 3 Tabs   |  | NavigationBar      |  | TurboModule Bridge    |  |
|  | GoatURLScheme     |  | GoatFastPool      |  | 7 Companions       |  | AppService Runtime    |  |
|  +---------+---------+  +---------+---------+  +---------+----------+  +-----------+-----------+  |
+------------|----------------------|----------------------|-------------------------|--------------+
             |                      |                      |                         |
+------------v----------------------v----------------------v-------------------------v--------------+
|                              Universal Compatibility Adapters                                     |
|  - Flutter Drop-in Adapter: goat_webview_compat (drop-in replacement for flutter_inappwebview)    |
|  - React Native Drop-in Adapter: react-native-goat-webview-compat (for react-native-webview)      |
|  - Portable Mini-App DSL: @goat/adapter-dsl (WeChat wx.*, Alipay my.*, uni.*, Taro.* shims)       |
+---------------------------------------------------------------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------------------+
|                               Core Engine Reliability & Security                                  |
|  - Multi-Profile Tenant Isolation & Cookie Affinity (GoatCookieManager, GoatFastPool)             |
|  - Transparent Renderer Crash Recovery & Session Rehydration (GoatView, GoatWebViewClient)        |
|  - Isolated Content Worlds (iOS GoatView.bridgeWorld & Bridge Trampoline / Frozen Proxy)           |
|  - Zero-Trust Virtual Origin Sandboxing (https://appassets.androidplatform.net & goat://)         |
|  - High-Performance Native Lifecycle, Asset Byte Cache & Memory Tiering                          |
+---------------------------------------------------------------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------------------+
|                   Web3, Digital Wallet Passes & Passkey Cryptographic Bridge                      |
|  - Web3 Providers: EIP-1193 / EIP-6963 EVM, Solana standard provider, TON Connect 2.0             |
|  - Decoder Safety: Permit2 Drainer Defense (2^160-1 check), Stack-Safe TON BOC (<128 depth)      |
|  - Passkeys & Credentials: W3C WebAuthn Level 3 Polyfill & Native CredentialManager Engine        |
|  - Physical Air-Gap Vault: Hardware AES-256-GCM KeyStore derive from CTAP2 PRF (0 keys in JS)    |
|  - Digital Wallet Passes: Google Wallet PayClient & Apple Wallet PKPassLibrary PassKit Plugin     |
|  - SuperApp Payments: WeChat Pay (WXPayEntryActivity), Alipay, Tencent SOTER Biometrics           |
+---------------------------------------------------------------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------------------+
|                                2D/3D Web Games Embeddability Suite                                |
|  - 4 Game Engines: LittleJS (2D Physics), Phaser 3 (Arcade), Three.js (WebGL), R3F (React 19)    |
|  - Master 4-Tier E2E Verification Harness: tests/games/e2e-verify.ts (41 suites, 262 assertions)  |
|  - Zero-Leak Guarantees: 100-cycle unmount slope <= 0.05 KB/cycle; clamped DPR <= 2.0             |
+---------------------------------------------------------------------------------------------------+
                                            |
+-------------------------------------------v-------------------------------------------------------+
|                           Sandboxed Mini-App Runtime & Showcase                                   |
|  - Packaged Asset: miniapp.zip (Verified SHA-256 Checksum)                                        |
|  - 4 Domain Mini-Apps: E-Commerce & Payments, IoT & Hardware, Field Service & Nav, Biometric Vault  |
|  - Embedded Floating Developer Debug HUD: Real-time IPC Trace, Warm-Path Latency (<5ms), Overrides|
|  - 18 Unified Bridge Domains (210 Actions verified with 100% parity across Android, iOS, and Mock)|
+---------------------------------------------------------------------------------------------------+
```

---

## 2. 31-Feature Capability Inventory (`v1.0.0-alpha.2`)

| Feature ID | Feature Name | Scope / Source Path | Target Path | Verification Criteria / Command | Phase | Dependency Prerequisites |
|:---|:---|:---|:---|:---|:---:|:---|
| **FEAT-01** | Master Verification Infrastructure | `scripts/verify-*.sh`, `scripts/verify-*.mjs`, `scripts/generate-web3-runtime.mjs` | `scripts/` | `node scripts/verify-action-parity.mjs` exits 0 (210 actions); `node scripts/verify-suites-are-gated.mjs` exits 0 | Phase 1 | Node.js v20+, Bash 3.2+ |
| **FEAT-02** | Root Monorepo Workspaces Config | `package.json` | `package.json` | `npm install` resolves workspaces (`packages/*`, `miniapp-web`, `tests/games`, `react-native-goat-webview*`) | Phase 1 | None |
| **FEAT-03** | Android Web3 Hardware Vault SPI & Decoders | `android/feature-web3/` | `android/feature-web3/` | `./gradlew -p android :feature-web3:testDebugUnitTest` passes (Permit2 $2^{160}-1$ check, EVM/SVM/TON decoders) | Phase 2 | Android `:core`, FEAT-01 |
| **FEAT-04** | Android Opt-in Web3 Compose Modal | `android/feature-web3-compose/` | `android/feature-web3-compose/` | `./gradlew -p android :feature-web3-compose:assembleRelease` compiles cleanly (~24 KB) | Phase 2 | FEAT-03, Jetpack Compose |
| **FEAT-05** | Android Google Wallet Passes Plugin | `android/feature-wallet-passes/` | `android/feature-wallet-passes/` | `./gradlew -p android :feature-wallet-passes:testDebugUnitTest` passes; `wallet.*` actions dispatch | Phase 2 | Android `:core`, FEAT-01 |
| **FEAT-06** | Android WeChat Pay Native Adapter | `android/feature-payments-wechat/` | `android/feature-payments-wechat/` | `./gradlew -p android :feature-payments-wechat:testDebugUnitTest` passes; `WXPayEntryActivity` registered | Phase 2 | Android `:core`, FEAT-01 |
| **FEAT-07** | Android Biometrics & KeyStore Vault Engine | `android/feature-biometrics/` | `android/feature-biometrics/` | `./gradlew -p android :feature-biometrics:testDebugUnitTest` passes; AES-256-GCM HKDF vault verified | Phase 2 | Android `:core`, AndroidKeyStore |
| **FEAT-08** | iOS Web3 Decoders & Wallet Adapter SPI | `ios/Sources/GoatWebView/Web3/` | `ios/Sources/GoatWebView/Web3/` | `xcodebuild test -scheme GoatWebView-Package -only-testing:GoatWebViewTests/GoatWeb3WalletManagerTests` passes | Phase 2 | iOS core, Swift 6 concurrency |
| **FEAT-09** | iOS Passkey Engine & Hardware Vault | `ios/Sources/GoatWebView/Passkey/` | `ios/Sources/GoatWebView/Passkey/` | `xcodebuild test -scheme GoatWebView-Package -only-testing:GoatWebViewTests/GoatPasskeyTests` passes | Phase 2 | iOS core, `AuthenticationServices` |
| **FEAT-10** | iOS Apple Wallet PassKit Plugin | `ios/Sources/GoatWebView/Passes/` | `ios/Sources/GoatWebView/Passes/` | `xcodebuild test -scheme GoatWebView-Package -only-testing:GoatWebViewTests/GoatPassesPluginTests` passes | Phase 2 | iOS core, `PassKit` |
| **FEAT-11** | Injected Web3, Passkey & Vault Runtime | `miniapp-web/src/injected/` | `miniapp-web/src/injected/` | `node scripts/verify-web3-runtime-sync.mjs` exits 0; `npm --prefix miniapp-web test` passes | Phase 2 | Node.js, esbuild, FEAT-01 |
| **FEAT-12** | Bridge Mock Web3, Passkey & Passes Handlers | `packages/bridge-mock/src/handlers/` | `packages/bridge-mock/src/handlers/` | `npm --prefix packages/bridge-mock test` passes all 379 unit & A1-A10 adversarial tests | Phase 2 | Node.js, FEAT-01 |
| **FEAT-13** | Digital Wallet Pass Server Issuers | `packages/server/src/issuers/` | `packages/server/src/issuers/` | `npm --prefix packages/server test` passes; Google Wallet JWT + Apple `.pkpass` manifest generation verified | Phase 2 | Node.js, crypto |
| **FEAT-14** | 2D/3D Web Games Demo Projects (4 Engines) | `tests/games/{littlejs,phaser,threejs,r3f}-demo/` | `tests/games/` | `bash tests/games/run-all.sh build && bash tests/games/run-all.sh check-size` complies with size budgets | Phase 3 | Node.js, Vite |
| **FEAT-15** | Master 4-Tier Games E2E Verification Harness | `tests/games/e2e-verify.ts`, `tests/games/test-infra.ts` | `tests/games/` | `node --experimental-strip-types tests/games/e2e-verify.ts` passes 41/41 suites, 262/262 assertions | Phase 3 | Node.js v22+, FEAT-14 |
| **FEAT-16** | Games Embeddability Sign-Off Record | `TEST_READY.md` | `TEST_READY.md` | Verified sign-off documentation tracking 41 suites, 262 assertions, 100-cycle unmount slope $\le 0.05$ KB/cycle | Phase 3 | FEAT-15 |
| **FEAT-17** | Flutter Drop-In Compat Adapter (`goat_webview_compat`) | `goat_webview_compat/` | `goat_webview_compat/` | `flutter test` passes all 29 unit tests; `flutter analyze` passes 0 warnings | Phase 4 | Flutter SDK, Dart 3.0+ |
| **FEAT-18** | Flutter Zero-Retention Custom Lint | `goat_webview_compat/lib/src/lint/` | `goat_webview_compat/` | Lint fires on stored `InAppWebViewSettings` fields; self-check passes cleanly | Phase 4 | FEAT-17 |
| **FEAT-19** | React Native Compat Adapter (`react-native-goat-webview-compat`) | `react-native-goat-webview-compat/` | `react-native-goat-webview-compat/` | `npm test` passes 31 tests; `npm run typecheck` & `npm run build` compile cleanly | Phase 4 | React Native 0.76+, React 18+ |
| **FEAT-20** | React Native Zero-Retention ESLint Rule | `react-native-goat-webview-compat/eslint-plugin/` | `react-native-goat-webview-compat/eslint-plugin/` | `npm run test:lint-rule` passes all 9 RuleTester cases | Phase 4 | ESLint, FEAT-19 |
| **FEAT-21** | React Native Fabric Extended Native Commands | `react-native-goat-webview/` | `react-native-goat-webview/` | 10 Fabric commands wired (`goBack`, `goForward`, `reload`, `stopLoading`, `injectJavaScript`, etc.) | Phase 4 | Fabric New Architecture |
| **FEAT-22** | Portable Mini-App DSL Shims (`@goat/adapter-dsl`) | `packages/adapter-dsl/` | `packages/adapter-dsl/` | `npm test` passes 67 tests; `npm run check:size` enforces < 2.2 KB gzipped across all 4 entry points | Phase 4 | Node.js, esbuild, FEAT-01 |
| **FEAT-23** | Android Native BLE GATT Client (`AndroidBleTransport`) | `android/feature-bluetooth/` | `android/feature-bluetooth/` | `BLE_LIST_SERVICES`, `BLE_SUBSCRIBE`, `BLE_UNSUBSCRIBE` backed by real GATT client; fail-closed on absent HW | Phase 4 | Android `:core`, BLE radio |
| **FEAT-24** | iOS Core Engine Reliability & Lifecycle Manager | `ios/Sources/GoatWebView/` | `ios/Sources/GoatWebView/` | `GoatLifecycleManager.swift`, `GoatProcessPoolManager.swift`, `GoatWebViewPool.swift` active | Phase 5 | iOS core, WebKit |
| **FEAT-25** | iOS Asset Streaming & Byte Cache | `ios/Sources/GoatWebView/` | `ios/Sources/GoatWebView/` | `GoatAssetByteCache.swift`, `GoatNetworkPrewarmer.swift`; local asset loads avoid HTTP socket overhead | Phase 5 | iOS core |
| **FEAT-26** | iOS Zero-Copy Binary IPC Port Manager | `ios/Sources/GoatWebView/` | `ios/Sources/GoatWebView/` | `GoatBinaryPortManager.swift`; `CREATE_BINARY_PORT`, `POST_BINARY_MESSAGE` routes `ArrayBuffer` | Phase 5 | iOS core |
| **FEAT-27** | Android Core Engine FastPool & Memory Tiering | `android/core/` | `android/core/` | `GoatFastPool.kt`, `GoatDeviceTier.kt`; multi-tenant affinity + crash recovery; passes `:core:testDebugUnitTest` | Phase 5 | Android `:core` |
| **FEAT-28** | Android Decoupled Sensors Module (20Hz Limiter) | `android/feature-sensors/` | `android/feature-sensors/` | Native 20Hz sensor rate limiting per sensor type; auto-pause on background/blur | Phase 5 | Android `:core` |
| **FEAT-29** | Flutter Engine Core Bindings & Theme Sync | `goat_webview/` | `goat_webview/` | `goat_theme.dart`, `goat_web_view_controller.dart`; theme sync & domain allowlist active | Phase 5 | Flutter SDK |
| **FEAT-30** | Public API Catalog & Migration Documentation | Monorepo root | Monorepo root | Documentation reflects 210-action surface; 0 private development journals present | Phase 6 | All previous phases |
| **FEAT-31** | Full Monorepo Master Quality Gate | `scripts/verify-all.sh` | Monorepo root | `bash scripts/verify-all.sh` executes all 9 test tracks cleanly with zero failures | Phase 6 | All previous phases |

---

## 3. Milestones and Release Phases

| Milestone / Phase | Scope | Dependencies | Status | Acceptance Gate |
|---|---|---|:---:|---|
| **Phase 1: Foundation** | Root workspaces, verification scripts (`verify-action-parity.mjs`, `verify-suites-are-gated.mjs`, `generate-web3-runtime.mjs`) | None | **DONE** | `node scripts/verify-action-parity.mjs` (210 actions) |
| **Phase 2: Cryptography** | Web3 (EVM/Solana/TON), Passkeys (W3C WebAuthn), Digital Wallet Passes (Google Wallet / Apple PassKit), Biometric Vault | Phase 1 | **DONE** | `bash scripts/verify-wallet-passkey-adapters.sh` (12/12 passed) |
| **Phase 3: Embeddability** | 2D/3D Web Games embeddability suite (LittleJS, Phaser 3, Three.js, R3F), 4-tier E2E verification harness, sign-off record | Phase 1 | **DONE** | `node --experimental-strip-types tests/games/e2e-verify.ts` (41/41 suites, 262/262 assertions) |
| **Phase 4: Compatibility** | Flutter drop-in adapter (`goat_webview_compat`), React Native drop-in adapter (`react-native-goat-webview-compat`), Mini-App DSL shims (`@goat/adapter-dsl`) | Phase 1 | **DONE** | `flutter test` (29 tests), `npm test && npm run typecheck` (RN compat), `check:size` (< 2.2 KB gz) |
| **Phase 5: Core Hardening** | Multi-profile tenant isolation, transparent crash rehydration, isolated `WKContentWorld` bridge trampoline, iOS lifecycle & byte cache | Phase 1 | **DONE** | `./gradlew -p android :core:testDebugUnitTest`, `verify-ios.sh`, `verify-android.sh` |
| **Phase 6: Public Release** | Documentation, benchmark scripts, clean MIT licensing, complete monorepo gate | Phases 1–5 | **DONE** | `bash scripts/verify-all.sh` (100% clean across all tracks) |
| **Showcase Track (M1–M6)** | 4 Mobile/Desktop host applications, 4 domain mini-apps, floating developer debug HUD, E2E showcase suite | Phase 1 | **DONE** | `bash scripts/verify-showcase.sh` |

---

## 4. Architectural Invariants & Non-Negotiable Guarantees

### 4.1 Monorepo Invariants (G1–G6)
- **G1 (Test Verification Gate)**: Only modules with a 100% test pass rate are released. No unverified logic.
- **G2 (Clean Public Licensing)**: Strict exclusion of private internal journals (`.agents/`, `.antigravity/`, `.claude/`, `text.log`, `TASK_*.md`). MIT licensing preserved.
- **G3 (Zero Monolithic Bloat)**: Modular architecture ("One Feature = One Module"). Heavy dependencies (Web3, Passkeys, Sensors, Payments) are decoupled from base `:core` (~450 KB AAR).
- **G4 (Hardware Realism & Honesty)**: Missing hardware APIs (BLE, Biometrics, KeyStore) fail closed with explicit typed error codes (`CAPABILITY_NOT_INSTALLED`, `HARDWARE_UNAVAILABLE`). No fabricated stubs.
- **G5 (Zero Memory Leaks)**: Teardown handlers release WebGL contexts, Web Audio instances, event listeners, and clear frame-buffer allocations. Unmount retention slope $\le 0.05$ KB/cycle over 100 cycles.
- **G6 (Public Build Integrity)**: Every public CI script (`verify-all.sh`, `verify-action-parity.mjs`, `verify-wallet-passkey-adapters.sh`, `e2e-verify.ts`) executes cleanly from the repository root.

### 4.2 Compatibility Adapter Guarantees (Flutter & React Native G1–G10)
- **G1 (Zero-Retention Config)**: Configuration bags (`InAppWebViewSettings`, `WebViewProps`) are translated once into primitive creation parameters and immediately discarded from state, refs, and the element/fiber tree.
- **G2 (Lazy Native Allocation)**: Unused compat features allocate 0 native objects until their first invocation, and all allocated resources are freed upon disposal.
- **G3 (Tree-Shakeable)**: Adapter packages declare `"sideEffects": false` and export pure façades.
- **G4 (No Per-Render Allocation)**: Enforce Dart `const` constructors and React `useMemo` prop stability.
- **G5 (Bounded, Cleared Registries)**: Exactly one handler registry per instance, cleared synchronously on unmount.
- **G6 (No Idle Work)**: Zero background polling, zero idle timers, zero unthrottled requestAnimationFrame loops.
- **G7 (Opt-in Event Bridging)**: Native bridge events are forwarded across the bridge only when consumer callbacks (`hasOnX`) are registered.
- **G8 (No Default Round-Trip)**: Fire-and-forget native scheme handling by default; blocking URL veto requires explicit opt-in.
- **G9 (Static Compat Bootstrap)**: Injected shims are compiled into static strings injected once at `document-start`. No dynamic `eval()` or `new Function()`.
- **G10 (Perf/RAM CI Gates)**: CI benchmarks enforce heap retention and latency budgets.

### 4.3 5-Layer Security Gate (L1–L5)
- **L1 (User Gesture Freshness Gate)**: 10-second monotonic user gesture timestamp anchoring. Programmatic transaction spam without fresh user touch is rejected.
- **L2 (Backend Asymmetric Payload Integrity)**: Cryptographic signature verification (ECDSA P-256 / Ed25519) for sensitive payloads against tenant public key directories.
- **L3 (Credential & Vault Physical Air-Gap)**: Private keys, seed phrases, and raw CTAP2 PRF secrets never enter JavaScript memory. Cryptographic signing and derivation occur exclusively within native hardware vaults (Android KeyStore StrongBox / iOS Secure Enclave).
- **L4 (Anti-Replay Idempotency & Mutex)**: Account and nonce-keyed mutexes atomically serialize bridge requests, preventing split-mutex race conditions and replay attacks.
- **L5 (Origin Virtual Sandbox)**: Native capability dispatch is strictly restricted to authorized origins (`https://appassets.androidplatform.net`, `goat://assets/{appId}/index.html`).

---

## 5. Interface Contracts

### 5.1 Bridge Action Parity Contract (210 Actions across 18 Domains)
Every declared action is registered in `api-matrix`, handled by Android Core/Feature modules, handled by iOS Core/Feature modules, and mocked in `@goat/bridge-mock`:
1. **Core Navigation & Lifecycle**: `NAVIGATE_TO`, `NAVIGATE_BACK`, `SWITCH_TAB`, `RELOAD`, `GET_APP_INFO`, `SET_TITLE`, `EXIT_APP`, `SHOW_TOAST`, `SHOW_MODAL`, `SHOW_ACTION_SHEET`, `SHOW_LOADING`, `HIDE_LOADING`, `GET_SYSTEM_INFO`, `GET_NETWORK_TYPE`, `ON_NETWORK_STATUS_CHANGE`, `OFF_NETWORK_STATUS_CHANGE`.
2. **Storage**: `STORAGE_SET`, `STORAGE_GET`, `STORAGE_REMOVE`, `STORAGE_CLEAR`, `STORAGE_GET_INFO`.
3. **Location**: `GET_LOCATION`, `START_LOCATION_UPDATE`, `STOP_LOCATION_UPDATE`, `ON_LOCATION_CHANGE`, `OFF_LOCATION_CHANGE`.
4. **Biometrics & SOTER**: `CHECK_BIOMETRY`, `AUTHENTICATE_BIOMETRY`, `CHECK_SOTER_SUPPORT`, `INIT_SOTER_AUTH_KEY`, `AUTH_WITH_SOTER`.
5. **Scanner**: `SCAN_CODE`.
6. **Sensors**: `START_ACCELEROMETER`, `STOP_ACCELEROMETER`, `ON_ACCELEROMETER_CHANGE`, `OFF_ACCELEROMETER_CHANGE`, `START_COMPASS`, `STOP_COMPASS`, `ON_COMPASS_CHANGE`, `OFF_COMPASS_CHANGE`, `START_GYROSCOPE`, `STOP_GYROSCOPE`, `ON_GYROSCOPE_CHANGE`, `OFF_GYROSCOPE_CHANGE`, `START_DEVICE_MOTION`, `STOP_DEVICE_MOTION`, `ON_DEVICE_MOTION_CHANGE`, `OFF_DEVICE_MOTION_CHANGE`.
7. **Bluetooth LE**: `OPEN_BLUETOOTH_ADAPTER`, `CLOSE_BLUETOOTH_ADAPTER`, `GET_BLUETOOTH_ADAPTER_STATE`, `START_BLUETOOTH_DEVICES_DISCOVERY`, `STOP_BLUETOOTH_DEVICES_DISCOVERY`, `GET_BLUETOOTH_DEVICES`, `ON_BLUETOOTH_DEVICE_FOUND`, `OFF_BLUETOOTH_DEVICE_FOUND`, `CREATE_BLE_CONNECTION`, `CLOSE_BLE_CONNECTION`, `GET_BLE_DEVICE_SERVICES`, `GET_BLE_DEVICE_CHARACTERISTICS`, `READ_BLE_CHARACTERISTIC_VALUE`, `WRITE_BLE_CHARACTERISTIC_VALUE`, `NOTIFY_BLE_CHARACTERISTIC_VALUE_CHANGE`, `ON_BLE_CHARACTERISTIC_VALUE_CHANGE`, `OFF_BLE_CHARACTERISTIC_VALUE_CHANGE`.
8. **Media**: `CHOOSE_IMAGE`, `PREVIEW_IMAGE`, `GET_IMAGE_INFO`, `SAVE_IMAGE_TO_PHOTOS_ALBUM`, `CHOOSE_VIDEO`, `SAVE_VIDEO_TO_PHOTOS_ALBUM`.
9. **Audio**: `CREATE_AUDIO_INSTANCE`, `DESTROY_AUDIO_INSTANCE`, `PLAY_AUDIO`, `PAUSE_AUDIO`, `STOP_AUDIO`, `SEEK_AUDIO`, `ON_AUDIO_PLAY`, `ON_AUDIO_PAUSE`, `ON_AUDIO_STOP`, `ON_AUDIO_ENDED`, `ON_AUDIO_TIME_UPDATE`, `ON_AUDIO_ERROR`.
10. **File System**: `SAVE_FILE`, `REMOVE_SAVED_FILE`, `GET_SAVED_FILE_LIST`, `GET_SAVED_FILE_INFO`, `READ_FILE`, `WRITE_FILE`, `UNLINK_FILE`, `MKDIR`, `RMDIR`, `READDIR`, `STAT_FILE`.
11. **Network**: `REQUEST`, `UPLOAD_FILE`, `DOWNLOAD_FILE`, `CONNECT_SOCKET`, `SEND_SOCKET_MESSAGE`, `CLOSE_SOCKET`, `ON_SOCKET_OPEN`, `ON_SOCKET_MESSAGE`, `ON_SOCKET_ERROR`, `ON_SOCKET_CLOSE`.
12. **Device & Clipboard**: `GET_CLIPBOARD_DATA`, `SET_CLIPBOARD_DATA`, `MAKE_PHONE_CALL`, `SET_KEEP_SCREEN_ON`, `VIBRATE_SHORT`, `VIBRATE_LONG`, `GET_SCREEN_BRIGHTNESS`, `SET_SCREEN_BRIGHTNESS`, `ON_USER_CAPTURE_SCREEN`, `OFF_USER_CAPTURE_SCREEN`.
13. **Multi-Rail Payments**: `REQUEST_PAYMENT` (Alipay, Bakong, PayPay, Stripe, Apple Pay, Google Pay, StoreKit 2).
14. **WeChat Pay**: `WECHAT_PAY`, `WECHAT_IS_INSTALLED`.
15. **Web3 EVM / Solana / TON**: `WEB3_REQUEST_ACCOUNTS`, `WEB3_GET_ACCOUNTS`, `WEB3_SEND_TRANSACTION`, `WEB3_SIGN_TRANSACTION`, `WEB3_SIGN_MESSAGE`, `WEB3_SIGN_TYPED_DATA`, `WEB3_SWITCH_CHAIN`, `WEB3_ADD_CHAIN`, `WEB3_GET_CHAIN_ID`, `SOLANA_CONNECT`, `SOLANA_DISCONNECT`, `SOLANA_SIGN_AND_SEND_TRANSACTION`, `SOLANA_SIGN_TRANSACTION`, `SOLANA_SIGN_ALL_TRANSACTIONS`, `SOLANA_SIGN_MESSAGE`, `TON_CONNECT`, `TON_DISCONNECT`, `TON_SEND_TRANSACTION`, `TON_SIGN_DATA`.
16. **Passkeys & Hardware Vault**: `PASSKEY_REGISTER`, `PASSKEY_AUTHENTICATE`, `PASSKEY_IS_SUPPORTED`, `VAULT_ENCRYPT`, `VAULT_DECRYPT`.
17. **Digital Wallet Passes**: `WALLET_CAN_ADD_PASSES`, `WALLET_SHOW_ADD_PASS_UI`, `WALLET_HAS_PASS`, `WALLET_GET_PASSES`, `WALLET_REMOVE_PASS`.
18. **Binary IPC**: `CREATE_BINARY_PORT`, `POST_BINARY_MESSAGE`, `CLOSE_BINARY_PORT`.

### 5.2 Mini-App Asset Distribution Contract
- Bundle Location: `miniapp-web/dist/`
- Archive Name: `miniapp.zip`
- Hash Algorithm: SHA-256 digest
- Target Host Asset Paths:
  - Android: `android/app/src/main/assets/miniapp.zip`
  - iOS: `ios/Example/Resources/miniapp.zip`
  - Flutter: `goat_webview/example/assets/miniapp.zip`
  - React Native: `react-native-goat-webview/example/assets/miniapp.zip`

### 5.3 Mini-App URL Routing Contract
- Host Schemes: `goat://assets/{appId}/index.html#{route}` or `https://appassets.androidplatform.net/assets/index.html#{route}`
- App IDs & Routes:
  - E-Commerce & Payments: `appId: "com.goat.ecommerce"`, route: `#/ecommerce`
  - IoT & Hardware: `appId: "com.goat.iot"`, route: `#/iot`
  - Field Service & Navigation: `appId: "com.goat.fieldservice"`, route: `#/fieldservice`
  - Secure Biometric Vault: `appId: "com.goat.vault"`, route: `#/vault`
  - Diagnostics / HUD: `appId: "com.goat.diagnostics"`, route: `#/diagnostics`

### 5.4 Floating Debug HUD IPC Contract
- Event Stream Name: `onBridgeMessage` / `onBridgeTelemetry`
- Latency Thresholds:
  - Warm-Path: `< 5ms` (Green Badge)
  - Standard: `5 - 15ms` (Amber Badge)
  - Slow/Cold: `> 15ms` (Red Badge)
- Hardware Override State Keys:
  - `isOffline`: `boolean`
  - `mockGps`: `{ latitude: number, longitude: number, accuracy: number } | null`
  - `mockBiometrics`: `"AUTO" | "FORCE_SUCCESS" | "FORCE_ERROR" | "LOCKED_OUT" | "NOT_ENROLLED"`

---

## 6. Monorepo Code Layout

```
public_goat_webview/
├── android/                               # Native Android engine and modular feature plugins
│   ├── core/                              # Base Goat WebView engine (GoatFastPool, GoatCookieManager, GoatView)
│   ├── core-compose/                      # Jetpack Compose bindings for GoatView
│   ├── feature-web3/                      # Web3 SPI, decoders (EVM, Solana, TON), Permit2 defense
│   ├── feature-web3-compose/              # Compose slide-to-confirm modal widget
│   ├── feature-wallet-passes/             # Google Wallet Passes plugin (PayClient)
│   ├── feature-payments-wechat/           # WeChat Pay native integration
│   ├── feature-biometrics/                # BiometricPrompt & AndroidKeyStore AES-256-GCM vault
│   ├── feature-bluetooth/                 # Real Android BLE GATT client
│   ├── feature-sensors/                   # Decoupled 20Hz sensor rate limiter
│   └── publish-maven.gradle.kts           # Maven Central publication definition
├── ios/                                   # Native iOS engine and modular feature plugins
│   ├── Sources/GoatWebView/               # Core engine, WKContentWorld isolation, lifecycle, byte cache
│   │   ├── Web3/                          # iOS Web3 manager, EVM/Solana/TON decoders, wallet adapter SPI
│   │   ├── Passkey/                       # AuthenticationServices passkey manager, Secure Enclave vault
│   │   └── Passes/                        # Apple Wallet PassKit plugin (PKPassLibrary)
│   └── Tests/GoatWebViewTests/            # Comprehensive XCTest test suites (including adversarial world tests)
├── miniapp-web/                           # Sandboxed Mini-App runtime & showcase applications
│   └── src/injected/                      # TypeScript sources for injected Web3, Passkey, and EIP-6963 runtime
├── packages/                              # Monorepo packages
│   ├── adapter-dsl/                       # Portable mini-app DSL shims (wx.*, my.*, uni.*, Taro.*)
│   ├── bridge-mock/                       # Canonical bridge mock implementing all 210 actions
│   ├── server/                            # Development server, CDP relay, Google/Apple wallet pass issuers
│   ├── appservice/                        # Dual-thread mini-app service worker worker runtime
│   └── devtools/                          # In-browser developer tools and bridge inspector
├── goat_webview/                          # Flutter engine core bindings & theme synchronization
├── goat_webview_compat/                   # Flutter drop-in compatibility adapter for flutter_inappwebview
├── react-native-goat-webview/             # React Native New Architecture Fabric host component
├── react-native-goat-webview-compat/      # React Native drop-in compatibility adapter for react-native-webview
├── tests/
│   ├── games/                             # 2D/3D Web Games embeddability suite (LittleJS, Phaser, Three.js, R3F)
│   │   ├── e2e-verify.ts                  # Master 4-tier games E2E runner (41 suites, 262 assertions)
│   │   └── test-infra.ts                  # Headless DOM, mock WebGL/WebAudio test harness
│   └── e2e/                               # Cross-framework E2E showcase tests
├── scripts/                               # Release verification, benchmarking, and CI scripts
│   ├── verify-action-parity.mjs           # 210-action bridge parity validator
│   ├── verify-wallet-passkey-adapters.sh  # 13-step Web3, Passkey, and Vault verification gate
│   ├── verify-all.sh                      # Full monorepo master quality gate
│   └── benchmark-*.sh                     # Bridge latency, RAM budget, and adapter benchmark runners
├── TEST_READY.md                          # 4-Tier Web Games embeddability sign-off certification
└── CODE_RULE.md                           # Monorepo engineering rules & non-negotiable invariants
```

---

## 7. Verification Targets & Quality Gates

| Target | Command | Expected Result |
|---|---|---|
| **Bridge Action Parity** | `node scripts/verify-action-parity.mjs` | 210 actions declared, on both platforms, and mocked (0 gaps) |
| **Wallet, Passkey & Vault Gate** | `bash scripts/verify-wallet-passkey-adapters.sh` | 12/12 passed (hardware vault skipped cleanly without device) |
| **Web Games 4-Tier E2E** | `node --experimental-strip-types tests/games/e2e-verify.ts` | 41 suites, 41 cases, 262 assertions, 41 PASS, 0 FAIL |
| **Android Core Unit Tests** | `./android/gradlew -p android :core:testDebugUnitTest` | All unit tests pass cleanly (including tenant isolation & crash recovery) |
| **Flutter Compat Adapter** | `cd goat_webview_compat && flutter test` | All 29 unit and leak tests pass; 100-cycle unmount verified |
| **React Native Compat Adapter** | `cd react-native-goat-webview-compat && npm test && npm run typecheck` | 4 suites, 31 tests pass; zero TypeScript compiler errors |
| **Portable Mini-App DSL** | `cd packages/adapter-dsl && npm test && npm run check:size` | 4 suites, 67 tests pass; all bundles < 2.2 KB gzipped |
| **Full Monorepo Gate** | `bash scripts/verify-all.sh` | All 9 test tracks execute cleanly with zero failures |
