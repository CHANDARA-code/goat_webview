# SuperApp Showcase: Master 4-Tier E2E Test Infrastructure

---

## 1. Test Philosophy & Architecture

The Goat WebView SuperApp Showcase E2E Testing Infrastructure enforces a rigorous **4-Tier Requirement-Driven Opaque-Box Testing Methodology**. It validates the end-to-end integration between **4 Production-Grade Mobile/Desktop Host Applications** (iOS SwiftUI, Android Jetpack Compose, Flutter PlatformView, and React Native Fabric) and **4 Sandboxed Enterprise Mini-Apps** (`miniapp-web`) across all **18 Native Bridge Domains (197 Actions)** and the **Embedded Floating Developer Debug HUD**.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        SuperApp Showcase 4-Tier Testing Hierarchy                      │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Tier 1: Feature Coverage (Category-Partition)                                        │
│  Exhaustive nominal test coverage across 4 domain mini-apps & 18 bridge domains        │
│  - E-Commerce & Payments Mini-App (Cart, Bottom-Sheet, Apple/Google Pay, Bakong, IAP)   │
│  - IoT & Hardware Mini-App (BLE GATT, NFC NDEF, 3D Motion Orientation, Binary IPC)     │
│  - Field Service & Nav Mini-App (GPS Telemetry, Geofencing, QR Scanner, Audio Memo)    │
│  - Secure Biometric Vault Mini-App (FaceID Gate, AES-256 KV Storage, Sandboxed VFS)   │
│  - Developer Debug HUD (Real-time IPC Tracer, Warm-Path Latency, Hardware Overrides)  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Tier 2: Boundary Value Analysis (BVA) & Corner Cases                                  │
│  Edge domains & defensive boundaries:                                                  │
│  - Schema validation, missing mandatory parameters, data type confusion               │
│  - Biometric lockout (`LOCKED_OUT`, `NOT_ENROLLED`, simulated user failure)            │
│  - Network offline simulation (`isOffline=true`) & Anti-SSRF localhost blocking        │
│  - GPS extreme coordinate clamping (lat ±90, lng ±180, negative geofence radius)       │
│  - VFS path traversal defense (`../../etc/passwd`, null-byte injections, root paths)   │
│  - Payment boundary validation (negative amounts, zero value, unsupported providers)   │
│  - BLE/NFC edge states (disconnected read/write, non-existent peripheral IDs)          │
│  - High-frequency burst & rate limiting (50+ rapid sequential dispatches)             │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Tier 3: Cross-Feature & Pairwise Combinatorial Interactions                           │
│  Complex multi-domain bridge integrations:                                             │
│  - Biometric step-up authentication before high-value payment execution                │
│  - BLE sensor & NFC tag telemetry streamed directly to AES-256 encrypted vault         │
│  - GPS geofence entry transition automatically triggering audio memo recording & VFS   │
│  - Camera QR scanner adding item to cart and opening native checkout sheet             │
│  - 3D motion orientation anomaly triggering haptic alert & APM telemetry metric        │
│  - Floating Developer Debug HUD live hardware override dynamic interception            │
├────────────────────────────────────────────────────────────────────────────────────────┤
│  Tier 4: Real-World SuperApp Production Scenarios                                     │
│  Full-lifecycle production workflows:                                                  │
│  - TC-T4-01: Omnichannel E-Commerce Checkout & Multi-Rail Payment Workflow             │
│  - TC-T4-02: Smart Warehouse IoT Asset Auditing & NDEF Tagging Workflow                │
│  - TC-T4-03: Field Service Dispatch, Geofence Check-In & Voice Incident Logging        │
│  - TC-T4-04: High-Security Biometric Vault Enclave & Multi-Tenant Audit Workflow       │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Core Testing Principles
1. **Opaque-Box Verification**: Tests interact strictly through public native bridge dispatch contracts (`dispatch(action, payload)`), verifying observable responses, side effects, and telemetry without reliance on private internals.
2. **Zero-Trust Multi-Tenant Partitioning**: Strict zero-bleed isolation across storage keyspaces (`goat_storage_<tenant>`), AES-256 secure storage, and virtual filesystem sandbox directories (`/sandbox/data/<tenant>/`).
3. **Deterministic Latency Benchmarking**: Real-time evaluation of IPC round-trip duration categorized into `<5ms` (Warm-Path Green), `5–15ms` (Standard Amber), and `>15ms` (Cold Red).
4. **Hermetic Hardware Simulation**: Full fidelity hardware mocking for BiometricPrompt/FaceID, GPS telemetry spoofer, BLE GATT peripherals, and NFC NDEF controllers.

