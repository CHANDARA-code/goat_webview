# 🐐 Goat WebView Universal Migration Guide (`v1.0.0-alpha.2`)

This document is the authoritative migration guide for adopting Goat WebView across **Flutter**, **React Native**, **Android**, **iOS**, and **Mini-App DSLs** (WeChat, Alipay, uni-app, Taro).

---

## 1. Migration Overview & Architectural Benefits

Goat WebView replaces legacy, fragmented mobile WebViews with a unified, high-performance, multi-tenant embedded runtime:

- **Instant Startup**: Pre-warmed pooling (`GoatFastPool`) delivers sub-50ms warm starts and sub-300ms cold starts with zero white flash.
- **Hardware Isolation**: Strict multi-tenant sandbox partitions for cookies (`WKWebsiteDataStore` / cookie jars), local storage keyspaces (`goat_storage_<appId>`), and filesystem directories.
- **Zero-Trust Security**: OWASP MASVS v2.0 compliant. Native capabilities communicate exclusively over authenticated virtual HTTPS domains (`https://appassets.androidplatform.net` and `goat://assets/`).
- **Standardized Bridge Surface**: 210+ verified native actions across 18 functional domains (Web3 EVM/Solana/TON, W3C Passkeys, Apple/Google Wallet Passes, BLE, Biometrics, Media, Audio, Filesystem).

---

## 2. Flutter Migration: `flutter_inappwebview` ➔ `goat_webview_compat`

For Flutter host applications currently using `flutter_inappwebview` (5.x or 6.x), Goat WebView provides the `goat_webview_compat` drop-in adapter.

### 2.1 Dependency Configuration

In your `pubspec.yaml`:

```yaml
dependencies:
  goat_webview: ^1.0.0-alpha.2
  goat_webview_compat: ^1.0.0-alpha.2
```

### 2.2 Drop-In Code Replacement

Replace the package import in your Dart files:

```dart
// Before:
// import 'package:flutter_inappwebview/flutter_inappwebview.dart';

// After:
import 'package:goat_webview_compat/goat_webview_compat.dart';
```

Existing widget hierarchies and controllers continue working seamlessly:

```dart
InAppWebView(
  initialUrlRequest: URLRequest(url: WebUri('https://appassets.androidplatform.net/assets/index.html')),
  initialSettings: InAppWebViewSettings(
    javaScriptEnabled: true,
    transparentBackground: true,
    allowsBackForwardNavigationGestures: true,
  ),
  onWebViewCreated: (controller) {
    // Standard controller usage
  },
  onLoadStart: (controller, url) {
    debugPrint('Navigation started: $url');
  },
  onLoadStop: (controller, url) {
    debugPrint('Navigation finished: $url');
  },
)
```

### 2.3 Zero-Retention Performance Contract (G1)

`goat_webview_compat` enforces Guarantee G1: `InAppWebViewSettings` and `URLRequest` instances are converted ephemerally into native engine primitives (`toCreationParams`) and must **never** be stored in long-lived state or class fields.

Detailed settings mapping and architectural guarantees are documented in [`goat_webview_compat/MIGRATION.md`](./goat_webview_compat/MIGRATION.md).

---

## 3. React Native Migration: `react-native-webview` ➔ `react-native-goat-webview-compat`

For React Native applications currently using `react-native-webview` (13.x through 16.x), Goat WebView provides `react-native-goat-webview-compat`.

### 3.1 Dependency Installation

Install the companion packages:

```bash
npm install react-native-goat-webview react-native-goat-webview-compat
cd ios && pod install
```

### 3.2 Drop-In Code Replacement

Replace the component import in your JSX/TSX files:

```tsx
// Before:
// import { WebView } from 'react-native-webview';

// After:
import { WebView } from 'react-native-goat-webview-compat';
```

Existing props and ref methods are fully supported:

```tsx
import React, { useRef } from 'react';
import { View, StyleSheet } from 'react-native';
import { WebView, WebViewNavigation } from 'react-native-goat-webview-compat';

export const MiniAppContainer: React.FC = () => {
  const webViewRef = useRef(null);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ uri: 'https://appassets.androidplatform.net/assets/index.html' }}
        javaScriptEnabled={true}
        incognito={true}
        onNavigationStateChange={(navState: WebViewNavigation) => {
          console.log('Current URL:', navState.url);
        }}
        onMessage={(event) => {
          console.log('Received from page:', event.nativeEvent.data);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
});
```

### 3.3 Zero-Retention ESLint Verification

Install and enable `eslint-plugin-no-retained-compat-config` to guarantee that `WebViewProps` and `source` objects are built inline and not retained in state or module-level variables.

Detailed props tables, Fabric commands, and ref methods are documented in [`react-native-goat-webview-compat/MIGRATION.md`](./react-native-goat-webview-compat/MIGRATION.md).

---

## 4. Mini-App DSL Migration: `@goat/adapter-dsl`

Mini-apps written in WeChat Mini-Program syntax (`wx.*`), Alipay (`my.*`), uni-app (`uni.*`), or Taro (`Taro.*`) can run unchanged inside Goat WebView using the portable `@goat/adapter-dsl` package.

### 4.1 Installation

```bash
npm install @goat/adapter-dsl
```

### 4.2 Entry Points

`@goat/adapter-dsl` provides modular entry points under 2.2 KB gzipped:

- **WeChat**: `@goat/adapter-dsl/wechat` (exposes `wx.*`)
- **Alibaba**: `@goat/adapter-dsl/alibaba` (exposes `my.*`)
- **Uni-App**: `@goat/adapter-dsl/uniapp` (exposes `uni.*`)
- **Taro**: `@goat/adapter-dsl/taro` (exposes `Taro.*`)

Example usage in mini-app bootstrap:

```typescript
import '@goat/adapter-dsl/wechat';

// Standard WeChat API calls route automatically through Goat Native Bridge
wx.setStorage({
  key: 'user_profile',
  data: { username: 'alice' },
  success: () => console.log('Storage saved securely'),
});

wx.getLocation({
  type: 'gcj02',
  success: (res) => console.log('Location:', res.latitude, res.longitude),
});
```

---

## 5. Host Tooling & AppService Runtimes

For development, dual-thread execution, and simulation, use the official `@goat/*` npm packages:

```bash
# Dual-thread worker service container
npm install @goat/appservice @goat/core

# Hermetic bridge simulator for browser and unit test suites
npm install -D @goat/bridge-mock

# Chrome DevTools Protocol relay & OTA server
npm install -g @goat/server

# Developer CLI for project initialization, linting, and bundling
npm install -g @goat/cli
```

---

## 6. Verification Checklist

Before deploying your migrated application, verify:

1. **Clean Installation**: All dependencies resolve from public package registries without unresolved local paths.
2. **Type Safety**: `npx tsc --noEmit` (Node/RN) or `flutter analyze` (Flutter) reports 0 errors and 0 warnings.
3. **Memory & Lifecycle**: Unmounting mini-app containers cleans up all active bridge registrations without memory leaks.
4. **Publish Dry-Run Validation**: For monorepo contributors, `bash scripts/publish-dry-run.sh` passes 100% across all 42 package checks.
