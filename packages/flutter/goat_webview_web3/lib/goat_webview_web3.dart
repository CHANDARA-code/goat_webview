import 'dart:async';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';

/// Modular Web3 & Wallet Signing Capability Companion Package for Goat WebView
///
/// Implements the `GoatCapabilityPlugin` SPI so a host links this capability only when it
/// needs it.
///
/// Pairs with the Android `:feature-web3` module (GoatWeb3Plugin).
class GoatWeb3CapabilityPlugin extends GoatCapabilityPlugin {
  static final GoatWeb3CapabilityPlugin instance = GoatWeb3CapabilityPlugin._();
  GoatWeb3CapabilityPlugin._();

  static MethodChannel? _bridgeChannel;

  /// Registers the Media capability plugin with the global GoatCapabilityRegistry.
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
  String get namespace => 'web3';

  @override
  Set<String> get supportedActions => {
        'WEB3_CONNECT_WALLET',
        'WEB3_SIGN_TRANSACTION',
        'WEB3_SIGN_MESSAGE',
        'WEB3_SWITCH_CHAIN',
        'WEB3_DISCONNECT',
        'WEB3_GET_ACCOUNT',
      };


  /// No alias map: every action this package declares is already the exact string the
  /// engine dispatches, verified by scripts/verify-flutter-companion-actions.mjs.
  static const Map<String, String> _engineAction = <String, String>{};
  static const Map<String, String> _unbacked = <String, String>{};
  static const Set<String> _androidOnly = {};

  static String? engineActionFor(String action) => _engineAction[action] ?? action;

  static bool isUnbacked(String action) => _unbacked.containsKey(action);

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    final reason = _unbacked[action];
    if (reason != null) {
      throw UnsupportedError('$action is not supported by the Goat engine: $reason');
    }
    final engineAction = _engineAction[action] ?? action;
    final channel = _bridgeChannel;
    if (channel == null) {
      throw StateError(
          'GoatWeb3CapabilityPlugin is not attached to a GoatWebViewController bridge channel');
    }
    final res = await channel.invokeMethod<Map>('executeAction', {
      'action': engineAction,
      'payload': payload,
    });
    if (res == null) {
      throw Exception('Empty native response for $action (engine action: $engineAction)');
    }
    final response = GoatBridgeResponse.fromMap(Map<String, dynamic>.from(res));
    if (!response.success) {
      final hint = _androidOnly.contains(engineAction)
          ? ' ($engineAction dispatches on Android only; iOS has no branch for it)'
          : '';
      throw Exception('${response.error ?? 'Native $action execution failed'}$hint');
    }
    if (response.data is Map) {
      return Map<String, dynamic>.from(response.data as Map);
    }
    return null;
  }
}