---

## 2. Feature Inventory & Test Mapping Matrix

| # | Feature / Domain | Mini-App Scope | Tier 1 (Nominal) | Tier 2 (Boundary) | Tier 3 (Cross-Feature) | Tier 4 (Workflows) | Total Tests |
|---|:-----------------|:---------------|:----------------:|:-----------------:|:----------------------:|:------------------:|:-----------:|
| 1 | **E-Commerce & Payments** | `com.goat.ecommerce` (`#/ecommerce`) | 5 | 2 | ✓ | ✓ | **7+** |
| 2 | **IoT & Hardware Dashboard** | `com.goat.iot` (`#/iot`) | 5 | 2 | ✓ | ✓ | **7+** |
| 3 | **Field Service & Nav** | `com.goat.fieldservice` (`#/fieldservice`) | 5 | 3 | ✓ | ✓ | **8+** |
| 4 | **Secure Biometric Vault** | `com.goat.vault` (`#/vault`) | 4 | 3 | ✓ | ✓ | **7+** |
| 5 | **Debug HUD & APM** | Floating Developer HUD / Overrides | 4 | 2 | ✓ | ✓ | **6+** |
| 6 | **Schema & Security Defenses** | VFS, Anti-SSRF, Schema Validators | 2 | 4 | ✓ | ✓ | **6+** |
| 7 | **Cross-Feature Integrations** | Multi-Domain Pairwise Scenarios | — | — | 6 | — | **6** |
| 8 | **Production Workflows** | End-to-End SuperApp Workflows | — | — | — | 4 | **4** |
| **Total** | **SuperApp Showcase Suite** | **All 4 Mini-Apps & 18 Domains** | **25 Tests** | **17 Tests** | **6 Scenarios** | **4 Workflows** | **52 Tests** |

*Note: The master test suite aggregates these 52 Showcase tests with Foundational Engine, Section 16, Task 10200 Coalescer, Task 10183 Popup Manager, Task 10206 Payments, and Task 10201 Cross-MiniApp suites for a grand total of **939 tests** across **200 test suites**.*

---

## 3. Comprehensive Test Specification Breakdown

### Tier 1: Feature Coverage (Category-Partition) — 25 Tests

#### Domain Mini-App 1: E-Commerce & Payments (`com.goat.ecommerce`)
- **`TC-T1-ECOM-01`**: Product catalog lookup, add-to-cart, persistent cart storage, subtotal/tax calculations.
- **`TC-T1-ECOM-02`**: Native bottom-sheet presentation (`SHOW_BOTTOM_SHEET`) and navigation bar title/color customization.
- **`TC-T1-ECOM-03`**: Multi-rail payment processing across Apple Pay, Google Pay, Bakong KHQR, and Alipay.
- **`TC-T1-ECOM-04`**: StoreKit 2 and Play Billing in-app purchase (IAP) product querying and subscription transactions.
- **`TC-T1-ECOM-05`**: Order confirmation UI feedback, confirmation modal, and success haptic actuation.

#### Domain Mini-App 2: IoT & Hardware Dashboard (`com.goat.iot`)
- **`TC-T1-IOT-01`**: BLE scanning, RSSI signal filtering, peripheral connection, and GATT service discovery.
- **`TC-T1-IOT-02`**: BLE GATT characteristic read/write operations with Base64 payload encoding.
- **`TC-T1-IOT-03`**: NFC tag discovery, NDEF payload reading, and NDEF record emission.
- **`TC-T1-IOT-04`**: Real-time 3D device motion orientation (roll, pitch, yaw, user acceleration, gravity).
- **`TC-T1-IOT-05`**: High-throughput binary IPC port opening and 1024-byte packet transmission.

#### Domain Mini-App 3: Field Service & Navigation (`com.goat.fieldservice`)
- **`TC-T1-FIELD-01`**: High-accuracy GPS location tracking with accuracy badge threshold validation.
- **`TC-T1-FIELD-02`**: Circular geofence boundary registration, active geofences query, and transition events.
- **`TC-T1-FIELD-03`**: Camera barcode & QR code scanner integration.
- **`TC-T1-FIELD-04`**: Audio voice memo recording, duration calculation, and playback.
- **`TC-T1-FIELD-05`**: Sandboxed field incident report JSON persistence in virtual filesystem.

