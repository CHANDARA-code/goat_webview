# react-native-goat-webview

High-Performance Embedded Mini-App Engine for React Native powered by **Goat WebView**.

## Features
- **Instant startup** (<300ms cold, <50ms warm)
- **Zero white flash** with transparent canvas and algorithmic darkening
- **Secure virtual origin**: `https://appassets.androidplatform.net/`
- **TurboModule & Fabric ready** with JSI direct methods: `prewarm()`, `clearCache()`, `getBundleVersion()`
- **Bidirectional Native-JS IPC** (`WebMessageListener`)

## Installation

```bash
npm install react-native-goat-webview
# or
yarn add react-native-goat-webview
```

Both **Android** and **iOS** are supported. On iOS, install pods after adding the package:

```bash
cd ios && pod install
```

## Quick Start

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GoatWebView, useGoatBridge } from 'react-native-goat-webview';

export default function App() {
  const { isPrewarmed, bundleVersion } = useGoatBridge();

  return (
    <View style={styles.container}>
      <GoatWebView
        style={styles.webview}
        onPageLoaded={(e) => console.log('Loaded:', e.nativeEvent.url)}
        onError={(e) => console.error('Error:', e.nativeEvent.description)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  webview: { flex: 1 },
});
```

## Running the Sample Application

An interactive, production-ready React Native sample app is located in the [`example/`](./example) directory.

To run the React Native example:

```bash
cd example
npm install
npm run android
# or
npm run ios
```
