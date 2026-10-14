# @goat-webview/bluetooth

Modular Bluetooth BLE capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/bluetooth
```

## Usage

```ts
import { registerBluetoothCapability } from '@goat-webview/bluetooth';

registerBluetoothCapability();
```

Marshals Bluetooth BLE actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