#### Domain Mini-App 4: Secure Biometric Vault (`com.goat.vault`)
- **`TC-T1-VAULT-01`**: Biometric hardware support probe and FaceID / TouchID authentication gate.
- **`TC-T1-VAULT-02`**: Hardware-backed KeyStore / Secure Enclave key generation and version rotation.
- **`TC-T1-VAULT-03`**: AES-256-GCM encrypted key-value storage lifecycle (store, retrieve, remove).
- **`TC-T1-VAULT-04`**: Isolated sandbox virtual filesystem directory partitioning and file stat verification.

#### Embedded Floating Developer Debug HUD & APM
- **`TC-T1-HUD-01`**: Real-time IPC message logging and telemetry subscriber event dispatch.
- **`TC-T1-HUD-02`**: Warm-path latency classification (<5ms Green, 5–15ms Amber, >15ms Red).
- **`TC-T1-HUD-03`**: Hardware override panel toggles (offline mode, GPS coordinate spoofer, biometric outcome).
- **`TC-T1-HUD-04`**: APM capability discovery across all 18 domains and performance metric recording.

---

### Tier 2: Boundary & Corner Cases (BVA) — 17 Tests

#### Schema Validation & Defensive Failure
- **`TC-T2-SCH-01`**: Rejects missing mandatory parameters across clipboard, storage, VFS, and networking actions.
- **`TC-T2-SCH-02`**: Rejects invalid haptic types and unsupported actions with fail-closed errors.

#### Biometric Edge States & Lockouts
- **`TC-T2-BIO-01`**: Handles `NOT_ENROLLED` biometric hardware state gracefully.
- **`TC-T2-BIO-02`**: Handles `LOCKED_OUT` state after excessive failed authentication attempts.
- **`TC-T2-BIO-03`**: Simulates user cancellation or biometric mismatch failure.

#### Network Offline & Anti-SSRF Defenses
- **`TC-T2-NET-01`**: Blocks outbound HTTP and payment requests when HUD Offline override is active.
- **`TC-T2-NET-02`**: Strictly blocks SSRF targeting localhost (`127.0.0.1`, `localhost`) and cloud metadata (`169.254.169.254`).
- **`TC-T2-NET-03`**: Rejects malformed and unsupported URL protocol schemes.

#### GPS Coordinates & Geofence Boundaries
- **`TC-T2-GPS-01`**: Rejects out-of-range GPS latitudes (> 90 or < -90).
- **`TC-T2-GPS-02`**: Rejects out-of-range GPS longitudes (> 180 or < -180).
- **`TC-T2-GPS-03`**: Rejects non-positive geofence radius.

#### VFS Path Traversal & Injection Defenses
- **`TC-T2-VFS-01`**: Rejects directory traversal attempts (`../../../../etc/passwd`).
- **`TC-T2-VFS-02`**: Rejects null-byte injection in file paths (`valid.txt\0/evil`).
- **`TC-T2-VFS-03`**: Rejects root absolute directory breakouts (`/etc/hosts`, `/var`).

#### Payment & Hardware Peripherals
- **`TC-T2-PAY-01`**: Rejects negative or zero payment amounts with `INVALID_AMOUNT`.
- **`TC-T2-PAY-02`**: Rejects unsupported payment gateway providers with `UNSUPPORTED_PROVIDER`.
- **`TC-T2-BLE-01`**: Rejects characteristic read/write when peripheral is disconnected.
- **`TC-T2-BLE-02`**: Rejects connection to non-existent BLE device ID.
- **`TC-T2-BURST-01`**: Handles 50 rapid sequential dispatches with zero corruption.

---

### Tier 3: Cross-Feature Combinations — 6 Scenarios

