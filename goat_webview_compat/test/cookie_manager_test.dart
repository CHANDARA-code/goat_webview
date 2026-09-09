import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview_compat/goat_webview_compat.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('T6 — CookieManager (lazy)', () {
    const channelName = 'com.goat.webview/global';
    final List<MethodCall> log = <MethodCall>[];

    setUp(() {
      log.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName),
          (MethodCall call) async {
        log.add(call);
        switch (call.method) {
          case 'removeSessionCookies':
          case 'deleteCookies':
          case 'deleteAllCookies':
            return true;
          default:
            return null;
        }
      });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), null);
    });

    test('instance() returns the same singleton every call', () {
      expect(identical(CookieManager.instance(), CookieManager.instance()),
          isTrue);
    });

    test('no channel call happens until a method is actually invoked (G2)', () {
      CookieManager.instance();
      expect(log, isEmpty);
    });

    test('removeSessionCookies forwards appId and result', () async {
      final result =
          await CookieManager.instance().removeSessionCookies(appId: 'shop');
      expect(result, isTrue);
      expect(log.single.method, 'removeSessionCookies');
      expect(log.single.arguments, {'appId': 'shop'});
    });

    test('removeSessionCookies defaults appId to "default"', () async {
      await CookieManager.instance().removeSessionCookies();
      expect(log.single.arguments, {'appId': 'default'});
    });

    test('deleteCookies forwards url, name and appId', () async {
      final result = await CookieManager.instance().deleteCookies(
        url: 'https://mini.app',
        name: 'session_id',
        appId: 'shop',
      );
      expect(result, isTrue);
      expect(log.single.method, 'deleteCookies');
      expect(log.single.arguments, {
        'url': 'https://mini.app',
        'name': 'session_id',
        'appId': 'shop',
      });
    });

    test('deleteAllCookies forwards appId and result', () async {
      final result =
          await CookieManager.instance().deleteAllCookies(appId: 'shop');
      expect(result, isTrue);
      expect(log.single.method, 'deleteAllCookies');
      expect(log.single.arguments, {'appId': 'shop'});
    });
  });
}
