# Project: SuperApp Multi-Ecosystem Showcase

## Architecture
The SuperApp showcase architecture connects 4 production-grade mobile/desktop host applications (iOS SwiftUI, Android Jetpack Compose, Flutter, and React Native) to a rich, sandboxed web mini-app runtime (`miniapp-web`) hosting 4 domain mini-apps that exercise all 18 bridge domains (210 actions).

> **Beyond the showcase (`1.0.0-alpha.2`):** the repo also ships a Web3 / Passkey / Wallet-Passes
> vertical (`android/feature-web3*`, `android/feature-wallet-passes`, `ios/Sources/GoatWebView/{Web3,Passkey,Passes}`,
> `miniapp-web/src/injected/`), two drop-in migration adapters (`goat_webview_compat` for
> `flutter_inappwebview`, `react-native-goat-webview-compat` for `react-native-webview`), the
> portable mini-app DSL shims (`packages/adapter-dsl`), and a 2D/3D web-games embeddability suite
> with its own 4-tier E2E harness (`tests/games/`). These are engine/adapter deliverables, not part
> of the showcase host apps, and are gated by `scripts/verify-wallet-passkey-adapters.sh`,
> `scripts/verify-rn.sh`, `scripts/verify-flutter.sh`, and `tests/games/e2e-verify.ts`.

