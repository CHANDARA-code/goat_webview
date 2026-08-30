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

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    final channel = _bridgeChannel;
    if (channel == null) {
      throw StateError(
          'GoatBluetoothCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
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
