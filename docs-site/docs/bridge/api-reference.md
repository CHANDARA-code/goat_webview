---
sidebar_position: 2
title: Bridge API Reference
---

# Bridge API Reference

The Goat WebView Native Bridge provides 185 standardized native actions categorized across 24 core capabilities.

## Summary of Action Categories

| Category | Actions Count | Example Actions | Description |
| :--- | :--- | :--- | :--- |
| **1. Device & Haptics** | 3 | `GET_DEVICE_INFO`, `HAPTIC_FEEDBACK` | Device model, OS, battery, screen metrics, anonymous `installGuid`, and tactile feedback. |
| **2. Storage & Sandboxing** | 8 | `STORAGE_SET`, `STORAGE_GET`, `SECURE_STORAGE_SET`, `SECURE_STORAGE_GET` | Key-value preferences, AES-256 GCM encrypted enclave secrets, and account isolation. |
| **3. Cookies & Web Storage** | 6 | `COOKIE_GET`, `COOKIE_SET`, `COOKIE_REMOVE`, `WEB_STORAGE_GET_QUOTA_USAGE`, `WEB_STORAGE_CLEAR` | RFC 6265 cookie management and Web Storage quota accounting. |
| **4. In-App OAuth & Auth** | 4 | `START_OAUTH_SESSION`, `CANCEL_OAUTH_SESSION`, `HTTP_AUTH_SAVE_CREDENTIAL`, `HTTP_AUTH_CLEAR_CREDENTIALS` | CustomTabs / ASWebAuthenticationSession OAuth flows and HTTP Basic/Digest credential storage. |
| **5. Navigation & UI** | 12 | `NAVIGATE_BACK`, `SET_NAV_BAR_TITLE`, `SET_NAV_BAR_COLOR`, `EXPAND_BOTTOM_SHEET`, `COLLAPSE_BOTTOM_SHEET` | Native navigation bars, bottom sheets, predictive back gestures, and system theme colors. |
| **6. Filesystem Sandboxing** | 10 | `FS_WRITE_FILE`, `FS_READ_FILE`, `FS_MKDIR`, `FS_RMDIR`, `FS_LIST_DIR`, `FS_STAT`, `FS_EXISTS` | Sandboxed file I/O with Zip Slip and path-traversal guards. |
| **7. Native Dialogs & Feedback**| 6 | `SHOW_TOAST`, `HIDE_TOAST`, `SHOW_MODAL`, `SHOW_ACTION_SHEET`, `SHOW_LOADING`, `HIDE_LOADING` | Native alerts, modals, action sheets, loading HUDs, and anti-spam cooldown protection. |
| **8. Motion & Sensors** | 10 | `START_ACCELEROMETER`, `START_COMPASS`, `START_GYROSCOPE`, `START_DEVICE_MOTION` | Sensor data streams with coalesced event throttling (50ms). |
| **9. Location & Geofencing** | 7 | `GET_LOCATION`, `CHOOSE_LOCATION`, `START_GEOFENCE`, `LIST_GEOFENCES`, `EVALUATE_GEOFENCE` | High-accuracy GPS, map pickers, and circular geofence boundary monitoring. |
| **10. Camera, Media & QR** | 6 | `SCAN_CODE`, `CHOOSE_MEDIA`, `PREVIEW_IMAGE`, `CHOOSE_FILES`, `CANCEL_FILE_CHOOSER` | Barcode/QR scanning, gallery/camera pickers, and multi-file choosers. |
| **11. Audio Playback** | 4 | `AUDIO_PLAY`, `AUDIO_PAUSE`, `AUDIO_STOP`, `AUDIO_SEEK` | Background audio playback with lifecycle management. |
| **12. Network & Connectivity** | 6 | `API_REQUEST`, `GET_NETWORK_TYPE`, `IS_CONNECTED`, `UPLOAD_FILE`, `DOWNLOAD_FILE`, `WEBSOCKET_CONNECT` | Quic/HTTP3 networking, byte counting, SSL pinning, and WebSocket streams. |
| **13. Bluetooth Low Energy** | 7 | `START_BLE_SCAN`, `CONNECT_BLE_DEVICE`, `READ_BLE_CHARACTERISTIC`, `WRITE_BLE_CHARACTERISTIC` | BLE scanning, GATT connection, and characteristic read/write. |
| **14. NFC Discovery** | 5 | `START_NFC_DISCOVERY`, `STOP_NFC_DISCOVERY`, `READ_NFC_NDEF_MESSAGE`, `NFC_WRITE_TAG` | NDEF message decoding and NFC tag writing. |
| **15. Push Notifications** | 9 | `GET_PUSH_TOKEN`, `PUSH_REQUEST_PERMISSION`, `PUSH_SET_BADGE`, `SUBSCRIBE_PUSH_TOPIC` | Push token registration, badge updates, and topic subscription. |
| **16. Web3 & Payments** | 7 | `WEB3_CONNECT_WALLET`, `WEB3_SIGN_TRANSACTION`, `OPEN_INVOICE`, `GET_PURCHASE_PRODUCTS` | Crypto wallet signing and in-app purchase product queries. |
| **17. Binary Message Ports** | 4 | `CREATE_BINARY_PORT`, `POST_BINARY_MESSAGE`, `READ_BINARY_MESSAGE`, `CLOSE_BINARY_PORT` | Zero-copy ArrayBuffer binary IPC channels. |
| **18. Permissions & Settings** | 5 | `CHECK_PERMISSION`, `REQUEST_PERMISSION`, `GET_SETTING`, `OPEN_SETTING`, `AUTHORIZE` | Two-stage rationale permission priming and settings deep-linking. |
| **19. Performance & Tracing** | 10 | `START_TRACE`, `STOP_TRACE`, `GET_TRACES`, `GET_APM_METRICS`, `GET_MEMORY_METRICS` | W3C OpenTelemetry distributed tracing and APM instrumentation. |
| **20. Ahead-Of-Time Bytecode** | 4 | `PRECOMPILE_BYTECODE`, `IS_BYTECODE_WARM`, `CLEAR_BYTECODE_CACHE`, `GET_BYTECODE_STATS` | V8 Code Cache and JavaScriptCore bytecode compilation. |
| **21. Subpackages & Native Views**| 8 | `LOAD_SUBPACKAGE`, `IS_SUBPACKAGE_CACHED`, `EMBED_NATIVE_VIEW`, `UPDATE_NATIVE_VIEW_BOUNDS` | Dynamic subpackage loading and composited native view embedding. |
| **22. Benchmarks & Discovery** | 5 | `GET_API_CAPABILITIES`, `REGISTER_CAPABILITY`, `GET_STARTUP_BENCHMARK_REPORT` | Runtime capability probing and boot benchmark metrics. |
