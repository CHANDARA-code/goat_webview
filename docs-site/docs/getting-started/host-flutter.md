---
sidebar_position: 9
title: Flutter Host Integration (PlatformView)
---

# Flutter Host Integration (PlatformView & Hybrid Composition)

The **Goat Flutter Plugin** (`goat_webview`) embeds the Goat WebView Engine into Flutter applications across Android and iOS using **PlatformView (Hybrid Composition on Android and UiKitView on iOS)**. It features zero-latency touch forwarding, MethodChannel-backed typed bridge bindings (`GoatBridgeMessage`/`GoatBridgeResponse`), and background engine pre-warming.

---

## Installation

Add `goat_webview` to your Flutter app's `pubspec.yaml`:

```yaml
dependencies:
  flutter:
    sdk: flutter
  goat_webview: ^1.0.0
```

Run `flutter pub get` to fetch the package.

---

## Engine Pre-Warming & Startup

To achieve instant **sub-15ms cold boot times**, pre-warm the Chromium/WebKit instance in your app's `main()` entrypoint before rendering the UI:

```dart
import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Prewarm the underlying native WebView engine during splash
  await GoatWebViewEngine.prewarm();

  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return const MaterialApp(
      debugShowCheckedModeBanner: false,
      home: MiniAppScreen(),
    );
  }
}
```

---

## Embedding `GoatWebView` in Flutter

```dart
import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

class MiniAppScreen extends StatefulWidget {
  const MiniAppScreen({super.key});

  @override
  State<MiniAppScreen> createState() => _MiniAppScreenState();
}

class _MiniAppScreenState extends State<MiniAppScreen> {
  GoatWebViewController? _controller;
  bool _isLoading = true;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Goat Mini-App Host'),
        backgroundColor: const Color(0xFF0F172A),
        foregroundColor: Colors.white,
      ),
      body: Stack(
        children: [
          GoatWebView(
            appId: 'crypto_tracker',
            assetBundleName: 'miniapp.zip',
            algorithmicDarkening: true,
            onWebViewCreated: (controller) {
              _controller = controller;
              _setupBridgeListeners();
            },
          ),
          if (_isLoading)
            const Center(
              child: CircularProgressIndicator(),
            ),
        ],
      ),
    );
  }

  void _setupBridgeListeners() {
    _controller?.onBridgeMessage.listen((message) {
      debugPrint('[Host Flutter] Received bridge action: ${message.action}');
      debugPrint('[Host Flutter] Payload: ${message.payload}');

      if (message.action == 'PAGE_READY') {
        setState(() {
          _isLoading = false;
        });
      }
    });
  }

  @override
  void dispose() {
    _controller?.dispose();
    super.dispose();
  }
}
```

---

## Core Technical Implementation

### 1. Android Hybrid Composition (`PlatformViewLink`)

On Android, `GoatWebView` utilizes `PlatformViewLink` paired with `AndroidViewSurface` and `PlatformViewsService.initSurfaceAndroidView`:
- Renders the native Android `WebView` onto a hardware Surface synchronized with Flutter's raster thread.
- Eliminates texture copying lag and tearing during fast fling scrolling.
- Automatically handles software keyboard (IME) insets and native text selection handles.

### 2. iOS `UiKitView` Integration

On iOS, `GoatWebView` embeds `UiKitView`:
- Direct UIKit view hierarchy insertion ensuring 120 FPS ProMotion scrolling.
- Forwards gesture recognizers (`gestureRecognizers`) seamlessly between Flutter touch listeners and WebKit DOM elements.

### 3. MethodChannel & Pigeon Type-Safe Bridge Protocol

All MethodChannel and Pigeon calls and native event streams are validated by typed models (`GoatBridgeMessage`, `GoatBridgeResponse`, `GoatCapabilityPlugin`) with automatic Map (de)serialization.
