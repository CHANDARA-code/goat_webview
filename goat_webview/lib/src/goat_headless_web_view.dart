import 'dart:async';
import 'package:flutter/services.dart';
import 'goat_bridge_types.dart';

/// Headless background WebView instance for executing offscreen JavaScript and bridge tasks.
class GoatHeadlessWebView {
  final String appId;
  final String? initialUrl;
  final String? assetBundleName;
  late final String id;
  late final MethodChannel _channel;
  final StreamController<GoatBridgeMessage> _bridgeMessageStream =
      StreamController<GoatBridgeMessage>.broadcast();

  bool _isRunning = false;
  bool _isDisposed = false;

  static const MethodChannel _globalChannel =
      MethodChannel('com.goat.webview/headless_global');

  GoatHeadlessWebView({
    this.appId = 'default',
    this.initialUrl,
    this.assetBundleName = 'miniapp.zip',
    String? customId,
  }) {
    id = customId ?? 'headless_${appId}_${DateTime.now().microsecondsSinceEpoch}';
    _channel = MethodChannel('com.goat.webview/$id');
    _channel.setMethodCallHandler(_handleMethodCall);
  }

  Stream<GoatBridgeMessage> get onBridgeMessage => _bridgeMessageStream.stream;
  bool get isRunning => _isRunning;
  bool get isDisposed => _isDisposed;

  Future<dynamic> _handleMethodCall(MethodCall call) async {
    switch (call.method) {
      case 'onBridgeMessage':
        final map = Map<String, dynamic>.from(call.arguments as Map);
        _bridgeMessageStream.add(GoatBridgeMessage.fromMap(map));
        return null;
      default:
        throw MissingPluginException();
    }
  }

  /// Initializes and runs the headless WebView instance on the host platform.
  Future<void> run() async {
    if (_isDisposed) throw StateError('GoatHeadlessWebView has already been disposed');
    if (_isRunning) return;

    final success = await _globalChannel.invokeMethod<bool>('createHeadless', {
      'id': id,
      'appId': appId,
      'initialUrl': initialUrl,
      'assetBundleName': assetBundleName,
    });
    _isRunning = success ?? true;
  }

  /// Evaluates JavaScript code inside the headless WebView DOM context.
  Future<String?> evaluateJavascript(String script) async {
    if (_isDisposed) throw StateError('GoatHeadlessWebView has already been disposed');
    return await _channel.invokeMethod<String>('evaluateJavascript', {'script': script});
  }

  /// Alias for evaluateJavascript supporting TC-F13-02 naming.
  Future<String?> evaluateScript(String script) => evaluateJavascript(script);

  /// Executes a native bridge action directly against the host platform engine.
  Future<GoatBridgeResponse> executeAction(
    String action, [
    Map<String, dynamic> payload = const {},
  ]) async {
    if (_isDisposed) throw StateError('GoatHeadlessWebView has already been disposed');
    final res = await _channel.invokeMethod<Map>('executeAction', {
      'action': action,
      'payload': payload,
    });
    if (res != null) {
      return GoatBridgeResponse.fromMap(Map<String, dynamic>.from(res));
    }
    return GoatBridgeResponse(id: '', success: false, error: 'Empty response');
  }

  /// Disposes the headless WebView and frees all resources.
  Future<void> dispose() async {
    if (_isDisposed) return;
    _isDisposed = true;
    _isRunning = false;
    try {
      await _channel.invokeMethod<void>('dispose');
    } catch (_) {}
    await _bridgeMessageStream.close();
  }
}
