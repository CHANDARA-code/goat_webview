# @goat/bridge-mock

> Zero-dependency hermetic browser simulation engine for Goat WebView Mini-Apps with 18 functional domains, interactive DOM modal dialogs, and real-time CDP trace emission.

`@goat/bridge-mock` enables full-fidelity simulation and automated testing of Goat native bridge interactions in standard browsers (Chrome, Firefox, Safari), headless test runners (Vitest, Jest, Playwright), and DevTools IDE environments without requiring physical Android or iOS devices.

---

## Features

- **18 Simulation Domains**: 197 normalized action strings covering everything from hardware sensors and sandboxed storage to Web3 wallet signing and subpackage bytecode loading.
- **Interactive UI Modals**: Built-in pure-DOM dialogs for biometrics (FaceID/Fingerprint), camera QR scanning, permission priming, and external URL navigation.
- **CDP & Trace Telemetry**: Real-time trace emission over WebSocket to `@goat/server` for Chrome DevTools timeline integration.
- **Multi-Tenant State Store**: In-memory isolated storage, cookies, and file systems keyed by `appId`.
- **Zero Dependencies**: Pure TypeScript/JavaScript with no external runtime requirements.
- **Dual-Thread & Worker Ready**: Compatible with Web Workers, `MessagePort`, `MessageChannel`, and dual-thread AppService runtimes.

---

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Mini-App JavaScript Execution                   │
│   GoatBridge.call(action, payload) / callNative(action, payload)       │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                       @goat/bridge-mock Runtime                        │
│  - Action Normalization (camelCase / dot.notation → UPPER_SNAKE_CASE) │
│  - Parameter Validation & Type Guards                                  │
│  - EventBus (Custom Events, Broadcasts & Listeners)                    │
│  - In-Memory Multi-Tenant State Store (Isolated by callerAppId)        │
└───────────────┬───────────────────┬───────────────────┬────────────────┘
                │                   │                   │
                ▼                   ▼                   ▼
