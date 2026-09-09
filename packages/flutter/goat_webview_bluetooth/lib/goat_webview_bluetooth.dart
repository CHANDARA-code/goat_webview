import 'dart:async';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';

/// Modular Bluetooth BLE capability companion plugin for Goat WebView (Task 10202).
///
/// Implements `GoatCapabilityPlugin` SPI to provide Bluetooth discovery, GATT read/write,
/// and peripheral communication without bloating core engine with native Bluetooth stacks.
class GoatBluetoothCapabilityPlugin extends GoatCapabilityPlugin {
  static final GoatBluetoothCapabilityPlugin instance = GoatBluetoothCapabilityPlugin._();
  GoatBluetoothCapabilityPlugin._();

  static MethodChannel? _bridgeChannel;

  /// Registers the Bluetooth capability plugin with the global GoatCapabilityRegistry.
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
  String get namespace => 'bluetooth';

  @override
  Set<String> get supportedActions => {
        'OPEN_BLUETOOTH_ADAPTER',
        'CLOSE_BLUETOOTH_ADAPTER',
        'GET_BLUETOOTH_ADAPTER_STATE',
        'START_BLUETOOTH_DEVICES_DISCOVERY',
        'STOP_BLUETOOTH_DEVICES_DISCOVERY',
        'GET_BLUETOOTH_DEVICES',
        'CREATE_BLE_CONNECTION',
        'CLOSE_BLE_CONNECTION',
        'GET_BLE_DEVICE_SERVICES',
        'GET_BLE_DEVICE_CHARACTERISTICS',
        'READ_BLE_CHARACTERISTIC_VALUE',
        'WRITE_BLE_CHARACTERISTIC_VALUE',
      };


  /// Friendly action names this package has always exposed, mapped onto the action strings the
  /// engine actually dispatches. Before this map existed, 30 of the 43 actions declared across the
  /// Flutter companion packages matched no Kotlin `when` branch and no Swift `case` on either
  /// platform, so calling them failed natively with an opaque error.
  static const Map<String, String> _engineAction = <String, String>{
        'CLOSE_BLE_CONNECTION': 'BLE_DISCONNECT',
        'CLOSE_BLUETOOTH_ADAPTER': 'BLE_CLOSE_ADAPTER',
        'CREATE_BLE_CONNECTION': 'BLE_CONNECT',
        'GET_BLE_DEVICE_CHARACTERISTICS': 'BLE_LIST_SERVICES',
        'GET_BLE_DEVICE_SERVICES': 'BLE_LIST_SERVICES',
        'OPEN_BLUETOOTH_ADAPTER': 'BLE_OPEN_ADAPTER',
        'READ_BLE_CHARACTERISTIC_VALUE': 'BLE_READ_CHARACTERISTIC',
        'START_BLUETOOTH_DEVICES_DISCOVERY': 'BLE_START_SCAN',
        'STOP_BLUETOOTH_DEVICES_DISCOVERY': 'BLE_STOP_SCAN',
        'WRITE_BLE_CHARACTERISTIC_VALUE': 'BLE_WRITE_CHARACTERISTIC',
      };

  /// Declared, but no engine action exists on either platform. Rejected explicitly here — the
  /// same declare-and-reject rule `@goat/adapter-dsl` follows — instead of being sent to the
  /// bridge to fail with a message that does not say why.
  static const Map<String, String> _unbacked = <String, String>{
        'GET_BLUETOOTH_ADAPTER_STATE': 'no engine action; adapter state is implied by BLE_OPEN_ADAPTER',
        'GET_BLUETOOTH_DEVICES': 'no engine action; BLE_START_SCAN returns the discovered devices',
      };

  /// Resolves to an action that only Android dispatches; iOS has no branch for it.
  static const Set<String> _androidOnly = {'BLE_CLOSE_ADAPTER', 'BLE_LIST_SERVICES', 'BLE_OPEN_ADAPTER'};

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
          'GoatBluetoothCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
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
