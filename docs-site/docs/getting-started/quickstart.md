---
sidebar_position: 1
title: Quickstart Guide
---

# Quickstart Guide

Welcome to the **Goat WebView Mini-App Engine** documentation. Goat WebView is a high-performance, multi-tenant, enterprise-hardened embedded runtime that powers super-app mini-program ecosystems across mobile and desktop platforms.

Whether you are authoring **Mini-Apps** (using modern frontend frameworks like React 19, Vue 3.5, or Svelte 5) or integrating the **Host-App SDK** into native Android, iOS, React Native, or Flutter applications, this guide gets you up and running in minutes.

---

## Developer Tracks

Choose your development path:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              GOAT WEBVIEW DEVELOPER TRACKS                             │
└────────────────────────────────────────────────────────────────────────────────────────┘

        ┌────────────────────────────────┐       ┌────────────────────────────────┐
        │      Mini-App Developers       │       │       Host App Developers      │
        ├────────────────────────────────┤       ├────────────────────────────────┤
        │ Build lightweight web apps     │       │ Embed native container engine  │
        │ using React 19, Vue 3.5, or    │       │ in Android (Kotlin / Compose), │
        │ Svelte 5 powered by @goat/cli  │       │ iOS (Swift / SwiftUI), React   │
        │ and the @goat/sdk bridge.      │       │ Native Fabric, or Flutter.     │
        └───────────────┬────────────────┘       └───────────────┬────────────────┘
                        │                                        │
                        ▼                                        ▼
             Mini-App Quickstart                      Host App Quickstart
```

---

## Track A: Mini-App Developer Quickstart

Mini-apps are single-page web applications packaged into secure, sandboxed bundles with zero-overhead access to native device hardware (biometrics, secure storage, camera, sensors, haptics, and payments) via `@goat/sdk`.

### 1. Install the Goat CLI

Install `@goat/cli` globally or execute it via `npx` / `bunx`:

```bash
# Global installation via npm
npm install -g @goat/cli

# Verify installation
goat doctor
```

### 2. Scaffold a New Project

Use `goat init` to create a project from one of our production-ready templates:

```bash
# Scaffold a React 19 + TypeScript project
goat init my-miniapp --template=react --typescript

# Navigate into the project
cd my-miniapp
npm install
```

### 3. Start Local Development with Mock Bridge

Start the local Vite 6 development server with hot module replacement (HMR) and automatic bridge mocking:

```bash
goat dev --mock
```

Open your browser at `http://localhost:3000`. You can now interact with all native bridge APIs in-browser without needing a physical mobile device or emulator attached.

### 4. Test on a Physical Device

Pair your mobile device using the wireless QR code tunnel:

```bash
goat run android --device --qr
# or for iOS:
goat run ios --simulator
```

---

## Track B: Host-App Developer Quickstart

Host applications embed the Goat WebView native engine to render mini-apps with 120 FPS gesture physics, multi-tenant sandboxing, and background RAM trimming.

### Platform SDK Installation

import Tabs from '@theme/Tabs';
import TabItem from '@theme/TabItem';

<Tabs>
  <TabItem value="android" label="Android (Kotlin / Compose)" default>

Add the Maven dependency to your `app/build.gradle.kts`:

```kotlin
dependencies {
    implementation("com.goat.webview:core:1.0.0")
    implementation("androidx.webkit:webkit:1.11.0")
}
```

Embed `GoatWebView` in Jetpack Compose:

```kotlin
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import com.goat.webview.compose.GoatWebView
import java.io.File

@Composable
fun MiniAppScreen(miniappDir: File) {
    GoatWebView(
        assetDir = miniappDir,
        appId = "shop_mini_app",
        modifier = Modifier.fillMaxSize(),
        onBridgeAction = { action, payload ->
            when (action) {
                "CUSTOM_PAYMENT" -> Result.success(buildJsonObject { put("status", "PAID") })
                else -> Result.failure(UnsupportedOperationException("Unknown action: $action"))
            }
        },
        onLoadingStateChanged = { isLoading ->
            // Toggle host loading skeleton or spinner
        }
    )
}
```

  </TabItem>
  <TabItem value="ios" label="iOS (Swift / SwiftUI)">

