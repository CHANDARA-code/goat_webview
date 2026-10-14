import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'goat_bridge_types.dart';
import 'goat_web_view_controller.dart';

typedef GoatWebViewCreatedCallback = void Function(GoatWebViewController controller);

/// Flutter Widget embedding the hardware-accelerated Goat WebView via Android Hybrid Composition and iOS UiKitView.
class GoatWebView extends StatefulWidget {
  final GoatWebViewCreatedCallback? onWebViewCreated;
  final String appId;
  final String? initialUrl;
  final String? assetBundleName;
  final bool algorithmicDarkening;
  final GoatPopupRoutingPolicy popupRoutingPolicy;
  final Set<Factory<OneSequenceGestureRecognizer>>? gestureRecognizers;
  final void Function(Map<String, dynamic> data)? onAppServiceReady;
  final void Function(Map<String, dynamic> data)? onAppServiceCrash;
  final void Function(Map<String, dynamic> data)? onAppServiceTerminate;
  final void Function(GoatPopupRequest request)? onPopupRequest;

  /// JS injected at document-start (before the page's own scripts), main frame only,
  /// after goat's built-in `window.nativeBridge` shim. Empty by default — nothing is
  /// registered natively when this is empty, so there is no cost for the common case.
  /// Used by compatibility adapters to install their bridge shim
  /// (`window.flutter_inappwebview`, `window.ReactNativeWebView`, …).
  final List<String> initialUserScripts;

  /// Off by default. When true, app-deep-link schemes (`tel`/`sms`/`mailto`/`geo` are always
  /// silently resolved regardless of this flag; this additionally covers `tg`/`fb`/`whatsapp`/
  /// `comgooglemaps`, Android `intent://` incl. `browser_fallback_url`, and any host in
  /// [compatExternalLinkHosts]) are resolved directly to an external app/browser instead of the
  /// bundled-mini-app sandbox's user-facing warning dialog. Existing sandbox behavior is
  /// unaffected when this is false. For compatibility-adapter use.
  final bool compatExternalSchemeResolver;

  /// Universal-link hosts (e.g. `t.me`) treated as external navigation when
  /// [compatExternalSchemeResolver] is on. Ignored otherwise.
  final List<String> compatExternalLinkHosts;

  /// Origins this mini-app may load subresources from and reach through `API_REQUEST`.
  ///
  /// Overrides the bundle manifest's `security.allowedDomains`. A packaged mini-app that declares
  /// that field is already filtered without setting this; leaving the list empty keeps the
  /// long-standing unfiltered behaviour rather than silently starting to block requests.
  ///
  /// Required for URL-mode mini-apps ([initialUrl]), which have no bundle and therefore no
  /// manifest to read.
  ///
  /// Entries are host patterns, not URLs: `api.example.com`, or `*.cdn.example.com` to include a
  /// domain and its subdomains.
  final List<String> hostDomainAllowlist;

  /// T8 compat: each fires only when supplied here — the widget tells the native side to
  /// enable exactly the events it was actually given a callback for (G7); omitted callbacks
  /// cost nothing on the native side, not just on the Dart side.
  final void Function(String url, int errorCode, String description)? onReceivedError;
  final void Function(String url, int statusCode)? onReceivedHttpError;
  final void Function(String url)? onPageCommitVisible;
  final void Function(String url)? onLoadResource;
  final void Function(String url, bool isReload)? onUpdateVisitedHistory;
  final void Function(String message, String messageLevel)? onConsoleMessage;

  /// T9 compat: off by default — no `SwipeRefreshLayout`/`UIRefreshControl` exists in the
  /// native view hierarchy at all unless this is true. When true but [onPullToRefresh] is not
  /// supplied, pulling to refresh does a plain native `reload()` with zero Dart round-trip;
  /// supplying the callback opts into a native→Dart notice instead (the caller is then
  /// responsible for calling [GoatWebViewController.setRefreshing] to stop the spinner).
  final bool pullToRefreshEnabled;
  final VoidCallback? onPullToRefresh;
  final bool gcProbe;

  const GoatWebView({
    super.key,
    this.onWebViewCreated,
    this.appId = 'default',
    this.initialUrl,
    this.assetBundleName = 'miniapp.zip',
    this.algorithmicDarkening = true,
    this.popupRoutingPolicy = GoatPopupRoutingPolicy.auto,
    this.gestureRecognizers,
    this.onAppServiceReady,
    this.onAppServiceCrash,
    this.onAppServiceTerminate,
    this.onPopupRequest,
    this.initialUserScripts = const [],
    this.compatExternalSchemeResolver = false,
    this.compatExternalLinkHosts = const ['t.me'],
    this.hostDomainAllowlist = const <String>[],
    this.onReceivedError,
    this.onReceivedHttpError,
    this.onPageCommitVisible,
    this.onLoadResource,
    this.onUpdateVisitedHistory,
    this.onConsoleMessage,
    this.pullToRefreshEnabled = false,
    this.onPullToRefresh,
    this.gcProbe = false,
  });

