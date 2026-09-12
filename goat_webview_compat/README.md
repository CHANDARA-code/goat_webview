# goat_webview_compat

Drop-in compatibility adapter for migrating Flutter applications from `flutter_inappwebview` (5.x and 6.x) to **Goat WebView**.

## Overview

`goat_webview_compat` provides drop-in compatible replacements for `flutter_inappwebview` widgets, controllers, and data types, powered under the hood by the high-performance, enterprise-grade Goat WebView engine.

By replacing your import:

```dart
// Before:
// import 'package:flutter_inappwebview/flutter_inappwebview.dart';

// After:
import 'package:goat_webview_compat/goat_webview_compat.dart';
```

Existing code continues to compile and run while gaining:
- Prewarmed instance recycling and memory tiering
- Multi-tenant cookie isolation partitioned by `appId`
- Deterministic sub-5ms bridge IPC throughput
- OWASP MASVS zero-trust security architecture

## Features

- **Drop-in Widgets & Controllers**: `InAppWebView`, `InAppWebViewController`, `HeadlessInAppWebView`, `PullToRefreshController`.
- **Drop-in Types**: `InAppWebViewSettings`, `URLRequest`, `WebUri`, `NavigationActionPolicy`, `ConsoleMessage`, `WebResourceError`.
- **Cookie & Storage Management**: Drop-in `CookieManager` compatible with `flutter_inappwebview`.
- **Zero-Retention Architecture**: Ephemeral configuration processing ensures widget state holds zero retained configuration objects.

## Usage

```dart
import 'package:flutter/material.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

class WebViewExample extends StatelessWidget {
  const WebViewExample({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Goat WebView Compat')),
      body: InAppWebView(
        initialUrlRequest: URLRequest(url: WebUri('https://example.com')),
        initialSettings: InAppWebViewSettings(
          javaScriptEnabled: true,
          allowsBackForwardNavigationGestures: true,
        ),
        onWebViewCreated: (controller) {
          // Use InAppWebViewController as usual
        },
        onLoadStop: (controller, url) {
          debugPrint('Page loaded: $url');
        },
      ),
    );
  }
}
```

## Migration Reference

For exhaustive parameter mappings, legacy `InAppWebViewGroupOptions` shims, and architectural guarantees (G1–G10), refer to [MIGRATION.md](./MIGRATION.md).

## License

MIT
