import 'dart:async';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';

/// Modular Network & SSL Security capability companion plugin for Goat WebView (Task 10202).
///
/// Implements `GoatCapabilityPlugin` SPI to provide custom certificate pinning,
/// streaming HTTP proxies, and advanced network diagnostics without bloating core.
class GoatNetworkCapabilityPlugin extends GoatCapabilityPlugin {
  static final GoatNetworkCapabilityPlugin instance = GoatNetworkCapabilityPlugin._();
  GoatNetworkCapabilityPlugin._();

  static MethodChannel? _bridgeChannel;

  /// Registers the Network capability plugin with the global GoatCapabilityRegistry.
  static void register() {
    GoatCapabilityRegistry.instance.registerPlugin(instance);
  }

  /// Attaches the plugin to an active [GoatWebViewController] so every action executes
  /// against the native bridge engine instead of Dart-side stubs.
  static void attachTo(GoatWebViewController controller) {
    _bridgeChannel = MethodChannel('com.goat.webview/bridge_${controller.viewId}');
  }

  /// Detaches the plugin from the active controller bridge channel.
  static void detach() {
    _bridgeChannel = null;
  }

  @override
  String get namespace => 'network';

  @override
  Set<String> get supportedActions => {
        'GET_NETWORK_TYPE',
        'ON_NETWORK_STATUS_CHANGE',
        'VERIFY_SSL_PIN',
        'AUDIT_NETWORK_CERTIFICATE',
        'NETWORK_PING',
      };

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    final channel = _bridgeChannel;
    if (channel == null) {
      throw StateError(
          'GoatNetworkCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
    }
    final res = await channel.invokeMethod<Map>('executeAction', {
      'action': action,
      'payload': payload,
    });
    if (res == null) {
      throw Exception('Empty native response for $action');
    }
    final response = GoatBridgeResponse.fromMap(Map<String, dynamic>.from(res));
    if (!response.success) {
      throw Exception(response.error ?? 'Native $action execution failed');
    }
    if (response.data is Map) {
      return Map<String, dynamic>.from(response.data as Map);
    }
    return null;
  }
}
