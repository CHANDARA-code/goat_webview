# @goat-webview/media

Modular Media capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/media
```

## Usage

```ts
import { registerMediaCapability } from '@goat-webview/media';

registerMediaCapability();
```

Marshals audio, image, and video media actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