```
+-----------------------------------------------------------------------------------+
|                            Host Applications (R2)                                 |
|  +-------------------+  +-------------------+  +---------------+  +-------------+ |
|  | iOS (SwiftUI)     |  | Android (Compose) |  | Flutter Host  |  | React Native| |
|  | TabView Launcher  |  | Material 3 Tabs   |  | NavigationBar |  | Fabric/Turbo| |
|  | GoatURLScheme     |  | GoatFastPool      |  | 7 Companions  |  | AppService  | |
|  +---------+---------+  +---------+---------+  +-------+-------+  +------+------+ |
+------------|----------------------|--------------------|-----------------|--------+
             |                      |                    |                 |
+------------v----------------------v--------------------v-----------------v--------+
|                   Embedded Floating Developer Debug HUD (R3)                     |
|  - Real-time IPC Message Inspector (timestamp, action, latency, JSON payload/resp) |
|  - Warm-Path Latency Benchmarking Indicator (<5ms Green, 5-15ms Amber, >15ms Red) |
|  - Hardware Overrides (Offline Mode, GPS Coordinate Spoofer, Biometric Mocking)    |
+-----------------------------------+-----------------------------------------------+
                                    |
+-----------------------------------v-----------------------------------------------+
|                      Sandboxed Mini-App Runtime & Assets                          |
|  - Packaged Asset: miniapp.zip (SHA-256 Cryptographic Checksum)                   |
|  - 4 Domain Mini-Apps (R1):                                                       |
|    1. E-Commerce & Payments (Cart, Bottom-Sheet, Apple/Google Pay, Multi-Rail)    |
|    2. IoT & Hardware Dashboard (BLE GATT, NFC NDEF, 3D Motion Orientation)        |
|    3. Field Service & Navigation (GPS Telemetry, Geofencing, Barcode/QR, Audio)   |
|    4. Secure Biometric Vault (Biometric Gate, AES-256 KeyStore, Sandboxed FS)    |
+-----------------------------------------------------------------------------------+
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | MiniApp: E-Commerce & Payments | Product catalog, cart state, native bottom-sheet checkout, Apple/Google Pay, StoreKit 2 IAP, multi-rail Alipay/Bakong/PayPay | M1 | ORIGINAL_REQUEST §R1 |
| 2 | MiniApp: IoT & Hardware | BLE scanning & GATT connection, NFC tag reading & NDEF emission, 3D device motion orientation | M1 | ORIGINAL_REQUEST §R1 |
| 3 | MiniApp: Field Service & Nav | Real-time GPS tracking with accuracy badge, geofence boundary monitoring, camera scanner, audio voice memo | M1 | ORIGINAL_REQUEST §R1 |
| 4 | MiniApp: Secure Biometric Vault | Biometric FaceID/TouchID gate, AES-256 encrypted KV storage, isolated sandbox filesystem | M1 | ORIGINAL_REQUEST §R1 |
| 5 | MiniApp Tab Switcher & Router | Unified mini-app switcher tab bar and hash routing for domain apps | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Asset Packaging Pipeline | Vite build to `dist/`, packaging to `miniapp.zip`, SHA-256 calculation, and distribution to host asset dirs | M1 | ORIGINAL_REQUEST §R1 |
| 7 | iOS SwiftUI Host Application | SwiftUI app in `ios/Example/` or `ios/GoatWebViewShowcase/` with TabView mini-app launcher, nav bar customization, dynamic scheme `goat://assets/{appId}/` | M2 | ORIGINAL_REQUEST §R2 |
| 8 | iOS Floating Debug HUD | Native SwiftUI floating draggable HUD overlay with IPC trace viewer, latency indicator (<5ms), and hardware override panel | M2 | ORIGINAL_REQUEST §R3 |
| 9 | Android Jetpack Compose Host | Material 3 Compose host in `android/app/` with multi-tab navigation, `GoatFastPool` instance recycling on tab switch | M3 | ORIGINAL_REQUEST §R2 |
| 10 | Android Floating Debug HUD | Jetpack Compose floating draggable HUD overlay with real-time IPC logging, warm-path latency badges, and hardware overrides | M3 | ORIGINAL_REQUEST §R3 |
| 11 | Flutter Host Showcase | Flutter app in `goat_webview/example/` with Material 3 NavigationBar, PlatformViews, event stream subscriptions | M4 | ORIGINAL_REQUEST §R2 |
| 12 | Flutter 7 Companion Packages | Active registration and utilization of all 7 companion capability packages in `packages/flutter/` | M4 | ORIGINAL_REQUEST §R2 |
| 13 | Flutter Floating Debug HUD | Floating Flutter developer HUD overlay with IPC trace viewer, warm-path benchmark indicator, and hardware controls | M4 | ORIGINAL_REQUEST §R3 |
| 14 | React Native Host Showcase | React Native app in `react-native-goat-webview/example/` with Fabric/TurboModule integration, AppService runtime support | M5 | ORIGINAL_REQUEST §R2 |
| 15 | React Native Floating Debug HUD | Floating React Native developer HUD with IPC message inspector, latency benchmarking, and hardware overrides | M5 | ORIGINAL_REQUEST §R3 |
| 16 | Showcase Verification Pipeline | Automated `scripts/verify-showcase.sh` validating 4 host builds, mini-app packaging, and integration tests | M6 | ORIGINAL_REQUEST §R4 |
| 17 | Zero-Regression Quality Gate | Ensuring `scripts/verify-all.sh` passes 100% with zero regressions | M6 | ORIGINAL_REQUEST §R4 |
| 18 | E2E Showcase Test Suite | 4-tier opaque-box E2E test suite covering all showcase domain workflows, platform hosts, and HUD functions | E2E | ORIGINAL_REQUEST §R4 |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| E2E | E2E Testing Track | Requirement-driven 4-tier E2E testing infrastructure and test suite for showcase applications | None | DONE |
| M1 | Domain Mini-Apps & Asset Packaging | 4 enterprise mini-apps in `miniapp-web/`, mini-app switcher, 18 bridge domain integrations, packaging to `miniapp.zip` | None | DONE |
| M2 | iOS SwiftUI Showcase & HUD | Standalone SwiftUI showcase app in `ios/Example/` or `ios/GoatWebViewShowcase/`, dynamic scheme handling, floating debug HUD | M1 | DONE |
| M3 | Android Compose Showcase & HUD | Material 3 Compose showcase in `android/app/`, `GoatFastPool` instance recycling, BiometricPrompt, KeyStore, floating debug HUD | M1 | DONE |
| M4 | Flutter Showcase & HUD | Multi-tab Flutter app in `goat_webview/example/`, 7 companion capability packages, event stream subscribers, floating debug HUD | M1 | DONE |
| M5 | React Native Showcase & HUD | Multi-tab React Native app in `react-native-goat-webview/example/`, Fabric/TurboModule runtime, AppService, floating debug HUD | M1 | DONE |
| M6 | Verification Pipeline & Acceptance | `scripts/verify-showcase.sh` 8-stage verification pipeline, execution across all platforms, ensuring `verify-all.sh` passes 100% | M1, M2, M3, M4, M5, E2E | DONE |

