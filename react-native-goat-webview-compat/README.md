# react-native-goat-webview-compat

Drop-in compatibility adapter for `react-native-webview` backed by **Goat WebView**.

`react-native-goat-webview-compat` enables existing React Native code written against `react-native-webview` (versions 13.x through 16.x) to run directly on Goat WebView's high-performance, New Architecture embedded web engine without rewriting JSX, ref methods, or web-to-native communication channels.

---

## Features

- **Drop-in Compatibility**: Import `WebView` and `CookieManager` directly without modifying existing JSX and ref calls.
- **New Architecture Native**: Built for React Native Fabric and TurboModules with zero legacy bridge overhead.
- **Zero-Retention Configuration**: Props and configuration objects are mapped once via `toCreationProps` and immediately discarded from memory.
- **Deterministic High-Speed IPC**: Native `window.ReactNativeWebView.postMessage` bridge with sub-5ms round-trip latency.
- **Multi-Tenant Cookie Affinity**: Hardware-isolated cookie jars and sandbox filesystems per `appId` via `CookieManager`.
- **Tree-Shakeable & Lightweight**: Pure facade with `"sideEffects": false` (< 2.7 KB gzipped).

---

## Installation

Install both the host engine and compatibility adapter:

```bash
npm install react-native-goat-webview react-native-goat-webview-compat
# or
yarn add react-native-goat-webview react-native-goat-webview-compat
```

### iOS CocoaPods Setup

For iOS applications using CocoaPods, run pod install in the `ios/` folder:

```bash
cd ios && pod install
```

---

## Quick Start

Replace your `react-native-webview` import with `react-native-goat-webview-compat`:

```tsx
import React, { useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView, CookieManager } from 'react-native-goat-webview-compat';

export default function App() {
  const webViewRef = useRef(null);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://example.com' }}
        javaScriptEnabled={true}
        incognito={true}
        onMessage={(event) => {
          console.log('Received message from web:', event.nativeEvent.data);
        }}
        onLoad={() => {
          console.log('Page loaded successfully');
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
```

---

## Cookie Management

`CookieManager` provides asynchronous, tenant-partitioned cookie operations:

```tsx
import { CookieManager } from 'react-native-goat-webview-compat';

// Set a cookie
await CookieManager.setCookie('https://example.com', {
  name: 'session_token',
  value: 'xyz123',
  domain: 'example.com',
  path: '/',
});

// Retrieve cookies
const cookies = await CookieManager.getCookies('https://example.com');
console.log('Stored cookies:', cookies);

// Clear cookies
await CookieManager.clearCookies();
```

---

## Exported Public API

### Components & Utilities
- `WebView` (default and named export)
- `CookieManager` (static cookie administration API)
- `toCreationProps` (utility mapping `WebViewProps` into primitive engine creation parameters)
- `compatBootstrapScript` (static bootstrap script injected for `window.ReactNativeWebView`)

### TypeScript Types
- `WebViewProps`, `WebViewRef`
- `WebViewNavigation`, `WebViewNavigationEvent`
- `WebViewMessage`, `WebViewMessageEvent`
- `WebViewError`, `WebViewErrorEvent`
- `WebViewHttpError`, `WebViewHttpErrorEvent`
- `ShouldStartLoadRequest`, `ShouldStartLoadRequestEvent`
- `GoatCookie`, `CreationProps`

---

## Migration Documentation

For exhaustive prop compatibility tables, architectural guarantees (G1–G10), and migration notes, consult [MIGRATION.md](./MIGRATION.md).

---

## License

MIT License. See [LICENSE](./LICENSE) for details.
