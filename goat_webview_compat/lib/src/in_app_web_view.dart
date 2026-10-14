import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';
import 'package:goat_webview/goat_webview.dart';

import 'bootstrap.dart';
import 'console_message.dart';
import 'enums.dart';
import 'in_app_web_view_controller.dart';
import 'pull_to_refresh.dart';
import 'settings.dart';
import 'url_request.dart';
import 'web_resource.dart';
import 'web_uri.dart';

typedef InAppWebViewCreatedCallback = void Function(
    InAppWebViewController controller);

/// Primitives [InAppWebView] currently threads through to the live
/// [GoatWebView] widget. Everything else [_toCreationParams] computes is
/// accepted for drop-in compilation but not yet wired to the engine —
/// pending the remaining native settings work (T5 follow-up), not silently
/// dropped without a trace: see the doc comment on [_toCreationParams].
@visibleForTesting
Map<String, Object?> toCreationParams(
  InAppWebViewSettings? settings,
  URLRequest? initialUrlRequest,
) {
  final s = settings ?? const InAppWebViewSettings();
  return <String, Object?>{
    'initialUrl': initialUrlRequest?.url?.rawValue,
    'userAgentSuffix': s.userAgentSuffix,
    'cacheMode': s.cacheMode.name,
    'transparentBackground': s.transparentBackground,
    'isInspectable': s.isInspectable,
    'allowsBackForwardNavigationGestures':
        s.allowsBackForwardNavigationGestures,
    'useShouldOverrideUrlLoading': s.useShouldOverrideUrlLoading,
    'mediaPlaybackRequiresUserGesture': s.mediaPlaybackRequiresUserGesture,
    'supportZoom': s.supportZoom,
    'contentInsetAdjustment': s.contentInsetAdjustmentBehavior.name,
    'pullToRefreshEnabled': s.pullToRefreshEnabled,
  };
}

/// Thin wrapper over [GoatWebView]. Per G1, neither this widget's [State] nor
/// [InAppWebViewController] may hold a field of type [InAppWebViewSettings]
/// or [URLRequest] — [widget.initialSettings]/[widget.initialUrlRequest] are
/// read fresh in [build] and never copied into a State field.
class InAppWebView extends StatefulWidget {
  const InAppWebView({
    super.key,
    this.initialUrlRequest,
    this.initialSettings,
    this.onWebViewCreated,
    this.onLoadStart,
    this.onLoadStop,
    this.onProgressChanged,
    this.gestureRecognizers,
    this.onReceivedError,
    this.onReceivedHttpError,
    this.onPageCommitVisible,
    this.onConsoleMessage,
    this.pullToRefreshController,
  });

  final URLRequest? initialUrlRequest;
  final InAppWebViewSettings? initialSettings;
  final InAppWebViewCreatedCallback? onWebViewCreated;
  final void Function(InAppWebViewController controller, WebUriCompat? url)?
      onLoadStart;
  final void Function(InAppWebViewController controller, WebUriCompat? url)?
      onLoadStop;
  final void Function(InAppWebViewController controller, int progress)?
      onProgressChanged;
  final Set<Factory<OneSequenceGestureRecognizer>>? gestureRecognizers;

  /// Compat error handling: each is only ever enabled natively when set here (G7).
  /// In compatibility mode, [WebResourceError.type] is always
  /// [WebResourceErrorType.unknown] — Android and iOS use unrelated error-code numbering
  /// with no clean shared mapping; [WebResourceError.description] carries the real,
  /// platform-native message (what a Crashlytics-style consumer actually logs).
  final void Function(InAppWebViewController controller,
      WebResourceRequest request, WebResourceError error)? onReceivedError;
  final void Function(
      InAppWebViewController controller,
      WebResourceRequest request,
      WebResourceResponse errorResponse)? onReceivedHttpError;
  final void Function(InAppWebViewController controller, WebUriCompat? url)?
      onPageCommitVisible;
  final void Function(
      InAppWebViewController controller, ConsoleMessage consoleMessage)?
      onConsoleMessage;

  /// T9 compat: off unless supplied — matches `flutter_inappwebview`'s
  /// `pullToRefreshController` param. When set but its `onRefresh` callback is null,
  /// pulling to refresh does a plain native reload with zero Dart round-trip.
  final PullToRefreshController? pullToRefreshController;

  @override
  State<InAppWebView> createState() => _InAppWebViewState();
}

/// `flutter_inappwebview`'s `WebUri` isn't reachable from this file without a
/// dependency cycle back onto the barrel; the callbacks here only need the
/// raw string, so this file defines its own minimal alias rather than
/// importing the public `WebUri` (which would be a value-type retention risk
/// if a consumer stashed it — the callback args are transient by design).
typedef WebUriCompat = Uri;