┌───────────────────────┐ ┌───────────────────┐ ┌────────────────────────┐
│  18 Simulation        │ │  DOM UI Modals    │ │  CDP WebSocket Trace   │
│  Domain Handlers      │ │  - Biometrics     │ │  - JSON-RPC 2.0 frames │
│  (Storage, FS, BLE,   │ │  - QR Scanner     │ │  - Method tracing      │
│   Sensors, Web3, etc.)│ │  - Permissions    │ │  - Perf benchmarks     │
└───────────────────────┘ └───────────────────┘ └────────────────────────┘
```

---

## 18 Simulation Domains

| # | Domain | Key Action APIs | Description |
|---|---|---|---|
| 1 | **Core & System** | `GET_DEVICE_INFO`, `HAPTIC_FEEDBACK`, `SET_SCREEN_BRIGHTNESS`, `CLIPBOARD_SET`, `CAN_I_USE`, `START_OAUTH_SESSION` | Device metadata, haptics, clipboard, OAuth sessions |
| 2 | **Storage & Sandboxing** | `STORAGE_SET`, `STORAGE_GET`, `SECURE_STORAGE_SET`, `COOKIE_SET`, `WEB_STORAGE_GET_QUOTA_USAGE` | Multi-tenant isolated storage, encrypted store, cookie jar |
| 3 | **Sandboxed FileSystem** | `FS_WRITE_FILE`, `FS_READ_FILE`, `FS_MKDIR`, `FS_STAT`, `CHOOSE_FILES` | Virtual sandboxed file system with directory traversal controls |
| 4 | **Networking & WebSockets** | `API_REQUEST`, `DOWNLOAD_FILE`, `UPLOAD_FILE`, `WEBSOCKET_CONNECT`, `VERIFY_SSL_PIN` | HTTP requests, file transfers, WebSocket emulation, SSL pinning |
| 5 | **UI Feedback & Navigation** | `SHOW_TOAST`, `SHOW_MODAL`, `SHOW_ACTION_SHEET`, `SET_NAV_BAR_TITLE`, `EXPAND_BOTTOM_SHEET`, `TAB_OPEN` | Toasts, dialogs, action sheets, navigation bar, tabs |
| 6 | **Hardware Sensors** | `START_ACCELEROMETER`, `START_GYROSCOPE`, `START_COMPASS`, `START_DEVICE_MOTION`, `MAKE_PHONE_CALL` | Emulated 3-axis accelerometer, gyroscope, compass, telephony |
| 7 | **Location & Geofencing** | `GET_LOCATION`, `CHOOSE_LOCATION`, `START_GEOFENCE`, `EVALUATE_GEOFENCE` | GPS coordinates, simulated movement, geofence trigger radius |
| 8 | **Biometrics & Permissions** | `CHECK_BIOMETRIC_SUPPORT`, `BIOMETRIC_AUTH`, `REQUEST_PERMISSION`, `GET_SETTING` | FaceID/TouchID auth, dynamic permission management |
| 9 | **Media & Audio** | `SCAN_CODE`, `CHOOSE_MEDIA`, `PREVIEW_IMAGE`, `AUDIO_PLAY`, `AUDIO_SEEK` | Camera barcode scanner, media picker, audio playback engine |
| 10 | **Contacts & Social** | `CHOOSE_CONTACT`, `GET_CONTACTS_COUNT`, `SHARE_SHEET`, `SHARE_TO_STORY` | Address book picker, social sharing dialogs |
| 11 | **Push Notifications** | `PUSH_GET_TOKEN`, `PUSH_REQUEST_PERMISSION`, `PUSH_SET_BADGE`, `SUBSCRIBE_PUSH_TOPIC` | APNs/FCM tokens, badge count, local & remote notifications |
| 12 | **BLE & NFC** | `BLE_START_SCAN`, `BLE_CONNECT`, `BLE_WRITE_CHARACTERISTIC`, `NFC_READ_TAG` | Bluetooth LE peripheral discovery, characteristic I/O, NFC |
| 13 | **Web3 & Payments** | `WEB3_CONNECT_WALLET`, `WEB3_SIGN_TRANSACTION`, `OPEN_INVOICE`, `GET_PURCHASE_PRODUCTS` | EIP-1193 wallet connect, tx signing, in-app billing |
| 14 | **Binary IPC** | `CREATE_BINARY_PORT`, `POST_BINARY_MESSAGE`, `READ_BINARY_MESSAGE` | Zero-copy ArrayBuffer / Uint8Array high-throughput IPC |
| 15 | **Predictive Navigation** | `NAV_PUSH`, `NAV_POP`, `PREDICTIVE_BACK_PROGRESS`, `PREDICTIVE_BACK_INVOKE` | Page stack routing, Android 14+ predictive back gestures |
| 16 | **Subpackages & WASM** | `LOAD_SUBPACKAGE`, `PRECOMPILE_BYTECODE`, `IS_BYTECODE_WARM`, `VALIDATE_WASM_SUPPORT` | Dynamic bundle loading, V8 bytecode caching, WASM probing |
| 17 | **Visual Rendering** | `CONFIGURE_TRANSPARENCY`, `SYNC_THEME_BACKGROUND`, `EMBED_NATIVE_VIEW` | Same-layer native view embedding, surface composition |
| 18 | **APM & Capabilities** | `GET_API_CAPABILITIES`, `RECORD_BRIDGE_TIMING`, `START_TRACE`, `GET_MEMORY_METRICS` | Startup benchmarks, memory telemetry, CDP performance trace |

---

## Interactive DOM Modal Dialogs

When running in browser contexts, `@goat/bridge-mock` renders interactive, accessible dialogs for user confirmation flows:

1. **Biometric Modal (`src/ui/biometric-modal.ts`)**: Emulates FaceID and Fingerprint authentication with Success, Cancel, and Failure trigger buttons.
2. **Scanner Modal (`src/ui/scanner-modal.ts`)**: Emulates QR/Barcode camera scanning with mock QR generation, manual code entry, and sample presets.
3. **Permission Priming Modal (`src/ui/permission-modal.ts`)**: Simulates iOS/Android runtime permission prompts with explainers and grant/deny actions.
4. **External Link Warning (`src/ui/external-link-modal.ts`)**: Prompts user before opening non-whitelisted external URLs.

---

## Installation & Usage

### 1. Browser Auto-Installation (Script Tag / Vite)

```typescript
import { installGoatBridgeMock } from '@goat/bridge-mock';

// Automatically binds window.GoatBridge and WebKit/Android bridge listeners
const mock = installGoatBridgeMock(window, {
  enableUi: true,
  traceWsUrl: 'ws://localhost:7373/cdp',
});
```

### 2. Direct Programmatic Calls

```typescript
import { dispatchBridgeAction, mockState } from '@goat/bridge-mock';

// Call any bridge action
const result = await dispatchBridgeAction('STORAGE_SET', {
  key: 'auth_token',
  value: 'mock_jwt_token_123',
});

// Inspect or mutate in-memory state directly
console.log(mockState.storage.get('default:auth_token'));
```

### 3. Automated Headless Testing (Vitest / Jest)

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { dispatchBridgeAction, mockState } from '@goat/bridge-mock';

describe('Mini-App Bridge Tests', () => {
  beforeEach(() => {
    mockState.reset();
  });

  it('stores and retrieves items correctly', async () => {
    await dispatchBridgeAction('STORAGE_SET', { key: 'user', value: { id: 42 } });
    const res = await dispatchBridgeAction('STORAGE_GET', { key: 'user' });
    expect(res.value).toEqual({ id: 42 });
  });
});
```

---

## License

MIT © 2026 Goat Engine Authors & Contributors
