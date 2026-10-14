# @goat-webview/biometrics

Modular Biometrics capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/biometrics
```

## Usage

```ts
import { registerBiometricsCapability } from '@goat-webview/biometrics';

registerBiometricsCapability();
```

Marshals biometrics actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