## Interface Contracts

### 1. Mini-App Asset Distribution Contract
- Bundle Location: `miniapp-web/dist/`
- Archive Name: `miniapp.zip`
- Hash Algorithm: SHA-256 digest
- Target Host Asset Paths:
  - Android: `android/app/src/main/assets/miniapp.zip` (Verified)
  - iOS: `ios/Example/Resources/miniapp.zip` (Verified)
  - Flutter: `goat_webview/example/assets/miniapp.zip` (Verified)
  - React Native: `react-native-goat-webview/example/assets/miniapp.zip` (Verified)

### 2. Mini-App URL Routing Contract
- Host Scheme: `goat://assets/{appId}/index.html#{route}` or `https://appassets.androidplatform.net/assets/index.html#{route}`
- App IDs & Routes:
  - E-Commerce & Payments: `appId: "com.goat.ecommerce"`, route: `#/ecommerce`
  - IoT & Hardware: `appId: "com.goat.iot"`, route: `#/iot`
  - Field Service & Navigation: `appId: "com.goat.fieldservice"`, route: `#/fieldservice`
  - Secure Biometric Vault: `appId: "com.goat.vault"`, route: `#/vault`
  - Diagnostics / HUD: `appId: "com.goat.diagnostics"`, route: `#/diagnostics`

### 3. Floating Debug HUD IPC Contract
- Event Stream Name: `onBridgeMessage` / `onBridgeTelemetry`
- Message Payload Schema:
  ```json
  {
    "id": "req-12345",
    "timestamp": 1756461234567,
    "action": "REQUEST_PAYMENT",
    "status": "SUCCESS",
    "durationMs": 3.2,
    "isWarmPath": true,
    "request": { "provider": "bakong", "amount": 15.00, "currency": "USD" },
    "response": { "status": "COMPLETED", "txHash": "0xabc..." }
  }
  ```
- Latency Thresholds:
  - Warm-Path: `< 5ms` (Green Badge)
  - Standard: `5 - 15ms` (Amber Badge)
  - Slow/Cold: `> 15ms` (Red Badge)
- Hardware Override State Keys:
  - `isOffline`: `boolean`
  - `mockGps`: `{ latitude: number, longitude: number, accuracy: number } | null`
  - `mockBiometrics`: `"AUTO" | "FORCE_SUCCESS" | "FORCE_ERROR" | "LOCKED_OUT" | "NOT_ENROLLED"`

## Code Layout
- Web Mini-Apps: `miniapp-web/src/` (`App.tsx`, `miniapp-bridge.ts`, `components/ecommerce/`, `components/iot/`, `components/fieldservice/`, `components/vault/`, `components/debug/`)
- iOS Showcase: `ios/Example/` and `ios/Sources/GoatWebView/` (`GoatShowcaseTab.swift`, `GoatTelemetryManager.swift`, `GoatHardwareOverrideManager.swift`, `GoatFloatingDebugHUD.swift`, `GoatShowcaseMainView.swift`)
- Android Showcase: `android/app/src/main/java/com/example/miniappwebview/` (`MainActivity.kt`, `ShowcaseScreen.kt`, `DebugHudOverlay.kt`, `GoatFastPoolContainer.kt`)
- Flutter Showcase: `goat_webview/example/lib/` (`main.dart`, `widgets/debug_hud.dart`, `widgets/showcase_tabs.dart`)
- React Native Showcase: `react-native-goat-webview/example/` (`App.tsx`, `src/DebugHUD.tsx`, `src/ShowcaseTabs.tsx`)
- Verification Pipeline: `scripts/verify-showcase.sh`, `scripts/verify-all.sh`
- E2E Test Suite: `tests/e2e/` (`showcase/run-showcase.ts`, `showcase.test.ts`, `hud.test.ts`, `miniapps.test.ts`, `run-all.ts`)
