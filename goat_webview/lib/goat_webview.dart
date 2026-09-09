library goat_webview;

import 'dart:async';
import 'package:flutter/services.dart';

export 'src/goat_bridge_types.dart';
export 'src/goat_capability_plugin.dart';
export 'src/goat_headless_web_view.dart';
export 'src/goat_theme.dart';
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

/// Cookie management independent of any mounted [GoatWebView] instance. Backed by the same
/// `com.goat.webview/global` channel as [GoatWebViewEngine] — no separate native object or
/// channel is created; the underlying cookie store is touched only when one of these is first
/// called.
///
/// Cookies are partitioned per mini-app tenant (the same `appId` a [GoatWebView] is created
/// with), so there is no single shared jar to clear — pass the [appId] whose cookies you mean.
/// **iOS: only call these for an [appId] that has already had a [GoatWebView] mounted in this
/// process.** A cold/never-used partition is a native crash on iOS (`WKWebsiteDataStore` traps
/// resolving an identifier that was never attached to a live WebView), not a catchable error.
class GoatCookieManager {
  const GoatCookieManager._();

  static const MethodChannel _globalChannel =
      MethodChannel('com.goat.webview/global');

  /// Removes session (non-persistent) cookies only, for [appId]'s partition.
  static Future<bool> removeSessionCookies({String appId = 'default'}) async {
    final result = await _globalChannel
        .invokeMethod<bool>('removeSessionCookies', {'appId': appId});
    return result ?? false;
  }

  /// Removes every cookie named [name] set for [url], in [appId]'s partition.
  static Future<bool> deleteCookies({
    required String url,
    required String name,
    String appId = 'default',
  }) async {
    final result = await _globalChannel.invokeMethod<bool>('deleteCookies', {
      'url': url,
      'name': name,
      'appId': appId,
    });
    return result ?? false;
  }

  /// Removes every cookie, session or persistent, in [appId]'s partition.
  static Future<bool> deleteAllCookies({String appId = 'default'}) async {
    final result = await _globalChannel
        .invokeMethod<bool>('deleteAllCookies', {'appId': appId});
    return result ?? false;
  }
}
