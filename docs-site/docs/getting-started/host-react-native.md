---
sidebar_position: 8
title: React Native Host Integration (Fabric)
---

# React Native Host Integration (Fabric & TurboModules)

The **Goat React Native SDK** (`@goat/react-native-goat-webview`) integrates the Goat WebView Engine into React Native applications using the **New Architecture (Fabric Native Components and TurboModules)**. It eliminates legacy React Native bridge serialization bottlenecks, providing direct C++ JSI event dispatching and hardware synchronization.

---

## 📦 Installation

Install the package in your React Native project:

```bash
npm install @goat/react-native-goat-webview
# or
yarn add @goat/react-native-goat-webview
```

For iOS projects with CocoaPods:
```bash
cd ios && pod install
```

---

## 🚀 Embedding `GoatWebView` in React Native

```tsx
import React, { useRef } from 'react';
import { StyleSheet, View, SafeAreaView, Alert } from 'react-native';
import { GoatWebView, useGoatBridge } from '@goat/react-native-goat-webview';

export function MiniAppScreen() {
  const webViewRef = useRef(null);

  // Hook for dispatching native actions directly from host JS
  const { callBridgeAction } = useGoatBridge();

  return (
    <SafeAreaView style={styles.container}>
      <GoatWebView
        ref={webViewRef}
        appId="wallet_mini_app"
        assetBundleName="miniapp.zip"
        style={styles.webView}
        
        // Navigation Bar Props
        navBarVisible={true}
        navBarTitle="Goat Wallet"
        navBarBackgroundColor="#0F172A"
        navBarTextColor="#F8FAFC"
        
        // Bottom Sheet Props
        bottomSheetVisible={false}
        bottomSheetSnapPoints={[0.25, 0.5, 0.9]}

        // Direct Event Handlers (Fabric Codegen)
        onBridgeMessage={(event) => {
          const { action, payload } = event.nativeEvent;
          console.log(`[Bridge Action] ${action}:`, payload);

          if (action === 'REQUEST_HOST_AUTH') {
            Alert.alert('Authentication', 'Host Auth Request Received');
          }
        }}
        onPageStarted={(event) => {
          console.log('Page started loading:', event.nativeEvent.url);
        }}
        onPageLoaded={(event) => {
          console.log('Page finished loading:', event.nativeEvent.url);
        }}
        onProgressChanged={(event) => {
          console.log('Progress:', event.nativeEvent.progress);
        }}
        onInsetsChange={(event) => {
          const { top, bottom, keyboardHeight } = event.nativeEvent;
          console.log(`Insets: Top=${top}, Bottom=${bottom}, Keyboard=${keyboardHeight}`);
        }}
        onError={(event) => {
          console.error('Mini-App runtime error:', event.nativeEvent.description);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#020617',
  },
  webView: {
    flex: 1,
  },
});
```

---

## ⚙️ Fabric Native Component Specification (`GoatWebViewNativeComponent`)

The component is generated using React Native's strict **Codegen** pipeline:

```typescript
export interface NativeProps extends ViewProps {
  assetBundleName?: WithDefault<string, 'miniapp.zip'>;
  appId?: WithDefault<string, 'default'>;

  // Native Navigation Bar Configuration
  navBarTitle?: WithDefault<string, ''>;
  navBarSubtitle?: WithDefault<string, ''>;
  navBarBackgroundColor?: WithDefault<string, '#0F172A'>;
  navBarTextColor?: WithDefault<string, '#F8FAFC'>;
  navBarVisible?: WithDefault<boolean, true>;
  navBarProgress?: WithDefault<Double, -1>;

  // Native Bottom Sheet Drawer Configuration
  bottomSheetSnapPoints?: ReadonlyArray<Double>;
  bottomSheetInitialSnap?: WithDefault<Double, 0.5>;
  bottomSheetDismissible?: WithDefault<boolean, true>;
  bottomSheetShowDragHandle?: WithDefault<boolean, true>;
  bottomSheetVisible?: WithDefault<boolean, false>;

  // Fabric Direct Event Handlers
  onBridgeMessage?: DirectEventHandler<OnBridgeMessageEventData>;
  onPageStarted?: DirectEventHandler<OnPageStartedEventData>;
  onPageLoaded?: DirectEventHandler<OnPageLoadedEventData>;
  onProgressChanged?: DirectEventHandler<OnProgressChangedEventData>;
  onReceivedTitle?: DirectEventHandler<OnReceivedTitleEventData>;
  onInsetsChange?: DirectEventHandler<OnInsetsChangeEventData>;
  onSheetStateChange?: DirectEventHandler<OnSheetStateChangeEventData>;
  onError?: DirectEventHandler<OnErrorEventData>;
}
```

---

## 🔌 Using the `useGoatBridge` Hook

The package exports a helper hook `useGoatBridge` for issuing native calls or listening for telemetry events outside the JSX tree:

```tsx
import { useGoatBridge } from '@goat/react-native-goat-webview';

export function CustomActionBar() {
  const { callBridgeAction } = useGoatBridge();

  const handleRefresh = async () => {
    await callBridgeAction('RELOAD_CURRENT_ROUTE', {});
  };

  return (
    <Button title="Reload Mini-App" onPress={handleRefresh} />
  );
}
```

---

## 🏛️ Backward Compatibility (Legacy Architecture Fallback)

While optimized for Fabric and TurboModules, `@goat/react-native-goat-webview` automatically falls back to `UIManager.getViewManagerConfig('GoatWebView')` on React Native applications still running the legacy Paper architecture.
