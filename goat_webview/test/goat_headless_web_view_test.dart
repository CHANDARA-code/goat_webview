import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:goat_webview/goat_webview.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('GoatHeadlessWebView Unit Suite (Milestone 1/3)', () {
    const globalChannel = MethodChannel('com.goat.webview/headless_global');
    late MethodChannel instanceChannel;
    final List<MethodCall> log = <MethodCall>[];
    const String testId = 'headless_tenant_1';

    setUp(() {
      instanceChannel = const MethodChannel('com.goat.webview/$testId');

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(globalChannel, (MethodCall call) async {
        log.add(call);
        if (call.method == 'createHeadless') {
          return true;
        }
        return null;
      });

      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(instanceChannel, (MethodCall call) async {
        log.add(call);
        if (call.method == 'evaluateJavascript') {
          return 'result_${call.arguments['script']}';
        }
        if (call.method == 'executeAction') {
          final action = call.arguments['action'] as String;
          return {
            'id': 'headless_resp_1',
            'success': true,
            'data': {'executedAction': action},
            'error': null,
          };
        }
        if (call.method == 'dispose') {
          return null;
        }
        return null;
      });
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(globalChannel, null);
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(instanceChannel, null);
      log.clear();
    });

    test('GoatHeadlessWebView creates, runs, executes scripts and actions without UI', () async {
      final headless = GoatHeadlessWebView(
        appId: 'tenant_alpha',
        customId: 'headless_tenant_1',
      );

      expect(headless.appId, equals('tenant_alpha'));
      expect(headless.id, equals('headless_tenant_1'));
      expect(headless.isRunning, isFalse);
      expect(headless.isDisposed, isFalse);

      await headless.run();
      expect(headless.isRunning, isTrue);
      expect(log.any((call) => call.method == 'createHeadless'), isTrue);

      final evalRes = await headless.evaluateJavascript('1 + 1');
      expect(evalRes, equals('result_1 + 1'));

      final evalScriptRes = await headless.evaluateScript('console.log()');
      expect(evalScriptRes, equals('result_console.log()'));

      final actionRes = await headless.executeAction('GET_DEVICE_INFO', {'dummy': true});
      expect(actionRes.success, isTrue);
      expect((actionRes.data as Map)['executedAction'], equals('GET_DEVICE_INFO'));

      await headless.dispose();
      expect(headless.isDisposed, isTrue);
      expect(headless.isRunning, isFalse);
    });
  });

  group('GoatWebViewController UI Subsystems & Streams (Milestone 2/3)', () {
    const channelName = 'com.goat.webview/bridge_20';
    final List<MethodCall> log = <MethodCall>[];

    setUp(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
        const MethodChannel(channelName),
        (MethodCall call) async {
          log.add(call);
          if (call.method == 'executeAction') {
            final args = call.arguments as Map;
            final action = args['action'] as String;
            if (action == 'GET_SAFE_AREA_INSETS') {
              return {
                'id': 'resp_insets',
                'success': true,
                'data': {
                  'top': 48.0,
                  'bottom': 34.0,
                  'left': 0.0,
                  'right': 0.0,
                },
                'error': null,
              };
            }
            return {
              'id': 'mock_ui_id',
              'success': true,
              'data': {'handledAction': action},
              'error': null,
            };
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

    test('GoatWebViewController executes Navigation Bar methods', () async {
      final controller = GoatWebViewController(viewId: 20);

      final titleRes = await controller.setNavBarTitle('Title', subtitle: 'Subtitle');
      expect(titleRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_NAV_BAR_TITLE'));
      expect(log.last.arguments['payload']['title'], equals('Title'));
      expect(log.last.arguments['payload']['subtitle'], equals('Subtitle'));

      final colorRes = await controller.setNavBarColor(
        backgroundColor: '#0F172A',
        textColor: '#FFFFFF',
        isDark: true,
      );
      expect(colorRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_NAV_BAR_COLOR'));

      final btnRes = await controller.setNavBarButtons(left: 'BACK', right: ['CLOSE']);
      expect(btnRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_NAV_BAR_BUTTONS'));

      final progRes = await controller.setNavBarProgress(visible: true, progress: 80);
      expect(progRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_NAV_BAR_PROGRESS'));

      controller.dispose();
    });

    test('GoatWebViewController executes Bottom Sheet & Insets methods', () async {
      final controller = GoatWebViewController(viewId: 20);

      final expandRes = await controller.expandBottomSheet(0.9);
      expect(expandRes.success, isTrue);
      expect(log.last.arguments['action'], equals('EXPAND_BOTTOM_SHEET'));
      expect(log.last.arguments['payload']['snapPoint'], equals(0.9));

      final collapseRes = await controller.collapseBottomSheet();
      expect(collapseRes.success, isTrue);
      expect(log.last.arguments['action'], equals('COLLAPSE_BOTTOM_SHEET'));

      final snapRes = await controller.setSheetSnapPoints([0.25, 0.5, 0.9], initialSnap: 0.5);
      expect(snapRes.success, isTrue);
      expect(log.last.arguments['action'], equals('SET_SHEET_SNAP_POINTS'));

      final insets = await controller.getSafeAreaInsets();
      expect(insets.top, equals(48.0));
      expect(insets.bottom, equals(34.0));

      controller.dispose();
    });

    test('GoatWebViewController executes Haptic Feedback waveforms', () async {
      final controller = GoatWebViewController(viewId: 20);

      final impactRes = await controller.impactHaptic('heavy');
      expect(impactRes.success, isTrue);
      expect(log.last.arguments['action'], equals('HAPTIC_FEEDBACK'));
      expect(log.last.arguments['payload']['type'], equals('impact'));
      expect(log.last.arguments['payload']['style'], equals('heavy'));

      final notifRes = await controller.notificationHaptic('warning');
      expect(notifRes.success, isTrue);
      expect(log.last.arguments['payload']['notificationType'], equals('warning'));

      final selectRes = await controller.selectionHaptic();
      expect(selectRes.success, isTrue);
      expect(log.last.arguments['payload']['type'], equals('selection'));

      controller.dispose();
    });
  });
}
