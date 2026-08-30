import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('GoatWebViewController AppService Lifecycle Tests (Task F9)', () {
    const channelName = 'com.goat.webview/bridge_99';
    late GoatWebViewController controller;
    final List<MethodCall> methodLog = <MethodCall>[];

    setUp(() {
      methodLog.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), (call) async {
        methodLog.add(call);
        if (call.method == 'executeAction') {
          final args = Map<String, dynamic>.from(call.arguments as Map);
          final action = args['action'] as String;
          return {
            'id': 'call_123',
            'success': true,
            'data': {'handled': true, 'action': action},
            'error': null,
          };
        }
        return null;
      });

      controller = GoatWebViewController(viewId: 99);
    });

    tearDown(() {
      controller.dispose();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), null);
    });

    test('receives onAppServiceReady events via platform method call', () async {
      Map<String, dynamic>? receivedData;
      controller.onAppServiceReady.listen((data) {
        receivedData = data;
      });

      // Simulate native platform sending onAppServiceReady
      final ByteData message = const StandardMethodCodec().encodeMethodCall(
        const MethodCall('onAppServiceReady', {
          'appId': 'mini_app_flutter_1',
          'timestamp': 1724725000000,
          'details': {'engine': 'v8_dual_thread'},
        }),
      );

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, message, (ByteData? reply) {});

      expect(receivedData, isNotNull);
      expect(receivedData!['appId'], equals('mini_app_flutter_1'));
      expect(receivedData!['details']['engine'], equals('v8_dual_thread'));
    });

    test('receives onAppServiceCrash events via platform method call', () async {
      Map<String, dynamic>? receivedCrash;
      controller.onAppServiceCrash.listen((data) {
        receivedCrash = data;
      });

      final ByteData message = const StandardMethodCodec().encodeMethodCall(
        const MethodCall('onAppServiceCrash', {
          'appId': 'mini_app_flutter_1',
          'error': 'Uncaught exception in Worker isolate',
        }),
      );

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, message, (ByteData? reply) {});

      expect(receivedCrash, isNotNull);
      expect(receivedCrash!['appId'], equals('mini_app_flutter_1'));
      expect(receivedCrash!['error'], equals('Uncaught exception in Worker isolate'));
    });

    test('receives onAppServiceTerminate events via platform method call', () async {
      Map<String, dynamic>? receivedTerminate;
      controller.onAppServiceTerminate.listen((data) {
        receivedTerminate = data;
      });

      final ByteData message = const StandardMethodCodec().encodeMethodCall(
        const MethodCall('onAppServiceTerminate', {
          'appId': 'mini_app_flutter_1',
        }),
      );

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(channelName, message, (ByteData? reply) {});

      expect(receivedTerminate, isNotNull);
      expect(receivedTerminate!['appId'], equals('mini_app_flutter_1'));
    });

    test('dispatches notifyAppServiceReady, notifyAppServiceCrash, notifyAppServiceTerminate', () async {
      final readyRes = await controller.notifyAppServiceReady(
        appId: 'test_app',
        details: {'ready': true},
      );
      expect(readyRes.success, isTrue);
      expect(methodLog.last.arguments['action'], equals('ON_APP_SERVICE_READY'));

      final crashRes = await controller.notifyAppServiceCrash(
        appId: 'test_app',
        error: 'Simulated failure',
      );
      expect(crashRes.success, isTrue);
      expect(methodLog.last.arguments['action'], equals('ON_APP_SERVICE_CRASH'));

      final termRes = await controller.notifyAppServiceTerminate(appId: 'test_app');
      expect(termRes.success, isTrue);
      expect(methodLog.last.arguments['action'], equals('ON_APP_SERVICE_TERMINATE'));
    });
  });
}
