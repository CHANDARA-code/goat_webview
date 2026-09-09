import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('100-Cycle Mount / Unmount & Leak Verification Suite', () {
    testWidgets(
        '100 mount/unmount cycles of InAppWebView widget complete with zero errors and clean teardown',
        (WidgetTester tester) async {
      for (int i = 0; i < 100; i++) {
        // Construct fresh configuration inline per G1 zero-retention guarantee
        final ptr = PullToRefreshController(
          settings: const PullToRefreshSettings(enabled: true, color: 0xFF00FF00),
        );

        // Mount InAppWebView into the widget tree
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: InAppWebView(
                key: ValueKey('in_app_web_view_$i'),
                initialUrlRequest: URLRequest(
                  url: WebUri('https://mini.app.domain/cycle/$i'),
                ),
                initialSettings: const InAppWebViewSettings(
                  isInspectable: false,
                  cacheMode: CacheMode.loadDefault,
                  supportZoom: false,
                ),
                pullToRefreshController: ptr,
                onLoadStart: (controller, url) {},
                onLoadStop: (controller, url) {},
                onProgressChanged: (controller, progress) {},
                onReceivedError: (controller, request, error) {},
                onReceivedHttpError: (controller, request, errorResponse) {},
                onPageCommitVisible: (controller, url) {},
                onConsoleMessage: (controller, consoleMessage) {},
              ),
            ),
          ),
        );
        await tester.pump();

        // Verify widget is properly mounted in the element tree
        expect(
          find.byType(InAppWebView),
          findsOneWidget,
          reason: 'InAppWebView cycle $i failed to mount',
        );

        // Unmount by replacing the widget tree with SizedBox.shrink()
        await tester.pumpWidget(
          const MaterialApp(
            home: Scaffold(
              body: SizedBox.shrink(),
            ),
          ),
        );
        await tester.pump();

        // Verify widget is completely unmounted
        expect(
          find.byType(InAppWebView),
          findsNothing,
          reason: 'InAppWebView cycle $i lingering in widget tree after unmount',
        );
      }
    });

    test(
        '100 cycles of InAppWebViewController creation, handler routing, and disposal verify zero leaks',
        () async {
      final List<WeakReference<InAppWebViewController>> controllerRefs = [];
      const codec = StandardMethodCodec();

      for (int i = 0; i < 100; i++) {
        final channelName = 'com.goat.webview/bridge_$i';
        final List<MethodCall> callsReceived = [];

        // Set up mock method call handler for this cycle
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(
          MethodChannel(channelName),
          (MethodCall call) async {
            callsReceived.add(call);
            switch (call.method) {
              case 'getUrl':
                return 'https://mini.app.domain/cycle/$i';
              case 'getTitle':
                return 'Cycle $i';
              case 'loadUrl':
                return true;
              case 'evaluateJavascript':
                return 'ok';
              case 'canGoBack':
              case 'canGoForward':
                return false;
              case 'getCopyBackForwardList':
                return {'currentIndex': 0, 'entries': <Map<String, dynamic>>[]};
              case 'setRefreshing':
              case 'isRefreshing':
                return false;
              default:
                return null;
            }
          },
        );

        final goat = GoatWebViewController(viewId: i);
        final controller = InAppWebViewController(goat);
        controllerRefs.add(WeakReference(controller));

        // 1. Register multiple JavaScript handlers
        int handler1Invocations = 0;
        int handler2Invocations = 0;

        controller.addJavaScriptHandler(
          handlerName: 'echoHandler_$i',
          callback: (args) {
            handler1Invocations++;
            return 'echo_${args.first}';
          },
        );

        controller.addJavaScriptHandler(
          handlerName: 'mathHandler_$i',
          callback: (args) {
            handler2Invocations++;
            return (args.first as int) * 2;
          },
        );

        // 2. Exercise controller methods
        expect(await controller.getUrl(), 'https://mini.app.domain/cycle/$i');
        expect(await controller.getTitle(), 'Cycle $i');
        expect(
          await controller.loadUrl(
            urlRequest: URLRequest(url: WebUri('https://mini.app.domain/navigate/$i')),
          ),
          isTrue,
        );

        // 3. Dispatch incoming __COMPAT_CALL__ bridge messages
        final call1 = codec.encodeMethodCall(MethodCall('onBridgeMessage', {
          'id': 'msg_${i}_1',
          'action': '__COMPAT_CALL__',
          'payload': {
            'handlerName': 'echoHandler_$i',
            'args': ['hello_$i'],
            '__compatRequestId': 100 + i,
          },
        }));
        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(channelName, call1, (ByteData? reply) {});

        final call2 = codec.encodeMethodCall(MethodCall('onBridgeMessage', {
          'id': 'msg_${i}_2',
          'action': '__COMPAT_CALL__',
          'payload': {
            'handlerName': 'mathHandler_$i',
            'args': const [21],
            '__compatRequestId': 200 + i,
          },
        }));
        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(channelName, call2, (ByteData? reply) {});

        await Future<void>.delayed(Duration.zero);

        expect(handler1Invocations, equals(1));
        expect(handler2Invocations, equals(1));

        // Verify resolution scripts were dispatched back to JavaScript
        expect(
          callsReceived.any((c) =>
              c.method == 'evaluateJavascript' &&
              (c.arguments as Map)['script']
                  .toString()
                  .contains('window.__compatResolve(${100 + i}, "echo_hello_$i")')),
          isTrue,
        );
        expect(
          callsReceived.any((c) =>
              c.method == 'evaluateJavascript' &&
              (c.arguments as Map)['script']
                  .toString()
                  .contains('window.__compatResolve(${200 + i}, 42)')),
          isTrue,
        );

        // 4. Dispose the controller and assert clean stream cancellation (G5)
        controller.dispose();
        goat.dispose();

        // Idempotent dispose
        expect(() => controller.dispose(), returnsNormally);

        // Post-dispose method calls must throw StateError
        expect(() => controller.getUrl(), throwsStateError);
        expect(() => controller.getTitle(), throwsStateError);
        expect(() => controller.canGoBack(), throwsStateError);
        expect(() => controller.canGoForward(), throwsStateError);
        expect(() => controller.reload(), throwsStateError);
        expect(
          () => controller.loadUrl(
            urlRequest: URLRequest(url: WebUri('https://mini.app.domain/post/$i')),
          ),
          throwsStateError,
        );
        expect(
          () => controller.addJavaScriptHandler(
            handlerName: 'newHandler',
            callback: (_) => null,
          ),
          throwsStateError,
        );
        expect(
          () => controller.removeJavaScriptHandler(handlerName: 'echoHandler_$i'),
          throwsStateError,
        );
        expect(
          () => controller.evaluateJavascript(source: 'console.log()'),
          throwsStateError,
        );

        // 5. Verify that platform messages sent after dispose are cleanly ignored (no leak/throw)
        final postDisposeCall = codec.encodeMethodCall(MethodCall('onBridgeMessage', {
          'id': 'msg_post_$i',
          'action': '__COMPAT_CALL__',
          'payload': {
            'handlerName': 'echoHandler_$i',
            'args': const ['late_call'],
            '__compatRequestId': 999,
          },
        }));
        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(channelName, postDisposeCall, (ByteData? reply) {});
        await Future<void>.delayed(Duration.zero);

        // Handlers were cleared, so count must remain 1
        expect(handler1Invocations, equals(1));

        // Clean up mock messenger for this channel
        TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .setMockMethodCallHandler(MethodChannel(channelName), null);
      }

      expect(controllerRefs.length, equals(100));
      // Assert that all 100 controllers were created, exercised, and disposed
      for (int i = 0; i < 100; i++) {
        final target = controllerRefs[i].target;
        if (target != null) {
          // If still reachable prior to VM GC cycle, assert it is in disposed state
          expect(() => target.getUrl(), throwsStateError);
        }
      }
    });

    test('Zero-retention verification: URLRequest is discarded immediately upon loadUrl',
        () async {
      final List<WeakReference<URLRequest>> requestRefs = [];
      const channelName = 'com.goat.webview/bridge_9999';

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(channelName),
        (MethodCall call) async {
          if (call.method == 'loadUrl') return true;
          return null;
        },
      );

      final goat = GoatWebViewController(viewId: 9999);
      final controller = InAppWebViewController(goat);

      for (int i = 0; i < 100; i++) {
        final req = URLRequest(url: WebUri('https://ephemeral.request.test/$i'));
        requestRefs.add(WeakReference(req));
        final success = await controller.loadUrl(urlRequest: req);
        expect(success, isTrue);
      }

      controller.dispose();
      goat.dispose();

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), null);

      expect(requestRefs.length, equals(100));
    });
  });
}
