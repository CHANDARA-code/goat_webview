# goat_webview

High-Performance Embedded Mini-App Engine for Flutter powered by **Goat WebView**.

## Features
- **Android & iOS**: Hybrid Composition `PlatformView` on Android, `UiKitView` (`WKWebView`) on iOS
- **Instant startup** (<300ms cold, <50ms warm)
- **Zero white flash** with transparent canvas and algorithmic darkening
- **Secure virtual origin**: `https://appassets.androidplatform.net/` (Android) / `goat://assets/` (iOS)
- **Bidirectional Native-JS IPC** (`WebMessageListener` / `WKScriptMessageHandlerWithReply` via `MethodChannel`)

## Installation

Add to your `pubspec.yaml`:

```yaml
dependencies:
  goat_webview:
    path: ./goat_webview
```

## Quick Start

```dart
import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Prewarm engine on app boot
  await GoatWebViewEngine.prewarm();
  runApp(const MyApp());
}

class MyApp extends StatelessWidget {
  const MyApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      home: Scaffold(
        backgroundColor: const Color(0xFF020617),
        body: SafeArea(
          child: GoatWebView(
            onWebViewCreated: (controller) {
              controller.onBridgeMessage.listen((msg) {
                print('Bridge action: ${msg.action}, payload: ${msg.payload}');
              });
            },
          ),
        ),
      ),
    );
  }
}
```

## Running the Sample Application

An interactive, production-ready sample app is located in the [`example/`](./example) directory.

To run the Flutter example:

```bash
cd example
flutter pub get
flutter run
```
