import 'dart:async';
import 'package:flutter/services.dart';
import 'package:goat_webview/goat_webview.dart';

/// Modular Media capability companion plugin for Goat WebView (Task 10202).
///
/// Implements `GoatCapabilityPlugin` SPI to provide image picking, video recording,
/// and audio playback without bloating core engine binary size.
class GoatMediaCapabilityPlugin extends GoatCapabilityPlugin {
  static final GoatMediaCapabilityPlugin instance = GoatMediaCapabilityPlugin._();
  GoatMediaCapabilityPlugin._();

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
  String get namespace => 'media';

  @override
  Set<String> get supportedActions => {
        'CHOOSE_IMAGE',
        'PREVIEW_IMAGE',
        'GET_IMAGE_INFO',
        'SAVE_IMAGE_TO_PHOTOS_ALBUM',
        'CHOOSE_VIDEO',
        'SAVE_VIDEO_TO_PHOTOS_ALBUM',
        'START_RECORD',
        'STOP_RECORD',
        'PLAY_VOICE',
        'PAUSE_VOICE',
        'STOP_VOICE',
      };

  @override
  Future<Map<String, dynamic>?> handleAction(
    String action,
    Map<String, dynamic> payload,
  ) async {
    final channel = _bridgeChannel;
    if (channel == null) {
      throw StateError(
          'GoatMediaCapabilityPlugin is not attached to a GoatWebViewController bridge channel');
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
