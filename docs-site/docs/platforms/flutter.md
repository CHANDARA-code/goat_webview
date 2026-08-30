---
sidebar_position: 4
title: Flutter Integration
---

# Flutter Integration

Embed Goat WebView into Flutter applications utilizing `PlatformView` (Android `AndroidView` with Hybrid Composition and iOS `UiKitView`).

## Installation

Add to `pubspec.yaml`:

```yaml
dependencies:
  goat_webview: ^1.0.0
```

## Usage

```dart
import 'package:flutter/material.dart';
import 'package:goat_webview/goat_webview.dart';

class MiniAppPage extends StatelessWidget {
  const MiniAppPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Mini-App Host')),
      body: GoatWebView(
        appId: 'orders_mini_app',
        assetBundleName: 'miniapp.zip',
        onWebViewCreated: (controller) {
          controller.onBridgeMessage.listen((message) {
            debugPrint('Bridge message: ${message.action}, payload: ${message.payload}');
          });
        },
      ),
    );
  }
}
```
