# @goat-webview/location

Modular Geolocation & Maps capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/location
```

## Usage

```ts
import { registerLocationCapability } from '@goat-webview/location';

registerLocationCapability();
```

Marshals location and map actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
