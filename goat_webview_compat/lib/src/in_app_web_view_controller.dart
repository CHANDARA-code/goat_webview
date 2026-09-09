import 'dart:async';

import 'package:goat_webview/goat_webview.dart';

import 'url_request.dart';

typedef JavaScriptHandlerCallback = dynamic Function(List<dynamic> args);

/// Façade over [GoatWebViewController]. Per G5, [_handlers] is the ONE bounded
/// registry this class owns; [dispose] clears it and cancels every
/// subscription so a disposed controller's closures return to GC.
class InAppWebViewController {
  InAppWebViewController(this._goat);

  final GoatWebViewController _goat;
  final List<StreamSubscription<dynamic>> _subscriptions = [];
  final Map<String, JavaScriptHandlerCallback> _handlers = {};
  StreamSubscription<GoatBridgeMessage>? _bridgeSub;
  bool _isDisposed = false;

  void _checkNotDisposed() {
    if (_isDisposed) {
      throw StateError('InAppWebViewController used after dispose()');
    }
  }

  void _onBridgeMessage(GoatBridgeMessage msg) {
    if (msg.action != '__COMPAT_CALL__') return;
    final payload = msg.payload;
    final handlerName = payload['handlerName'] as String?;
    final callback = handlerName == null ? null : _handlers[handlerName];
    if (callback == null) return;
    final args = (payload['args'] as List?) ?? const [];
    final requestId = payload['__compatRequestId'];
    final result = callback(args);
    if (requestId != null) {
      final encoded = _encodeForJs(result);
      unawaited(_goat.evaluateJavascript(
          'window.__compatResolve($requestId, $encoded)'));
    }
  }

  String _encodeForJs(Object? value) {
    if (value == null) return 'null';
    if (value is String) return '"${value.replaceAll('"', '\\"')}"';
    if (value is num || value is bool) return value.toString();
    return 'null';
  }

  /// Bounded registry mutation (G5) — one entry per handler name, per
  /// controller. No static/global map anywhere in this package.
  void addJavaScriptHandler({
    required String handlerName,
    required JavaScriptHandlerCallback callback,
  }) {
    _checkNotDisposed();
    if (_bridgeSub == null) {
      final sub = _goat.onBridgeMessage.listen(_onBridgeMessage);
      _bridgeSub = sub;
      _subscriptions.add(sub);
    }
    _handlers[handlerName] = callback;
  }

  void removeJavaScriptHandler({required String handlerName}) {
    _checkNotDisposed();
    _handlers.remove(handlerName);
  }

  Future<String?> evaluateJavascript({required String source}) {
    _checkNotDisposed();
    return _goat.evaluateJavascript(source);
  }

  Future<bool> canGoBack() async {
    _checkNotDisposed();
    final list = await _goat.getCopyBackForwardList();
    final currentIndex = list['currentIndex'] as int? ?? 0;
    return currentIndex > 0;
  }

  Future<void> goBack() async {
    _checkNotDisposed();
    await _goat.goBack();
  }

  Future<bool> canGoForward() {
    _checkNotDisposed();
    return _goat.canGoForward();
  }

  Future<void> goForward() {
    _checkNotDisposed();
    return _goat.goForward();
  }

  Future<void> reload() {
    _checkNotDisposed();
    return _goat.reload();
  }

  Future<String?> getUrl() {
    _checkNotDisposed();
    return _goat.getUrl();
  }

  Future<String?> getTitle() {
    _checkNotDisposed();
    return _goat.getTitle();
  }

  /// The [URLRequest] argument is read once for its URL string and never
  /// stored (G1) — the caller's request object is not retained here.
  Future<bool> loadUrl({required URLRequest urlRequest}) {
    _checkNotDisposed();
    final url = urlRequest.url?.rawValue;
    if (url == null) return Future.value(false);
    return _goat.loadUrl(url);
  }

  /// T9: drives the pull-to-refresh spinner. No-op if `pullToRefreshEnabled` wasn't set on the
  /// widget. Not called directly by consumer code — [PullToRefreshController.attachTo] wires it.
  Future<bool> setRefreshing(bool refreshing) {
    _checkNotDisposed();
    return _goat.setRefreshing(refreshing);
  }

  Future<bool> isRefreshing() {
    _checkNotDisposed();
    return _goat.isRefreshing();
  }

  void dispose() {
    if (_isDisposed) return;
    _isDisposed = true;
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    _bridgeSub = null;
    _handlers.clear();
  }
}