  @override
  State<GoatWebView> createState() => _GoatWebViewState();
}

/// Debug-only: when a new [GoatWebView] instance for the same `appId` is created
/// shortly after the previous one was disposed, the host is almost certainly
/// recreating the widget (a new [Key], a route push, an `IndexedStack` swap)
/// instead of reusing one long-lived instance. That tears down and rebuilds the
/// native platform view — and its GPU-compositing surface — on every swap; see
/// `bench/goat_vs_fiw/RESULT_v11_android_aot.md` for the measured cost. Using
/// [GoatWebViewController.switchMiniApp] on a single instance avoids all of it.
final Map<String, DateTime> _lastGoatWebViewDisposedAt = <String, DateTime>{};
const Duration _goatWebViewRemountWarnWindow = Duration(seconds: 5);

class _GoatWebViewState extends State<GoatWebView> with WidgetsBindingObserver {
  GoatWebViewController? _controller;
  final List<StreamSubscription> _subscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    if (kDebugMode) {
      final lastDisposed = _lastGoatWebViewDisposedAt[widget.appId];
      if (lastDisposed != null &&
          DateTime.now().difference(lastDisposed) <
              _goatWebViewRemountWarnWindow) {
        debugPrint(
          'GoatWebView: a new instance for appId "${widget.appId}" was created '
          'shortly after the previous one was disposed. Recreating this widget '
          '(a new Key, Navigator.push, an IndexedStack swap, ...) tears down and '
          'rebuilds the native platform view on every swap. Prefer keeping one '
          'long-lived GoatWebView and calling '
          'GoatWebViewController.switchMiniApp(url) to change mini-apps in '
          'place — it reuses the platform view and is dramatically faster.',
        );
      }
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _controller?.onAppShow();
    } else if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.inactive ||
        state == AppLifecycleState.hidden) {
      _controller?.onAppHide();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();
    _creationParamsCache = null;
    _controller?.dispose();
    _controller = null;
    if (kDebugMode) {
      _lastGoatWebViewDisposedAt[widget.appId] = DateTime.now();
    }
    super.dispose();
  }

  void _wireLifecycleListeners(GoatWebViewController controller) {
    if (widget.onAppServiceReady != null) {
      _subscriptions.add(
          controller.onAppServiceReady.listen(widget.onAppServiceReady));
    }
    if (widget.onAppServiceCrash != null) {
      _subscriptions.add(
          controller.onAppServiceCrash.listen(widget.onAppServiceCrash));
    }
    if (widget.onAppServiceTerminate != null) {
      _subscriptions.add(
          controller.onAppServiceTerminate.listen(widget.onAppServiceTerminate));
    }
    if (widget.onPopupRequest != null) {
      _subscriptions
          .add(controller.onPopupRequest.listen(widget.onPopupRequest));
    }
    final onReceivedError = widget.onReceivedError;
    if (onReceivedError != null) {
      _subscriptions.add(controller.onReceivedError.listen((e) => onReceivedError(
          e['url'] as String? ?? '',
          e['errorCode'] as int? ?? -1,
          e['description'] as String? ?? '')));
    }
    final onReceivedHttpError = widget.onReceivedHttpError;
    if (onReceivedHttpError != null) {
      _subscriptions.add(controller.onReceivedHttpError.listen((e) =>
          onReceivedHttpError(
              e['url'] as String? ?? '', e['statusCode'] as int? ?? -1)));
    }
    if (widget.onPageCommitVisible != null) {
      _subscriptions.add(
          controller.onPageCommitVisible.listen(widget.onPageCommitVisible));
    }
    if (widget.onLoadResource != null) {
      _subscriptions
          .add(controller.onLoadResource.listen(widget.onLoadResource));
    }
    final onUpdateVisitedHistory = widget.onUpdateVisitedHistory;
    if (onUpdateVisitedHistory != null) {
      _subscriptions.add(controller.onUpdateVisitedHistory.listen((e) =>
          onUpdateVisitedHistory(
              e['url'] as String? ?? '', e['isReload'] as bool? ?? false)));
    }
    final onConsoleMessage = widget.onConsoleMessage;
    if (onConsoleMessage != null) {
      _subscriptions.add(controller.onConsoleMessage.listen((e) =>
          onConsoleMessage(
              e['message'] as String? ?? '', e['messageLevel'] as String? ?? 'log')));
    }
    if (widget.onPullToRefresh != null) {
      _subscriptions
          .add(controller.onPullToRefresh.listen((_) => widget.onPullToRefresh?.call()));
    }
  }

  void _onPlatformViewCreated(int id) {
    final controller = GoatWebViewController(viewId: id);
    _controller = controller;
    _creationParamsCache = null;
    _wireLifecycleListeners(controller);
    widget.onWebViewCreated?.call(controller);
  }

  /// Built once, on the first build that needs it, and cleared as soon as
  /// [_onPlatformViewCreated] runs.
  ///
  /// Platform-view creation params are read exactly once — when the native view is created
  /// (`onCreatePlatformView` on Android, `UiKitView`'s constructor on iOS). Once the view is
  /// created, keeping this map in memory holds onto strings, lists, and user scripts indefinitely.
  /// Clearing [_creationParamsCache] releases those references, and returning an empty map
  /// when `_controller != null` prevents re-allocations on subsequent build passes.
  Map<String, dynamic>? _creationParamsCache;

  Map<String, dynamic> get _creationParams {
    if (_controller != null) return const <String, dynamic>{};
    return _creationParamsCache ??= buildGoatCreationParams(widget);
  }

  @override
  Widget build(BuildContext context) {
    const String viewType = 'com.goat.webview/platform_view';
    final Map<String, dynamic> creationParams = _creationParams;

    if (defaultTargetPlatform == TargetPlatform.android) {
      return PlatformViewLink(
        viewType: viewType,
        surfaceFactory: (context, controller) {
          return AndroidViewSurface(
            controller: controller as AndroidViewController,
            gestureRecognizers: widget.gestureRecognizers ??
                const <Factory<OneSequenceGestureRecognizer>>{},
            hitTestBehavior: PlatformViewHitTestBehavior.opaque,
          );
        },
        onCreatePlatformView: (params) {
          // Texture Layer Hybrid Composition: the WebView renders into a Flutter-owned
          // texture instead of a SurfaceView embedded in the view hierarchy. A SurfaceView
          // is torn down and rebuilt on every Activity stop/resume (~100 ms of surface
          // recreation + re-composite on a warm start); the texture path just re-samples.
          // This is what webview_flutter and flutter_inappwebview use.
          return PlatformViewsService.initExpensiveAndroidView(
            id: params.id,
            viewType: viewType,
            layoutDirection: TextDirection.ltr,
            creationParams: creationParams,
            creationParamsCodec: const StandardMessageCodec(),
            onFocus: () {
              params.onFocusChanged(true);
            },
          )
            ..addOnPlatformViewCreatedListener(params.onPlatformViewCreated)
            ..addOnPlatformViewCreatedListener(_onPlatformViewCreated)
            ..create();
        },
      );
    }

    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return UiKitView(
        viewType: viewType,
        layoutDirection: TextDirection.ltr,
        creationParams: creationParams,
        creationParamsCodec: const StandardMessageCodec(),
        gestureRecognizers: widget.gestureRecognizers ??
            const <Factory<OneSequenceGestureRecognizer>>{},
        onPlatformViewCreated: _onPlatformViewCreated,
      );
    }

    return Center(
      child: Text(
          '$defaultTargetPlatform is not supported yet by Goat WebView'),
    );
  }
}

