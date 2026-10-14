# @goat-webview/network

Modular Network Security capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/network
```

## Usage

```ts
import { registerNetworkCapability } from '@goat-webview/network';

registerNetworkCapability();
```

Marshals network actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
