import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('GoatWebViewController Stream & Disposal Lifecycle Tests (Milestone 3)', () {
    const channelName = 'com.goat.webview/bridge_42';
    final List<MethodCall> log = <MethodCall>[];

    setUp(() {
      log.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(channelName),
        (MethodCall call) async {
          log.add(call);
          return {'success': true};
        },
      );
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), null);
      log.clear();
    });

    test('GoatWebViewController isDisposed starts false and becomes true upon dispose()', () {
      final controller = GoatWebViewController(viewId: 42);
      expect(controller.isDisposed, isFalse);

      controller.dispose();
      expect(controller.isDisposed, isTrue);

      // Subsequent dispose calls are safe and idempotent
      expect(() => controller.dispose(), returnsNormally);
      expect(controller.isDisposed, isTrue);
    });

    test('GoatWebViewController closes all 20 stream controllers on dispose()', () async {
      final controller = GoatWebViewController(viewId: 42);

      // Verify all 20 streams emit done events when disposed
      final streamDones = <String, bool>{
        'bridgeMessage': false,
        'downloadProgress': false,
        'progress': false,
        'pageStarted': false,
        'pageFinished': false,
        'safeArea': false,
        'keyboardInsets': false,
        'miniAppClosed': false,
        'appServiceReady': false,
        'appServiceCrash': false,
        'appServiceTerminate': false,
        'popupRequest': false,
        'externalNavigation': false,
        'receivedError': false,
        'receivedHttpError': false,
        'pageCommitVisible': false,
        'loadResource': false,
        'updateVisitedHistory': false,
        'consoleMessage': false,
        'pullToRefresh': false,
      };

      controller.onBridgeMessage.listen((_) {}, onDone: () => streamDones['bridgeMessage'] = true);
      controller.onDownloadProgress.listen((_) {}, onDone: () => streamDones['downloadProgress'] = true);
      controller.onProgressChanged.listen((_) {}, onDone: () => streamDones['progress'] = true);
      controller.onPageStarted.listen((_) {}, onDone: () => streamDones['pageStarted'] = true);
      controller.onPageFinished.listen((_) {}, onDone: () => streamDones['pageFinished'] = true);
      controller.onSafeAreaChanged.listen((_) {}, onDone: () => streamDones['safeArea'] = true);
      controller.onKeyboardInsetsChanged.listen((_) {}, onDone: () => streamDones['keyboardInsets'] = true);
      controller.onMiniAppClosed.listen((_) {}, onDone: () => streamDones['miniAppClosed'] = true);
      controller.onAppServiceReady.listen((_) {}, onDone: () => streamDones['appServiceReady'] = true);
      controller.onAppServiceCrash.listen((_) {}, onDone: () => streamDones['appServiceCrash'] = true);
      controller.onAppServiceTerminate.listen((_) {}, onDone: () => streamDones['appServiceTerminate'] = true);
      controller.onPopupRequest.listen((_) {}, onDone: () => streamDones['popupRequest'] = true);
      controller.onExternalNavigation.listen((_) {}, onDone: () => streamDones['externalNavigation'] = true);
      controller.onReceivedError.listen((_) {}, onDone: () => streamDones['receivedError'] = true);
      controller.onReceivedHttpError.listen((_) {}, onDone: () => streamDones['receivedHttpError'] = true);
      controller.onPageCommitVisible.listen((_) {}, onDone: () => streamDones['pageCommitVisible'] = true);
      controller.onLoadResource.listen((_) {}, onDone: () => streamDones['loadResource'] = true);
      controller.onUpdateVisitedHistory.listen((_) {}, onDone: () => streamDones['updateVisitedHistory'] = true);
      controller.onConsoleMessage.listen((_) {}, onDone: () => streamDones['consoleMessage'] = true);
      controller.onPullToRefresh.listen((_) {}, onDone: () => streamDones['pullToRefresh'] = true);

      controller.dispose();
      await Future<void>.delayed(Duration.zero);

      for (final entry in streamDones.entries) {
        expect(entry.value, isTrue, reason: 'Stream ${entry.key} was not closed upon dispose()');
      }
    });

    test('Incoming platform events after disposal are silently dropped without StateError', () async {
      final controller = GoatWebViewController(viewId: 42);
      controller.dispose();

      const codec = StandardMethodCodec();

      final calls = [
        const MethodCall('onPopupRequest', {
          'url': 'https://goat.dev/popup',
          'policy': 'auto',
        }),
        const MethodCall('onBridgeMessage', {
          'id': 'msg_99',
          'action': 'STORAGE_GET',
          'payload': {'key': 'k'},
        }),
        const MethodCall('onDownloadProgress', {
          'downloadId': 1,
          'bytesRead': 100,
          'totalBytes': 200,
        }),
        const MethodCall('onProgressChanged', 80),
        const MethodCall('onPageStarted', 'https://goat.dev'),
        const MethodCall('onPageFinished', 'https://goat.dev'),
        const MethodCall('onSafeAreaChanged', {
          'top': 44.0,
          'bottom': 34.0,
          'left': 0.0,
          'right': 0.0,
        }),
        const MethodCall('onKeyboardInsetsChanged', {
          'keyboardHeight': 250,
          'durationMs': 250,
          'isVisible': true,
        }),
        const MethodCall('onMiniAppClosed', {
          'appId': 'app_1',
          'reason': 'user_exit',
        }),
        const MethodCall('onAppServiceReady', {
          'appId': 'app_1',
          'timestamp': 123456,
        }),
        const MethodCall('onAppServiceCrash', {
          'appId': 'app_1',
          'error': 'Fatal',
        }),
        const MethodCall('onAppServiceTerminate', {
          'appId': 'app_1',
        }),
        const MethodCall('onExternalNavigation', 'tel:+15551234567'),
        const MethodCall('onReceivedError', {
          'url': 'https://goat.dev/broken', 'errorCode': -2, 'description': 'net::ERR_FAILED',
        }),
        const MethodCall('onReceivedHttpError', {
          'url': 'https://goat.dev/missing', 'statusCode': 404,
        }),
        const MethodCall('onPageCommitVisible', 'https://goat.dev/visible'),
        const MethodCall('onLoadResource', 'https://goat.dev/a.js'),
        const MethodCall('onUpdateVisitedHistory', {
          'url': 'https://goat.dev/page1', 'isReload': true,
        }),
        const MethodCall('onConsoleMessage', {
          'message': 'hello from JS', 'messageLevel': 'log',
        }),
        const MethodCall('onPullToRefresh', null),
      ];

      for (final call in calls) {
        final ByteData encoded = codec.encodeMethodCall(call);
        expect(
          () async {
            await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
                .handlePlatformMessage(channelName, encoded, (ByteData? reply) {});
          },
          returnsNormally,
        );
      }
    });

    test('Events for never-subscribed streams are dropped, and a later subscriber still works', () async {
      // The stream controllers are created on first subscription rather than eagerly per
      // controller (20 of them per mounted WebView, when a typical mini-app listens to two or
      // three). A broadcast controller with no listener drops events anyway, so skipping the
      // dispatch entirely is observably identical -- this pins that equivalence, and that
      // subscribing afterwards still wires up correctly.
      final controller = GoatWebViewController(viewId: 42);
      const codec = StandardMethodCodec();

      Future<void> send(MethodCall call) async {
        final ByteData encoded = codec.encodeMethodCall(call);
        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(channelName, encoded, (ByteData? reply) {});
      }

      // Nobody has touched onPageFinished yet: this must be a silent no-op, not a StateError.
      await expectLater(
        send(const MethodCall('onPageFinished', 'https://goat.dev/ignored')),
        completes,
      );

      // Subscribing now must still receive subsequent events.
      final received = <String>[];
      controller.onPageFinished.listen(received.add);
      await send(const MethodCall('onPageFinished', 'https://goat.dev/after'));
      await Future<void>.delayed(Duration.zero);

      expect(received, equals(['https://goat.dev/after']),
          reason: 'A subscriber attached after the first event must still receive later ones');

      controller.dispose();
    });

    test('All 20 stream controllers safely dispatch active events when not closed', () async {
      final controller = GoatWebViewController(viewId: 42);
      const codec = StandardMethodCodec();

      final eventsReceived = <String, dynamic>{};

      controller.onPopupRequest.listen((e) => eventsReceived['popupRequest'] = e.url);
      controller.onBridgeMessage.listen((e) => eventsReceived['bridgeMessage'] = e.action);
      controller.onDownloadProgress.listen((e) => eventsReceived['downloadProgress'] = e['downloadId']);
      controller.onProgressChanged.listen((e) => eventsReceived['progress'] = e);
      controller.onPageStarted.listen((e) => eventsReceived['pageStarted'] = e);
      controller.onPageFinished.listen((e) => eventsReceived['pageFinished'] = e);
      controller.onSafeAreaChanged.listen((e) => eventsReceived['safeArea'] = e.top);
      controller.onKeyboardInsetsChanged.listen((e) => eventsReceived['keyboardInsets'] = e.keyboardHeight);
      controller.onMiniAppClosed.listen((e) => eventsReceived['miniAppClosed'] = e['appId']);
      controller.onAppServiceReady.listen((e) => eventsReceived['appServiceReady'] = e['appId']);
      controller.onAppServiceCrash.listen((e) => eventsReceived['appServiceCrash'] = e['appId']);
      controller.onAppServiceTerminate.listen((e) => eventsReceived['appServiceTerminate'] = e['appId']);
      controller.onExternalNavigation.listen((e) => eventsReceived['externalNavigation'] = e);
      controller.onReceivedError.listen((e) => eventsReceived['receivedError'] = e['url']);
      controller.onReceivedHttpError.listen((e) => eventsReceived['receivedHttpError'] = e['statusCode']);
      controller.onPageCommitVisible.listen((e) => eventsReceived['pageCommitVisible'] = e);
      controller.onLoadResource.listen((e) => eventsReceived['loadResource'] = e);
      controller.onUpdateVisitedHistory.listen((e) => eventsReceived['updateVisitedHistory'] = e['isReload']);
      controller.onConsoleMessage.listen((e) => eventsReceived['consoleMessage'] = e['message']);
      controller.onPullToRefresh.listen((_) => eventsReceived['pullToRefresh'] = true);

      final testDispatches = [
        const MethodCall('onPopupRequest', {
          'url': 'https://goat.dev/popup_active',
          'policy': 'auto',
        }),
        const MethodCall('onBridgeMessage', {
          'id': 'msg_active',
          'action': 'PING',
          'payload': {},
        }),
        const MethodCall('onDownloadProgress', {
          'downloadId': 555,
          'bytesRead': 50,
          'totalBytes': 100,
        }),
        const MethodCall('onProgressChanged', 95),
        const MethodCall('onPageStarted', 'https://goat.dev/start'),
        const MethodCall('onPageFinished', 'https://goat.dev/finish'),
        const MethodCall('onSafeAreaChanged', {
          'top': 50.0,
          'bottom': 30.0,
          'left': 0.0,
          'right': 0.0,
        }),
        const MethodCall('onKeyboardInsetsChanged', {
          'keyboardHeight': 320,
          'durationMs': 250,
          'isVisible': true,
        }),
        const MethodCall('onMiniAppClosed', {
          'appId': 'app_active',
        }),
        const MethodCall('onAppServiceReady', {
          'appId': 'app_active',
        }),
        const MethodCall('onAppServiceCrash', {
          'appId': 'app_active',
        }),
        const MethodCall('onAppServiceTerminate', {
          'appId': 'app_active',
        }),
        const MethodCall('onExternalNavigation', 'tel:+15551234567'),
        const MethodCall('onReceivedError', {
          'url': 'https://goat.dev/broken', 'errorCode': -2, 'description': 'net::ERR_FAILED',
        }),
        const MethodCall('onReceivedHttpError', {
          'url': 'https://goat.dev/missing', 'statusCode': 404,
        }),
        const MethodCall('onPageCommitVisible', 'https://goat.dev/visible'),
        const MethodCall('onLoadResource', 'https://goat.dev/a.js'),
        const MethodCall('onUpdateVisitedHistory', {
          'url': 'https://goat.dev/page1', 'isReload': true,
        }),
        const MethodCall('onConsoleMessage', {
          'message': 'hello from JS', 'messageLevel': 'log',
        }),
        const MethodCall('onPullToRefresh', null),
      ];

      for (final call in testDispatches) {
        final ByteData encoded = codec.encodeMethodCall(call);
        await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
            .handlePlatformMessage(channelName, encoded, (ByteData? reply) {});
      }

      await Future<void>.delayed(Duration.zero);

      expect(eventsReceived['popupRequest'], equals('https://goat.dev/popup_active'));
      expect(eventsReceived['bridgeMessage'], equals('PING'));
      expect(eventsReceived['downloadProgress'], equals(555));
      expect(eventsReceived['progress'], equals(95));
      expect(eventsReceived['pageStarted'], equals('https://goat.dev/start'));
      expect(eventsReceived['pageFinished'], equals('https://goat.dev/finish'));
      expect(eventsReceived['safeArea'], equals(50.0));
      expect(eventsReceived['keyboardInsets'], equals(320.0));
      expect(eventsReceived['miniAppClosed'], equals('app_active'));
      expect(eventsReceived['appServiceReady'], equals('app_active'));
      expect(eventsReceived['appServiceCrash'], equals('app_active'));
      expect(eventsReceived['appServiceTerminate'], equals('app_active'));
      expect(eventsReceived['externalNavigation'], equals('tel:+15551234567'));
      expect(eventsReceived['receivedError'], equals('https://goat.dev/broken'));
      expect(eventsReceived['receivedHttpError'], equals(404));
      expect(eventsReceived['pageCommitVisible'], equals('https://goat.dev/visible'));
      expect(eventsReceived['loadResource'], equals('https://goat.dev/a.js'));
      expect(eventsReceived['updateVisitedHistory'], equals(true));
      expect(eventsReceived['consoleMessage'], equals('hello from JS'));
      expect(eventsReceived['pullToRefresh'], equals(true));

      controller.dispose();
    });
  });

  group('GoatWebView Widget Lifecycle & Unmount Teardown Tests', () {
    testWidgets('GoatWebView StatefulWidget mounts and unmounts cleanly with subscription cancellation', (WidgetTester tester) async {
      bool appServiceReadyCalled = false;
      bool popupRequestCalled = false;

      // Pump GoatWebView in widget tree
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: GoatWebView(
              appId: 'lifecycle_app',
              onAppServiceReady: (data) {
                appServiceReadyCalled = true;
              },
              onPopupRequest: (req) {
                popupRequestCalled = true;
              },
            ),
          ),
        ),
      );

      expect(find.byType(GoatWebView), findsOneWidget);

      // Replace widget tree to unmount GoatWebView and trigger State.dispose()
      await tester.pumpWidget(
        const MaterialApp(
          home: Scaffold(
            body: SizedBox.shrink(),
          ),
        ),
      );

      expect(find.byType(GoatWebView), findsNothing);
      expect(appServiceReadyCalled, isFalse);
      expect(popupRequestCalled, isFalse);
    });
  });
}
