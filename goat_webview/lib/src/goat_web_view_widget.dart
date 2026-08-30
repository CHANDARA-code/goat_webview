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
  });

  @override
  State<GoatWebView> createState() => _GoatWebViewState();
}

class _GoatWebViewState extends State<GoatWebView> {
  GoatWebViewController? _controller;
  final List<StreamSubscription> _subscriptions = [];

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
  }

  @override
  Widget build(BuildContext context) {
    const String viewType = 'com.goat.webview/platform_view';
    final Map<String, dynamic> creationParams = {
      'appId': widget.appId,
      'assetBundleName': widget.assetBundleName,
      'algorithmicDarkening': widget.algorithmicDarkening,
      'popupRoutingPolicy': widget.popupRoutingPolicy.name,
      if (widget.initialUrl != null) 'initialUrl': widget.initialUrl,
    };

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
          return PlatformViewsService.initSurfaceAndroidView(
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
            ..addOnPlatformViewCreatedListener((id) {
              final controller = GoatWebViewController(viewId: id);
              _controller = controller;
              _wireLifecycleListeners(controller);
              widget.onWebViewCreated?.call(controller);
            })
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
        onPlatformViewCreated: (id) {
          final controller = GoatWebViewController(viewId: id);
          _controller = controller;
          _wireLifecycleListeners(controller);
          widget.onWebViewCreated?.call(controller);
        },
      );
    }

    return Center(
      child: Text(
          '$defaultTargetPlatform is not supported yet by Goat WebView'),
    );
  }
}
