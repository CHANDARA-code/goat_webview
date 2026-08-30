# @goat/compiler-taro

Official Taro (React, Vue 3, Vue 2) compiler adapter and runtime JSAPI bridge plugin for Goat WebView Mini-Programs and Web Bundles.

## Features

- **Taro CLI Platform Registration**: Registers `goat` platform target in `@tarojs/service`.
- **Conditional Compilation**: Supports `#ifdef GOAT` and `process.env.TARO_ENV = 'goat'`.
- **44 JSAPI Bridge Shims**: Complete typed shims for `Taro.*` APIs mapping to Goat IPC actions with Promise/Callback duality.
- **Synchronous In-Memory Storage Cache**: 10MB quota tracking and sub-millisecond synchronous storage (`getStorageSync`, `setStorageSync`).
- **Dual-Thread & Single-Thread Bundlers**:
  - `dual-thread`: Generates `appservice.worker.js` + `webview.html` + on-demand subpackages.
  - `single-thread`: Generates SPA bundle `index.html` + `assets/main.[hash].js` + dynamic chunks.
- **SHA-256 Tamper-Proof Integrity Manifest**: Generates deterministic `integrity.json` checksums for all emitted files.

## Installation

```bash
npm install @goat/compiler-taro --save-dev
```

## Usage in Taro

In your Taro project `config/index.js` or `config/index.ts`:

```ts
export default {
  projectName: 'my-taro-goat-app',
  framework: 'react', // or 'vue3'
  compiler: 'webpack5', // or 'vite'
  plugins: ['@goat/compiler-taro'],
  goat: {
    appId: 'com.example.goatminiapp',
    appName: 'Goat Taro MiniApp',
    target: 'dual-thread', // 'dual-thread' | 'single-thread'
    version: '1.0.0',
    versionCode: 10000,
    allowedDomains: ['api.example.com'],
  },
};
```

## Build Commands

```bash
# Build for Goat WebView dual-thread mini-app
taro build --type goat

# Build in watch mode
taro build --type goat --watch
```
