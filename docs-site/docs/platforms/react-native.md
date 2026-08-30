---
sidebar_position: 3
title: React Native Integration
---

# React Native Integration

Goat WebView provides first-class React Native support using modern TurboModules and Fabric Native Components with zero bridge serialization lag.

## Installation

```bash
npm install @goat/react-native-goat-webview
```

## Usage

```tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GoatWebView } from '@goat/react-native-goat-webview';

export function App() {
  return (
    <View style={styles.container}>
      <GoatWebView
        appId="crypto_dashboard"
        assetBundleName="miniapp.zip"
        style={styles.webView}
        onBridgeMessage={(event) => {
          const { action, payload } = event.nativeEvent;
          console.log(`Received bridge action ${action}:`, payload);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  webView: { flex: 1 },
});
```
