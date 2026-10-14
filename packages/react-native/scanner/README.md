# @goat-webview/scanner

Modular Scanner capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/scanner
```

## Usage

```ts
import { registerScannerCapability } from '@goat-webview/scanner';

registerScannerCapability();
```

Marshals barcode and QR code scanning actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
