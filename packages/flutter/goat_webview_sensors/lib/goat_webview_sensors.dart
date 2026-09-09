import 'dart:async';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';

/// Modular Hardware Sensors Capability Companion Package for Goat WebView
///
/// Implements the `GoatCapabilityPlugin` SPI so a host links this capability only when it
/// needs it.
///
/// Pairs with the Android `:feature-sensors` module (GoatSensorsPlugin). Every action here is
/// backed by real `android.hardware` registration; STOP_COMPASS landed 2026-09-06.
class GoatSensorsCapabilityPlugin extends GoatCapabilityPlugin {
  static final GoatSensorsCapabilityPlugin instance = GoatSensorsCapabilityPlugin._();
  GoatSensorsCapabilityPlugin._();

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
  String get namespace => 'sensors';

  @override
  Set<String> get supportedActions => {
        'START_ACCELEROMETER',
        'STOP_ACCELEROMETER',
        'GET_LATEST_ACCELEROMETER',
        'START_GYROSCOPE',
        'STOP_GYROSCOPE',
        'GET_LATEST_GYROSCOPE',
        'START_COMPASS',
        'STOP_COMPASS',
        'START_DEVICE_MOTION',
        'STOP_DEVICE_MOTION',
        'GET_LATEST_DEVICE_MOTION',
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
          'GoatSensorsCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
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