- **`TC-T3-01`**: **Biometric Step-Up Authentication Before Payment**: Cart total verification -> Native bottom sheet -> FaceID biometric authorization -> Apple Pay execution -> UI confirmation.
- **`TC-T3-02`**: **BLE/NFC Hardware Telemetry to Encrypted Vault**: Connect BLE sensor -> Read temperature -> Scan NFC tag -> Package into AES-256 encrypted vault record -> Decrypt & verify.
- **`TC-T3-03`**: **GPS Geofence Transition Triggering Audio Memo & VFS Report**: Geofence entry event -> Auto-initiate audio memo recording -> Save incident package to VFS -> Push local notification.
- **`TC-T3-04`**: **Camera QR Scanner Adding Item to Cart & Triggering Checkout Sheet**: Scan physical product QR -> Auto-insert into cart -> Pop native checkout bottom sheet -> Settle via Bakong KHQR.
- **`TC-T3-05`**: **3D Motion Orientation Anomaly Alert**: Continuous motion updates -> Detect orientation tilt -> Actuate warning haptic -> Record APM telemetry metric.
- **`TC-T3-06`**: **Developer Debug HUD Live Hardware Override Interception**: Dynamic GPS spoofing injection -> Dynamic offline toggle -> Real-time IPC duration and error capture in HUD trace log.

---

### Tier 4: Real-World SuperApp Production Scenarios — 4 Workflows

- **`TC-T4-01`**: **Omnichannel E-Commerce Checkout & Multi-Rail Payment Workflow**: Complete user buying journey from catalog browsing, cart mutation, native bottom sheet, FaceID authorization, Apple Pay settlement, encrypted receipt storage, and HUD trace verification.
- **`TC-T4-02`**: **Smart Warehouse IoT Asset Auditing & NDEF Tagging Workflow**: End-to-end field auditor workflow connecting to BLE diagnostic sensor, reading temperature telemetry, scanning NFC asset tag, emitting updated NDEF audit records, writing encrypted VFS audit logs, and syncing to backend API.
- **`TC-T4-03`**: **Field Service Dispatch, Geofence Check-In & Voice Incident Logging Workflow**: Complete technician dispatch workflow receiving local notification, navigating via GPS, triggering site geofence entry, scanning equipment QR code, recording audio voice memo, and compiling sealed incident report in VFS.
- **`TC-T4-04`**: **High-Security Biometric Vault Enclave & Multi-Tenant Audit Workflow**: Enterprise vault workflow initializing FaceID gate, rotating Secure Enclave master keys, storing private credentials, mathematically verifying zero cross-tenant bleed with other mini-apps, and inspecting complete IPC audit trail in Developer HUD.

---

## 4. Test Execution Commands & CI Integration

### 1. Dedicated SuperApp Showcase Test Suite
```bash
node --experimental-strip-types tests/e2e/showcase/run-showcase.ts
```

### 2. Mini-Apps & HUD Specific Test Runners
```bash
node --experimental-strip-types tests/e2e/miniapps.test.ts
node --experimental-strip-types tests/e2e/hud.test.ts
node --experimental-strip-types tests/e2e/showcase.test.ts
```

### 3. Master 4-Tier Opaque-Box E2E Suite Runner
```bash
node --experimental-strip-types tests/e2e/run-all.ts
```

### 4. Master E2E Shell Verification Gate
```bash
bash scripts/verify-e2e.sh
```

---

## Device Benchmark Suite (Startup SLA Enforcement)

The objective SLAs — **cold startup < 300ms, warm startup < 50ms, 60/120 FPS** — are enforced by an
AndroidX Macrobenchmark suite on a real device/emulator:

- Module: `android/benchmark` (`com.android.test`, targets `:app`)
- Benchmark: `android/benchmark/src/main/java/com/goat/webview/benchmark/GoatStartupBenchmark.kt`
  - `coldStartupMiniAppShowcase` — `StartupTimingMetric`, `StartupMode.COLD`, 7 iterations
  - `warmStartupMiniAppShowcase` — `StartupTimingMetric`, `StartupMode.WARM`, 10 iterations
  - `frameTimingTabSwitchesAndScroll` — `FrameTimingMetric`, 5 iterations
- Runner: `bash scripts/benchmark-android.sh` (requires a connected device; writes `dist/startup-benchmark-report.json`)
- CI: `.github/workflows/benchmark.yml` (manual dispatch, API 34 x86_64 emulator)

CODE_RULE targets are stricter than the objective gate: 120ms cold boot, 15ms warm pool swap
(`GoatStartupBenchmark` in core records these via the `GET_STARTUP_BENCHMARK_REPORT` bridge action).
