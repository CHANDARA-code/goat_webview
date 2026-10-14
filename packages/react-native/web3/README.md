# @goat-webview/web3

Modular Web3 & Wallet Signing capability companion for React Native Goat WebView.

## Installation

```bash
npm install @goat-webview/web3
```

## Usage

```ts
import { registerWeb3Capability } from '@goat-webview/web3';

registerWeb3Capability();
```

Marshals wallet connection and transaction/message signing actions directly to the native engine via `GoatWebViewNativeModule.executeAction`.