Add GoatWebView via Swift Package Manager (`Package.swift`):

```swift
dependencies: [
    .package(url: "https://github.com/goat-webview/goatwebview.git", from: "1.0.0")
]
```

Embed `GoatSwiftUIView` in SwiftUI:

```swift
import SwiftUI
import GoatWebView

struct MiniAppScreen: View {
    var body: some View {
        GoatSwiftUIView(
            appId: "shop_mini_app",
            initialRoute: "/home",
            onBridgeMessage: { action, payload in
                print("Bridge action received: \(action)")
            },
            onPageLoaded: { url in
                print("Mini-app ready: \(url)")
            }
        )
        .edgesIgnoringSafeArea(.all)
    }
}
```

  </TabItem>
  <TabItem value="rn" label="React Native (Fabric)">

Install the React Native Fabric TurboModule package:

```bash
npm install @goat/react-native-goat-webview
```

Embed `GoatWebView` in your React Native app:

```tsx
import React from 'react';
import { StyleSheet, SafeAreaView } from 'react-native';
import { GoatWebView } from '@goat/react-native-goat-webview';

export function MiniAppContainer() {
  return (
    <SafeAreaView style={styles.container}>
      <GoatWebView
        appId="shop_mini_app"
        assetBundleName="miniapp.zip"
        style={styles.webView}
        navBarVisible={true}
        navBarTitle="Goat Store"
        onBridgeMessage={(e) => {
          console.log('Action:', e.nativeEvent.action, e.nativeEvent.payload);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#020617' },
  webView: { flex: 1 },
});
```

  </TabItem>
  <TabItem value="flutter" label="Flutter (PlatformView)">

Add the dependency to `pubspec.yaml`:

```yaml
dependencies:
  goat_webview: ^1.0.0
```

Embed `GoatWebView` in Flutter:

```dart
import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await GoatWebViewEngine.prewarm(); // Prewarm pool for sub-15ms cold start
  runApp(const MaterialApp(home: MiniAppPage()));
}

class MiniAppPage extends StatelessWidget {
  const MiniAppPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GoatWebView(
        appId: 'shop_mini_app',
        assetBundleName: 'miniapp.zip',
        onWebViewCreated: (controller) {
          controller.onBridgeMessage.listen((msg) {
            debugPrint('Bridge message: ${msg.action}');
          });
        },
      ),
    );
  }
}
```

  </TabItem>
</Tabs>

---

## Live Interactive Device Simulator & Component Matrix

Experience the Goat WebView native widgets and hardware controls directly in your browser. Toggle between iPhone 16 Pro and Pixel 9 Pro frames, adjust battery and network states, and inspect real-time JSON-RPC telemetry:

import EmbeddedPlayground from '@site/src/components/EmbeddedPlayground';

<EmbeddedPlayground
  initialTab="navbar"
  title="Goat Mini-App Live Preview & Native Component Matrix"
  description="Test native navigation bar styling, draggable bottom sheets, rationale priming, haptic triggers, and biometric verification."
  showControls={true}
  showInspector={true}
/>

---

## Next Steps

- Explore the complete **[Goat CLI Toolchain Guide](./cli-toolchain)** for advanced build and deployment configurations.
- Review framework-specific guides: **[React 19](./template-react)**, **[Vue 3.5](./template-vue)**, or **[Svelte 5](./template-svelte)**.
- Read about host integrations: **[Android](./host-android)**, **[iOS](./host-ios)**, **[React Native](./host-react-native)**, and **[Flutter](./host-flutter)**.
- Dive deep into **[120 FPS Page Stack](../architecture/120fps-page-stack)** and **[Virtual Domain Asset Routing](../architecture/virtual-domain-routing)**.
