import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('GoatWebViewController Advanced Unit Suite (Task 10093)', () {
    const channelName = 'com.goat.webview/bridge_10';
    final List<MethodCall> log = <MethodCall>[];

    setUp(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(channelName),
        (MethodCall call) async {
          log.add(call);
          if (call.method == 'executeAction' || call.method == 'callJs') {
            final args = call.arguments as Map;
            final action = args['action'] as String;
            if (action == 'GET_DEVICE_INFO') {
              return {
                'id': args['id'] ?? 'mock_id',
                'success': true,
                'data': {
                  'model': 'Pixel 9 Pro (Simulated Goat)',
                  'manufacturer': 'Google',
                  'brand': 'google',
                  'platform': 'Android',
                  'androidVersion': '15',
                  'sdkInt': 35,
                  'screenWidthDp': 412,
                  'screenHeightDp': 915,
                  'density': 2.625,
                  'batteryLevel': 95,
                  'isCharging': true,
                  'isAlgorithmicDarkening': false,
                  'appVersion': '1.0.0-goat',
                  'installGuid': '550e8400-e29b-41d4-a716-446655440000',
                },
                'error': null,
              };
            }
            return {
              'id': args['id'] ?? 'mock_id',
              'success': true,
              'data': {'handledAction': action},
              'error': null,
            };
          }
          if (call.method == 'setTheme' ||
              call.method == 'prewarm' ||
              call.method == 'goBack' ||
              call.method == 'pause' ||
              call.method == 'resume' ||
              call.method == 'setPopupRoutingPolicy') {
            return true;
          }
          if (call.method == 'evaluateJavascript') {
            return 'eval_result';
          }
          if (call.method == 'reload') {
            return null;
          }
          return null;
        },
      );
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(const MethodChannel(channelName), null);
      log.clear();
    });

    test('GoatWebViewController dispatches navigation and gesture actions', () async {
      final controller = GoatWebViewController(viewId: 10);

      // Page Stack Pop
      final popRes = await controller.navPop();
      expect(popRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('NAV_POP'));

      // Page Stack Pop To Root
      final rootRes = await controller.navPopToRoot();
      expect(rootRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('NAV_POP_TO_ROOT'));

      // Check Subpackage Cache
      final cacheRes = await controller.isSubpackageCached('wallet_module');
      expect(cacheRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('IS_SUBPACKAGE_CACHED'));

      // Parent Intercept Touch
      final touchRes = await controller.shouldParentInterceptTouch(25.0);
      expect(touchRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOULD_PARENT_INTERCEPT'));

      controller.dispose();
    });

    test('GoatWebViewController convenience methods invoke executeAction on MethodChannel (Task 10191 / R4)', () async {
      final controller = GoatWebViewController(viewId: 10);

      // UI Toast
      final toastRes = await controller.showToast(title: 'Operation Successful', icon: 'success', duration: 2000);
      expect(toastRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOW_TOAST'));
      expect(log.last.arguments['payload']['title'], equals('Operation Successful'));
      expect(log.last.arguments['payload']['icon'], equals('success'));
      expect(log.last.arguments['payload']['duration'], equals(2000));

      // UI Modal
      final modalRes = await controller.showModal(
        title: 'Confirm Action',
        content: 'Are you sure you want to proceed?',
        showCancel: true,
        confirmText: 'Yes',
        cancelText: 'No',
      );
      expect(modalRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOW_MODAL'));
      expect(log.last.arguments['payload']['title'], equals('Confirm Action'));
      expect(log.last.arguments['payload']['showCancel'], isTrue);

      // UI ActionSheet
      final sheetRes = await controller.showActionSheet(itemList: ['Option 1', 'Option 2', 'Option 3']);
      expect(sheetRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHOW_ACTION_SHEET'));
      expect(log.last.arguments['payload']['itemList'], equals(['Option 1', 'Option 2', 'Option 3']));

      // Location
      final locRes = await controller.getLocation(type: 'wgs84', highAccuracy: true);
      expect(locRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('GET_LOCATION'));
      expect(log.last.arguments['payload']['type'], equals('wgs84'));
      expect(log.last.arguments['payload']['highAccuracy'], isTrue);

      final chooseLocRes = await controller.chooseLocation();
      expect(chooseLocRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('CHOOSE_LOCATION'));

      final openLocRes = await controller.openLocation(latitude: 37.7749, longitude: -122.4194, name: 'Market St');
      expect(openLocRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('OPEN_LOCATION'));
      expect(log.last.arguments['payload']['latitude'], equals(37.7749));
      expect(log.last.arguments['payload']['longitude'], equals(-122.4194));

      // Screen & Telephony
      final brightRes = await controller.setScreenBrightness(0.85);
      expect(brightRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SET_SCREEN_BRIGHTNESS'));
      expect(log.last.arguments['payload']['value'], equals(0.85));

      final keepRes = await controller.setKeepScreenOn(true);
      expect(keepRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SET_KEEP_SCREEN_ON'));
      expect(log.last.arguments['payload']['keepScreenOn'], isTrue);

      final callRes = await controller.makePhoneCall('+15551234567');
      expect(callRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('MAKE_PHONE_CALL'));
      expect(log.last.arguments['payload']['phoneNumber'], equals('+15551234567'));

      final smsRes = await controller.sendSms('+15551234567', 'Hello from Goat WebView');
      expect(smsRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SEND_SMS'));
      expect(log.last.arguments['payload']['phoneNumber'], equals('+15551234567'));
      expect(log.last.arguments['payload']['body'], equals('Hello from Goat WebView'));

      // Biometrics & Scanner
      final bioCheckRes = await controller.checkBiometricSupport();
      expect(bioCheckRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('CHECK_BIOMETRIC_SUPPORT'));

      final bioAuthRes = await controller.authenticateBiometric(title: 'Unlock Vault', subtitle: 'Touch fingerprint sensor');
      expect(bioAuthRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('BIOMETRIC_AUTH'));
      expect(log.last.arguments['payload']['title'], equals('Unlock Vault'));

      final scanRes = await controller.scanCode(scanType: ['QR_CODE', 'BARCODE']);
      expect(scanRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SCAN_CODE'));
      expect(log.last.arguments['payload']['scanType'], equals(['QR_CODE', 'BARCODE']));

      // Haptic Feedback
      final hapticRes = await controller.impactHaptic('light');
      expect(hapticRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('HAPTIC_FEEDBACK'));
      expect(log.last.arguments['payload']['type'], equals('impact'));
      expect(log.last.arguments['payload']['style'], equals('light'));

      // File upload & Sharing
      final uploadRes = await controller.uploadFile(url: 'https://api.goat.dev/upload', filePath: '/data/user/0/cache/doc.pdf');
      expect(uploadRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('UPLOAD_FILE'));
      expect(log.last.arguments['payload']['url'], equals('https://api.goat.dev/upload'));

      final shareRes = await controller.shareSheet(title: 'Share Article', url: 'https://goat.dev/news');
      expect(shareRes.success, isTrue);
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('SHARE_SHEET'));
      expect(log.last.arguments['payload']['title'], equals('Share Article'));

      controller.dispose();
    });

    test('callJs is strictly reserved for page DOM scripts and dispatches callJs method (Task 10191 / R4)', () async {
      final controller = GoatWebViewController(viewId: 10);

      final jsRes = await controller.callJs('CUSTOM_DOM_EVENT', {'eventData': 42});
      expect(jsRes.success, isTrue);
      expect(log.last.method, equals('callJs'));
      expect(log.last.method, isNot(equals('executeAction')));
      expect(log.last.arguments['action'], equals('CUSTOM_DOM_EVENT'));
      expect(log.last.arguments['payload']['eventData'], equals(42));

      controller.dispose();
    });

    test('Theme, navigation, and engine control methods invoke dedicated MethodChannel methods', () async {
      final controller = GoatWebViewController(viewId: 10);

      // setTheme
      final themeRes = await controller.setTheme(true);
      expect(themeRes, isTrue);
      expect(log.last.method, equals('setTheme'));
      expect(log.last.arguments['isDark'], isTrue);

      // prewarm
      final prewarmRes = await controller.prewarm();
      expect(prewarmRes, isTrue);
      expect(log.last.method, equals('prewarm'));

      // goBack
      final backRes = await controller.goBack();
      expect(backRes, isTrue);
      expect(log.last.method, equals('goBack'));

      // reload
      await controller.reload();
      expect(log.last.method, equals('reload'));

      // pause & resume
      final pauseRes = await controller.pause();
      expect(pauseRes, isTrue);
      expect(log.last.method, equals('pause'));

      final resumeRes = await controller.resume();
      expect(resumeRes, isTrue);
      expect(log.last.method, equals('resume'));

      // evaluateJavascript
      final evalRes = await controller.evaluateJavascript('window.title');
      expect(evalRes, equals('eval_result'));
      expect(log.last.method, equals('evaluateJavascript'));
      expect(log.last.arguments['script'], equals('window.title'));

      controller.dispose();
    });

    test('GoatDeviceInfo model correctly serializes and deserializes device metadata with installGuid (Task 10203 / R3)', () {
      final sampleMap = {
        'model': 'Pixel 9 Pro',
        'manufacturer': 'Google',
        'brand': 'google',
        'platform': 'Android',
        'androidVersion': '15 (VanillaIceCream)',
        'sdkInt': 35,
        'screenWidthDp': 412,
        'screenHeightDp': 915,
        'density': 2.625,
        'batteryLevel': 98,
        'isCharging': true,
        'isAlgorithmicDarkening': true,
        'appVersion': '1.0.0-goat',
        'installGuid': '123e4567-e89b-12d3-a456-426614174000',
      };

      final info = GoatDeviceInfo.fromMap(sampleMap);
      expect(info.model, equals('Pixel 9 Pro'));
      expect(info.manufacturer, equals('Google'));
      expect(info.brand, equals('google'));
      expect(info.platform, equals('Android'));
      expect(info.androidVersion, equals('15 (VanillaIceCream)'));
      expect(info.sdkInt, equals(35));
      expect(info.screenWidthDp, equals(412));
      expect(info.screenHeightDp, equals(915));
      expect(info.density, equals(2.625));
      expect(info.batteryLevel, equals(98));
      expect(info.isCharging, isTrue);
      expect(info.isAlgorithmicDarkening, isTrue);
      expect(info.appVersion, equals('1.0.0-goat'));
      expect(info.installGuid, equals('123e4567-e89b-12d3-a456-426614174000'));

      final serialized = info.toMap();
      expect(serialized['model'], equals('Pixel 9 Pro'));
      expect(serialized['installGuid'], equals('123e4567-e89b-12d3-a456-426614174000'));
      expect(serialized['batteryLevel'], equals(98));
      expect(serialized['isCharging'], isTrue);

      // Fallback keys for iOS / alternative schemas
      final iosMap = {
        'model': 'iPhone 16 Pro',
        'manufacturer': 'Apple',
        'brand': 'Apple',
        'platform': 'iOS',
        'systemVersion': '18.0',
        'installGuid': 'abcdef01-2345-6789-abcd-ef0123456789',
      };
      final iosInfo = GoatDeviceInfo.fromMap(iosMap);
      expect(iosInfo.model, equals('iPhone 16 Pro'));
      expect(iosInfo.platform, equals('iOS'));
      expect(iosInfo.androidVersion, equals('18.0'));
      expect(iosInfo.installGuid, equals('abcdef01-2345-6789-abcd-ef0123456789'));
    });

    test('GoatWebViewController retrieves device info and installGuid via GET_DEVICE_INFO bridge (Task 10203 / R3)', () async {
      final controller = GoatWebViewController(viewId: 10);

      final info = await controller.getDeviceInfo();
      expect(log.last.method, equals('executeAction'));
      expect(log.last.arguments['action'], equals('GET_DEVICE_INFO'));
      expect(info.model, equals('Pixel 9 Pro (Simulated Goat)'));
      expect(info.manufacturer, equals('Google'));
      expect(info.brand, equals('google'));
      expect(info.platform, equals('Android'));
      expect(info.androidVersion, equals('15'));
      expect(info.sdkInt, equals(35));
      expect(info.screenWidthDp, equals(412));
      expect(info.screenHeightDp, equals(915));
      expect(info.density, equals(2.625));
      expect(info.batteryLevel, equals(95));
      expect(info.isCharging, isTrue);
      expect(info.isAlgorithmicDarkening, isFalse);
      expect(info.appVersion, equals('1.0.0-goat'));
      expect(info.installGuid, equals('550e8400-e29b-41d4-a716-446655440000'));

      final guid = await controller.getInstallGuid();
      expect(guid, equals('550e8400-e29b-41d4-a716-446655440000'));

      controller.dispose();
    });

    test('GoatPopupRequest and GoatWindowFeatures serialization and policy parsing (Task 10183 / R1 / R3)', () {
      expect(parseGoatPopupRoutingPolicy('auto'), equals(GoatPopupRoutingPolicy.auto));
      expect(parseGoatPopupRoutingPolicy('SYSTEM_BROWSER'), equals(GoatPopupRoutingPolicy.systemBrowser));
      expect(parseGoatPopupRoutingPolicy('modal'), equals(GoatPopupRoutingPolicy.modal));
      expect(parseGoatPopupRoutingPolicy('SAME_FRAME'), equals(GoatPopupRoutingPolicy.sameFrame));
      expect(parseGoatPopupRoutingPolicy('block'), equals(GoatPopupRoutingPolicy.block));
      expect(parseGoatPopupRoutingPolicy('unknown'), equals(GoatPopupRoutingPolicy.auto));

      final wf = GoatWindowFeatures.fromMap({
        'width': 480,
        'height': 640,
        'left': 50,
        'top': 80,
        'menuBar': false,
        'statusBar': true,
        'toolbars': false,
        'resizable': true,
        'scrollbars': true,
      });
      expect(wf.width, equals(480.0));
      expect(wf.height, equals(640.0));
      expect(wf.x, equals(50.0));
      expect(wf.y, equals(80.0));
      expect(wf.menuBar, isFalse);
      expect(wf.statusBar, isTrue);
      expect(wf.toolbars, isFalse);
      expect(wf.resizable, isTrue);
      expect(wf.scrollbars, isTrue);

      final wfMap = wf.toMap();
      expect(wfMap['width'], equals(480.0));
      expect(wfMap['resizable'], isTrue);

      final req = GoatPopupRequest.fromMap({
        'url': 'https://external-service.com/auth',
        'target': '_blank',
        'policy': 'SYSTEM_BROWSER',
        'isUserGesture': true,
        'isDialog': false,
        'windowFeatures': wfMap,
      });
      expect(req.url, equals('https://external-service.com/auth'));
      expect(req.target, equals('_blank'));
      expect(req.policy, equals(GoatPopupRoutingPolicy.systemBrowser));
      expect(req.isUserGesture, isTrue);
      expect(req.isDialog, isFalse);
      expect(req.windowFeatures?.width, equals(480.0));

      final reqMap = req.toMap();
      expect(reqMap['url'], equals('https://external-service.com/auth'));
      expect(reqMap['policy'], equals('systemBrowser'));
    });

    test('GoatWebViewController dispatches setPopupRoutingPolicy and receives onPopupRequest stream (Task 10183 / R2)', () async {
      final controller = GoatWebViewController(viewId: 10);

      // setPopupRoutingPolicy call
      await controller.setPopupRoutingPolicy(GoatPopupRoutingPolicy.modal);
      expect(log.last.method, equals('setPopupRoutingPolicy'));
      expect(log.last.arguments['policy'], equals('modal'));

      // onPopupRequest stream
      GoatPopupRequest? receivedReq;
      final sub = controller.onPopupRequest.listen((req) {
        receivedReq = req;
      });

      // Simulate incoming platform method call
      final message = const StandardMethodCodec().encodeMethodCall(
        const MethodCall('onPopupRequest', {
          'url': 'https://appassets.androidplatform.net/assets/details.html',
          'target': '_blank',
          'policy': 'modal',
          'isUserGesture': true,
          'isDialog': false,
          'windowFeatures': {
            'width': 400.0,
            'height': 500.0,
            'resizable': true,
          },
        }),
      );

      await TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .handlePlatformMessage(
        channelName,
        message,
        (ByteData? reply) {},
      );

      expect(receivedReq, isNotNull);
      expect(receivedReq!.url, equals('https://appassets.androidplatform.net/assets/details.html'));
      expect(receivedReq!.policy, equals(GoatPopupRoutingPolicy.modal));
      expect(receivedReq!.isUserGesture, isTrue);
      expect(receivedReq!.windowFeatures?.width, equals(400.0));
      expect(receivedReq!.windowFeatures?.height, equals(500.0));

      await sub.cancel();
      controller.dispose();
    });
  });
}

