# @goat-webview/payments

Modular Payment Gateway capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/payments
```

## Usage

```ts
import { registerPaymentsCapability } from '@goat-webview/payments';

registerPaymentsCapability();
```

Marshals payment actions directly to the native engine via `GoatWebViewNativeModule.executeAction`. Native payment security gates (L1-L5), mutex locks, and adapter routing are handled by the native Goat engine.
