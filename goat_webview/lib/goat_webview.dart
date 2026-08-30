library goat_webview;

import 'dart:async';
import 'package:flutter/services.dart';

export 'src/goat_bridge_types.dart';
export 'src/goat_capability_plugin.dart';
export 'src/goat_headless_web_view.dart';
export 'src/goat_web_view_controller.dart';
export 'src/goat_web_view_widget.dart';

/// Top-level platform service for global Goat WebView prewarming and cache management.
class GoatWebViewEngine {
  static const MethodChannel _globalChannel =
      MethodChannel('com.goat.webview/global');

  /// Pre-warms the Chromium engine on application start before mounting any WebView widget.
  static Future<bool> prewarm() async {
    final result = await _globalChannel.invokeMethod<bool>('prewarm');
    return result ?? false;
  }

  /// Clears the cached extracted mini-app bundle from disk.
  static Future<bool> clearCache() async {
    final result = await _globalChannel.invokeMethod<bool>('clearCache');
    return result ?? false;
  }

  /// Gets the currently installed bundle version.
  static Future<String> getBundleVersion() async {
    final result = await _globalChannel.invokeMethod<String>('getBundleVersion');
    return result ?? '1.0.0-goat';
  }
}
