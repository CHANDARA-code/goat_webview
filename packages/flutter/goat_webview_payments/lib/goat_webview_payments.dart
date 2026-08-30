import 'dart:async';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';

/// Modular Payment Gateway capability companion plugin for Goat WebView (Task 10206f).
///
/// The Payment Security Gate (L1-L5), mutex/watchdog, and adapter routing all live natively —
/// this plugin only marshals `REQUEST_PAYMENT` / `QUERY_PAYMENT_STATUS` / `CANCEL_PAYMENT`
/// calls through the platform `MethodChannel`, matching the "web/JS layers never implement gate
/// logic" rule (Task 10206 / §10 cross-platform parity).
class GoatPaymentsCapabilityPlugin extends GoatCapabilityPlugin {
  static final GoatPaymentsCapabilityPlugin instance = GoatPaymentsCapabilityPlugin._();
  GoatPaymentsCapabilityPlugin._();

  static MethodChannel? _bridgeChannel;

  /// Registers the Payments capability plugin with the global GoatCapabilityRegistry.
  static void register() {
    GoatCapabilityRegistry.instance.registerPlugin(instance);
  }

  /// Attaches the plugin to an active [GoatWebViewController] so every action executes
  /// against the native payment security gate instead of Dart-side stubs.
  static void attachTo(GoatWebViewController controller) {
    _bridgeChannel = MethodChannel('com.goat.webview/bridge_${controller.viewId}');
  }

  /// Detaches the plugin from the active controller bridge channel.
  static void detach() {
    _bridgeChannel = null;
  }

  @override
  String get namespace => 'payments';

  @override
  Set<String> get supportedActions => {
        'REQUEST_PAYMENT',
        'QUERY_PAYMENT_STATUS',
        'CANCEL_PAYMENT',
      };

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    final channel = _bridgeChannel;
    if (channel == null) {
      throw StateError(
          'GoatPaymentsCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
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
