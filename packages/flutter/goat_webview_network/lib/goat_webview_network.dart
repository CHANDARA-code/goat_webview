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


  /// Friendly action names this package has always exposed, mapped onto the action strings the
  /// engine actually dispatches. Before this map existed, 30 of the 43 actions declared across the
  /// Flutter companion packages matched no Kotlin `when` branch and no Swift `case` on either
  /// platform, so calling them failed natively with an opaque error.
  static const Map<String, String> _engineAction = <String, String>{};

  /// Declared, but no engine action exists on either platform. Rejected explicitly here — the
  /// same declare-and-reject rule `@goat/adapter-dsl` follows — instead of being sent to the
  /// bridge to fail with a message that does not say why.
  static const Map<String, String> _unbacked = <String, String>{
        'NETWORK_PING': 'no engine action',
        'ON_NETWORK_STATUS_CHANGE': 'this is a push event, not a callable action',
      };

  /// Resolves to an action that only Android dispatches; iOS has no branch for it.
  static const Set<String> _androidOnly = {};

  /// The engine action a caller-facing name resolves to, for callers that want to check first.
  static String? engineActionFor(String action) => _engineAction[action] ?? action;

  /// Whether [action] is declared by this package but unsupported by the engine.
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
          'GoatNetworkCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
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
