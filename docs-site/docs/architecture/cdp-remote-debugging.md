---
sidebar_position: 4
title: CDP Remote Debugging Protocol
---

# Chrome DevTools Protocol (CDP) Remote Debugging

The **Goat Remote Debugging Architecture** integrates standard **Chrome DevTools Protocol (CDP)** and **Safari Web Inspector** endpoints with a dedicated **`GoatBridge` custom inspection domain**. This enables mini-app developers to inspect DOM elements, analyze network requests, set JavaScript breakpoints, profile memory leaks, and audit native bridge IPC calls in real-time using standard Chrome/Edge DevTools, VSCode, or the interactive Web Playground.

---

## Remote Debugging Architecture Topology

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        CDP REMOTE DEBUGGING ARCHITECTURAL TOPOLOGY                     │
└────────────────────────────────────────────────────────────────────────────────────────┘

  Developer Workstations (Chrome / VSCode)          Goat Tooling Infrastructure
  ┌─────────────────────────────────────┐           ┌───────────────────────────────────┐
  │ Chrome DevTools / VSCode Debugger   │           │ @goat/server Daemon (Port 9222)   │
  │ (devtools://... or ws://localhost)  │           │ - /json/version discovery         │
  └──────────────────┬──────────────────┘           │ - /json/list target enumeration   │
                     │                              │ - SQLite trace persistence        │
                     │ WebSocket (ws://localhost)   └─────────────────┬─────────────────┘
                     ▼                                                ▼
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │ Standard Domains: Page, DOM, CSS, Network, Runtime, Console                         │
  │ Custom Domain: GoatBridge                                                           │
  │  - GoatBridge.messageSent     ({ callId, appId, action, payload, timestamp })       │
  │  - GoatBridge.messageReceived ({ callId, status, result, durationMs })              │
  │  - GoatBridge.setMockResponse ({ action, mockResult, shouldFail })                  │
  └──────────────────────────────────┬──────────────────────────────────────────────────┘
                                     │
                     ADB Reverse / Unix Domain Sockets
                                     │
                                     ▼
                      Mobile Device / Emulator Runtime
  ┌─────────────────────────────────────────────────────────────────────────────────────┐
  │ - Android Chromium WebView (Remote Debugging Port: 9222)                            │
  │ - iOS WKWebView / Web Inspector (Relay via 9223)                                    │
  │ - In-App DevMenu HUD (Shake Gesture / 3-Finger Tap / vConsole Overlay)              │
  └─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Discovery Endpoints (`@goat/server`)

The `@goat/server` daemon runs on port `9222` (or `7373` in CLI dev mode) and exposes standard HTTP discovery endpoints:

### 1. `GET /json/version`

Returns runtime metadata and root debugger socket URL:

```json
{
  "Browser": "GoatWebView/1.0.0 (Chromium 124.0.6367.82)",
  "Protocol-Version": "1.3",
  "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 9 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.6367.82 Mobile Safari/537.36 Goat/1.0.0",
  "V8-Version": "12.4.254.14",
  "WebKit-Version": "537.36 (@c7634f)",
  "webSocketDebuggerUrl": "ws://localhost:9222/devtools/browser/root-target-id"
}
```

### 2. `GET /json/list` (or `/json`)

Enumerates active mini-app target pages:

```json
[
  {
    "id": "target_page_wallet_01",
    "title": "Goat Wallet — Dashboard",
    "description": "Mini-App Container (com.goat.wallet)",
    "type": "page",
    "url": "https://appassets.androidplatform.net/assets/index.html#/dashboard",
    "devtoolsFrontendUrl": "devtools://devtools/bundled/inspector.html?ws=localhost:9222/devtools/page/target_page_wallet_01",
    "webSocketDebuggerUrl": "ws://localhost:9222/devtools/page/target_page_wallet_01",
    "appId": "com.goat.wallet",
    "connected": true,
    "createdAt": 1724738400000
  }
]
```

---

## Custom `GoatBridge` Inspection Domain

In addition to standard Chromium CDP domains (`DOM`, `CSS`, `Network`, `Runtime`), Goat WebView implements a specialized `GoatBridge` domain designed specifically for auditing mini-app native IPC calls:

### 1. Event: `GoatBridge.messageSent`

Fired immediately when a mini-app dispatches an IPC action to the native host:

```json
{
  "method": "GoatBridge.messageSent",
  "params": {
    "callId": "call_994812a",
    "appId": "com.goat.wallet",
    "action": "BIOMETRIC_AUTHENTICATE",
    "payload": {
      "reason": "Confirm withdrawal of $100.00",
      "fallbackTitle": "Enter PIN"
    },
    "timestamp": 1724738401250,
    "sourceFrame": "https://appassets.androidplatform.net/assets/index.html"
  }
}
```

### 2. Event: `GoatBridge.messageReceived`

Fired when the native host returns the asynchronous result to the mini-app:

```json
{
  "method": "GoatBridge.messageReceived",
  "params": {
    "callId": "call_994812a",
    "appId": "com.goat.wallet",
    "action": "BIOMETRIC_AUTHENTICATE",
    "status": "success",
    "result": {
      "authenticated": true,
      "biometryType": "FACE_ID"
    },
    "durationMs": 42.6,
    "timestamp": 1724738401292
  }
}
```

### 3. Command: `GoatBridge.setMockResponse`

Allows developers to dynamically mock or override native hardware responses from DevTools or automated test scripts:

```json
{
  "id": 42,
  "method": "GoatBridge.setMockResponse",
  "params": {
    "appId": "com.goat.wallet",
    "action": "GET_LOCATION",
    "mockResult": {
      "latitude": 37.7749,
      "longitude": -122.4194,
      "accuracy": 5.0
    },
    "delayMs": 50,
    "shouldFail": false
  }
}
```

---

## In-App Developer Menu (`GoatDevMenuManager`)

On debug builds, Goat WebView includes an embedded **In-App DevMenu** designed for on-device diagnostics without physical USB tethering:

```
┌────────────────────────────────────────────────────────────┐
│                    GOAT IN-APP DEVMENU                     │
├────────────────────────────────────────────────────────────┤
│  CDP Server: ws://localhost:9222/devtools/page/...       │
│  HUD: 120 FPS | RAM: 34.2 MB | DOM Nodes: 182            │
├────────────────────────────────────────────────────────────┤
│ [ Reload Current Page]       [ Purge Storage & Cache]  │
│ [ Toggle vConsole Overlay]   [ Mock Bridge State]      │
│ [ Inspect Network IPC]       [[Unsupported] Dismiss DevMenu]        │
└────────────────────────────────────────────────────────────┘
```

### Activation Gestures:
- **Physical Shake:** Rapidly shake the physical mobile device (detected via accelerometer/gyroscope).
- **3-Finger Tap:** Tap the screen with 3 fingers simultaneously for 500ms.

### DevMenu Features:
1. **Live Performance HUD:** Real-time overlay showing instantaneous rendering FPS, resident memory (RSS), and active DOM node counts.
2. **vConsole Floating Window:** Injects an in-page floating console for viewing logs and DOM structures directly on mobile screens.
3. **Storage & Cache Cleaner:** Flushes tenant cookies, localStorage, IndexedDB, and V8 bytecode caches with one tap.
4. **Mock Hardware Overrides:** Sliders and switches to simulate low battery (5%), lost GPS signal, or biometric authentication failure.
