import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('T2 — toCreationParams (pure mapping, no retention)', () {
    test('maps the <=12 documented primitives from settings + request', () {
      const settings = InAppWebViewSettings(
        userAgentSuffix: 'DgSuperApp',
        cacheMode: CacheMode.loadNoCache,
        transparentBackground: true,
        isInspectable: true,
        allowsBackForwardNavigationGestures: false,
        useShouldOverrideUrlLoading: true,
        mediaPlaybackRequiresUserGesture: false,
        supportZoom: false,
        contentInsetAdjustmentBehavior:
            ScrollViewContentInsetAdjustmentBehavior.always,
        pullToRefreshEnabled: true,
      );
      const request = URLRequest(url: WebUri('https://mini.app/entry'));

      final params = toCreationParams(settings, request);

      expect(params['initialUrl'], 'https://mini.app/entry');
      expect(params['userAgentSuffix'], 'DgSuperApp');
      expect(params['cacheMode'], 'loadNoCache');
      expect(params['transparentBackground'], true);
      expect(params['isInspectable'], true);
      expect(params['allowsBackForwardNavigationGestures'], false);
      expect(params['useShouldOverrideUrlLoading'], true);
      expect(params['mediaPlaybackRequiresUserGesture'], false);
      expect(params['supportZoom'], false);
      expect(params['contentInsetAdjustment'], 'always');
      expect(params['pullToRefreshEnabled'], true);
      expect(params.length, 11);
    });

    test('null settings/request fall back to defaults, never throws', () {
      final params = toCreationParams(null, null);
      expect(params['initialUrl'], isNull);
      expect(params['cacheMode'], 'loadDefault');
    });

    test('is a pure function: same inputs, same (non-identical) output map', () {
      const settings = InAppWebViewSettings(userAgentSuffix: 'x');
      final a = toCreationParams(settings, null);
      final b = toCreationParams(settings, null);
      expect(a, equals(b));
      expect(identical(a, b), isFalse);
    });
  });

  group('T3/T4 — InAppWebViewController facade', () {
    const channelName = 'com.goat.webview/bridge_5';
    final List<MethodCall> log = <MethodCall>[];

    setUp(() {
      log.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName),
          (MethodCall call) async {
        log.add(call);
        switch (call.method) {
          case 'getCopyBackForwardList':
            return {'currentIndex': 2, 'entries': <Map<String, dynamic>>[]};
          case 'canGoForward':
            return true;
          case 'getUrl':
            return 'https://mini.app/current';
          case 'getTitle':
            return 'Mini App';
          case 'loadUrl':
            return true;
          case 'evaluateJavascript':
            return 'ok';
          default:
            return null;
        }
      });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), null);
    });

    test('direct forwards reach the underlying GoatWebViewController', () async {
      final goat = GoatWebViewController(viewId: 5);
      final controller = InAppWebViewController(goat);

      expect(await controller.getUrl(), 'https://mini.app/current');
      expect(await controller.getTitle(), 'Mini App');
      expect(await controller.canGoForward(), true);
      expect(await controller.canGoBack(), true); // currentIndex=2 > 0
      expect(
        await controller.loadUrl(
            urlRequest: const URLRequest(url: WebUri('https://mini.app/b'))),
        true,
      );
      expect(log.map((c) => c.method), contains('loadUrl'));

      controller.dispose();
    });

    test('addJavaScriptHandler routes __COMPAT_CALL__ and resolves via evaluateJavascript',
        () async {
      final goat = GoatWebViewController(viewId: 5);
      final controller = InAppWebViewController(goat);

      List<dynamic>? receivedArgs;
      controller.addJavaScriptHandler(
        handlerName: 'capturePhoto',
        callback: (args) {
          receivedArgs = args;
          return 'photo.png';
        },
      );

      const codec = StandardMethodCodec();
      final call = codec.encodeMethodCall(const MethodCall('onBridgeMessage', {
        'id': 'm1',
        'action': '__COMPAT_CALL__',
        'payload': {
          'handlerName': 'capturePhoto',
          'args': ['front'],
          '__compatRequestId': 42,
        },
      }));
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, call, (ByteData? reply) {});
      await Future<void>.delayed(Duration.zero);

      expect(receivedArgs, ['front']);
      expect(
        log.any((c) =>
            c.method == 'evaluateJavascript' &&
            (c.arguments as Map)['script']
                .toString()
                .contains('__compatResolve(42')),
        isTrue,
      );

      controller.dispose();
    });

    test('G5 — dispose clears the handler registry and cancels subscriptions', () async {
      final goat = GoatWebViewController(viewId: 5);
      final controller = InAppWebViewController(goat);
      controller.addJavaScriptHandler(handlerName: 'h', callback: (_) => null);

      controller.dispose();

      expect(() => controller.getUrl(), throwsStateError);
      expect(() => controller.addJavaScriptHandler(
          handlerName: 'h2', callback: (_) => null), throwsStateError);
    });

    test('unknown handler name is ignored, does not throw', () async {
      final goat = GoatWebViewController(viewId: 5);
      final controller = InAppWebViewController(goat);

      const codec = StandardMethodCodec();
      final call = codec.encodeMethodCall(const MethodCall('onBridgeMessage', {
        'id': 'm2',
        'action': '__COMPAT_CALL__',
        'payload': {'handlerName': 'neverRegistered', 'args': []},
      }));
      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, call, (ByteData? reply) {});
      await Future<void>.delayed(Duration.zero);

      controller.dispose();
    });
  });
}