ConsoleMessageLevel _parseConsoleLevel(String raw) {
  switch (raw) {
    case 'error':
      return ConsoleMessageLevel.error;
    case 'warning':
    case 'warn':
      return ConsoleMessageLevel.warning;
    case 'debug':
      return ConsoleMessageLevel.debug;
    default:
      return ConsoleMessageLevel.log;
  }
}

class _InAppWebViewState extends State<InAppWebView> {
  InAppWebViewController? _controller;
  final List<StreamSubscription<dynamic>> _subscriptions = [];

  late final void Function(String url, int errorCode, String description)
      _cachedReceivedError = _handleReceivedError;
  late final void Function(String url, int statusCode)
      _cachedReceivedHttpError = _handleReceivedHttpError;
  late final void Function(String url) _cachedPageCommitVisible =
      _handlePageCommitVisible;
  late final void Function(String message, String messageLevel)
      _cachedConsoleMessage = _handleConsoleMessage;
  late final VoidCallback _cachedPullToRefresh = _handlePullToRefresh;

  void _handleReceivedError(String url, int errorCode, String description) {
    final controller = _controller;
    if (controller != null) {
      widget.onReceivedError?.call(
        controller,
        WebResourceRequest(url: WebUri(url)),
        WebResourceError(
          type: WebResourceErrorType.unknown,
          description: description,
        ),
      );
    }
  }

  void _handleReceivedHttpError(String url, int statusCode) {
    final controller = _controller;
    if (controller != null) {
      widget.onReceivedHttpError?.call(
        controller,
        WebResourceRequest(url: WebUri(url)),
        WebResourceResponse(statusCode: statusCode),
      );
    }
  }

  void _handlePageCommitVisible(String url) {
    final controller = _controller;
    if (controller != null) {
      widget.onPageCommitVisible?.call(controller, Uri.tryParse(url));
    }
  }

  void _handleConsoleMessage(String message, String messageLevel) {
    final controller = _controller;
    if (controller != null) {
      widget.onConsoleMessage?.call(
        controller,
        ConsoleMessage(
          message: message,
          messageLevel: _parseConsoleLevel(messageLevel),
        ),
      );
    }
  }

  void _handlePullToRefresh() {
    widget.pullToRefreshController?.onRefresh?.call();
  }

  void _onWebViewCreated(GoatWebViewController goatController) {
    final controller = InAppWebViewController(goatController);
    _controller = controller;
    widget.pullToRefreshController?.attachTo(controller);
    widget.onWebViewCreated?.call(controller);
    if (widget.onLoadStart != null) {
      _subscriptions.add(goatController.onPageStarted.listen((url) {
        widget.onLoadStart?.call(controller, Uri.tryParse(url));
      }));
    }
    if (widget.onLoadStop != null) {
      _subscriptions.add(goatController.onPageFinished.listen((url) {
        widget.onLoadStop?.call(controller, Uri.tryParse(url));
      }));
    }
    if (widget.onProgressChanged != null) {
      _subscriptions.add(goatController.onProgressChanged.listen((progress) {
        widget.onProgressChanged?.call(controller, progress);
      }));
    }
  }

  @override
  Widget build(BuildContext context) {
    return GoatWebView(
      key: widget.key,
      initialUrl: widget.initialUrlRequest?.url?.rawValue,
      initialUserScripts: const [compatBootstrapScript],
      // T7: a compat consumer always wants tel/sms/mailto/geo/tg/fb/whatsapp/comgooglemaps
      // and configured universal-link hosts resolved silently, matching how
      // flutter_inappwebview's default (non-vetoing) shouldOverrideUrlLoading behaves —
      // never the bundled-mini-app sandbox's warning dialog. The opt-in blocking veto
      // (`useShouldOverrideUrlLoading`) is not implemented yet; only the default,
      // non-blocking resolver is wired here.
      compatExternalSchemeResolver: true,
      gestureRecognizers: widget.gestureRecognizers,
      // Passed as real GoatWebView callback params (not wired via a post-creation stream
      // listen) so its own enable-flag computation — which drives the native
      // enableOnX creation params (G7) — sees these as supplied exactly when this widget's
      // caller supplied them, not unconditionally.
      onReceivedError:
          widget.onReceivedError == null ? null : _cachedReceivedError,
      onReceivedHttpError: widget.onReceivedHttpError == null
          ? null
          : _cachedReceivedHttpError,
      onPageCommitVisible: widget.onPageCommitVisible == null
          ? null
          : _cachedPageCommitVisible,
      onConsoleMessage:
          widget.onConsoleMessage == null ? null : _cachedConsoleMessage,
      pullToRefreshEnabled: widget.pullToRefreshController != null,
      onPullToRefresh: widget.pullToRefreshController?.onRefresh == null
          ? null
          : _cachedPullToRefresh,
      onWebViewCreated: _onWebViewCreated,
    );
  }

  @override
  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    _controller?.dispose();
    _controller = null;
    super.dispose();
  }
}