/// The platform-view creation params for [widget].
///
/// Extracted from the widget state so it can be tested directly: the state class is private, and a
/// param that never reaches native is indistinguishable from one that is ignored there.
@visibleForTesting
Map<String, dynamic> buildGoatCreationParams(GoatWebView widget) {
  return <String, dynamic>{
      'appId': widget.appId,
      'assetBundleName': widget.assetBundleName,
      'algorithmicDarkening': widget.algorithmicDarkening,
      'popupRoutingPolicy': widget.popupRoutingPolicy.name,
      if (widget.initialUrl != null) 'initialUrl': widget.initialUrl,
      if (widget.initialUserScripts.isNotEmpty)
        'initialUserScripts': widget.initialUserScripts,
      if (widget.compatExternalSchemeResolver) ...{
        'compatExternalSchemeResolver': true,
        'compatExternalLinkHosts': widget.compatExternalLinkHosts,
      },
      if (widget.onReceivedError != null) 'enableOnReceivedError': true,
      if (widget.onReceivedHttpError != null) 'enableOnReceivedHttpError': true,
      if (widget.onPageCommitVisible != null) 'enableOnPageCommitVisible': true,
      if (widget.onLoadResource != null) 'enableOnLoadResource': true,
      if (widget.onUpdateVisitedHistory != null)
        'enableOnUpdateVisitedHistory': true,
      if (widget.onConsoleMessage != null) 'enableOnConsoleMessage': true,
      if (widget.pullToRefreshEnabled) ...{
        'pullToRefreshEnabled': true,
        if (widget.onPullToRefresh != null) 'enableOnPullToRefresh': true,
      },
      if (widget.hostDomainAllowlist.isNotEmpty)
        'hostDomainAllowlist': widget.hostDomainAllowlist.toList(),
      if (widget.gcProbe) 'gcProbe': true,
    };
}
