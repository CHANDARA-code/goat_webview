---
sidebar_position: 1
title: 18-Domain API Reference Overview
description: Master 18-domain, 197-action native bridge catalog and interactive search matrix.
---

import ApiCatalog from '@site/src/components/ApiCatalog';

# Goat WebView 18-Domain API Reference

Welcome to the comprehensive API Reference Matrix for the Goat WebView Native Bridge ecosystem. The runtime standardizes **197 action strings** partitioned across **18 functional domains**, delivering 100% feature parity across Android, iOS, React Native, Flutter, and the Web Simulator.

---

## Interactive API Catalog & Search Index

Search across all 197 actions, filter by domain or platform support, inspect required Android/iOS permissions, and copy ready-to-run code snippets in TypeScript, Kotlin, Swift, and Dart.

<ApiCatalog />

---

## 18 Functional Domains Overview

| # | Domain | Actions | Description |
| :--- | :--- | :--- | :--- |
| 1 | [**Core & System Lifecycle**](./core-system) | `12 actions` | Hardware metrics, vibration haptics, status bar appearance, brightness, screen wake locks, clipboard exchange, back navigation, and secure OAuth sessions. |
| 2 | [**Multi-Tenant Storage & Sandboxing**](./storage-sandboxing) | `16 actions` | Hardware-backed AES-256-GCM enclave storage, tenant isolation per appId, RFC 6265 cookie management, and web storage quota accounting. |
| 3 | [**Sandboxed FileSystem & Chooser**](./sandboxed-filesystem) | `11 actions` | Sandboxed file I/O operations inside app-isolated directory (/sandbox/data/`{appId}`/) with path-traversal guards and native file choosers. |
| 4 | [**Networking, HTTP & WebSockets**](./networking-http) | `10 actions` | Zero-trust networking stack with anti-SSRF protections, chunked streaming downloads/uploads, WebSocket bridge, and SSL pinning audits. |
| 5 | [**UI, Navigation Bar & Sheets**](./ui-navigation-bars) | `28 actions` | Native navigation bar styling, multi-snap draggable bottom sheets, safe-area window insets, toasts, modals, and multi-tab presentation. |
| 6 | [**Hardware Sensors & Telephony**](./hardware-sensors) | `12 actions` | Hardware motion sensors (accelerometer, gyroscope, compass, device motion) with 50ms coalesced throttling, plus phone calls and SMS. |
| 7 | [**Location & Geofencing**](./location-geofencing) | `7 actions` | High-accuracy GPS positioning (WGS84 / GCJ02), map location pickers, and circular geofence boundary transition triggers. |
| 8 | [**Biometrics & Permissions**](./biometrics-security) | `8 actions` | Hardware biometric authentication (FaceID, TouchID, BiometricPrompt), two-stage permission priming dialogs, and COOP/COEP sandbox auditing. |
| 9 | [**Media & Audio**](./media-audio) | `7 actions` | Camera QR/barcode scanner, photo gallery and video pickers, multi-image preview gallery, and background audio player controller. |
| 10 | [**Contacts & Social Sharing**](./contacts-social) | `5 actions` | Address book picker with privacy guardrails, contacts counter, system share sheet, and Instagram/Snapchat Story sharing. |
| 11 | [**Push Notifications**](./push-notifications) | `9 actions` | APNs / FCM push token retrieval, application notification badges, in-app local notification dispatch, and pub/sub topic subscriptions. |
| 12 | [**Bluetooth Low Energy & NFC**](./bluetooth-nfc) | `16 actions` | GATT client communication (device discovery, service discovery, characteristic read/write) and ISO 14443 / NDEF NFC tag operations. |
| 13 | [**Web3 & Payments**](./web3-payments) | `7 actions` | EVM / Solana Web3 wallet connection, transaction signing with user gesture gate, in-app invoice checkout, and IAP product queries. |
| 14 | [**Binary IPC Channels**](./binary-ipc) | `4 actions` | High-throughput, zero-copy ArrayBuffer binary message ports for large payloads (images, audio frames, WASM memory buffers). |
| 15 | [**Navigation & Predictive Back**](./navigation-stack) | `12 actions` | Multi-page navigation stack management (push, pop, replace, popToRoot) and Android 14+ / iOS 18+ predictive back gesture physics. |
| 16 | [**Subpackages, WASM & Bytecode**](./subpackages-wasm) | `9 actions` | Dynamic on-demand subpackage downloading and extraction, V8 code cache / JSC bytecode precompilation, and WASM SIMD validation. |
| 17 | [**Visual Rendering & Same-Layer**](./visual-rendering) | `10 actions` | WebView window transparency, anti-white-flash background color synchronization, nested scrolling coordinator, and same-layer native views. |
| 18 | [**APM & Telemetry**](./apm-telemetry) | `14 actions` | Runtime API capability discovery, dynamic plugin registration, isolated process status, boot SLA benchmark metrics, and OpenTelemetry spans. |

---

## Global Platform & Error Guarantees

Every native bridge action conforms to standard platform contracts:
- **Zero-Trust Anti-SSRF:** Outbound networking blocked against private subnets (127.0.0.1, RFC1918) and cloud metadata (169.254.169.254).
- **Tenant Storage Sandboxing:** Strict isolation of key-value preferences and file system trees per `appId` with 10 MB and 50 MB quota boundaries.
- **Biometric & Sensitive Feature Gesture Gate:** Actions like `BIOMETRIC_AUTH`, `CLIPBOARD_GET`, and `WEB3_SIGN_TRANSACTION` require an active touch gesture (&lt;10s) before dispatch.
- **Anti-Spam Dialog Throttling:** Dialog actions like `SHOW_MODAL` enforce a 500ms cooldown window to prevent UI lockup.
